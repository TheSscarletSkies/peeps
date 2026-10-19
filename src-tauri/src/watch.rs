//! Background loop: reads new transcript lines, runs due checks and refreshes token tips.

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, SystemTime};

use chrono::Utc;
use peeps_core::advice::{self, Tip};
use peeps_core::config::Product;
use peeps_core::helper;
use peeps_core::snapshot::CheckRun;
use peeps_core::{calendar, paths, usage};

use crate::secrets::Keychain;
use crate::state::App;

const TICK: Duration = Duration::from_secs(15);
const RESCAN_EVERY_TICKS: u32 = 20;
const HISTORY: Duration = Duration::from_secs(7 * 24 * 3_600);

pub async fn run(app: Arc<App>) {
    let mut interval = tokio::time::interval(TICK);
    let mut tick: u32 = 0;
    loop {
        interval.tick().await;
        let worker = app.clone();
        let rescan = app.take_rescan() || tick % RESCAN_EVERY_TICKS == 0;
        let result = tokio::task::spawn_blocking(move || {
            if rescan {
                discover_transcripts(&worker);
            }
            read_transcripts(&worker);
            run_due_checks(&worker);
            refresh_calendars(&worker, rescan);
            if rescan {
                refresh_tips(&worker);
            }
        })
        .await;
        if let Err(error) = result {
            eprintln!("peeps: background work failed: {error}");
        }
        app.publish();
        tick = tick.wrapping_add(1);
    }
}

fn projects_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".claude")
        .join("projects")
}

/// Finds this week's transcripts so idle products still get token totals and activity times.
fn discover_transcripts(app: &App) {
    let since = SystemTime::now() - HISTORY;
    let Ok(found) = usage::recent_transcripts(&projects_dir(), since) else {
        return;
    };
    for path in found {
        if app.world().transcripts.contains_key(&path) {
            continue;
        }
        let Ok(Some(cwd)) = usage::transcript_cwd(&path) else {
            continue;
        };
        if let Some(product) = app.product_for(Some(&cwd)) {
            app.world().track_transcript(path, &product);
        }
    }
}

fn read_transcripts(app: &App) {
    let mut world = app.world();
    let world = &mut *world;
    for (path, transcript) in world.transcripts.iter_mut() {
        if transcript.refresh().is_err() {
            continue;
        }
        let (Some(product), Some(last)) = (
            world.transcript_products.get(path),
            transcript.entries().last(),
        ) else {
            continue;
        };
        world.sessions.record_activity(product, last.at);
    }
}

/// Calendars are re-read every quarter of an hour, and straight away when the config changes.
const CALENDAR_EVERY: chrono::TimeDelta = chrono::TimeDelta::minutes(15);

fn refresh_calendars(app: &App, rescan: bool) {
    let now = Utc::now();
    let zone = *chrono::Local::now().offset();
    for feed in &app.config().calendars {
        let fetched = app
            .world()
            .feeds
            .get(&feed.name)
            .and_then(|loaded| loaded.fetched);
        if !rescan && fetched.is_some_and(|at| now - at < CALENDAR_EVERY) {
            continue;
        }
        let result = calendar::fetch(&feed.url, &Keychain, now);
        let mut world = app.world();
        let loaded = world.feeds.entry(feed.name.clone()).or_default();
        loaded.fetched = Some(now);
        match result {
            Ok(text) => {
                loaded.events = calendar::parse(&text, zone);
                loaded.error = None;
            }
            // Keep the last good copy so a flaky connection doesn't empty the calendar.
            Err(error) => loaded.error = Some(error),
        }
    }
}

fn run_due_checks(app: &App) {
    let now = Utc::now();
    for product in &app.config().products {
        for check in &product.checks {
            let key = (product.id.clone(), check.id.clone());
            let last_run = app.world().checks.get(&key).map(|run| run.at);
            if !check.is_due(last_run, now) {
                continue;
            }
            let outcome = check.run(&Keychain, now).map_err(|error| error.to_string());
            if let Err(error) = &outcome {
                eprintln!("peeps: check {}/{} failed: {error}", product.id, check.id);
            }
            app.world()
                .checks
                .insert(key, CheckRun { at: now, outcome });
        }
    }
}

fn refresh_tips(app: &App) {
    let mut tips: Vec<Tip> = Vec::new();
    for product in &app.config().products {
        if let Some(tip) = instructions_tip(product) {
            tips.push(tip);
        }
        let world = app.world();
        let entries: Vec<_> = world
            .transcripts
            .iter()
            .filter(|(path, _)| world.transcript_products.get(*path) == Some(&product.id))
            .flat_map(|(_, transcript)| transcript.entries().iter().cloned())
            .collect();
        if let Some(tip) = advice::model_fit(&product.id, &entries) {
            tips.push(tip);
        }
    }
    let mut world = app.world();
    let week = helper::weekly(
        world.transcripts.iter().filter_map(|(path, transcript)| {
            world
                .transcript_products
                .get(path)
                .map(|product| (product.as_str(), transcript.entries()))
        }),
        Utc::now(),
        *chrono::Local::now().offset(),
    );
    world.tips = tips;
    world.week = week;
}

fn instructions_tip(product: &Product) -> Option<Tip> {
    product.paths.iter().find_map(|root| {
        let file = paths::expand_home(root).join("CLAUDE.md");
        let bytes = file_size(&file)?;
        advice::instructions_size(&product.id, bytes)
    })
}

fn file_size(path: &Path) -> Option<u64> {
    std::fs::metadata(path).ok().map(|meta| meta.len())
}
