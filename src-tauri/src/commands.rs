use std::path::{Path, PathBuf};
use std::sync::Arc;

use chrono::Utc;
use peeps_core::chat::Message;
use peeps_core::config::{Config, ReminderRule, Reminders};
use peeps_core::config_edit::{self, NewProduct};
use peeps_core::drafts::Draft;
use peeps_core::notes::{Delivery, Note};
use peeps_core::protocol::Decision;
use peeps_core::schedule::{NewSchedule, Schedule};
use peeps_core::sync::{self, Joined};
use peeps_core::todos::{self, Todo, TodoInput};
use peeps_core::{briefs, hooks_install, mail, numbers, paths, paypal, teammates, youtube};
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
pub async fn send_chat(
    app: State<'_, Arc<App>>,
    text: String,
    scope: Option<String>,
) -> Result<Message> {
    let scope = scope.unwrap_or_else(|| peeps_core::chat::HELPER.to_owned());
    assistant::send(app.inner().clone(), scope, text).await
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

#[tauri::command]
pub fn read_brief(app: State<'_, Arc<App>>, product_id: String) -> Result<String> {
    let config = app.config();
    let product = config
        .product(&product_id)
        .ok_or_else(|| format!("unknown product `{product_id}`"))?;
    Ok(briefs::read(
        &paths::config_file(),
        &product.id,
        &product.name,
    ))
}

#[tauri::command]
pub fn write_brief(app: State<'_, Arc<App>>, product_id: String, text: String) -> Result<()> {
    if app.config().product(&product_id).is_none() {
        return Err(format!("unknown product `{product_id}`"));
    }
    briefs::write(&paths::config_file(), &product_id, &text).map_err(message)
}

/// Signs in to check the account, then keeps its app password in the keychain and the account in the config.
#[tauri::command]
pub async fn add_mail_account(
    app: State<'_, Arc<App>>,
    address: String,
    provider: mail::Provider,
    name: String,
    login: Option<String>,
    password: String,
) -> Result<()> {
    let account = mail::Account {
        address: address.trim().to_lowercase(),
        provider,
        name,
        login: login.unwrap_or_default().trim().to_lowercase(),
    };
    // App passwords are often pasted with spaces between groups of four.
    let password: String = password.chars().filter(|c| !c.is_whitespace()).collect();
    let probe = account.clone();
    let secret = password.clone();
    tauri::async_runtime::spawn_blocking(move || mail::check_login(&probe, &secret))
        .await
        .map_err(message)??;
    let path = paths::config_file();
    let text = read_or_empty(&path)?;
    // A computer joining through sync already has the account; it only needs the password.
    let known = Config::parse(&text)
        .map(|config| config.mail.iter().any(|a| a.address == account.address))
        .unwrap_or(false);
    if !known {
        let updated = config_edit::add_mail(&text, &account).map_err(message)?;
        write_atomic(&path, &updated)?;
    }
    secrets::set(&mail::secret_name(&account.address), &password).map_err(message)?;
    app.reload_config();
    crate::mailbox::refresh_ready(&app);
    app.publish();
    Ok(())
}

#[tauri::command]
pub fn remove_mail_account(app: State<'_, Arc<App>>, address: String) -> Result<()> {
    let path = paths::config_file();
    let updated = config_edit::remove_mail(&read_or_empty(&path)?, &address).map_err(message)?;
    write_atomic(&path, &updated)?;
    secrets::remove(&mail::secret_name(&address)).map_err(message)?;
    app.reload_config();
    crate::mailbox::refresh_ready(&app);
    app.publish();
    Ok(())
}

/// Writes an email by hand; like the helper's drafts, it waits until the user sends it.
#[tauri::command]
pub fn compose_email(app: State<'_, Arc<App>>, draft: mail::Draft) -> Result<mail::Email> {
    let email = app.mail().draft(&draft, Utc::now()).map_err(message)?;
    app.publish();
    Ok(email)
}

#[tauri::command]
pub async fn send_email(
    app: State<'_, Arc<App>>,
    id: i64,
    draft: mail::Draft,
) -> Result<mail::Email> {
    crate::mailbox::send(app.inner().clone(), id, draft).await
}

#[tauri::command]
pub fn discard_email(app: State<'_, Arc<App>>, id: i64) -> Result<()> {
    app.mail().discard(id).map_err(message)?;
    app.publish();
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

/// Starts a fresh conversation with the helper.
#[tauri::command]
pub fn new_chat(app: State<'_, Arc<App>>, scope: Option<String>) -> Result<()> {
    app.chat()
        .clear(scope.as_deref().unwrap_or(peeps_core::chat::HELPER))
        .map_err(message)?;
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
        .add(
            &schedule,
            *chrono::Local::now().offset(),
            Utc::now(),
            app.device(),
        )
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

fn known_product(app: &App, id: &str) -> Result<()> {
    app.config()
        .product(id)
        .map(|_| ())
        .ok_or_else(|| format!("unknown product `{id}`"))
}

#[tauri::command]
pub fn log_payment(
    app: State<'_, Arc<App>>,
    product: String,
    amount: String,
    currency: String,
    note: String,
) -> Result<numbers::Entry> {
    known_product(&app, &product)?;
    let entry = numbers::manual_payment(&product, &amount, &currency, &note, Utc::now())?;
    app.ledger().add(&entry).map_err(message)?;
    app.publish();
    Ok(entry)
}

#[tauri::command]
pub fn log_post(
    app: State<'_, Arc<App>>,
    product: String,
    channel: String,
    note: String,
) -> Result<numbers::Entry> {
    known_product(&app, &product)?;
    let entry = numbers::manual_post(&product, &channel, &note, Utc::now())?;
    app.ledger().add(&entry).map_err(message)?;
    app.publish();
    Ok(entry)
}

#[tauri::command]
pub fn remove_entry(app: State<'_, Arc<App>>, uid: String) -> Result<()> {
    app.ledger().remove(&uid, Utc::now()).map_err(message)?;
    app.publish();
    Ok(())
}

/// Checks the PayPal app's keys, keeps them in the keychain and points payments at a product.
#[tauri::command]
pub async fn connect_paypal(
    app: State<'_, Arc<App>>,
    product: String,
    client_id: String,
    secret: String,
    sandbox: bool,
) -> Result<()> {
    let (id, key) = (client_id.trim().to_owned(), secret.trim().to_owned());
    let (probe_id, probe_key) = (id.clone(), key.clone());
    tauri::async_runtime::spawn_blocking(move || paypal::token(&probe_id, &probe_key, sandbox))
        .await
        .map_err(message)??;
    let path = paths::config_file();
    let updated = config_edit::set_paypal(
        &read_or_empty(&path)?,
        Some(&paypal::Settings { product, sandbox }),
    )
    .map_err(message)?;
    write_atomic(&path, &updated)?;
    secrets::set(paypal::CLIENT_ID, &id).map_err(message)?;
    secrets::set(paypal::SECRET, &key).map_err(message)?;
    app.reload_config();
    crate::numbers::refresh(app.inner().clone()).await;
    Ok(())
}

#[tauri::command]
pub fn disconnect_paypal(app: State<'_, Arc<App>>) -> Result<()> {
    let path = paths::config_file();
    let updated = config_edit::set_paypal(&read_or_empty(&path)?, None).map_err(message)?;
    write_atomic(&path, &updated)?;
    secrets::remove(paypal::CLIENT_ID).map_err(message)?;
    secrets::remove(paypal::SECRET).map_err(message)?;
    app.reload_config();
    app.world().numbers.paypal_ready = false;
    app.publish();
    Ok(())
}

/// Keeps the YouTube Data API key in the keychain; `None` forgets it.
#[tauri::command]
pub async fn set_youtube_key(app: State<'_, Arc<App>>, key: Option<String>) -> Result<()> {
    match key
        .map(|key| key.trim().to_owned())
        .filter(|k| !k.is_empty())
    {
        Some(key) => secrets::set(youtube::KEY, &key).map_err(message)?,
        None => secrets::remove(youtube::KEY).map_err(message)?,
    }
    crate::numbers::refresh(app.inner().clone()).await;
    Ok(())
}

#[tauri::command]
pub async fn set_youtube_channel(
    app: State<'_, Arc<App>>,
    product: String,
    channel: Option<String>,
) -> Result<()> {
    let path = paths::config_file();
    let updated = config_edit::set_youtube_channel(
        &read_or_empty(&path)?,
        &product,
        channel.as_deref().filter(|c| !c.trim().is_empty()),
    )
    .map_err(message)?;
    write_atomic(&path, &updated)?;
    app.reload_config();
    crate::numbers::refresh(app.inner().clone()).await;
    Ok(())
}

#[tauri::command]
pub async fn refresh_numbers(app: State<'_, Arc<App>>) -> Result<()> {
    crate::numbers::refresh(app.inner().clone()).await;
    Ok(())
}

/// Adds a teammate from a role and starts its rhythm on this computer, today if its time is
/// still ahead, otherwise tomorrow.
#[tauri::command]
pub fn add_teammate(
    app: State<'_, Arc<App>>,
    product: String,
    role: String,
    name: String,
) -> Result<String> {
    let path = paths::config_file();
    let (updated, id) = config_edit::add_teammate(&read_or_empty(&path)?, &product, &role, &name)
        .map_err(message)?;
    write_atomic(&path, &updated)?;
    app.reload_config();
    let starting = teammates::role(&role).ok_or_else(|| format!("unknown role `{role}`"))?;
    let time = chrono::NaiveTime::parse_from_str(starting.time, "%H:%M").map_err(message)?;
    let today = chrono::Local::now().date_naive();
    let zone = *chrono::Local::now().offset();
    for start in [today, today + chrono::TimeDelta::days(1)] {
        let shift = NewSchedule {
            kind: teammates::SHIFT.to_owned(),
            topic: teammates::scope(&product, &id),
            repeat: starting.repeat,
            start,
            time,
        };
        if app
            .schedules()
            .add(&shift, zone, Utc::now(), app.device())
            .map_err(message)?
            .is_some()
        {
            break;
        }
    }
    app.publish();
    Ok(id)
}

#[tauri::command]
pub fn remove_teammate(app: State<'_, Arc<App>>, product: String, id: String) -> Result<()> {
    let path = paths::config_file();
    let updated =
        config_edit::remove_teammate(&read_or_empty(&path)?, &product, &id).map_err(message)?;
    write_atomic(&path, &updated)?;
    let scope = teammates::scope(&product, &id);
    let shifts: Vec<i64> = app
        .schedules()
        .all()
        .map_err(message)?
        .into_iter()
        .filter(|s| s.kind == teammates::SHIFT && s.topic == scope)
        .map(|s| s.id)
        .collect();
    for shift in shifts {
        app.schedules().delete(shift).map_err(message)?;
    }
    app.reload_config();
    Ok(())
}

fn teammate(app: &App, product: &str, id: &str) -> Result<teammates::Teammate> {
    app.config()
        .product(product)
        .and_then(|p| p.teammates.iter().find(|t| t.id == id).cloned())
        .ok_or_else(|| format!("no teammate `{id}` on `{product}`"))
}

#[tauri::command]
pub fn read_playbook(app: State<'_, Arc<App>>, product: String, id: String) -> Result<String> {
    let teammate = teammate(&app, &product, &id)?;
    Ok(teammates::read(&paths::config_file(), &product, &teammate))
}

#[tauri::command]
pub fn write_playbook(
    app: State<'_, Arc<App>>,
    product: String,
    id: String,
    text: String,
) -> Result<()> {
    teammate(&app, &product, &id)?;
    teammates::write(&paths::config_file(), &product, &id, &text).map_err(message)
}

/// Starts a shift now, outside the teammate's rhythm.
#[tauri::command]
pub async fn run_teammate(app: State<'_, Arc<App>>, product: String, id: String) -> Result<()> {
    teammate(&app, &product, &id)?;
    assistant::shift(app.inner(), &teammates::scope(&product, &id)).await;
    Ok(())
}

/// The roles peeps suggests for a product, from its name, brief, checks and numbers.
#[tauri::command]
pub fn suggest_team(app: State<'_, Arc<App>>, product: String) -> Result<Vec<String>> {
    let config = app.config();
    let found = config
        .product(&product)
        .ok_or_else(|| format!("unknown product `{product}`"))?;
    let mut signals = vec![
        found.name.clone(),
        briefs::read(&paths::config_file(), &found.id, &found.name),
    ];
    for check in &found.checks {
        signals.push(format!("{} {}", check.id, check.message));
        if let peeps_core::checks::Source::Http(http) = &check.source {
            signals.push(http.url.clone());
        }
    }
    if found.youtube_channel.is_some() {
        signals.push("youtube".into());
    }
    if config
        .paypal
        .as_ref()
        .is_some_and(|p| p.product == found.id)
    {
        signals.push("paypal".into());
    }
    let since = Utc::now() - chrono::TimeDelta::days(30);
    let month = app.ledger().summary(&found.id, since).map_err(message)?;
    if month.payments > 0 {
        signals.push("payment".into());
    }
    signals.extend(month.posts.keys().cloned());
    let taken: Vec<&str> = found.teammates.iter().map(|t| t.role.as_str()).collect();
    Ok(teammates::suggest(&signals.join("\n"), &taken)
        .into_iter()
        .map(str::to_owned)
        .collect())
}
