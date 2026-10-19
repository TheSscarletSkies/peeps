//! Messages exchanged between `peeps-hook` and the desktop app, one JSON object per line.

use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};

/// The payload an agent passes to its hook. Fields peeps does not read are kept in `extra`.
#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
pub struct HookInput {
    pub session_id: String,
    pub hook_event_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transcript_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_input: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

impl HookInput {
    pub fn event(&self) -> HookEvent {
        HookEvent::from_name(&self.hook_event_name)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HookEvent {
    SessionStart,
    UserPromptSubmit,
    PreToolUse,
    PermissionRequest,
    PostToolUse,
    PostToolUseFailure,
    Notification,
    Stop,
    StopFailure,
    SessionEnd,
    Other,
}

impl HookEvent {
    pub fn from_name(name: &str) -> Self {
        match name {
            "SessionStart" => Self::SessionStart,
            "UserPromptSubmit" => Self::UserPromptSubmit,
            "PreToolUse" => Self::PreToolUse,
            "PermissionRequest" => Self::PermissionRequest,
            "PostToolUse" => Self::PostToolUse,
            "PostToolUseFailure" => Self::PostToolUseFailure,
            "Notification" => Self::Notification,
            "Stop" => Self::Stop,
            "StopFailure" => Self::StopFailure,
            "SessionEnd" => Self::SessionEnd,
            _ => Self::Other,
        }
    }

    /// Events whose hook waits for the app before letting the agent continue.
    pub fn expects_reply(self) -> bool {
        matches!(
            self,
            Self::SessionStart | Self::PermissionRequest | Self::PostToolUse
        )
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Decision {
    Allow,
    Deny,
}

/// The app's answer to a hook. An empty reply leaves the agent's default behaviour untouched.
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize, Serialize)]
pub struct Reply {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decision: Option<Decision>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub context: Option<String>,
}

/// Builds the JSON the hook prints to stdout for Claude Code, or `None` to print nothing.
pub fn hook_output(event: HookEvent, event_name: &str, reply: &Reply) -> Option<Value> {
    match event {
        HookEvent::PermissionRequest => {
            let decision = match reply.decision? {
                Decision::Allow => json!({ "behavior": "allow" }),
                Decision::Deny => json!({ "behavior": "deny", "message": "Denied from peeps." }),
            };
            Some(json!({
                "hookSpecificOutput": {
                    "hookEventName": event_name,
                    "decision": decision,
                }
            }))
        }
        HookEvent::SessionStart | HookEvent::PostToolUse => {
            let context = reply.context.as_deref().filter(|text| !text.is_empty())?;
            Some(json!({
                "hookSpecificOutput": {
                    "hookEventName": event_name,
                    "additionalContext": context,
                }
            }))
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input(event: &str) -> HookInput {
        serde_json::from_value(json!({
            "session_id": "s1",
            "hook_event_name": event,
            "cwd": "/code/app",
            "permission_mode": "default",
        }))
        .unwrap()
    }

    #[test]
    fn keeps_unknown_fields() {
        let parsed = input("Stop");
        assert_eq!(parsed.extra["permission_mode"], "default");
        assert_eq!(parsed.event(), HookEvent::Stop);
    }

    #[test]
    fn permission_reply_maps_to_claude_decision() {
        let reply = Reply {
            decision: Some(Decision::Allow),
            context: None,
        };
        let out = hook_output(HookEvent::PermissionRequest, "PermissionRequest", &reply).unwrap();
        assert_eq!(out["hookSpecificOutput"]["decision"]["behavior"], "allow");
    }

    #[test]
    fn empty_reply_prints_nothing() {
        let reply = Reply::default();
        assert!(hook_output(HookEvent::PermissionRequest, "PermissionRequest", &reply).is_none());
        assert!(hook_output(HookEvent::SessionStart, "SessionStart", &reply).is_none());
    }

    #[test]
    fn notes_become_additional_context() {
        let reply = Reply {
            decision: None,
            context: Some("Use annual pricing.".into()),
        };
        let out = hook_output(HookEvent::SessionStart, "SessionStart", &reply).unwrap();
        assert_eq!(
            out["hookSpecificOutput"]["additionalContext"],
            "Use annual pricing."
        );
    }

    #[test]
    fn only_blocking_events_wait_for_a_reply() {
        assert!(HookEvent::PermissionRequest.expects_reply());
        assert!(!HookEvent::PreToolUse.expects_reply());
        assert!(!HookEvent::from_name("Unknown").expects_reply());
    }
}
