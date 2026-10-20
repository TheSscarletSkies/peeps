//! The Model Context Protocol, as much as peeps needs: the agent lists the tools and calls them.
//! Messages are JSON-RPC 2.0, one per line on stdin and stdout.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::tools;

const LATEST: &str = "2025-06-18";

/// One request or notification from the agent, or a tool call forwarded to the app.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ToolRequest {
    pub peeps_tool: String,
    #[serde(default)]
    pub args: Value,
}

/// The app's answer to a tool call: text for the agent, or why it failed.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct ToolResponse {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Answers one message. Notifications get no answer. `call` runs a tool and returns its text.
pub fn handle(
    message: &Value,
    call: &mut dyn FnMut(&str, Value) -> Result<String, String>,
) -> Option<Value> {
    let id = message.get("id")?.clone();
    let method = message.get("method").and_then(Value::as_str).unwrap_or("");
    let params = message.get("params").cloned().unwrap_or(Value::Null);
    let result = match method {
        "initialize" => json!({
            "protocolVersion": params
                .get("protocolVersion")
                .and_then(Value::as_str)
                .unwrap_or(LATEST),
            "capabilities": { "tools": {} },
            "serverInfo": { "name": "peeps", "version": env!("CARGO_PKG_VERSION") },
            "instructions": "peeps keeps the user's products, to-dos, reminders, scheduled drafts, product briefs and email. Use these tools to act on what the user asks, then say briefly what you did. Emails are only drafted; the user reads and sends them in peeps.",
        }),
        "ping" => json!({}),
        "tools/list" => json!({ "tools": tools::definitions() }),
        "tools/call" => {
            let name = params.get("name").and_then(Value::as_str).unwrap_or("");
            let args = params.get("arguments").cloned().unwrap_or(Value::Null);
            let (text, is_error) = match call(name, args) {
                Ok(text) => (text, false),
                Err(error) => (error, true),
            };
            json!({ "content": [{ "type": "text", "text": text }], "isError": is_error })
        }
        other => {
            return Some(json!({
                "jsonrpc": "2.0",
                "id": id,
                "error": { "code": -32601, "message": format!("unknown method {other}") },
            }))
        }
    };
    Some(json!({ "jsonrpc": "2.0", "id": id, "result": result }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(message: Value) -> Option<Value> {
        handle(&message, &mut |name, args| match name {
            "list_todos" => Ok("1. Pay rent".into()),
            _ => Err(format!("{name} failed with {args}")),
        })
    }

    #[test]
    fn introduces_itself_in_the_agents_protocol_version() {
        let reply = run(json!({
            "jsonrpc": "2.0", "id": 1, "method": "initialize",
            "params": { "protocolVersion": "2025-03-26", "capabilities": {} }
        }))
        .unwrap();
        assert_eq!(reply["result"]["protocolVersion"], "2025-03-26");
        assert_eq!(reply["result"]["serverInfo"]["name"], "peeps");
        assert!(reply["result"]["capabilities"]["tools"].is_object());
    }

    #[test]
    fn lists_and_calls_tools() {
        let list = run(json!({ "jsonrpc": "2.0", "id": 2, "method": "tools/list" })).unwrap();
        let tools = list["result"]["tools"].as_array().unwrap();
        assert!(tools.iter().any(|tool| tool["name"] == "add_todo"));
        assert!(tools[0]["inputSchema"].is_object());

        let ok = run(json!({
            "jsonrpc": "2.0", "id": 3, "method": "tools/call",
            "params": { "name": "list_todos", "arguments": {} }
        }))
        .unwrap();
        assert_eq!(ok["result"]["content"][0]["text"], "1. Pay rent");
        assert_eq!(ok["result"]["isError"], false);

        let failed = run(json!({
            "jsonrpc": "2.0", "id": 4, "method": "tools/call",
            "params": { "name": "add_todo", "arguments": {} }
        }))
        .unwrap();
        assert_eq!(failed["result"]["isError"], true);
    }

    #[test]
    fn notifications_get_no_answer_and_unknown_methods_an_error() {
        assert!(run(json!({ "jsonrpc": "2.0", "method": "notifications/initialized" })).is_none());
        let unknown =
            run(json!({ "jsonrpc": "2.0", "id": "x", "method": "resources/list" })).unwrap();
        assert_eq!(unknown["error"]["code"], -32601);
        assert_eq!(unknown["id"], "x");
    }
}
