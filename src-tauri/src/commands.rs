use std::path::{Path, PathBuf};
use std::sync::Arc;

use chrono::Utc;
use peeps_core::chat::Message;
use peeps_core::config::{ReminderRule, Reminders};
use peeps_core::config_edit::{self, NewProduct};
use peeps_core::drafts::Draft;
use peeps_core::notes::{Delivery, Note};
use peeps_core::protocol::Decision;
use peeps_core::schedule::{NewSchedule, Schedule};
use peeps_core::todos::{self, Todo, TodoInput};
use peeps_core::{hooks_install, paths};
use serde::Serialize;
use serde_json::Value;
use tauri::{Manager, State, WebviewWindow};

use crate::assistant;
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
pub fn add_todo(app: State<'_, Arc<App>>, input: TodoInput) -> Result<Todo> {
    check_todo(&input)?;
    let todo = app.todos().add(&input, Utc::now()).map_err(message)?;
    app.publish();
    Ok(todo)
}

#[tauri::command]
pub fn edit_todo(app: State<'_, Arc<App>>, id: i64, input: TodoInput) -> Result<()> {
    check_todo(&input)?;
    app.todos().edit(id, &input).map_err(message)?;
    app.publish();
    Ok(())
}

fn check_todo(input: &TodoInput) -> Result<()> {
    if todos::split_tags(&input.title).0.is_empty() {
        return Err("the to-do needs a few words besides its tags".into());
    }
    Ok(())
}

#[tauri::command]
pub fn set_todo_done(app: State<'_, Arc<App>>, id: i64, done: bool) -> Result<()> {
    let now = Utc::now();
    let store = app.todos();
    if done {
        store
            .complete(id, now, chrono::Local::now().date_naive())
            .map_err(message)?;
    } else {
        store.reopen(id).map_err(message)?;
    }
    drop(store);
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
    assistant::draft(app.inner().clone(), kind, topic).await
}

#[tauri::command]
pub async fn send_chat(app: State<'_, Arc<App>>, text: String) -> Result<Message> {
    assistant::send(app.inner().clone(), text).await
}

/// Saves which model and effort the helper's agent uses.
#[tauri::command]
pub fn set_helper_agent(
    app: State<'_, Arc<App>>,
    model: Option<String>,
    effort: Option<String>,
) -> Result<()> {
    let path = paths::config_file();
    let updated =
        config_edit::set_helper_agent(&read_or_empty(&path)?, model.as_deref(), effort.as_deref())
            .map_err(message)?;
    write_atomic(&path, &updated)?;
    app.reload_config();
    Ok(())
}

/// Starts a fresh conversation with the helper.
#[tauri::command]
pub fn new_chat(app: State<'_, Arc<App>>) -> Result<()> {
    app.chat().clear().map_err(message)?;
    app.publish();
    Ok(())
}

#[tauri::command]
pub fn add_schedule(app: State<'_, Arc<App>>, schedule: NewSchedule) -> Result<Schedule> {
    if schedule.topic.trim().is_empty() {
        return Err("tell the helper what to write about".into());
    }
    let added = app
        .schedules()
        .add(&schedule, *chrono::Local::now().offset(), Utc::now())
        .map_err(message)?
        .ok_or("that time has already passed")?;
    app.publish();
    Ok(added)
}

#[tauri::command]
pub fn delete_schedule(app: State<'_, Arc<App>>, id: i64) -> Result<()> {
    app.schedules().delete(id).map_err(message)?;
    app.publish();
    Ok(())
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
pub fn set_tray_size(window: WebviewWindow, width: f64, height: f64) -> Result<()> {
    window::dock(&window, width, height).map_err(message)
}

#[tauri::command]
pub fn float_tray(window: WebviewWindow, x: f64, y: f64, width: f64, height: f64) -> Result<()> {
    window::float(&window, x, y, width, height).map_err(message)
}

#[tauri::command]
pub fn notch() -> window::Notch {
    window::notch()
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
/// Checks the link really is a calendar, keeps it in the keychain and adds the calendar to the config.
#[tauri::command]
pub async fn add_calendar(
    app: State<'_, Arc<App>>,
    name: String,
    link: String,
    remind_minutes: Option<i64>,
) -> Result<()> {
    let link = link.trim().to_owned();
    if !["https://", "http://", "webcal://"]
        .iter()
        .any(|scheme| link.starts_with(scheme))
    {
        return Err(
            "paste the calendar's private iCal link; it starts with https:// or webcal://".into(),
        );
    }
    let probe = link.clone();
    tauri::async_runtime::spawn_blocking(move || {
        peeps_core::calendar::fetch(&probe, &secrets::Keychain, Utc::now())
    })
    .await
    .map_err(message)??;

    let path = paths::config_file();
    let updated = config_edit::add_calendar(&read_or_empty(&path)?, &name, remind_minutes)
        .map_err(message)?;
    secrets::set(&config_edit::calendar_secret(&name), &link).map_err(message)?;
    write_atomic(&path, &updated)?;
    app.reload_config();
    Ok(())
}

#[tauri::command]
pub fn remove_calendar(app: State<'_, Arc<App>>, name: String) -> Result<()> {
    let path = paths::config_file();
    let updated = config_edit::remove_calendar(&read_or_empty(&path)?, &name).map_err(message)?;
    write_atomic(&path, &updated)?;
    secrets::remove(&config_edit::calendar_secret(&name)).map_err(message)?;
    app.reload_config();
    Ok(())
}

#[tauri::command]
pub fn set_reminders(
    app: State<'_, Arc<App>>,
    default_minutes: i64,
    rules: Vec<ReminderRule>,
) -> Result<()> {
    let path = paths::config_file();
    let reminders = Reminders {
        default_minutes,
        rules,
    };
    let updated =
        config_edit::set_reminders(&read_or_empty(&path)?, &reminders).map_err(message)?;
    write_atomic(&path, &updated)?;
    app.reload_config();
    Ok(())
}

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
