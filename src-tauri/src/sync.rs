//! Writes this computer's to-dos and schedules to the sync folder and takes in the other computers'.

use std::sync::Arc;
use std::time::{Duration, SystemTime};

use chrono::Utc;
use peeps_core::paths;
use peeps_core::sync::{DeviceFile, Layout, Local};

use crate::state::{App, Computer};

const TICK: Duration = Duration::from_secs(5);
/// Even with nothing changed here, look for other computers' changes this often.
const EVERY: Duration = Duration::from_secs(60);

pub async fn run(app: Arc<App>) {
    let mut interval = tokio::time::interval(TICK);
    let mut last_full = SystemTime::UNIX_EPOCH;
    let mut config_seen: Option<SystemTime> = None;
    loop {
        interval.tick().await;
        let changed_here = app.take_unsynced();
        let due = last_full.elapsed().unwrap_or(EVERY) >= EVERY;
        if !changed_here && !due {
            continue;
        }
        last_full = SystemTime::now();
        let worker = app.clone();
        let seen = config_seen;
        let outcome = tokio::task::spawn_blocking(move || once(&worker, seen)).await;
        match outcome {
            Ok(Ok((changed, modified))) => {
                if modified != config_seen && config_seen.is_some() {
                    // Another computer edited the shared settings.
                    app.reload_config();
                }
                config_seen = modified;
                if changed {
                    app.publish();
                    // Publishing marks things unsynced; what came in needs no echo.
                    app.take_unsynced();
                }
            }
            Ok(Err(error)) => app.world().sync.error = Some(error),
            Err(error) => eprintln!("peeps: sync stopped: {error}"),
        }
    }
}

/// One round: write ours, merge theirs. Returns whether anything changed here and the shared
/// settings file's modification time.
fn once(app: &App, config_seen: Option<SystemTime>) -> Result<(bool, Option<SystemTime>), String> {
    let local = Local::read(&paths::sync_settings_file());
    let name = gethostname::gethostname().to_string_lossy().into_owned();
    let Some(folder) = local.folder else {
        let mut world = app.world();
        world.sync = Default::default();
        world.sync.this_computer = name;
        return Ok((false, config_seen));
    };
    let layout = Layout::new(&folder);

    let mine = DeviceFile {
        device: app.device().to_owned(),
        name: name.clone(),
        written_at: Utc::now(),
        todos: app.todos().records().map_err(|e| e.to_string())?,
        schedules: app.schedules().records().map_err(|e| e.to_string())?,
    };
    layout
        .write(&mine)
        .map_err(|error| format!("could not write to the sync folder: {error}"))?;

    let others = layout.others(app.device());
    let mut changed = 0;
    for other in &others {
        changed += app.todos().apply(&other.todos).map_err(|e| e.to_string())?;
        changed += app
            .schedules()
            .apply(&other.schedules)
            .map_err(|e| e.to_string())?;
    }

    let modified = std::fs::metadata(layout.config())
        .and_then(|meta| meta.modified())
        .ok();
    let mut world = app.world();
    world.sync.folder = Some(folder.display().to_string());
    world.sync.this_computer = name;
    world.sync.last_synced = Some(Utc::now());
    world.sync.error = None;
    world.sync.computers = others
        .iter()
        .map(|other| Computer {
            name: other.name.clone(),
            seen_at: other.written_at,
        })
        .collect();
    Ok((changed > 0, modified))
}
