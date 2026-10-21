//! Carries out tool calls from the user's agent and answers in short, plain text it can relay.

use chrono::{Local, TimeDelta, Utc};
use peeps_core::briefs;
use peeps_core::numbers;
use peeps_core::paths;
use peeps_core::schedule::NewSchedule;
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
        Call::CompleteTodo { id } => {
            let done = app
                .todos()
                .complete(id, Utc::now(), Local::now().date_naive())
                .map_err(|e| e.to_string())?;
            Ok(if done {
                format!("Ticked off to-do {id}.")
            } else {
                format!("There is no open to-do {id}.")
            })
        }
        Call::ScheduleDraft {
            kind,
            topic,
            repeat,
            start,
            time,
        } => {
            let schedule = app
                .schedules()
                .add(
                    &NewSchedule {
                        kind,
                        topic,
                        repeat,
                        start,
                        time,
                    },
                    *Local::now().offset(),
                    Utc::now(),
                    app.device(),
                )
                .map_err(|e| e.to_string())?
                .ok_or("that time has already passed")?;
            Ok(format!(
                "Scheduled. The first draft will be written {}.",
                schedule
                    .next_at
                    .with_timezone(&Local)
                    .format("%A %-d %B at %-I:%M %p")
            ))
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
        Call::ReadBrief { product: id } => {
            let name = product(&id)?.name.clone();
            Ok(briefs::read(&paths::config_file(), &id, &name))
        }
        Call::WriteBrief { product: id, text } => {
            let name = product(&id)?.name.clone();
            briefs::write(&paths::config_file(), &id, &text).map_err(|e| e.to_string())?;
            Ok(format!("Updated {name}'s brief."))
        }
        Call::DraftEmail {
            from,
            to,
            subject,
            body,
            in_reply_to,
        } => {
            let account = match from {
                Some(from) => config
                    .mail
                    .iter()
                    .find(|account| account.address.eq_ignore_ascii_case(&from))
                    .ok_or_else(|| {
                        format!("`{from}` is not one of the user's mail accounts in peeps")
                    })?,
                None => config.mail.first().ok_or(
                    "no mail account is set up in peeps yet; ask the user to add one under Mail",
                )?,
            };
            let email = app
                .mail()
                .draft(
                    &peeps_core::mail::Draft {
                        from: account.address.clone(),
                        to,
                        subject,
                        body,
                        in_reply_to,
                    },
                    Utc::now(),
                )
                .map_err(|e| e.to_string())?;
            app.notify("An email is ready for you", &email.subject);
            Ok(format!(
                "Drafted from {}. It is waiting in peeps for the user to read, edit and send; nothing has been sent.",
                account.address
            ))
        }
        Call::WaitingReplies => {
            let waiting = app
                .mail()
                .awaiting(Utc::now() - TimeDelta::days(crate::state::AWAITING_DAYS))
                .map_err(|e| e.to_string())?;
            if waiting.is_empty() {
                return Ok("Everyone has replied, or nothing was sent from peeps lately.".into());
            }
            Ok(waiting
                .iter()
                .map(|email| {
                    format!(
                        "- {} · \"{}\" · sent {} · Message-ID {}\n",
                        email.to,
                        email.subject,
                        email
                            .sent_at
                            .map(|at| at.with_timezone(&Local).format("%a %-d %b").to_string())
                            .unwrap_or_default(),
                        email.message_id.clone().unwrap_or_default()
                    )
                })
                .collect())
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
        Call::SaveDraft { kind, topic, text } => {
            app.drafts()
                .add(&kind, &topic, &text, Utc::now())
                .map_err(|e| e.to_string())?;
            Ok(format!(
                "Saved “{topic}” in the Write tab for the user to copy."
            ))
        }
        Call::ProductNumbers { product: id } => {
            let name = product(&id)?.name.clone();
            let now = Utc::now();
            let ledger = app.ledger();
            let week = ledger
                .summary(&id, now - TimeDelta::days(7))
                .map_err(|e| e.to_string())?;
            let month = ledger
                .summary(&id, now - TimeDelta::days(30))
                .map_err(|e| e.to_string())?;
            let mut out = format!(
                "{name}\nLast 7 days: {}\nLast 30 days: {}\nLatest:\n",
                numbers::describe(&week),
                numbers::describe(&month)
            );
            let recent = ledger.recent(&id, 10).map_err(|e| e.to_string())?;
            if recent.is_empty() {
                out.push_str("- nothing logged yet\n");
            }
            for entry in recent {
                let amount = entry
                    .amount_cents
                    .map(|cents| {
                        format!(
                            " {}",
                            numbers::money(cents, entry.currency.as_deref().unwrap_or("USD"))
                        )
                    })
                    .unwrap_or_default();
                out.push_str(&format!(
                    "- {} {}{amount} {}\n",
                    entry.at.with_timezone(&Local).format("%a %-d %b"),
                    entry.channel,
                    entry.note
                ));
            }
            Ok(out)
        }
        Call::LogPayment {
            product: id,
            amount,
            currency,
            note,
        } => {
            let name = product(&id)?.name.clone();
            let entry = numbers::manual_payment(&id, &amount, &currency, &note, Utc::now())?;
            app.ledger().add(&entry).map_err(|e| e.to_string())?;
            Ok(format!(
                "Logged {} for {name}.",
                numbers::money(entry.amount_cents.unwrap_or(0), &currency.to_uppercase())
            ))
        }
        Call::LogPost {
            product: id,
            channel,
            note,
        } => {
            let name = product(&id)?.name.clone();
            let entry = numbers::manual_post(&id, &channel, &note, Utc::now())?;
            app.ledger().add(&entry).map_err(|e| e.to_string())?;
            Ok(format!("Logged a {} post for {name}.", entry.channel))
        }
        Call::LogDecision {
            product: id,
            decision,
        } => {
            let name = product(&id)?.name.clone();
            let config_file = paths::config_file();
            let brief = briefs::read(&config_file, &id, &name);
            let updated = briefs::with_decision(&brief, Local::now().date_naive(), &decision);
            briefs::write(&config_file, &id, &updated).map_err(|e| e.to_string())?;
            Ok(format!("Noted in {name}'s brief."))
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
        let team: Vec<String> = snapshot
            .teammates
            .iter()
            .filter(|teammate| teammate.product_id == pet.id)
            .map(|teammate| format!("{} ({})", teammate.name, teammate.title))
            .collect();
        if !team.is_empty() {
            out.push_str(&format!("  - team: {}\n", team.join(", ")));
        }
        if let Some(numbers) = snapshot
            .numbers
            .products
            .iter()
            .find(|numbers| numbers.product_id == pet.id)
        {
            out.push_str(&format!(
                "  - last 7 days: {}\n",
                numbers::describe(&numbers.week)
            ));
        }
        if let Some(permission) = &pet.permission {
            out.push_str(&format!(
                "  - waiting for approval: {}\n",
                permission.summary
            ));
        }
    }
    if !snapshot.mail.accounts.is_empty() {
        out.push_str("\nMail accounts: ");
        let addresses: Vec<_> = snapshot
            .mail
            .accounts
            .iter()
            .map(|a| a.address.as_str())
            .collect();
        out.push_str(&addresses.join(", "));
        out.push_str(&format!(
            "\n{} sent email(s) waiting for a reply, {} draft(s) waiting for the user.\n",
            snapshot.mail.awaiting.len(),
            snapshot.mail.outbox.len()
        ));
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
