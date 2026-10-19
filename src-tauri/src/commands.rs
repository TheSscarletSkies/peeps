use std::path::{Path, PathBuf};
use std::sync::Arc;

use std::time::Duration;

use chrono::{NaiveDate, Utc};
use peeps_core::config_edit::{self, NewProduct};
use peeps_core::drafts::{self, Draft};
use peeps_core::notes::{Delivery, Note};
use peeps_core::protocol::Decision;
use peeps_core::todos::{Todo, TodoKind};
use peeps_core::{hooks_install, paths};
use serde::Serialize;
use serde_json::Value;
use tauri::{Manager, State, WebviewWindow};

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
    if app.config().product(&product_id).is_none() {
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

#[tauri::command]
pub fn add_product(app: State<'_, Arc<App>>, product: NewProduct) -> Result<String> {
    let path = paths::config_file();
    let (updated, id) =
        config_edit::add_product(&read_or_empty(&path)?, &product).map_err(message)?;
    write_atomic(&path, &updated)?;
    app.reload_config();
    Ok(id)
}

#[tauri::command]
pub fn remove_product(app: State<'_, Arc<App>>, product_id: String) -> Result<()> {
    let path = paths::config_file();
    let updated =
        config_edit::remove_product(&read_or_empty(&path)?, &product_id).map_err(message)?;
    write_atomic(&path, &updated)?;
    app.reload_config();
    Ok(())
}

#[tauri::command]
pub fn add_todo(
    app: State<'_, Arc<App>>,
    title: String,
    kind: TodoKind,
    due: Option<String>,
) -> Result<Todo> {
    if title.trim().is_empty() {
        return Err("the to-do is empty".into());
    }
    let due = due
        .filter(|day| !day.is_empty())
        .map(|day| day.parse::<NaiveDate>())
        .transpose()
        .map_err(|_| "the due date should look like 2026-10-31".to_owned())?;
    let todo = app
        .todos()
        .add(&title, kind, due, Utc::now())
        .map_err(message)?;
    app.publish();
    Ok(todo)
}

#[tauri::command]
pub fn set_todo_done(app: State<'_, Arc<App>>, id: i64, done: bool) -> Result<()> {
    app.todos()
        .set_done(id, done, Utc::now())
        .map_err(message)?;
    app.publish();
    Ok(())
}

#[tauri::command]
pub fn delete_todo(app: State<'_, Arc<App>>, id: i64) -> Result<()> {
    app.todos().delete(id).map_err(message)?;
    app.publish();
    Ok(())
}

#[tauri::command]
pub fn delete_draft(app: State<'_, Arc<App>>, id: i64) -> Result<()> {
    app.drafts().delete(id).map_err(message)?;
    app.publish();
    Ok(())
}

/// Asks the user's own agent for a draft. Only one draft runs at a time.
#[tauri::command]
pub async fn write_draft(app: State<'_, Arc<App>>, kind: String, topic: String) -> Result<Draft> {
    if topic.trim().is_empty() {
        return Err("tell the helper what to write about".into());
    }
    let app = app.inner().clone();
    if !app.start_drafting() {
        return Err("the helper is already writing a draft".into());
    }
    app.publish();

    let config = app.config();
    let helper = &config.helper;
    let voice = helper
        .voices
        .get(&kind)
        .filter(|path| !path.is_empty())
        .map(|path| std::fs::read_to_string(paths::expand_home(path)))
        .transpose()
        .map_err(|error| format!("could not read the voice guide: {error}"));
    let command = helper.command.clone();
    let timeout = Duration::from_secs(helper.timeout_seconds);

    let result = match voice {
        Ok(voice) => {
            let prompt = drafts::prompt(&kind, &topic, voice.as_deref());
            tauri::async_runtime::spawn_blocking(move || drafts::run(&command, &prompt, timeout))
                .await
                .map_err(message)
                .and_then(|outcome| outcome.map_err(message))
        }
        Err(error) => Err(error),
    };

    let saved = result.and_then(|text| {
        app.drafts()
            .add(&kind, &topic, &text, Utc::now())
            .map_err(message)
    });
    app.finish_drafting();
    app.publish();
    saved
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
pub fn open_home(app: tauri::AppHandle) -> Result<()> {
    let window = app
        .get_webview_window(window::HOME)
        .ok_or("the peeps window is missing")?;
    window::show_home(&window).map_err(message)
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
    let text = read_or_empty(&paths::claude_settings_file())?;
    if text.trim().is_empty() {
        return Ok(Value::Object(Default::default()));
    }
    serde_json::from_str(&text).map_err(message)
}

fn write_settings(settings: &Value) -> Result<()> {
    let mut body = serde_json::to_string_pretty(settings).map_err(message)?;
    body.push('\n');
    write_atomic(&paths::claude_settings_file(), &body)
}

fn read_or_empty(path: &Path) -> Result<String> {
    match std::fs::read_to_string(path) {
        Ok(text) => Ok(text),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        Err(error) => Err(error.to_string()),
    }
}

/// Writes through a temporary file so a crash never leaves a half-written file behind.
/// Saves a PNG to Downloads and returns where it went.
#[tauri::command]
pub fn save_image(name: String, data: Vec<u8>) -> Result<String> {
    let dir = dirs::download_dir()
        .or_else(dirs::home_dir)
        .ok_or("No Downloads folder")?;
    let path = paths::unused_path(&dir, &paths::safe_file_name(&name, "png"));
    std::fs::write(&path, data).map_err(message)?;
    Ok(path.display().to_string())
}

fn write_atomic(path: &Path, body: &str) -> Result<()> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(message)?;
    }
    let mut staging = path.as_os_str().to_owned();
    staging.push(".peeps-tmp");
    std::fs::write(&staging, body).map_err(message)?;
    std::fs::rename(&staging, path).map_err(message)
}
