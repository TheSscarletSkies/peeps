use std::collections::HashMap;
use std::path::PathBuf;

use chrono::{DateTime, Utc};
use serde::Serialize;
use serde_json::Value;

use crate::protocol::{HookEvent, HookInput};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "state", rename_all = "camelCase")]
pub enum Activity {
    Idle,
    Working,
    AwaitingPermission { tool: String, summary: String },
    Failed { reason: String },
}

#[derive(Debug, Clone)]
pub struct Session {
    pub id: String,
    pub product_id: Option<String>,
    pub transcript: Option<PathBuf>,
    pub activity: Activity,
    pub working_since: Option<DateTime<Utc>>,
    pub last_event_at: DateTime<Utc>,
}

/// Live agent sessions, rebuilt from hook events.
#[derive(Debug, Default)]
pub struct Sessions {
    sessions: HashMap<String, Session>,
    last_activity: HashMap<String, DateTime<Utc>>,
}

impl Sessions {
    pub fn apply(&mut self, input: &HookInput, product_id: Option<String>, now: DateTime<Utc>) {
        if let Some(product) = &product_id {
            self.last_activity.insert(product.clone(), now);
        }
        let event = input.event();
        if event == HookEvent::SessionEnd {
            self.sessions.remove(&input.session_id);
            return;
        }

        let session = self
            .sessions
            .entry(input.session_id.clone())
            .or_insert_with(|| Session {
                id: input.session_id.clone(),
                product_id: product_id.clone(),
                transcript: None,
                activity: Activity::Idle,
                working_since: None,
                last_event_at: now,
            });
        session.last_event_at = now;
        if session.product_id.is_none() {
            session.product_id = product_id;
        }
        if let Some(path) = &input.transcript_path {
            session.transcript = Some(PathBuf::from(path));
        }

        match event {
            HookEvent::UserPromptSubmit | HookEvent::PreToolUse | HookEvent::PostToolUse => {
                session.set_working(now);
            }
            HookEvent::PermissionRequest => {
                let tool = input.tool_name.clone().unwrap_or_else(|| "a tool".into());
                let summary = describe_tool(&tool, input.tool_input.as_ref());
                session.activity = Activity::AwaitingPermission { tool, summary };
            }
            HookEvent::Stop => {
                session.activity = Activity::Idle;
                session.working_since = None;
            }
            HookEvent::StopFailure => {
                session.activity = Activity::Failed {
                    reason: input
                        .message
                        .clone()
                        .unwrap_or_else(|| "The agent stopped with an error.".into()),
                };
                session.working_since = None;
            }
            _ => {}
        }
    }

    /// Marks a permission as answered so the session goes back to work.
    pub fn resolve_permission(&mut self, session_id: &str, now: DateTime<Utc>) {
        if let Some(session) = self.sessions.get_mut(session_id) {
            session.set_working(now);
        }
    }

    pub fn for_product<'a>(&'a self, product_id: &'a str) -> impl Iterator<Item = &'a Session> {
        self.sessions
            .values()
            .filter(move |session| session.product_id.as_deref() == Some(product_id))
    }

    pub fn last_activity(&self, product_id: &str) -> Option<DateTime<Utc>> {
        self.last_activity.get(product_id).copied()
    }

    pub fn record_activity(&mut self, product_id: &str, at: DateTime<Utc>) {
        let entry = self
            .last_activity
            .entry(product_id.to_owned())
            .or_insert(at);
        *entry = (*entry).max(at);
    }

    pub fn all(&self) -> impl Iterator<Item = &Session> {
        self.sessions.values()
    }
}

impl Session {
    fn set_working(&mut self, now: DateTime<Utc>) {
        if self.activity != Activity::Working {
            self.activity = Activity::Working;
        }
        self.working_since.get_or_insert(now);
    }
}

/// A short, human description of what a tool call will do.
pub fn describe_tool(tool: &str, input: Option<&Value>) -> String {
    let field = |key: &str| {
        input
            .and_then(|value| value.get(key))
            .and_then(Value::as_str)
            .map(str::to_owned)
    };
    let detail = match tool {
        "Bash" => field("command"),
        "Edit" | "Write" | "Read" | "NotebookEdit" => field("file_path"),
        "WebFetch" => field("url"),
        _ => None,
    };
    match detail {
        Some(detail) => truncate(&detail, 120),
        None => tool.to_owned(),
    }
}

fn truncate(text: &str, max: usize) -> String {
    let line = text.lines().next().unwrap_or_default();
    if line.chars().count() <= max && line.len() == text.len() {
        return line.to_owned();
    }
    let cut: String = line.chars().take(max).collect();
    format!("{cut}…")
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeDelta;
    use serde_json::json;

    fn event(name: &str, extra: Value) -> HookInput {
        let mut value = json!({ "session_id": "s1", "hook_event_name": name });
        value
            .as_object_mut()
            .unwrap()
            .extend(extra.as_object().unwrap().clone());
        serde_json::from_value(value).unwrap()
    }

    fn product() -> Option<String> {
        Some("shop".into())
    }

    #[test]
    fn follows_a_session_through_its_life() {
        let mut sessions = Sessions::default();
        let start = Utc::now();
        sessions.apply(&event("SessionStart", json!({})), product(), start);
        assert_eq!(
            sessions.for_product("shop").next().unwrap().activity,
            Activity::Idle
        );

        sessions.apply(&event("UserPromptSubmit", json!({})), product(), start);
        sessions.apply(
            &event("PreToolUse", json!({})),
            product(),
            start + TimeDelta::minutes(5),
        );
        let session = sessions.for_product("shop").next().unwrap();
        assert_eq!(session.activity, Activity::Working);
        assert_eq!(session.working_since, Some(start));

        sessions.apply(
            &event(
                "PermissionRequest",
                json!({ "tool_name": "Bash", "tool_input": { "command": "git push" } }),
            ),
            product(),
            start,
        );
        assert_eq!(
            sessions.for_product("shop").next().unwrap().activity,
            Activity::AwaitingPermission {
                tool: "Bash".into(),
                summary: "git push".into()
            }
        );

        sessions.apply(&event("Stop", json!({})), product(), start);
        let session = sessions.for_product("shop").next().unwrap();
        assert_eq!(session.activity, Activity::Idle);
        assert_eq!(session.working_since, None);

        sessions.apply(&event("SessionEnd", json!({})), product(), start);
        assert!(sessions.for_product("shop").next().is_none());
        assert_eq!(sessions.last_activity("shop"), Some(start));
    }

    #[test]
    fn failure_keeps_the_reason() {
        let mut sessions = Sessions::default();
        sessions.apply(
            &event("StopFailure", json!({ "message": "rate limited" })),
            product(),
            Utc::now(),
        );
        assert_eq!(
            sessions.all().next().unwrap().activity,
            Activity::Failed {
                reason: "rate limited".into()
            }
        );
    }

    #[test]
    fn describes_tools() {
        assert_eq!(
            describe_tool("Edit", Some(&json!({ "file_path": "src/app.ts" }))),
            "src/app.ts"
        );
        assert_eq!(describe_tool("Task", None), "Task");
        assert_eq!(
            describe_tool(
                "Bash",
                Some(&json!({ "command": "npm test\nnpm run lint" }))
            ),
            "npm test…"
        );
    }
}
