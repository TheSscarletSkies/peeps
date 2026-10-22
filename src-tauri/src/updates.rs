//! Looks for a newer peeps in the background and installs it only when the user presses Restart.

use std::sync::{Arc, Mutex, PoisonError};

use peeps_core::paths;
use peeps_core::updates::{self, Check, Ready};
use tauri::{AppHandle, Manager};
use tauri_plugin_updater::{Update, UpdaterExt};

use crate::state::App;

type Result<T> = std::result::Result<T, String>;

/// The release a check found, kept so pressing Restart installs exactly what the card shows.
#[derive(Default)]
pub struct Pending(Mutex<Option<Update>>);

impl Pending {
    fn set(&self, update: Option<Update>) {
        *self.0.lock().unwrap_or_else(PoisonError::into_inner) = update;
    }

    fn take(&self) -> Option<Update> {
        self.0.lock().unwrap_or_else(PoisonError::into_inner).take()
    }
}

pub async fn run(app: Arc<App>, handle: AppHandle) {
    let mut interval = tokio::time::interval(updates::CHECK_EVERY);
    loop {
        interval.tick().await;
        check(&app, &handle).await;
    }
}

async fn look(handle: &AppHandle) -> Result<Option<Update>> {
    handle
        .updater_builder()
        .version_comparator(|current, release| {
            updates::is_newer(&current.to_string(), &release.version.to_string())
        })
        .build()
        .map_err(|error| error.to_string())?
        .check()
        .await
        .map_err(|error| error.to_string())
}

async fn check(app: &App, handle: &AppHandle) {
    let found = match look(handle).await {
        Ok(Some(update)) => {
            let version = update.version.clone();
            handle.state::<Pending>().set(Some(update));
            Check::Found(version)
        }
        Ok(None) => {
            handle.state::<Pending>().set(None);
            Check::UpToDate
        }
        // Offline, nothing released yet, or a feed that can't be read: nothing to tell anyone.
        Err(_) => Check::Failed,
    };
    let ready = {
        let mut world = app.world();
        world.update = updates::after_check(world.update.take(), found);
        world.update.clone()
    };
    if let Some(ready) = ready {
        announce(app, &ready.version);
    }
    app.publish();
}

/// One notification per version, remembered across restarts so a new launch doesn't repeat it.
fn announce(app: &App, version: &str) {
    let file = paths::data_dir().join("update-announced");
    let announced = std::fs::read_to_string(&file).ok();
    if !updates::should_notify(announced.as_deref(), version) {
        return;
    }
    app.notify(
        &format!("peeps {version} is ready"),
        "Restart from Settings to update.",
    );
    if let Err(error) = std::fs::write(&file, version) {
        eprintln!("peeps: could not remember the update notice: {error}");
    }
}

/// Downloads and installs the release on the card, then restarts into it.
pub async fn install(app: Arc<App>, handle: AppHandle) -> Result<()> {
    let update = match handle.state::<Pending>().take() {
        Some(update) => update,
        None => look(&handle).await?.ok_or("peeps is already up to date")?,
    };
    {
        let mut world = app.world();
        world.update =
            updates::after_check(world.update.take(), Check::Found(update.version.clone()));
    }
    set(&app, |ready| {
        ready.installing = true;
        ready.error = None;
    });
    match update.download_and_install(|_, _| {}, || {}).await {
        Ok(()) => handle.restart(),
        Err(error) => {
            let error = error.to_string();
            handle.state::<Pending>().set(Some(update));
            set(&app, |ready| {
                ready.installing = false;
                ready.error = Some(error.clone());
            });
            Err(error)
        }
    }
}

fn set(app: &App, change: impl FnOnce(&mut Ready)) {
    if let Some(ready) = app.world().update.as_mut() {
        change(ready);
    }
    app.publish();
}

#[cfg(test)]
mod tests {
    /// The plugin reads this when the app starts; a setting it rejects would stop peeps opening.
    #[test]
    fn the_updater_settings_load() {
        let conf: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        assert_eq!(conf["bundle"]["createUpdaterArtifacts"], true);
        let updater: tauri_plugin_updater::Config =
            serde_json::from_value(conf["plugins"]["updater"].clone()).unwrap();
        assert_eq!(
            updater.endpoints[0].as_str(),
            "https://github.com/TheSscarletSkies/peeps/releases/latest/download/latest.json"
        );
        assert!(!updater.pubkey.is_empty());
    }
}
