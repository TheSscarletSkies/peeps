//! Shows reminders for calendar events and to-dos when their moment arrives.

use std::sync::Arc;
use std::time::Duration;

use chrono::{Local, TimeDelta, Utc};
use peeps_core::reminders;

use crate::state::App;

const TICK: Duration = Duration::from_secs(20);
/// Far enough ahead to cover the longest lead time on offer.
const LOOKAHEAD: TimeDelta = TimeDelta::days(8);
/// After the Mac wakes from sleep, only very recent reminders are worth showing.
const CATCH_UP: TimeDelta = TimeDelta::minutes(10);

pub async fn run(app: Arc<App>) {
    let mut interval = tokio::time::interval(TICK);
    let mut last = Utc::now() - TimeDelta::minutes(1);
    loop {
        interval.tick().await;
        let now = Utc::now();
        let after = last.max(now - CATCH_UP);
        let zone = *Local::now().offset();
        let config = app.config();

        let events = app.events(after - TimeDelta::days(1), now + LOOKAHEAD);
        let mut all = reminders::for_events(&events, &config.calendars, &config.reminders, zone);
        let todos = app.todos().open_items().unwrap_or_default();
        all.extend(reminders::for_todos(
            &todos,
            zone,
            Local::now().date_naive(),
        ));

        let due = reminders::due(&all, after, now);
        for reminder in &due {
            app.notify(&reminder.title, &reminder.body);
            app.nudge(reminder);
        }
        if !due.is_empty() {
            app.publish();
        }
        last = now;
    }
}

/// Once a day, a nudge about whatever setup is left, until there is none.
pub async fn setup_nudge(app: Arc<App>) {
    tokio::time::sleep(Duration::from_secs(20)).await;
    let today = Local::now().date_naive().to_string();
    let stamp = peeps_core::paths::data_dir().join("setup-nudge");
    if std::fs::read_to_string(&stamp).is_ok_and(|day| day.trim() == today) {
        return;
    }
    let snapshot = app.snapshot();
    let left = peeps_core::setup::missing(
        crate::commands::claude_ready(),
        snapshot.knows_you,
        snapshot
            .helper
            .todos
            .iter()
            .filter(|view| view.todo.tags.iter().any(|tag| tag == "nudge"))
            .count(),
    );
    if let Some(text) = peeps_core::setup::nudge(&left) {
        app.notify("A few steps left to set up peeps", &text);
        // Getting to know you happens in chat, so the pet asks for it itself.
        if !snapshot.knows_you {
            app.nudge(&peeps_core::reminders::Reminder {
                key: format!("setup:{today}"),
                title: "Can I get to know you?".to_owned(),
                body: "A few quick questions, so I can help the way you like.".to_owned(),
                at: chrono::Utc::now(),
            });
        }
        let _ = std::fs::write(stamp, today);
    }
}
