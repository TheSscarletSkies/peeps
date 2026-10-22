//! Carries out tool calls from the user's agent and answers in short, plain text it can relay.

use chrono::{Local, TimeDelta, Utc};
use peeps_core::paths;
use peeps_core::tools::{self, Call};
use serde_json::Value;

use crate::state::App;

type Result<T> = std::result::Result<T, String>;

pub async fn call(app: &App, name: &str, args: Value) -> Result<String> {
    let call = tools::parse(name, args)?;
    let text = run(app, call)?;
    app.publish();
    Ok(text)
}

fn run(app: &App, call: Call) -> Result<String> {
    let config = app.config();
    let product = |id: &str| {
        config.product(id).ok_or_else(|| {
            let known: Vec<_> = config.products.iter().map(|p| p.id.as_str()).collect();
            format!("no product `{id}`; products are: {}", known.join(", "))
        })
    };
    match call {
        Call::Overview => Ok(overview(app)),
        Call::ListTodos => Ok(todo_list(app)),
        Call::AddTodo(input) => {
            let todo = app
                .todos()
                .add(&input, Utc::now())
                .map_err(|e| e.to_string())?;
            Ok(format!("Added to-do {}: {}", todo.id, todo.title))
        }
        Call::EditTodo { id, input } => {
            let changed = app.todos().edit(id, &input).map_err(|e| e.to_string())?;
            Ok(if changed {
                format!("Changed to-do {id}.")
            } else {
                format!("There is no open to-do {id}.")
            })
        }
        Call::DeleteTodo { id } => {
            let gone = app.todos().delete(id).map_err(|e| e.to_string())?;
            Ok(if gone {
                format!("Removed to-do {id}.")
            } else {
                format!("There is no to-do {id}.")
            })
        }
        Call::CompleteTodo { id } => {
            let done = app
                .todos()
                .complete_once(
                    id,
                    Utc::now(),
                    Local::now().date_naive(),
                    crate::state::start_of_today(),
                )
                .map_err(|e| e.to_string())?;
            Ok(if done {
                format!("Ticked off to-do {id}.")
            } else {
                format!("There is no open to-do {id}.")
            })
        }
        Call::LeaveNote {
            product: id,
            text,
            when,
        } => {
            let name = product(&id)?.name.clone();
            app.notes()
                .add(&id, &text, when, Utc::now())
                .map_err(|e| e.to_string())?;
            Ok(format!("Left {name} a note."))
        }
        Call::Remember { fact } => {
            let config_file = paths::config_file();
            let updated = peeps_core::profile::remember(
                &peeps_core::profile::read(&config_file),
                Local::now().date_naive(),
                &fact,
            );
            peeps_core::profile::write(&config_file, &updated).map_err(|e| e.to_string())?;
            Ok("Saved to the user's About me page.".into())
        }
    }
}

fn overview(app: &App) -> String {
    let snapshot = app.snapshot();
    let mut out = String::from("Products:\n");
    if snapshot.snapshot.pets.is_empty() {
        out.push_str("- none yet\n");
    }
    for pet in &snapshot.snapshot.pets {
        out.push_str(&format!(
            "- {} (id {}): {:?}, {}",
            pet.name, pet.id, pet.mood, pet.headline
        ));
        if pet.live_sessions > 0 {
            out.push_str(&format!(", {} agent session(s) live", pet.live_sessions));
        }
        out.push('\n');
        for need in &pet.needs {
            out.push_str(&format!("  - needs: {}\n", need.message));
        }
        if let Some(permission) = &pet.permission {
            out.push_str(&format!(
                "  - waiting for approval: {}\n",
                permission.summary
            ));
        }
    }
    out.push_str("\nTo-dos:\n");
    out.push_str(&todo_list(app));
    let now = Utc::now();
    let events = app.events(now, now + TimeDelta::days(2));
    out.push_str("\nNext two days:\n");
    if events.is_empty() {
        out.push_str("- nothing on the calendars\n");
    }
    for event in events.iter().take(10) {
        let start = event.start.with_timezone(&Local);
        out.push_str(&format!(
            "- {} ({}, {})\n",
            event.title,
            event.calendar,
            if event.all_day {
                start.format("%a %-d %b, all day").to_string()
            } else {
                start.format("%a %-d %b %-I:%M %p").to_string()
            }
        ));
    }
    out
}

fn todo_list(app: &App) -> String {
    let todos = app.todos().open_items().unwrap_or_default();
    if todos.is_empty() {
        return "- nothing open\n".to_owned();
    }
    todos
        .iter()
        .map(|todo| {
            let mut line = format!("- [{}] {}", todo.id, todo.title);
            if !todo.tags.is_empty() {
                line.push_str(&format!(" #{}", todo.tags.join(" #")));
            }
            if let Some(due) = todo.due {
                line.push_str(&format!(", due {due}"));
            }
            if let Some(time) = todo.time {
                line.push_str(&format!(" {}", time.format("%H:%M")));
            }
            line.push('\n');
            line
        })
        .collect()
}
