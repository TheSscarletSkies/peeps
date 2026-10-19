use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError, RwLock};

use chrono::Utc;
use peeps_core::advice::Tip;
use peeps_core::config::Config;
use peeps_core::notes::{self, Delivery, NoteStore};
use peeps_core::paths;
use peeps_core::protocol::{Decision, HookEvent, HookInput, Reply};
use peeps_core::session::{describe_tool, Sessions};
use peeps_core::snapshot::{self, CheckResults, PendingPermission, Snapshot};
use peeps_core::usage::Transcript;
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tokio::sync::oneshot;

const RECENT_NOTES: usize = 20;
const STARTER_CONFIG: &str = "# peeps: add products from the app, or by hand.\n\
# Every option is described in the README; examples/ has full setups.\n";
pub const SNAPSHOT_EVENT: &str = "snapshot";

#[derive(Default)]
pub struct World {
    pub sessions: Sessions,
    pub checks: CheckResults,
    pub transcripts: HashMap<PathBuf, Transcript>,
    pub transcript_products: HashMap<PathBuf, String>,
    pub permissions: Vec<PendingPermission>,
    pub tips: Vec<Tip>,
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
    pub config_error: Option<String>,
}

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
    world: Mutex<World>,
    notes: Mutex<NoteStore>,
    waiters: Mutex<HashMap<u64, oneshot::Sender<Decision>>>,
    next_request: AtomicU64,
    handle: AppHandle,
}

impl App {
    pub fn load(handle: AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        std::fs::create_dir_all(paths::data_dir())?;
        let config_path = paths::config_file();
        if !config_path.exists() {
            std::fs::write(&config_path, STARTER_CONFIG)?;
        }
        Ok(Self {
            loaded: RwLock::new(Loaded::read()),
            rescan: AtomicBool::new(true),
            world: Mutex::default(),
            notes: Mutex::new(NoteStore::open(&paths::database_file())?),
            waiters: Mutex::default(),
            next_request: AtomicU64::new(1),
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

    fn waiters(&self) -> MutexGuard<'_, HashMap<u64, oneshot::Sender<Decision>>> {
        self.waiters.lock().unwrap_or_else(PoisonError::into_inner)
    }

    pub fn snapshot(&self) -> AppSnapshot {
        let config = self.config();
        let notes = self.notes().recent(RECENT_NOTES).unwrap_or_default();
        let world = self.world();
        AppSnapshot {
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
            config_error: self.config_error(),
        }
    }

    pub fn publish(&self) {
        if let Err(error) = self.handle.emit(SNAPSHOT_EVENT, self.snapshot()) {
            eprintln!("peeps: could not update the window: {error}");
        }
    }

    pub fn product_for(&self, cwd: Option<&str>) -> Option<String> {
        let config = self.config();
        cwd.and_then(|dir| config.product_for_dir(Path::new(dir)))
            .map(|product| product.id.clone())
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
