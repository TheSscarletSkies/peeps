//! Runs the user's own agent command for one prompt and returns what it printed.

use std::io::{Read, Write};
use std::path::Path;
use std::process::{Command, Stdio};
use std::thread;
use std::time::Duration;

use wait_timeout::ChildExt;

const PROMPT_PLACEHOLDER: &str = "{prompt}";

#[derive(Debug, thiserror::Error)]
pub enum AgentError {
    #[error("no agent command is configured")]
    NoCommand,
    #[error("could not run `{command}`: {source}")]
    Spawn {
        command: String,
        source: std::io::Error,
    },
    #[error("the agent took longer than {0} s")]
    Timeout(u64),
    #[error("the agent stopped with an error: {0}")]
    Failed(String),
    #[error("the agent returned nothing")]
    Empty,
    #[error(transparent)]
    Io(#[from] std::io::Error),
}

/// Runs the configured command and returns what it printed.
pub fn run(command: &[String], prompt: &str, timeout: Duration) -> Result<String, AgentError> {
    run_in(command, prompt, timeout, None)
}

/// Like [`run`], from a chosen working folder.
pub fn run_in(
    command: &[String],
    prompt: &str,
    timeout: Duration,
    cwd: Option<&Path>,
) -> Result<String, AgentError> {
    let (program, args) = command.split_first().ok_or(AgentError::NoCommand)?;
    let uses_placeholder = args.iter().any(|arg| arg.contains(PROMPT_PLACEHOLDER));
    let args: Vec<String> = args
        .iter()
        .map(|arg| arg.replace(PROMPT_PLACEHOLDER, prompt))
        .collect();

    let found = crate::programs::find(program).ok_or_else(|| AgentError::Spawn {
        command: program.clone(),
        source: std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "it isn't installed, or peeps can't see where it is",
        ),
    })?;
    let mut process = Command::new(found);
    crate::programs::quietly(&mut process);
    if let Some(path) = crate::programs::path_for_children() {
        process.env("PATH", path);
    }
    if let Some(dir) = cwd {
        process.current_dir(dir);
    }
    let mut child = process
        .args(&args)
        .stdin(if uses_placeholder {
            Stdio::null()
        } else {
            Stdio::piped()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|source| AgentError::Spawn {
            command: program.clone(),
            source,
        })?;

    if let Some(mut stdin) = child.stdin.take() {
        // An agent that quits straight away closes its input; its own error says why.
        match stdin.write_all(prompt.as_bytes()) {
            Err(error) if error.kind() != std::io::ErrorKind::BrokenPipe => {
                return Err(error.into())
            }
            _ => {}
        }
    }
    // Read both pipes on their own threads so a long reply cannot fill a pipe and stall the agent.
    let stdout = drain(child.stdout.take());
    let stderr = drain(child.stderr.take());

    let status = match child.wait_timeout(timeout)? {
        Some(status) => status,
        None => {
            child.kill()?;
            child.wait()?;
            return Err(AgentError::Timeout(timeout.as_secs()));
        }
    };
    let stdout = stdout.join().unwrap_or_default();
    let stderr = stderr.join().unwrap_or_default();

    if !status.success() {
        let detail = stderr.trim();
        return Err(AgentError::Failed(if detail.is_empty() {
            status.to_string()
        } else {
            tail(detail, 400)
        }));
    }
    let reply = stdout.trim();
    if reply.is_empty() {
        return Err(AgentError::Empty);
    }
    Ok(reply.to_owned())
}

fn drain<R: Read + Send + 'static>(pipe: Option<R>) -> thread::JoinHandle<String> {
    thread::spawn(move || {
        let mut text = String::new();
        if let Some(mut pipe) = pipe {
            let _ = pipe.read_to_string(&mut text);
        }
        text
    })
}

fn tail(text: &str, max: usize) -> String {
    let start = text.len().saturating_sub(max);
    let start = (start..text.len())
        .find(|&i| text.is_char_boundary(i))
        .unwrap_or(text.len());
    text[start..].to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sh(script: &str) -> Vec<String> {
        vec!["/bin/sh".into(), "-c".into(), script.into()]
    }

    #[cfg(unix)]
    #[test]
    fn passes_the_prompt_as_an_argument() {
        let command = vec![
            "/bin/sh".into(),
            "-c".into(),
            "printf 'reply: %s' \"$0\"".into(),
            "{prompt}".into(),
        ];
        let out = run(&command, "hello", Duration::from_secs(5)).unwrap();
        assert_eq!(out, "reply: hello");
    }

    #[cfg(unix)]
    #[test]
    fn falls_back_to_stdin_and_handles_long_output() {
        let out = run(
            &sh("cat; yes line | head -n 20000"),
            "from stdin",
            Duration::from_secs(10),
        )
        .unwrap();
        assert!(out.starts_with("from stdinline"));
        assert_eq!(out.lines().count(), 20_000);
    }

    #[cfg(unix)]
    #[test]
    fn reports_failures_and_timeouts() {
        let failed = run(
            &sh("echo 'not logged in' >&2; exit 1"),
            "x",
            Duration::from_secs(5),
        );
        assert!(matches!(failed, Err(AgentError::Failed(message)) if message == "not logged in"));

        let empty = run(&sh("true"), "x", Duration::from_secs(5));
        assert!(matches!(empty, Err(AgentError::Empty)));

        let slow = run(&sh("sleep 5"), "x", Duration::from_secs(1));
        assert!(matches!(slow, Err(AgentError::Timeout(1))));

        let missing = run(
            &["peeps-no-such-agent".to_owned()],
            "x",
            Duration::from_secs(1),
        );
        assert!(matches!(missing, Err(AgentError::Spawn { .. })));
        assert!(matches!(
            run(&[], "x", Duration::from_secs(1)),
            Err(AgentError::NoCommand)
        ));
    }

    #[test]
    fn tail_respects_character_boundaries() {
        assert_eq!(tail("héllo", 4), "llo");
        assert_eq!(tail("short", 100), "short");
    }
}
