//! Friends over ntfy: listens on your inbox and your friends' status, and sends hearts and pokes.

use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::time::Duration;

use chrono::{DateTime, Utc};
use peeps_core::friends::{
    self, Circle, FriendView, Heard, Incoming, Message, Reaction, Received, HEARTBEAT,
};
use peeps_core::paths;
use serde::Serialize;

use crate::state::App;

pub const REACTION_EVENT: &str = "reaction";

#[derive(Default)]
pub struct Friends {
    circle: Mutex<Option<Circle>>,
    heard: Mutex<HashMap<String, Heard>>,
    /// Bumped when the friend list changes, so the listener reconnects with the new channels.
    generation: AtomicU64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FriendsView {
    pub code: String,
    pub name: String,
    pub friends: Vec<FriendView>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReactionPayload {
    from: String,
    reaction: Reaction,
    line: String,
}

fn file() -> std::path::PathBuf {
    paths::data_dir().join("friends.json")
}

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(PoisonError::into_inner)
}

impl Friends {
    pub fn load() -> Self {
        let circle = std::fs::read_to_string(file())
            .ok()
            .and_then(|text| serde_json::from_str(&text).ok());
        Self {
            circle: Mutex::new(circle),
            ..Self::default()
        }
    }

    pub fn circle(&self) -> Option<Circle> {
        lock(&self.circle).clone()
    }

    fn save(&self, circle: Circle) -> Result<(), String> {
        let text = serde_json::to_string_pretty(&circle).map_err(|e| e.to_string())?;
        std::fs::write(file(), text).map_err(|e| e.to_string())?;
        *lock(&self.circle) = Some(circle);
        self.generation.fetch_add(1, Ordering::Relaxed);
        Ok(())
    }

    pub fn view(&self, now: DateTime<Utc>) -> Option<FriendsView> {
        let circle = self.circle()?;
        let heard = lock(&self.heard).clone();
        Some(FriendsView {
            friends: circle
                .friends
                .iter()
                .map(|friend| {
                    let seen = heard.get(&friend.code).cloned().unwrap_or_default();
                    FriendView {
                        code: friend.code.clone(),
                        name: friend.name.clone(),
                        presence: seen.presence(now),
                        focus_until: seen.focus_until.filter(|until| *until > now),
                        area: seen.area,
                    }
                })
                .collect(),
            code: circle.code,
            name: circle.name,
        })
    }

    pub fn start(&self, name: &str) -> Result<(), String> {
        let name = name.trim();
        let circle = match self.circle() {
            Some(mut circle) => {
                circle.name = name.to_owned();
                circle
            }
            None => Circle::new(name),
        };
        self.save(circle)
    }

    pub fn add(&self, code: &str) -> Result<(), String> {
        let code = friends::normalize(code)
            .ok_or("That doesn't look like a peeps code. It's 10 letters and numbers.")?;
        let mut circle = self.circle().ok_or("Pick your name first.")?;
        if code == circle.code {
            return Err("That's your own code. Send it to a friend instead.".into());
        }
        circle.add_by_hand(&code);
        let hello = Message::Hello {
            code: circle.code.clone(),
            name: circle.name.clone(),
        };
        self.save(circle)?;
        send(&friends::inbox(&code), &code, &hello)
    }

    pub fn remove(&self, code: &str) -> Result<(), String> {
        let mut circle = self.circle().ok_or("No friends yet.")?;
        circle.unfriend(code);
        self.save(circle)
    }

    pub fn react(&self, code: &str, reaction: Reaction) -> Result<(), String> {
        let circle = self.circle().ok_or("Pick your name first.")?;
        let message = Message::React {
            code: circle.code.clone(),
            name: circle.name.clone(),
            reaction,
        };
        send(&friends::inbox(code), code, &message)
    }
}

fn send(topic: &str, code: &str, message: &Message) -> Result<(), String> {
    friends::post(topic, code, message)
}

fn handle(app: &App, incoming: &Incoming) {
    let Some(mut circle) = app.friends.circle() else {
        return;
    };
    let before = circle.clone();
    let received = {
        let mut heard = lock(&app.friends.heard);
        circle.receive(&mut heard, incoming, Utc::now())
    };
    let Some(received) = received else {
        return;
    };
    if circle != before {
        let _ = app.friends.save(circle);
    }
    match received {
        Received::NewFriend { name } => {
            app.notify("A new friend", &format!("{name} added you on peeps."));
        }
        Received::Reaction {
            from,
            reaction,
            line,
        } => {
            app.notify(&from, &line);
            app.emit(
                REACTION_EVENT,
                ReactionPayload {
                    from,
                    reaction,
                    line,
                },
            );
        }
        Received::Updated => {}
    }
    app.publish();
}

/// Streams every channel in one long request; reconnects when the friend list changes or the line drops.
pub fn listen(app: Arc<App>) {
    let mut seen: HashSet<String> = HashSet::new();
    loop {
        let generation = app.friends.generation.load(Ordering::Relaxed);
        let Some(circle) = app.friends.circle() else {
            std::thread::sleep(Duration::from_secs(5));
            continue;
        };
        let url = friends::stream_url(&friends::relay(), &circle.topics());
        let streamed = friends::stream(&url, |line| {
            if let Some(incoming) = friends::parse_line(line) {
                if seen.insert(incoming.id.clone()) {
                    handle(&app, &incoming);
                }
            }
            app.friends.generation.load(Ordering::Relaxed) == generation
        });
        if streamed.is_err() {
            std::thread::sleep(Duration::from_secs(15));
        }
        if seen.len() > 2000 {
            seen.clear();
        }
    }
}

/// Tells friends whether you are focusing: at once when it changes, and every few minutes to say you're here.
pub async fn heartbeat(app: Arc<App>) {
    let mut interval = tokio::time::interval(Duration::from_secs(10));
    let mut last: Option<(DateTime<Utc>, Option<DateTime<Utc>>, u64)> = None;
    loop {
        interval.tick().await;
        let Some(circle) = app.friends.circle() else {
            continue;
        };
        let now = Utc::now();
        let focusing = app
            .focus()
            .as_ref()
            .and_then(|session| session.view(now))
            .filter(|view| view.phase == peeps_core::focus::Phase::Focus);
        let focus_until = focusing.as_ref().map(|view| view.ends_at);
        let area = focusing.and_then(|view| view.area);
        // A new friend hears your name and focus at once, not at the next heartbeat.
        let generation = app.friends.generation.load(Ordering::Relaxed);
        let due = match last {
            None => true,
            Some((at, until, seen)) => {
                until != focus_until || seen != generation || now - at >= HEARTBEAT
            }
        };
        if !due {
            continue;
        }
        let message = Message::Status {
            name: circle.name.clone(),
            focus_until,
            area,
        };
        let topic = friends::status(&circle.code);
        let code = circle.code.clone();
        let sent = tokio::task::spawn_blocking(move || send(&topic, &code, &message)).await;
        if matches!(sent, Ok(Ok(()))) {
            last = Some((now, focus_until, generation));
        }
    }
}
