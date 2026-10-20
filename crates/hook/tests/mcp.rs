//! Drives `peeps-hook mcp` the way Claude Code does: JSON-RPC lines in, lines out.

use std::io::Write;
use std::process::{Command, Stdio};

use serde_json::{json, Value};

fn converse(messages: &[Value]) -> Vec<Value> {
    let mut child = Command::new(env!("CARGO_BIN_EXE_peeps-hook"))
        .arg("mcp")
        // Keeps the test away from the real peeps data folder.
        .env("PEEPS_HOME", std::env::temp_dir().join("peeps-mcp-test"))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .unwrap();
    let mut stdin = child.stdin.take().unwrap();
    for message in messages {
        writeln!(stdin, "{message}").unwrap();
    }
    drop(stdin);
    let output = child.wait_with_output().unwrap();
    String::from_utf8(output.stdout)
        .unwrap()
        .lines()
        .map(|line| serde_json::from_str(line).unwrap())
        .collect()
}

#[test]
fn speaks_mcp_over_stdio() {
    let replies = converse(&[
        json!({ "jsonrpc": "2.0", "id": 1, "method": "initialize", "params": { "protocolVersion": "2025-06-18" } }),
        json!({ "jsonrpc": "2.0", "method": "notifications/initialized" }),
        json!({ "jsonrpc": "2.0", "id": 2, "method": "tools/list" }),
        json!({ "jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": { "name": "list_todos", "arguments": {} } }),
    ]);
    assert_eq!(replies.len(), 3, "the notification gets no reply");
    assert_eq!(replies[0]["result"]["serverInfo"]["name"], "peeps");
    let tools = replies[1]["result"]["tools"].as_array().unwrap();
    assert!(tools.iter().any(|tool| tool["name"] == "peeps_overview"));
    assert_eq!(replies[2]["result"]["isError"], true);
    assert!(replies[2]["result"]["content"][0]["text"]
        .as_str()
        .unwrap()
        .contains("isn't running"));
}
