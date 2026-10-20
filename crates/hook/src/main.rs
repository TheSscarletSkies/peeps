//! Reads a hook payload from stdin, hands it to the peeps app and prints the app's answer.
//!
//! It never blocks the agent when the app is closed or replies with something unexpected:
//! every failure exits 0 with no output, which leaves the agent's normal behaviour in place.
//!
//! Run as `peeps-hook mcp`, it is instead the tool server that lets an agent act in peeps.

use std::io::{self, BufRead, BufReader, Read, Write};
use std::process::ExitCode;

use interprocess::local_socket::{prelude::*, Stream};
use peeps_core::protocol::{hook_output, HookInput, Reply};
use peeps_core::{ipc, mcp};
use serde_json::Value;

fn main() -> ExitCode {
    if std::env::args().nth(1).as_deref() == Some("mcp") {
        serve_tools();
        return ExitCode::SUCCESS;
    }
    let mut raw = String::new();
    if io::stdin().read_to_string(&mut raw).is_err() {
        return ExitCode::SUCCESS;
    }
    let Ok(input) = serde_json::from_str::<HookInput>(&raw) else {
        return ExitCode::SUCCESS;
    };
    if let Ok(Some(output)) = forward(&input) {
        let mut stdout = io::stdout().lock();
        let _ = writeln!(stdout, "{output}");
    }
    ExitCode::SUCCESS
}

fn forward(input: &HookInput) -> io::Result<Option<String>> {
    let stream = Stream::connect(ipc::socket_name()?)?;
    let mut reader = BufReader::new(stream);

    let mut line = serde_json::to_string(input)?;
    line.push('\n');
    reader.get_mut().write_all(line.as_bytes())?;
    reader.get_mut().flush()?;

    let event = input.event();
    if !event.expects_reply() {
        return Ok(None);
    }
    let mut answer = String::new();
    reader.read_line(&mut answer)?;
    let reply: Reply = serde_json::from_str(answer.trim()).unwrap_or_default();
    Ok(hook_output(event, &input.hook_event_name, &reply).map(|value| value.to_string()))
}

/// Answers the agent's tool requests line by line until it hangs up.
fn serve_tools() {
    let stdin = io::stdin();
    let mut stdout = io::stdout();
    for line in stdin.lock().lines() {
        let Ok(line) = line else { break };
        let Ok(message) = serde_json::from_str::<Value>(&line) else {
            continue;
        };
        if let Some(reply) = mcp::handle(&message, &mut call_app) {
            if writeln!(stdout, "{reply}")
                .and_then(|()| stdout.flush())
                .is_err()
            {
                break;
            }
        }
    }
}

fn call_app(name: &str, args: Value) -> Result<String, String> {
    let request = mcp::ToolRequest {
        peeps_tool: name.to_owned(),
        args,
    };
    let send = || -> io::Result<mcp::ToolResponse> {
        let stream = Stream::connect(ipc::socket_name()?)?;
        let mut reader = BufReader::new(stream);
        let mut line = serde_json::to_string(&request)?;
        line.push('\n');
        reader.get_mut().write_all(line.as_bytes())?;
        reader.get_mut().flush()?;
        let mut answer = String::new();
        reader.read_line(&mut answer)?;
        serde_json::from_str(answer.trim()).map_err(io::Error::other)
    };
    match send() {
        Ok(mcp::ToolResponse {
            error: Some(error), ..
        }) => Err(error),
        Ok(response) => Ok(response.text.unwrap_or_default()),
        Err(_) => Err("peeps isn't running. Ask the user to open it.".into()),
    }
}
