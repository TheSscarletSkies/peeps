use std::path::{Path, PathBuf};
use std::sync::Arc;

use chrono::Utc;
use peeps_core::chat::Message;
use peeps_core::config::{Config, ReminderRule, Reminders};
use peeps_core::config_edit::{self, NewProduct};
use peeps_core::notes::{Delivery, Note};
use peeps_core::protocol::Decision;
use peeps_core::sync::{self, Joined};
use peeps_core::todos::{self, Todo, TodoInput};
use peeps_core::{hooks_install, paths};
use serde::Serialize;
use serde_json::Value;
use tauri::{Manager, State, WebviewWindow};

use crate::assistant;
use crate::state::{App, AppSnapshot};
use crate::{secrets, updates, window};

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
            .complete_once(
                id,
                now,
                chrono::Local::now().date_naive(),
                crate::state::start_of_today(),
            )
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
pub async fn send_chat(app: State<'_, Arc<App>>, text: String) -> Result<Message> {
    assistant::send(app.inner().clone(), text).await
}

/// Starts syncing through `folder`, or stops when it is `None`, keeping a local copy of the settings.
#[tauri::command]
pub fn set_sync_folder(app: State<'_, Arc<App>>, folder: Option<String>) -> Result<Option<Joined>> {
    let settings = paths::sync_settings_file();
    let joined = match folder.as_deref().map(str::trim).filter(|f| !f.is_empty()) {
        Some(folder) => {
            let folder = PathBuf::from(folder);
            if !folder.is_dir() {
                return Err("that folder does not exist".into());
            }
            let joined = sync::join(&folder, &paths::local_config_file()).map_err(message)?;
            sync::Local {
                folder: Some(folder),
            }
            .write(&settings)
            .map_err(message)?;
            Some(joined)
        }
        None => {
            let shared = paths::config_file();
            if shared != paths::local_config_file() && shared.exists() {
                std::fs::copy(&shared, paths::local_config_file()).map_err(message)?;
            }
            sync::Local::default().write(&settings).map_err(message)?;
            None
        }
    };
    app.reload_config();
    Ok(joined)
}

/// Gives a product another computer made this computer's folder, so they share one pet.
#[tauri::command]
pub fn add_product_path(app: State<'_, Arc<App>>, product_id: String, path: String) -> Result<()> {
    let config = paths::config_file();
    let updated =
        config_edit::add_path(&read_or_empty(&config)?, &product_id, &path).map_err(message)?;
    write_atomic(&config, &updated)?;
    app.reload_config();
    Ok(())
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

/// Saves the user's areas, such as work, study and play.
#[tauri::command]
pub fn set_areas(app: State<'_, Arc<App>>, areas: Vec<String>) -> Result<()> {
    let path = paths::config_file();
    let updated = config_edit::set_helper_areas(&read_or_empty(&path)?, &areas).map_err(message)?;
    write_atomic(&path, &updated)?;
    app.reload_config();
    Ok(())
}

/// Saves what your peep wears; friends see it with your next status.
#[tauri::command]
pub fn set_wear(app: State<'_, Arc<App>>, wear: peeps_core::config::Wear) -> Result<()> {
    let path = paths::config_file();
    let updated = config_edit::set_helper_wear(&read_or_empty(&path)?, wear).map_err(message)?;
    write_atomic(&path, &updated)?;
    app.reload_config();
    Ok(())
}

/// Starts a fresh conversation with the helper.
#[tauri::command]
pub fn new_chat(app: State<'_, Arc<App>>) -> Result<()> {
    app.chat()
        .clear(peeps_core::chat::HELPER)
        .map_err(message)?;
    app.publish();
    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HooksStatus {
    installed: bool,
    settings_path: PathBuf,
    command: String,
    /// Where the helper's agent was found, or None when peeps can't see it.
    agent: Option<PathBuf>,
    /// What to paste in a terminal to install Claude Code here, if the button can't.
    install_command: &'static str,
}

/// Claude Code is hooked up and its program can be found, so pets and chats both work.
pub(crate) fn claude_ready() -> bool {
    let installed = match (hook_command(), read_settings()) {
        (Ok(command), Ok(settings)) => hooks_install::is_installed(&settings, &command),
        _ => false,
    };
    installed && hook_agent().is_some()
}

fn hook_agent() -> Option<PathBuf> {
    let config = Config::parse(&std::fs::read_to_string(paths::config_file()).unwrap_or_default())
        .unwrap_or_default();
    let program = config.helper.chat_command.first().cloned()?;
    peeps_core::programs::find(&program)
}

#[tauri::command]
pub fn hooks_status() -> Result<HooksStatus> {
    let command = hook_command()?;
    let settings = read_settings()?;
    Ok(HooksStatus {
        installed: hooks_install::is_installed(&settings, &command),
        settings_path: paths::claude_settings_file(),
        command,
        agent: hook_agent(),
        install_command: peeps_core::install::command(peeps_core::install::Os::current()),
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
pub(crate) fn hook_command() -> Result<String> {
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

/// Writes through a temporary file so a crash never leaves a half-written file behind.
fn write_atomic(path: &Path, body: &str) -> Result<()> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(message)?;
    }
    let mut staging = path.as_os_str().to_owned();
    staging.push(".peeps-tmp");
    std::fs::write(&staging, body).map_err(message)?;
    std::fs::rename(&staging, path).map_err(message)
}

#[tauri::command]
pub fn read_profile() -> String {
    peeps_core::profile::read(&paths::config_file())
}

#[tauri::command]
pub fn write_profile(app: State<'_, Arc<App>>, text: String) -> Result<()> {
    peeps_core::profile::write(&paths::config_file(), &text).map_err(message)?;
    app.publish();
    Ok(())
}

/// Opens a terminal that installs Claude Code with Anthropic's installer and then starts it, so
/// the person signs in there. Nothing runs hidden: they see every step.
#[tauri::command]
pub fn install_claude() -> Result<()> {
    use peeps_core::install::{self, Os};
    let os = Os::current();
    let script = install::script(os);
    let mut command = match os {
        Os::Windows => {
            let mut command = std::process::Command::new("powershell");
            command.args([
                "-NoExit",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                &script,
            ]);
            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                // A console of its own; from a windowed app there is none to share.
                const CREATE_NEW_CONSOLE: u32 = 0x0000_0010;
                command.creation_flags(CREATE_NEW_CONSOLE);
            }
            command
        }
        Os::Mac => {
            let mut command = std::process::Command::new("osascript");
            command.args(["-e", &install::mac_terminal(&script)]);
            command
        }
        Os::Linux => {
            let mut command = std::process::Command::new("x-terminal-emulator");
            command.args(["-e", "bash", "-c", &format!("{script}; exec bash")]);
            command
        }
    };
    command
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("couldn't open a terminal: {error}"))
}

#[tauri::command]
pub fn start_focus(
    app: State<'_, Arc<App>>,
    minutes: i64,
    task: Option<String>,
    area: Option<String>,
) {
    let session = peeps_core::focus::Session::new(chrono::Utc::now(), minutes, task).in_area(area);
    *app.focus() = Some(session);
    app.publish();
}

#[tauri::command]
pub fn stop_focus(app: State<'_, Arc<App>>) {
    *app.focus() = None;
    app.publish();
}

#[tauri::command]
pub fn set_one_thing(app: State<'_, Arc<App>>, on: bool) -> Result<()> {
    app.set_one_thing(on).map_err(|error| error.to_string())?;
    app.publish();
    Ok(())
}

#[tauri::command]
pub fn start_friends(app: State<'_, Arc<App>>, name: String) -> Result<()> {
    app.friends.start(&name)?;
    app.publish();
    Ok(())
}

#[tauri::command]
pub async fn add_friend(app: State<'_, Arc<App>>, code: String) -> Result<()> {
    let app = Arc::clone(&app);
    let shared = Arc::clone(&app);
    tauri::async_runtime::spawn_blocking(move || shared.friends.add(&code))
        .await
        .map_err(|error| error.to_string())??;
    app.publish();
    Ok(())
}

#[tauri::command]
pub fn remove_friend(app: State<'_, Arc<App>>, code: String) -> Result<()> {
    app.friends.remove(&code)?;
    app.publish();
    Ok(())
}

#[tauri::command]
pub async fn react(
    app: State<'_, Arc<App>>,
    code: String,
    reaction: peeps_core::friends::Reaction,
) -> Result<()> {
    let app = Arc::clone(&app);
    tauri::async_runtime::spawn_blocking(move || app.friends.react(&code, reaction))
        .await
        .map_err(|error| error.to_string())?
}

/// Downloads the update the user chose to install and restarts into it.
#[tauri::command]
pub async fn install_update(app: State<'_, Arc<App>>, handle: tauri::AppHandle) -> Result<()> {
    updates::install(app.inner().clone(), handle).await
}
