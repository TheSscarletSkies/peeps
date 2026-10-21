//! Keeps time for a focus session and has the pet say when a break starts and ends.

use std::sync::Arc;
use std::time::Duration;

use chrono::Utc;
use peeps_core::focus::{Phase, Turn};
use peeps_core::reminders::Reminder;

use crate::state::App;

const TICK: Duration = Duration::from_secs(2);

pub async fn run(app: Arc<App>) {
    let mut interval = tokio::time::interval(TICK);
    let mut last = Utc::now();
    loop {
        interval.tick().await;
        let now = Utc::now();
        let session = app.focus().clone();
        if let Some(session) = session {
            if let Some(turn) = session.turn(last, now) {
                let (title, body) = session.line(turn);
                app.notify(&title, &body);
                app.nudge(&Reminder {
                    key: format!("focus:{}:{turn:?}", session.started_at.timestamp()),
                    title,
                    body,
                    at: now,
                });
                if turn == Turn::BreakEnds || session.phase(now) == Phase::Over {
                    *app.focus() = None;
                }
                app.publish();
            }
        }
        last = now;
    }
}
