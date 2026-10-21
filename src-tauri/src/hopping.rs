//! "One thing at a time": when switched on, watches which app is in front and nudges after a lot of hopping.

use std::sync::Arc;
use std::time::Duration;

use chrono::Utc;
use peeps_core::hopping::Hops;
use peeps_core::reminders::Reminder;

use crate::state::App;

const TICK: Duration = Duration::from_secs(3);

pub async fn run(app: Arc<App>) {
    let mut interval = tokio::time::interval(TICK);
    let mut hops = Hops::default();
    loop {
        interval.tick().await;
        if !app.one_thing() {
            hops = Hops::default();
            continue;
        }
        // Clicking peeps itself to answer a nudge isn't hopping.
        let Some(front) =
            crate::frontmost::app().filter(|name| !name.eq_ignore_ascii_case("peeps"))
        else {
            continue;
        };
        let now = Utc::now();
        if let Some(said) = hops.observe(now, &front) {
            app.notify(&said.title, &said.body);
            app.nudge(&Reminder {
                key: format!("hops:{}", now.timestamp()),
                title: said.title,
                body: said.body,
                at: now,
            });
        }
    }
}
