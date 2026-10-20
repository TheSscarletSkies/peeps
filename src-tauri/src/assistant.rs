//! The helper's own work: chatting through the user's agent and writing drafts, now or on a schedule.

use std::sync::Arc;
use std::time::Duration;

use chrono::{Local, TimeDelta, Utc};
use peeps_core::chat::{self, Message, Speaker};
use peeps_core::drafts::{self, Draft};
use peeps_core::{briefs, paths, quick};

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
    let command = chat::with_agent(
        &helper.command,
        helper.model.as_deref(),
        helper.effort.as_deref(),
    );
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

/// Sends one message to the helper, or to a product's pet when `scope` is a product id, and waits
/// for the answer, keeping that conversation going.
pub async fn send(app: Arc<App>, scope: String, text: String) -> Result<Message> {
    let text = text.trim().to_owned();
    if text.is_empty() {
        return Err("say something first".into());
    }
    if scope != chat::HELPER && app.config().product(&scope).is_none() {
        return Err(format!("unknown product `{scope}`"));
    }
    if let Some(reply) = quick_reminder(&app, &scope, &text)? {
        return Ok(reply);
    }
    if !app.start_chatting(&scope) {
        return Err("still answering another message; one moment".into());
    }
    let outcome = turn(&app, &scope, &text).await;
    app.finish_chatting();
    let reply = match outcome {
        Ok(reply) => reply,
        // Failures show up in the conversation, where the user is already looking.
        Err(error) => format!("I couldn't reach your agent: {error}"),
    };
    let message = app
        .chat()
        .add(&scope, Speaker::Helper, &reply, Utc::now())
        .map_err(|error| error.to_string());
    app.publish();
    message
}

/// "Remind me to …" is understood here and added straight away, without waking the agent.
fn quick_reminder(app: &App, scope: &str, text: &str) -> Result<Option<Message>> {
    let Some(quick) = quick::parse(text, Local::now().fixed_offset()) else {
        return Ok(None);
    };
    let now = Utc::now();
    app.chat()
        .add(scope, Speaker::You, text, now)
        .map_err(|error| error.to_string())?;
    app.todos()
        .add(&quick.input, now)
        .map_err(|error| error.to_string())?;
    let task = lowercase_first(&quick.input.title);
    let reply = if quick.input.remind_minutes.is_some() {
        format!("Got it. I'll remind you to {task} {}.", quick.summary)
    } else {
        format!("Added “{}” to your list.", quick.input.title)
    };
    let message = app
        .chat()
        .add(scope, Speaker::Helper, &reply, Utc::now())
        .map_err(|error| error.to_string())?;
    app.publish();
    Ok(Some(message))
}

fn lowercase_first(text: &str) -> String {
    let mut chars = text.chars();
    match chars.next() {
        Some(first) => first.to_lowercase().chain(chars).collect(),
        None => String::new(),
    }
}

async fn turn(app: &Arc<App>, scope: &str, text: &str) -> Result<String> {
    app.chat()
        .add(scope, Speaker::You, text, Utc::now())
        .map_err(|error| error.to_string())?;
    app.publish();

    let config = app.config();
    let session = app
        .chat()
        .session(scope)
        .map_err(|error| error.to_string())?;
    let base = chat::with_agent(
        &config.helper.chat_command,
        config.helper.model.as_deref(),
        config.helper.effort.as_deref(),
    );
    // Without the hook binary the helper can still talk, just not act.
    let base = match crate::commands::hook_command() {
        Ok(hook) => chat::with_tools(&base, &hook),
        Err(_) => base,
    };
    let (context, dirs) = match config.product(scope) {
        Some(product) => (
            product_context(app, &product.id, &product.name),
            product
                .paths
                .iter()
                .map(|path| paths::expand_home(path))
                .filter(|path| path.is_dir())
                .map(|path| path.display().to_string())
                .collect(),
        ),
        None => (context(app), Vec::new()),
    };
    let command = chat::with_dirs(&chat::command(&base, session.as_deref(), &context), &dirs);
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
            .set_session(scope, session)
            .map_err(|error| error.to_string())?;
    }
    Ok(reply.text)
}

/// A product's brief and live status, so its pet can advise on it.
fn product_context(app: &App, id: &str, name: &str) -> String {
    let snapshot = app.snapshot();
    let status = snapshot
        .snapshot
        .pets
        .iter()
        .find(|pet| pet.id == id)
        .map(|pet| {
            let mut lines = vec![format!("{:?}: {}", pet.mood, pet.headline)];
            lines.extend(
                pet.needs
                    .iter()
                    .map(|need| format!("Needs: {}", need.message)),
            );
            lines.join("\n")
        })
        .unwrap_or_else(|| "No news.".to_owned());
    let numbers = app
        .ledger()
        .summary(id, Utc::now() - TimeDelta::days(7))
        .map(|week| format!("\nLast 7 days: {}", peeps_core::numbers::describe(&week)))
        .unwrap_or_default();
    let status = status + &numbers;
    let brief = briefs::read(&paths::config_file(), id, name);
    chat::product_context(
        name,
        id,
        &Local::now().format("%A %-d %B %Y").to_string(),
        &status,
        &brief,
    )
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

/// Runs a product's weekly review in its conversation and lets the user know it is ready.
async fn review(app: &Arc<App>, product_id: &str) {
    let Some(name) = app.config().product(product_id).map(|p| p.name.clone()) else {
        return;
    };
    match send(
        app.clone(),
        product_id.to_owned(),
        chat::review_prompt(product_id),
    )
    .await
    {
        Ok(_) => app.notify(
            &format!("{name}'s weekly review is ready"),
            "Three moves for this week are on your list.",
        ),
        Err(error) => app.notify(&format!("Couldn't run {name}'s weekly review"), &error),
    }
}

/// Writes scheduled drafts when they come due and lets the user know.
pub async fn run_schedules(app: Arc<App>) {
    let mut interval = tokio::time::interval(SCHEDULE_TICK);
    loop {
        interval.tick().await;
        let now = Utc::now();
        let due = app.schedules().due(now, app.device()).unwrap_or_default();
        for schedule in due {
            let zone = *Local::now().offset();
            // Move on first, so a failing agent can't make the same schedule fire every tick.
            if let Err(error) = app.schedules().advance(schedule.id, zone, now) {
                eprintln!("peeps: could not move schedule {}: {error}", schedule.id);
                continue;
            }
            if schedule.kind == drafts::REVIEW {
                review(&app, &schedule.topic).await;
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
