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
        all.extend(reminders::for_todos(&todos, zone));

        let due = reminders::due(&all, after, now);
        for reminder in &due {
            app.notify(&reminder.title, &reminder.body);
        }
        if !due.is_empty() {
            app.publish();
        }
        last = now;
    }
}
