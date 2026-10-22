//! The helper's own work: chatting through the user's agent.

use std::sync::Arc;
use std::time::Duration;

use chrono::{Local, TimeDelta, Utc};
use peeps_core::chat::{self, Message, Speaker, HELPER};
use peeps_core::intent::{self, Intent};
use peeps_core::todos::{Repeat, TodoInput};
use peeps_core::{agent, focus, paths, quick};

use crate::state::App;

type Result<T> = std::result::Result<T, String>;

/// Sends one message to the helper and waits for the answer, keeping the conversation going.
pub async fn send(app: Arc<App>, text: String) -> Result<Message> {
    let text = text.trim().to_owned();
    if text.is_empty() {
        return Err("say something first".into());
    }
    if let Some(reply) = quick_reminder(&app, &text)? {
        return Ok(reply);
    }
    if let Some(reply) = local_intent(&app, &text)? {
        return Ok(reply);
    }
    if !app.start_chatting() {
        return Err("still answering another message; one moment".into());
    }
    let outcome = turn(&app, &text).await;
    app.finish_chatting();
    let reply = match outcome {
        Ok(reply) => reply,
        // Failures show up in the conversation, where the user is already looking.
        Err(error) if error.contains("can't see where it is") => "I can't find Claude Code on \
            this computer. Install it from claude.com/claude-code (or open a terminal and run \
            `claude` once to finish setting it up), then ask me again."
            .to_owned(),
        Err(error) => format!("I couldn't reach your agent: {error}"),
    };
    let message = app
        .chat()
        .add(HELPER, Speaker::Helper, &reply, Utc::now())
        .map_err(|error| error.to_string());
    app.publish();
    message
}

/// "Remind me to …" is understood here and added straight away, without waking the agent.
fn quick_reminder(app: &App, text: &str) -> Result<Option<Message>> {
    let Some(quick) = quick::parse(text, Local::now().fixed_offset()) else {
        return Ok(None);
    };
    let now = Utc::now();
    app.chat()
        .add(HELPER, Speaker::You, text, now)
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
        .add(HELPER, Speaker::Helper, &reply, Utc::now())
        .map_err(|error| error.to_string())?;
    app.publish();
    Ok(Some(message))
}

/// Everyday list and focus commands, done here without the agent. Words that don't clearly match
/// a to-do go on to the agent, which can ask.
fn local_intent(app: &App, text: &str) -> Result<Option<Message>> {
    let today = Local::now().date_naive();
    let areas = app.config().helper.areas.clone();
    let Some(said) = intent::parse(text, today, &areas) else {
        return Ok(None);
    };
    let now = Utc::now();
    let open = app.todos().open_items().map_err(|e| e.to_string())?;
    let pick = |query: &str| match intent::find(&open, query) {
        intent::Found::One(todo) => Ok(Some(todo.clone())),
        intent::Found::None => Ok(None),
        intent::Found::Several(several) => Err(intent::which_reply(&several)),
    };
    let reply: String = match said {
        Intent::Left => intent::left_reply(&open, today),
        Intent::Add { title, due } => {
            let input = TodoInput {
                title: title.clone(),
                due,
                time: None,
                repeat: Repeat::Never,
                remind_minutes: None,
                until: None,
            };
            let added = app.todos().add(&input, now).map_err(|e| e.to_string())?;
            match due {
                Some(due) => format!("Added “{}” for {}.", added.title, due.format("%A")),
                None => format!("Added “{}” to your list.", added.title),
            }
        }
        Intent::Done { query } => match pick(&query) {
            Ok(Some(todo)) => {
                let fresh = app
                    .todos()
                    .complete_once(todo.id, now, today, crate::state::start_of_today())
                    .map_err(|e| e.to_string())?;
                if fresh {
                    format!("Ticked off “{}”. Nice!", todo.title)
                } else {
                    format!("“{}” is already done today.", todo.title)
                }
            }
            Ok(None) => return Ok(None),
            Err(which) => which,
        },
        Intent::Delete { query } => match pick(&query) {
            Ok(Some(todo)) => {
                app.todos().delete(todo.id).map_err(|e| e.to_string())?;
                format!("Removed “{}”.", todo.title)
            }
            Ok(None) => return Ok(None),
            Err(which) => which,
        },
        Intent::Move { query, due } => match pick(&query) {
            Ok(Some(todo)) => {
                let tags: String = todo.tags.iter().map(|t| format!(" #{t}")).collect();
                let input = TodoInput {
                    title: format!("{}{tags}", todo.title),
                    due: Some(due),
                    time: todo.time,
                    repeat: todo.repeat,
                    remind_minutes: todo.remind_minutes,
                    until: todo.until,
                };
                app.todos()
                    .edit(todo.id, &input)
                    .map_err(|e| e.to_string())?;
                format!("Moved “{}” to {}.", todo.title, due.format("%A %-d %B"))
            }
            Ok(None) => return Ok(None),
            Err(which) => which,
        },
        Intent::Focus { minutes, area } => {
            let session = focus::Session::new(now, minutes, None).in_area(area.clone());
            let minutes = session.focus_minutes;
            *app.focus() = Some(session);
            match area.as_deref() {
                Some("study") => format!("Studying for {minutes} minutes. I'll call a break."),
                Some("work") => format!("Working for {minutes} minutes. I'll call a break."),
                _ => format!("Focusing for {minutes} minutes. I'll call a break."),
            }
        }
        Intent::StopFocus => {
            if app.focus().take().is_some() {
                "Stopped. Nice work.".to_owned()
            } else {
                "There's no session going. Say “study for 25 minutes” to start one.".to_owned()
            }
        }
    };
    app.chat()
        .add(HELPER, Speaker::You, text, now)
        .map_err(|e| e.to_string())?;
    let message = app
        .chat()
        .add(HELPER, Speaker::Helper, &reply, Utc::now())
        .map_err(|e| e.to_string())?;
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

async fn turn(app: &Arc<App>, text: &str) -> Result<String> {
    app.chat()
        .add(HELPER, Speaker::You, text, Utc::now())
        .map_err(|error| error.to_string())?;
    app.publish();

    let config = app.config();
    // The message just added is today's; what counts is the one before it.
    let before = app
        .chat()
        .recent(HELPER, 2)
        .map_err(|error| error.to_string())?
        .first()
        .map(|message| message.at);
    let session = chat::resume_today(
        app.chat()
            .session(HELPER)
            .map_err(|error| error.to_string())?,
        before,
        crate::state::start_of_today(),
    );
    let base = chat::with_agent(
        &config.helper.chat_command,
        // Effort is a setting of the larger models, so picking one keeps Claude's own default.
        config.helper.model.as_deref().or(config
            .helper
            .effort
            .is_none()
            .then_some(chat::QUICK_MODEL)),
        config.helper.effort.as_deref(),
    );
    // Without the hook binary the helper can still talk, just not act.
    let base = match crate::commands::hook_command() {
        Ok(hook) => chat::with_tools(&base, &hook),
        Err(_) => base,
    };
    let about = peeps_core::profile::context(&peeps_core::profile::read(&paths::config_file()));
    let context = format!("{about}\n\n{}", context(app));
    let command = chat::command(&base, session.as_deref(), &context);
    let timeout = Duration::from_secs(config.helper.chat_timeout_seconds);
    let dir = paths::assistant_dir();
    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;

    let prompt = text.to_owned();
    let stdout = tauri::async_runtime::spawn_blocking(move || {
        agent::run_in(&command, &prompt, timeout, Some(&dir))
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error| error.to_string())?;

    let reply = chat::parse_reply(&stdout)?;
    if let Some(session) = &reply.session {
        app.chat()
            .set_session(HELPER, session)
            .map_err(|error| error.to_string())?;
    }
    Ok(reply.text)
}

/// Today's to-dos, events and products, so the agent can answer "what's on today?".
fn context(app: &App) -> String {
    let config = app.config();
    let now = Utc::now();
    let zone = *Local::now().offset();
    // Only what's due by tomorrow; the agent can list everything with its tools when asked.
    let soon = Local::now().date_naive() + chrono::Days::new(1);
    let todos: Vec<String> = app
        .todos()
        .open_items()
        .unwrap_or_default()
        .into_iter()
        .filter(|todo| !todo.tags.iter().any(|tag| tag == "nudge"))
        .filter(|todo| todo.due.is_some_and(|due| due <= soon))
        .take(10)
        .map(|todo| match todo.due {
            Some(due) => format!("{} (due {due})", todo.title),
            None => todo.title,
        })
        .collect();
    let events: Vec<String> = app
        .events(now, now + TimeDelta::days(1))
        .into_iter()
        .take(5)
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
