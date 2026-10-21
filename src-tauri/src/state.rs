use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError, RwLock};

use chrono::{DateTime, Local, TimeDelta, Utc};
use peeps_core::advice::Tip;
use peeps_core::calendar::{self, Event, FeedEvent};
use peeps_core::chat::ChatStore;
use peeps_core::config::{Config, Reminders};
use peeps_core::drafts::DraftStore;
use peeps_core::helper::{self, HelperView, Week};
use peeps_core::mail::{Email, MailStore};
use peeps_core::notes::{self, Delivery, NoteStore};
use peeps_core::numbers::{Entry, Ledger, Summary};
use peeps_core::paths;
use peeps_core::protocol::{Decision, HookEvent, HookInput, Reply};
use peeps_core::schedule::ScheduleStore;
use peeps_core::session::{describe_tool, Sessions};
use peeps_core::snapshot::{self, CheckResults, PendingPermission, PermissionView, Snapshot};
use peeps_core::todos::TodoStore;
use peeps_core::usage::Transcript;
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tokio::sync::oneshot;

const RECENT_NOTES: usize = 20;
const RECENT_DONE: usize = 10;
const RECENT_DRAFTS: usize = 10;
const RECENT_CHAT: usize = 40;
/// Permission requests from the helper's own agent are filed under this id.
pub const HELPER_ID: &str = "helper";
const STARTER_CONFIG: &str = "# peeps: add products from the app, or by hand.\n\
# Every option is described in the README; examples/ has full setups.\n";
pub const SNAPSHOT_EVENT: &str = "snapshot";
const NUDGE_EVENT: &str = "nudge";

#[derive(Default)]
pub struct World {
    pub sessions: Sessions,
    pub checks: CheckResults,
    pub transcripts: HashMap<PathBuf, Transcript>,
    pub transcript_products: HashMap<PathBuf, String>,
    pub permissions: Vec<PendingPermission>,
    pub tips: Vec<Tip>,
    pub week: Week,
    /// Calendar feeds by name, as last downloaded.
    pub feeds: HashMap<String, Feed>,
    pub sync: SyncStatus,
    /// Accounts whose app password is in this computer's keychain, checked off the main path.
    pub mail_ready: std::collections::HashSet<String>,
    pub numbers: NumbersStatus,
}

/// How reading PayPal and YouTube is going on this computer.
#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NumbersStatus {
    pub paypal_ready: bool,
    pub youtube_ready: bool,
    pub last_checked: Option<DateTime<Utc>>,
    pub error: Option<String>,
}

/// How syncing is going, for the Devices page.
#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatus {
    pub folder: Option<String>,
    pub this_computer: String,
    pub last_synced: Option<DateTime<Utc>>,
    pub computers: Vec<Computer>,
    pub error: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Computer {
    pub name: String,
    pub seen_at: DateTime<Utc>,
}

#[derive(Default)]
pub struct Feed {
    pub events: Vec<FeedEvent>,
    pub error: Option<String>,
    pub fetched: Option<DateTime<Utc>>,
}

/// How a calendar is doing, for the settings page.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarStatus {
    pub name: String,
    pub remind_minutes: Option<i64>,
    pub notify: bool,
    pub loaded: bool,
    pub error: Option<String>,
}

impl World {
    pub fn track_transcript(&mut self, path: PathBuf, product_id: &str) {
        self.transcript_products
            .entry(path.clone())
            .or_insert_with(|| product_id.to_owned());
        self.transcripts
            .entry(path.clone())
            .or_insert_with(|| Transcript::new(path));
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSnapshot {
    #[serde(flatten)]
    pub snapshot: Snapshot,
    pub helper: HelperView,
    pub config_error: Option<String>,
    pub calendars: Vec<CalendarStatus>,
    pub reminders: Reminders,
    pub sync: SyncStatus,
    pub product_chats: Vec<ProductChat>,
    pub teammates: Vec<TeammateView>,
    /// Whether the user has told peeps anything about themselves yet.
    pub knows_you: bool,
    pub focus: Option<peeps_core::focus::FocusView>,
    /// Whether "one thing at a time" watches for app hopping. Off unless switched on.
    pub one_thing: bool,
    /// None until the user picks a name and gets a code.
    pub friends: Option<crate::friends::FriendsView>,
    /// The roles a new teammate can start from.
    pub roles: Vec<peeps_core::teammates::Role>,
    pub mail: MailView,
    pub numbers: NumbersView,
}

/// Payments and posts per product, and where they are read from.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NumbersView {
    pub products: Vec<ProductNumbers>,
    pub paypal: Option<peeps_core::paypal::Settings>,
    #[serde(flatten)]
    pub status: NumbersStatus,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductNumbers {
    pub product_id: String,
    pub youtube_channel: Option<String>,
    /// The last seven days.
    pub week: Summary,
    pub recent: Vec<Entry>,
}

/// How far back a product card's numbers look.
pub const NUMBERS_DAYS: i64 = 7;

/// Email for the window: accounts, drafts waiting for approval and who hasn't replied.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MailView {
    pub accounts: Vec<MailAccount>,
    pub outbox: Vec<Email>,
    pub awaiting: Vec<Email>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MailAccount {
    pub address: String,
    pub provider: peeps_core::mail::Provider,
    pub name: String,
    pub login: String,
    /// False on a computer that synced the account but has no app password for it yet.
    pub ready: bool,
}

/// How far back "hasn't replied" looks.
pub const AWAITING_DAYS: i64 = 30;

/// A product pet's conversation with the user.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductChat {
    pub product_id: String,
    pub messages: Vec<peeps_core::chat::Message>,
    pub chatting: bool,
}

/// A teammate with its rhythm and its conversation, which holds its shift reports.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TeammateView {
    pub product_id: String,
    pub id: String,
    pub name: String,
    pub role: String,
    pub title: String,
    pub scope: String,
    pub schedule: Option<peeps_core::schedule::Schedule>,
    pub messages: Vec<peeps_core::chat::Message>,
    pub chatting: bool,
}

/// Midnight this morning in the user's time zone.
pub fn start_of_today() -> DateTime<Utc> {
    Local::now()
        .date_naive()
        .and_hms_opt(0, 0, 0)
        .and_then(|midnight| midnight.and_local_timezone(Local).earliest())
        .map_or_else(Utc::now, |midnight| midnight.with_timezone(&Utc))
}

/// How far ahead the helper lists events.
const UPCOMING_HOURS: i64 = 36;
const UPCOMING_LIMIT: usize = 8;

struct Loaded {
    config: Arc<Config>,
    error: Option<String>,
}

impl Loaded {
    fn read() -> Self {
        match Config::load(&paths::config_file()) {
            Ok(config) => Self {
                config: Arc::new(config),
                error: None,
            },
            Err(error) => Self {
                config: Arc::default(),
                error: Some(error.to_string()),
            },
        }
    }
}

pub struct App {
    loaded: RwLock<Loaded>,
    rescan: AtomicBool,
    /// Something changed here that other computers should hear about.
    unsynced: AtomicBool,
    device: String,
    world: Mutex<World>,
    notes: Mutex<NoteStore>,
    todos: Mutex<TodoStore>,
    drafts: Mutex<DraftStore>,
    drafting: AtomicBool,
    chat: Mutex<ChatStore>,
    /// Which conversation the agent is answering, if any.
    chatting: Mutex<Option<String>>,
    schedules: Mutex<ScheduleStore>,
    mail: Mutex<MailStore>,
    ledger: Mutex<Ledger>,
    waiters: Mutex<HashMap<u64, oneshot::Sender<Decision>>>,
    next_request: AtomicU64,
    focus: Mutex<Option<peeps_core::focus::Session>>,
    pub friends: crate::friends::Friends,
    /// None only in tests, which have no window to update.
    handle: Option<AppHandle>,
}

impl App {
    pub fn load(handle: AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        Self::open(Some(handle))
    }

    fn open(handle: Option<AppHandle>) -> Result<Self, Box<dyn std::error::Error>> {
        std::fs::create_dir_all(paths::data_dir())?;
        let config_path = paths::config_file();
        if !config_path.exists() {
            std::fs::write(&config_path, STARTER_CONFIG)?;
        }
        Ok(Self {
            loaded: RwLock::new(Loaded::read()),
            rescan: AtomicBool::new(true),
            unsynced: AtomicBool::new(true),
            device: peeps_core::sync::device_id(&paths::device_file())?,
            world: Mutex::default(),
            notes: Mutex::new(NoteStore::open(&paths::database_file())?),
            todos: Mutex::new(TodoStore::open(&paths::database_file())?),
            drafts: Mutex::new(DraftStore::open(&paths::database_file())?),
            drafting: AtomicBool::new(false),
            chat: Mutex::new(ChatStore::open(&paths::database_file())?),
            chatting: Mutex::new(None),
            schedules: Mutex::new(ScheduleStore::open(&paths::database_file())?),
            mail: Mutex::new(MailStore::open(&paths::database_file())?),
            ledger: Mutex::new(Ledger::open(&paths::database_file())?),
            waiters: Mutex::default(),
            next_request: AtomicU64::new(1),
            focus: Mutex::new(None),
            friends: crate::friends::Friends::load(),
            handle,
        })
    }

    pub fn config(&self) -> Arc<Config> {
        self.loaded
            .read()
            .unwrap_or_else(PoisonError::into_inner)
            .config
            .clone()
    }

    fn config_error(&self) -> Option<String> {
        self.loaded
            .read()
            .unwrap_or_else(PoisonError::into_inner)
            .error
            .clone()
    }

    /// Re-reads the config file and asks the watcher to re-match transcripts to products.
    pub fn reload_config(&self) {
        *self.loaded.write().unwrap_or_else(PoisonError::into_inner) = Loaded::read();
        {
            let mut world = self.world();
            world.transcripts.clear();
            world.transcript_products.clear();
            world.checks.clear();
            world.feeds.clear();
        }
        self.rescan.store(true, Ordering::Relaxed);
        self.publish();
    }

    /// True once after the config changed or the app started.
    pub fn take_rescan(&self) -> bool {
        self.rescan.swap(false, Ordering::Relaxed)
    }

    pub fn world(&self) -> MutexGuard<'_, World> {
        self.world.lock().unwrap_or_else(PoisonError::into_inner)
    }

    pub fn notes(&self) -> MutexGuard<'_, NoteStore> {
        self.notes.lock().unwrap_or_else(PoisonError::into_inner)
    }

    /// Kept as a file beside the data, per computer: watching apps is a choice for each machine.
    pub fn one_thing(&self) -> bool {
        std::fs::read_to_string(paths::data_dir().join("one-thing")).is_ok_and(|s| s.trim() == "on")
    }

    pub fn set_one_thing(&self, on: bool) -> std::io::Result<()> {
        std::fs::write(
            paths::data_dir().join("one-thing"),
            if on { "on" } else { "off" },
        )
    }

    pub fn focus(&self) -> MutexGuard<'_, Option<peeps_core::focus::Session>> {
        self.focus.lock().unwrap_or_else(PoisonError::into_inner)
    }

    pub fn todos(&self) -> MutexGuard<'_, TodoStore> {
        self.todos.lock().unwrap_or_else(PoisonError::into_inner)
    }

    pub fn drafts(&self) -> MutexGuard<'_, DraftStore> {
        self.drafts.lock().unwrap_or_else(PoisonError::into_inner)
    }

    pub fn chat(&self) -> MutexGuard<'_, ChatStore> {
        self.chat.lock().unwrap_or_else(PoisonError::into_inner)
    }

    pub fn mail(&self) -> MutexGuard<'_, MailStore> {
        self.mail.lock().unwrap_or_else(PoisonError::into_inner)
    }

    pub fn ledger(&self) -> MutexGuard<'_, Ledger> {
        self.ledger.lock().unwrap_or_else(PoisonError::into_inner)
    }

    pub fn schedules(&self) -> MutexGuard<'_, ScheduleStore> {
        self.schedules
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
    }

    /// Marks a conversation as being answered. One at a time, so the agent's approvals land in the
    /// right card. Returns false if something else is being answered.
    pub fn start_chatting(&self, scope: &str) -> bool {
        let mut chatting = self.chatting.lock().unwrap_or_else(PoisonError::into_inner);
        if chatting.is_some() {
            return false;
        }
        *chatting = Some(scope.to_owned());
        true
    }

    pub fn finish_chatting(&self) {
        *self.chatting.lock().unwrap_or_else(PoisonError::into_inner) = None;
    }

    fn chatting_scope(&self) -> Option<String> {
        self.chatting
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .clone()
    }

    /// Marks a draft as in progress. Returns false if one is already being written.
    pub fn start_drafting(&self) -> bool {
        !self.drafting.swap(true, Ordering::SeqCst)
    }

    pub fn finish_drafting(&self) {
        self.drafting.store(false, Ordering::SeqCst);
    }

    fn waiters(&self) -> MutexGuard<'_, HashMap<u64, oneshot::Sender<Decision>>> {
        self.waiters.lock().unwrap_or_else(PoisonError::into_inner)
    }

    /// Occurrences across every calendar that overlap `from..to`, soonest first.
    pub fn events(&self, from: DateTime<Utc>, to: DateTime<Utc>) -> Vec<Event> {
        let config = self.config();
        let zone = *Local::now().offset();
        let world = self.world();
        let mut events: Vec<Event> = config
            .calendars
            .iter()
            .filter_map(|feed| {
                let loaded = world.feeds.get(&feed.name)?;
                Some(calendar::occurrences(
                    &feed.name,
                    &loaded.events,
                    from,
                    to,
                    zone,
                ))
            })
            .flatten()
            .collect();
        events.sort_by_key(|event| event.start);
        events
    }

    /// Lets the pets say a reminder out loud, with a way to tick off the to-do it is about.
    pub fn nudge(&self, reminder: &peeps_core::reminders::Reminder) {
        let Some(handle) = &self.handle else {
            return;
        };
        let payload = serde_json::json!({
            "title": reminder.title,
            "body": reminder.body,
            "todoId": reminder.todo_id(),
        });
        if let Err(error) = handle.emit(NUDGE_EVENT, payload) {
            eprintln!("peeps: could not show a reminder on the pets: {error}");
        }
    }

    pub fn emit<T: Serialize + Clone>(&self, event: &str, payload: T) {
        let Some(handle) = &self.handle else {
            return;
        };
        if let Err(error) = handle.emit(event, payload) {
            eprintln!("peeps: could not tell the window about {event}: {error}");
        }
    }

    pub fn notify(&self, title: &str, body: &str) {
        use tauri_plugin_notification::NotificationExt;
        let Some(handle) = &self.handle else {
            return;
        };
        if let Err(error) = handle
            .notification()
            .builder()
            .title(title)
            .body(body)
            .show()
        {
            eprintln!("peeps: could not show a notification: {error}");
        }
    }

    pub fn snapshot(&self) -> AppSnapshot {
        let config = self.config();
        let now = Utc::now();
        let upcoming: Vec<Event> = self
            .events(now, now + TimeDelta::hours(UPCOMING_HOURS))
            .into_iter()
            .take(UPCOMING_LIMIT)
            .collect();
        let notes = self.notes().recent(RECENT_NOTES).unwrap_or_default();
        let (open, done) = {
            let todos = self.todos();
            (
                todos.open_items().unwrap_or_default(),
                todos.recently_done(RECENT_DONE).unwrap_or_default(),
            )
        };
        let done_today = self
            .todos()
            .done_ids_since(start_of_today())
            .unwrap_or_default();
        let week_ago = Utc::now() - chrono::TimeDelta::days(7);
        let todos_done_this_week = self.todos().done_since(week_ago).unwrap_or_default();
        let drafts = self.drafts().recent(RECENT_DRAFTS).unwrap_or_default();
        let drafts_this_week = self.drafts().count_since(week_ago).unwrap_or_default();
        let chat = self
            .chat()
            .recent(peeps_core::chat::HELPER, RECENT_CHAT)
            .unwrap_or_default();
        let chatting_scope = self.chatting_scope();
        let product_chats = config
            .products
            .iter()
            .map(|product| ProductChat {
                product_id: product.id.clone(),
                messages: self
                    .chat()
                    .recent(&product.id, RECENT_CHAT)
                    .unwrap_or_default(),
                chatting: chatting_scope.as_deref() == Some(product.id.as_str()),
            })
            .collect();
        let schedules = self.schedules().all().unwrap_or_default();
        let teammates = config
            .products
            .iter()
            .flat_map(|product| {
                product.teammates.iter().map(|teammate| {
                    let scope = peeps_core::teammates::scope(&product.id, &teammate.id);
                    TeammateView {
                        product_id: product.id.clone(),
                        id: teammate.id.clone(),
                        name: teammate.name.clone(),
                        role: teammate.role.clone(),
                        title: peeps_core::teammates::role(&teammate.role)
                            .map_or("Teammate", |role| role.title)
                            .to_owned(),
                        schedule: schedules
                            .iter()
                            .find(|s| s.kind == peeps_core::teammates::SHIFT && s.topic == scope)
                            .cloned(),
                        messages: self.chat().recent(&scope, RECENT_CHAT).unwrap_or_default(),
                        chatting: chatting_scope.as_deref() == Some(scope.as_str()),
                        scope,
                    }
                })
            })
            .collect();
        // Each store is read in its own statement: a guard taken inside the snapshot's struct
        // literal lives until the whole literal is built, so a second read of the same store
        // there would wait on the first forever.
        let (outbox, awaiting) = {
            let mail = self.mail();
            (
                mail.outbox().unwrap_or_default(),
                mail.awaiting(now - TimeDelta::days(AWAITING_DAYS))
                    .unwrap_or_default(),
            )
        };
        let product_numbers: Vec<ProductNumbers> = {
            let ledger = self.ledger();
            config
                .products
                .iter()
                .map(|product| ProductNumbers {
                    product_id: product.id.clone(),
                    youtube_channel: product.youtube_channel.clone(),
                    week: ledger
                        .summary(&product.id, now - TimeDelta::days(NUMBERS_DAYS))
                        .unwrap_or_default(),
                    recent: ledger.recent(&product.id, 8).unwrap_or_default(),
                })
                .collect()
        };
        let config_error = self.config_error();
        let focus = self.focus().as_ref().and_then(|session| session.view(now));
        let knows_you =
            !peeps_core::profile::is_empty(&peeps_core::profile::read(&paths::config_file()));
        let world = self.world();
        let permission = world
            .permissions
            .iter()
            .find(|pending| pending.product_id == HELPER_ID)
            .map(|pending| PermissionView {
                request_id: pending.request_id,
                tool: pending.tool.clone(),
                summary: pending.summary.clone(),
            });
        AppSnapshot {
            helper: helper::view(helper::HelperInputs {
                config: &config.helper,
                open,
                done,
                drafts,
                drafting: self.drafting.load(Ordering::SeqCst),
                week: world.week.clone(),
                todos_done_this_week,
                drafts_this_week,
                today: Local::now().date_naive(),
                done_today,
                upcoming,
                now,
                chat,
                chatting: chatting_scope.as_deref() == Some(peeps_core::chat::HELPER),
                schedules,
                permission,
            }),
            snapshot: snapshot::build(snapshot::Inputs {
                config: &config,
                sessions: &world.sessions,
                checks: &world.checks,
                transcripts: &world.transcripts,
                permissions: &world.permissions,
                notes,
                tips: world.tips.clone(),
                now: Utc::now(),
            }),
            config_error,
            calendars: config
                .calendars
                .iter()
                .map(|feed| {
                    let loaded = world.feeds.get(&feed.name);
                    CalendarStatus {
                        name: feed.name.clone(),
                        remind_minutes: feed.remind_minutes,
                        notify: feed.notify,
                        loaded: loaded.is_some_and(|feed| feed.fetched.is_some()),
                        error: loaded.and_then(|feed| feed.error.clone()),
                    }
                })
                .collect(),
            reminders: config.reminders.clone(),
            sync: world.sync.clone(),
            product_chats,
            teammates,
            roles: peeps_core::teammates::ROLES.to_vec(),
            knows_you,
            focus,
            one_thing: self.one_thing(),
            friends: self.friends.view(now),
            mail: MailView {
                accounts: config
                    .mail
                    .iter()
                    .map(|account| MailAccount {
                        address: account.address.clone(),
                        provider: account.provider,
                        name: account.name.clone(),
                        login: account.login.clone(),
                        ready: world.mail_ready.contains(&account.address),
                    })
                    .collect(),
                outbox,
                awaiting,
            },
            numbers: NumbersView {
                products: product_numbers,
                paypal: config.paypal.clone(),
                status: world.numbers.clone(),
            },
        }
    }

    /// This computer's id in the sync folder.
    pub fn device(&self) -> &str {
        &self.device
    }

    /// True once after something changed that should be written to the sync folder.
    pub fn take_unsynced(&self) -> bool {
        self.unsynced.swap(false, Ordering::Relaxed)
    }

    pub fn publish(&self) {
        self.unsynced.store(true, Ordering::Relaxed);
        let Some(handle) = &self.handle else {
            return;
        };
        if let Err(error) = handle.emit(SNAPSHOT_EVENT, self.snapshot()) {
            eprintln!("peeps: could not update the window: {error}");
        }
    }

    pub fn product_for(&self, cwd: Option<&str>) -> Option<String> {
        let config = self.config();
        cwd.and_then(|dir| config.product_for_dir(Path::new(dir)))
            .map(|product| product.id.clone())
    }

    /// True for the helper's own agent, which runs in its own folder.
    fn is_assistant(cwd: Option<&str>) -> bool {
        cwd.is_some_and(|dir| paths::is_within(Path::new(dir), &paths::assistant_dir()))
    }

    /// Records a hook event and works out the reply, waiting for the user on permission requests.
    pub async fn on_hook(&self, input: HookInput) -> Option<Reply> {
        let now = Utc::now();
        let product = self.product_for(input.cwd.as_deref());
        {
            let mut world = self.world();
            world.sessions.apply(&input, product.clone(), now);
            if let (Some(path), Some(product)) = (&input.transcript_path, &product) {
                world.track_transcript(PathBuf::from(path), product);
            }
        }

        let event = input.event();
        let reply = match (event, product) {
            (HookEvent::PermissionRequest, Some(product)) if self.config().settings.approvals => {
                Some(self.ask(&input, product).await)
            }
            (HookEvent::PermissionRequest, None) if Self::is_assistant(input.cwd.as_deref()) => {
                // The agent answering a product's chat asks on that product's card.
                let card = self
                    .chatting_scope()
                    .map(|scope| peeps_core::teammates::product_of(&scope).to_owned())
                    .unwrap_or_else(|| HELPER_ID.to_owned());
                Some(self.ask(&input, card).await)
            }
            (HookEvent::SessionStart, Some(product)) => {
                Some(self.deliver(&product, Delivery::NextSession))
            }
            (HookEvent::PostToolUse, Some(product)) => {
                Some(self.deliver(&product, Delivery::NextStep))
            }
            _ if event.expects_reply() => Some(Reply::default()),
            _ => None,
        };
        self.publish();
        reply
    }

    pub fn decide(&self, request_id: u64, decision: Decision) -> bool {
        self.waiters()
            .remove(&request_id)
            .is_some_and(|waiter| waiter.send(decision).is_ok())
    }

    async fn ask(&self, input: &HookInput, product_id: String) -> Reply {
        let request_id = self.next_request.fetch_add(1, Ordering::Relaxed);
        let (sender, receiver) = oneshot::channel();
        let tool = input.tool_name.clone().unwrap_or_else(|| "a tool".into());
        let summary = describe_tool(&tool, input.tool_input.as_ref());
        self.waiters().insert(request_id, sender);
        self.world().permissions.push(PendingPermission {
            request_id,
            session_id: input.session_id.clone(),
            product_id,
            tool,
            summary,
        });
        self.publish();

        let _cleanup = PendingCleanup {
            app: self,
            request_id,
        };
        let decision = receiver.await.ok();
        if decision.is_some() {
            self.world()
                .sessions
                .resolve_permission(&input.session_id, Utc::now());
        }
        Reply {
            decision,
            context: None,
        }
    }

    fn deliver(&self, product_id: &str, at: Delivery) -> Reply {
        let delivered = self.notes().take(product_id, at, Utc::now());
        match delivered {
            Ok(notes) => Reply {
                decision: None,
                context: notes::for_agent(&notes),
            },
            Err(error) => {
                eprintln!("peeps: could not read notes: {error}");
                Reply::default()
            }
        }
    }
}

/// Clears a permission request once it is answered, or when the agent stops waiting for it.
struct PendingCleanup<'a> {
    app: &'a App,
    request_id: u64,
}

impl Drop for PendingCleanup<'_> {
    fn drop(&mut self) {
        self.app.waiters().remove(&self.request_id);
        self.app
            .world()
            .permissions
            .retain(|pending| pending.request_id != self.request_id);
        self.app.publish();
    }
}

#[cfg(test)]
mod tests {
    use std::sync::mpsc;
    use std::time::Duration;

    use peeps_core::mail::Draft;
    use peeps_core::numbers;

    use super::*;

    const CONFIG: &str = r#"
[[product]]
id = "funderly"
name = "Funderly"
paths = ["~/code/funderly"]

[[product.teammate]]
id = "sana"
name = "Sana"
role = "sales"

[[mail]]
address = "hello@funderly.app"
provider = "gmail"
"#;

    /// The window waits on this; a store locked twice in one expression once froze it for good.
    #[test]
    fn a_snapshot_with_every_store_in_use_comes_back() {
        let home = tempfile::tempdir().unwrap();
        // The only test here that touches the data folder, so setting it for the process is safe.
        std::env::set_var("PEEPS_HOME", home.path());
        std::fs::write(paths::config_file(), CONFIG).unwrap();

        let app = Arc::new(App::open(None).unwrap());
        let now = Utc::now();
        app.mail()
            .draft(
                &Draft {
                    from: "hello@funderly.app".into(),
                    to: "sara@example.com".into(),
                    subject: "Welcome".into(),
                    body: "Hi".into(),
                    in_reply_to: None,
                },
                now,
            )
            .unwrap();
        app.ledger()
            .add(&numbers::manual_payment("funderly", "49", "USD", "", now).unwrap())
            .unwrap();

        let (done, waited) = mpsc::channel();
        let worker = app.clone();
        std::thread::spawn(move || {
            let _ = done.send(worker.snapshot());
        });
        let snapshot = waited
            .recv_timeout(Duration::from_secs(10))
            .expect("the snapshot never came back; a lock is held twice");

        assert_eq!(snapshot.mail.outbox.len(), 1);
        assert_eq!(snapshot.numbers.products[0].week.payments, 1);
        assert_eq!(snapshot.teammates[0].scope, "funderly/sana");
        app.publish();
    }
}
