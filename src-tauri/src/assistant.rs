//! The helper's own work: chatting through the user's agent and writing drafts, now or on a schedule.

use std::sync::Arc;
use std::time::Duration;

use chrono::{Local, TimeDelta, Utc};
use peeps_core::chat::{self, Message, Speaker};
use peeps_core::drafts::{self, Draft};
use peeps_core::paths;

use crate::state::App;

type Result<T> = std::result::Result<T, String>;

const SCHEDULE_TICK: Duration = Duration::from_secs(30);

/// Writes a draft with the configured agent and keeps it.
pub async fn draft(app: Arc<App>, kind: String, topic: String) -> Result<Draft> {
    if topic.trim().is_empty() {
        return Err("tell the helper what to write about".into());
    }
    if !app.start_drafting() {
        return Err("the helper is already writing a draft".into());
    }
    app.publish();

    let config = app.config();
    let helper = &config.helper;
    let voice = helper
        .voices
        .get(&kind)
        .filter(|path| !path.is_empty())
        .map(|path| std::fs::read_to_string(paths::expand_home(path)))
        .transpose()
        .map_err(|error| format!("could not read the voice guide: {error}"));
    let command = helper.command.clone();
    let timeout = Duration::from_secs(helper.timeout_seconds);

    let result = match voice {
        Ok(voice) => {
            let prompt = drafts::prompt(&kind, &topic, voice.as_deref());
            tauri::async_runtime::spawn_blocking(move || drafts::run(&command, &prompt, timeout))
                .await
                .map_err(|error| error.to_string())
                .and_then(|outcome| outcome.map_err(|error| error.to_string()))
        }
        Err(error) => Err(error),
    };

    let saved = result.and_then(|text| {
        app.drafts()
            .add(&kind, &topic, &text, Utc::now())
            .map_err(|error| error.to_string())
    });
    app.finish_drafting();
    app.publish();
    saved
}

/// Sends one message to the helper and waits for its answer, keeping the conversation going.
pub async fn send(app: Arc<App>, text: String) -> Result<Message> {
    let text = text.trim().to_owned();
    if text.is_empty() {
        return Err("say something first".into());
    }
    if !app.start_chatting() {
        return Err("the helper is still answering".into());
    }
    let outcome = turn(&app, &text).await;
    app.finish_chatting();
    let reply = match outcome {
        Ok(reply) => reply,
        // Failures show up in the conversation, where the user is already looking.
        Err(error) => format!("I couldn't reach your agent: {error}"),
    };
    let message = app
        .chat()
        .add(Speaker::Helper, &reply, Utc::now())
        .map_err(|error| error.to_string());
    app.publish();
    message
}

async fn turn(app: &Arc<App>, text: &str) -> Result<String> {
    app.chat()
        .add(Speaker::You, text, Utc::now())
        .map_err(|error| error.to_string())?;
    app.publish();

    let config = app.config();
    let session = app.chat().session().map_err(|error| error.to_string())?;
    let command = chat::command(
        &config.helper.chat_command,
        session.as_deref(),
        &context(app),
    );
    let timeout = Duration::from_secs(config.helper.chat_timeout_seconds);
    let dir = paths::assistant_dir();
    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;

    let prompt = text.to_owned();
    let stdout = tauri::async_runtime::spawn_blocking(move || {
        drafts::run_in(&command, &prompt, timeout, Some(&dir))
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error| error.to_string())?;

    let reply = chat::parse_reply(&stdout)?;
    if let Some(session) = &reply.session {
        app.chat()
            .set_session(session)
            .map_err(|error| error.to_string())?;
    }
    Ok(reply.text)
}

/// Today's to-dos, events and products, so the agent can answer "what's on today?".
fn context(app: &App) -> String {
    let config = app.config();
    let now = Utc::now();
    let zone = *Local::now().offset();
    let todos: Vec<String> = app
        .todos()
        .open_items()
        .unwrap_or_default()
        .into_iter()
        .take(20)
        .map(|todo| match todo.due {
            Some(due) => format!("{} (due {due})", todo.title),
            None => todo.title,
        })
        .collect();
    let events: Vec<String> = app
        .events(now, now + TimeDelta::days(2))
        .into_iter()
        .take(10)
        .map(|event| {
            let start = event.start.with_timezone(&zone);
            if event.all_day {
                format!("{} ({}, all day)", event.title, start.format("%a %-d %b"))
            } else {
                format!("{} ({})", event.title, start.format("%a %-d %b, %-I:%M %p"))
            }
        })
        .collect();
    let products: Vec<String> = config
        .products
        .iter()
        .map(|product| product.name.clone())
        .collect();
    chat::context(
        &config.helper.name,
        &Local::now().format("%A %-d %B %Y, %-I:%M %p").to_string(),
        &todos,
        &events,
        &products,
    )
}

/// Writes scheduled drafts when they come due and lets the user know.
pub async fn run_schedules(app: Arc<App>) {
    let mut interval = tokio::time::interval(SCHEDULE_TICK);
    loop {
        interval.tick().await;
        let now = Utc::now();
        let due = app.schedules().due(now).unwrap_or_default();
        for schedule in due {
            let zone = *Local::now().offset();
            // Move on first, so a failing agent can't make the same schedule fire every tick.
            if let Err(error) = app.schedules().advance(schedule.id, zone, now) {
                eprintln!("peeps: could not move schedule {}: {error}", schedule.id);
                continue;
            }
            let label = drafts::label(&schedule.kind);
            match draft(app.clone(), schedule.kind.clone(), schedule.topic.clone()).await {
                Ok(_) => app.notify(&format!("Your {label} is ready"), &schedule.topic),
                Err(error) => app.notify(&format!("Couldn't write your {label}"), &error),
            }
        }
        app.publish();
    }
}
