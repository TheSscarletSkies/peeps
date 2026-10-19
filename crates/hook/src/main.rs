//! Reads a hook payload from stdin, hands it to the peeps app and prints the app's answer.
//!
//! It never blocks the agent when the app is closed or replies with something unexpected:
//! every failure exits 0 with no output, which leaves the agent's normal behaviour in place.

use std::io::{self, BufRead, BufReader, Read, Write};
use std::process::ExitCode;

use interprocess::local_socket::{prelude::*, Stream};
use peeps_core::ipc;
use peeps_core::protocol::{hook_output, HookInput, Reply};

fn main() -> ExitCode {
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
