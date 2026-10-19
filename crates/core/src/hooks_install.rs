//! Adds and removes peeps' entries in Claude Code's `settings.json` without touching anything else.

use serde_json::{json, Map, Value};

/// Events peeps listens to, with the hook timeout in seconds.
const EVENTS: &[(&str, u32)] = &[
    ("SessionStart", 10),
    ("UserPromptSubmit", 5),
    ("PreToolUse", 5),
    ("PostToolUse", 5),
    ("PermissionRequest", 600),
    ("Stop", 5),
    ("StopFailure", 5),
    ("SessionEnd", 5),
];

/// Adds a handler running `command` for every event peeps uses. Returns whether anything changed.
pub fn install(settings: &mut Value, command: &str) -> bool {
    let hooks = hooks_object(settings);
    let mut changed = false;
    for (event, timeout) in EVENTS {
        let groups = hooks
            .entry(*event)
            .or_insert_with(|| Value::Array(Vec::new()));
        let Some(groups) = groups.as_array_mut() else {
            continue;
        };
        if groups.iter().any(|group| group_runs(group, command)) {
            continue;
        }
        groups.push(json!({
            "hooks": [{ "type": "command", "command": command, "timeout": timeout }]
        }));
        changed = true;
    }
    changed
}

/// Removes every handler running `command`, and any group or event left empty.
pub fn uninstall(settings: &mut Value, command: &str) -> bool {
    let Some(hooks) = settings.get_mut("hooks").and_then(Value::as_object_mut) else {
        return false;
    };
    let mut changed = false;
    for groups in hooks.values_mut() {
        let Some(groups) = groups.as_array_mut() else {
            continue;
        };
        for group in groups.iter_mut() {
            if let Some(handlers) = group.get_mut("hooks").and_then(Value::as_array_mut) {
                let before = handlers.len();
                handlers.retain(|handler| !runs(handler, command));
                changed |= handlers.len() != before;
            }
        }
        groups.retain(|group| {
            group
                .get("hooks")
                .and_then(Value::as_array)
                .is_none_or(|handlers| !handlers.is_empty())
        });
    }
    hooks.retain(|_, groups| groups.as_array().is_none_or(|groups| !groups.is_empty()));
    changed
}

pub fn is_installed(settings: &Value, command: &str) -> bool {
    let Some(hooks) = settings.get("hooks").and_then(Value::as_object) else {
        return false;
    };
    EVENTS.iter().all(|(event, _)| {
        hooks
            .get(*event)
            .and_then(Value::as_array)
            .is_some_and(|groups| groups.iter().any(|group| group_runs(group, command)))
    })
}

fn hooks_object(settings: &mut Value) -> &mut Map<String, Value> {
    if !settings.is_object() {
        *settings = Value::Object(Map::new());
    }
    let root = settings.as_object_mut().expect("settings is an object");
    let hooks = root
        .entry("hooks")
        .or_insert_with(|| Value::Object(Map::new()));
    if !hooks.is_object() {
        *hooks = Value::Object(Map::new());
    }
    hooks.as_object_mut().expect("hooks is an object")
}

fn group_runs(group: &Value, command: &str) -> bool {
    group
        .get("hooks")
        .and_then(Value::as_array)
        .is_some_and(|handlers| handlers.iter().any(|handler| runs(handler, command)))
}

fn runs(handler: &Value, command: &str) -> bool {
    handler.get("command").and_then(Value::as_str) == Some(command)
}

#[cfg(test)]
mod tests {
    use super::*;

    const HOOK: &str = "/Applications/peeps.app/Contents/MacOS/peeps-hook";

    #[test]
    fn installs_once_and_keeps_existing_hooks() {
        let mut settings = json!({
            "model": "opus",
            "hooks": {
                "Stop": [{ "hooks": [{ "type": "command", "command": "say done" }] }]
            }
        });
        assert!(install(&mut settings, HOOK));
        assert!(!install(&mut settings, HOOK));
        assert!(is_installed(&settings, HOOK));
        assert_eq!(settings["model"], "opus");

        let stop = settings["hooks"]["Stop"].as_array().unwrap();
        assert_eq!(stop.len(), 2);
        assert_eq!(stop[0]["hooks"][0]["command"], "say done");
        assert_eq!(
            settings["hooks"]["PermissionRequest"][0]["hooks"][0]["timeout"],
            600
        );
    }

    #[test]
    fn uninstall_restores_the_original() {
        let original = json!({
            "hooks": {
                "Stop": [{ "hooks": [{ "type": "command", "command": "say done" }] }]
            }
        });
        let mut settings = original.clone();
        install(&mut settings, HOOK);
        assert!(uninstall(&mut settings, HOOK));
        assert_eq!(settings, original);
        assert!(!uninstall(&mut settings, HOOK));
    }

    #[test]
    fn handles_empty_settings() {
        let mut settings = Value::Null;
        install(&mut settings, HOOK);
        assert!(is_installed(&settings, HOOK));
        uninstall(&mut settings, HOOK);
        assert_eq!(settings, json!({ "hooks": {} }));
    }
}
