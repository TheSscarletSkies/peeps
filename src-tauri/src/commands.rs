use std::path::PathBuf;
use std::sync::Arc;

use chrono::Utc;
use peeps_core::notes::{Delivery, Note};
use peeps_core::protocol::Decision;
use peeps_core::{hooks_install, paths};
use serde::Serialize;
use serde_json::Value;
use tauri::{State, WebviewWindow};

use crate::state::{App, AppSnapshot};
use crate::{secrets, window};

type Result<T> = std::result::Result<T, String>;

fn message(error: impl std::fmt::Display) -> String {
    error.to_string()
}

#[tauri::command]
pub fn snapshot(app: State<'_, Arc<App>>) -> AppSnapshot {
    app.snapshot()
}

#[tauri::command]
pub fn decide(app: State<'_, Arc<App>>, request_id: u64, decision: Decision) -> bool {
    app.decide(request_id, decision)
}

#[tauri::command]
pub fn add_note(
    app: State<'_, Arc<App>>,
    product_id: String,
    text: String,
    delivery: Delivery,
) -> Result<Note> {
    if app.config.product(&product_id).is_none() {
        return Err(format!("unknown product `{product_id}`"));
    }
    if text.trim().is_empty() {
        return Err("the note is empty".into());
    }
    let note = app
        .notes()
        .add(&product_id, &text, delivery, Utc::now())
        .map_err(message)?;
    app.publish();
    Ok(note)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HooksStatus {
    installed: bool,
    settings_path: PathBuf,
    command: String,
}

#[tauri::command]
pub fn hooks_status() -> Result<HooksStatus> {
    let command = hook_command()?;
    let settings = read_settings()?;
    Ok(HooksStatus {
        installed: hooks_install::is_installed(&settings, &command),
        settings_path: paths::claude_settings_file(),
        command,
    })
}

#[tauri::command]
pub fn install_hooks() -> Result<HooksStatus> {
    let mut settings = read_settings()?;
    if hooks_install::install(&mut settings, &hook_command()?) {
        write_settings(&settings)?;
    }
    hooks_status()
}

#[tauri::command]
pub fn uninstall_hooks() -> Result<HooksStatus> {
    let mut settings = read_settings()?;
    if hooks_install::uninstall(&mut settings, &hook_command()?) {
        write_settings(&settings)?;
    }
    hooks_status()
}

#[tauri::command]
pub fn set_secret(name: String, value: String) -> Result<()> {
    secrets::set(&name, &value).map_err(message)
}

#[tauri::command]
pub fn set_expanded(window: WebviewWindow, expanded: bool) -> Result<()> {
    window::dock(&window, expanded).map_err(message)
}

/// `peeps-hook` ships next to the app binary.
fn hook_command() -> Result<String> {
    let name = if cfg!(windows) {
        "peeps-hook.exe"
    } else {
        "peeps-hook"
    };
    let path = std::env::current_exe()
        .map_err(message)?
        .with_file_name(name);
    Ok(path.to_string_lossy().into_owned())
}

fn read_settings() -> Result<Value> {
    match std::fs::read_to_string(paths::claude_settings_file()) {
        Ok(text) => serde_json::from_str(&text).map_err(message),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            Ok(Value::Object(Default::default()))
        }
        Err(error) => Err(error.to_string()),
    }
}

fn write_settings(settings: &Value) -> Result<()> {
    let path = paths::claude_settings_file();
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(message)?;
    }
    let mut body = serde_json::to_string_pretty(settings).map_err(message)?;
    body.push('\n');
    let staging = path.with_extension("json.peeps-tmp");
    std::fs::write(&staging, body).map_err(message)?;
    std::fs::rename(&staging, &path).map_err(message)
}
