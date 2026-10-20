//! Drafts written by the user's own agent command, kept in the local database.

use std::io::{Read, Write};
use std::path::Path;
use std::process::{Command, Stdio};
use std::thread;
use std::time::Duration;

use chrono::{DateTime, Utc};
use rusqlite::{params, Connection};
use serde::Serialize;
use wait_timeout::ChildExt;

const PROMPT_PLACEHOLDER: &str = "{prompt}";

#[derive(Debug, thiserror::Error)]
pub enum DraftError {
    #[error("no draft command is configured")]
    NoCommand,
    #[error("could not run `{command}`: {source}")]
    Spawn {
        command: String,
        source: std::io::Error,
    },
    #[error("the draft took longer than {0} s")]
    Timeout(u64),
    #[error("the agent stopped with an error: {0}")]
    Failed(String),
    #[error("the agent returned an empty draft")]
    Empty,
    #[error(transparent)]
    Io(#[from] std::io::Error),
}

/// A human name for a draft kind, used in the prompt and the interface.
pub fn label(kind: &str) -> String {
    match kind {
        "linkedin" => "LinkedIn post".into(),
        "x" => "post for X".into(),
        other => other.replace(['-', '_'], " "),
    }
}

/// The request sent to the agent.
pub fn prompt(kind: &str, topic: &str, voice: Option<&str>) -> String {
    let label = label(kind);
    let mut text = format!("Write a {label} about the topic below.\n\n");
    if let Some(voice) = voice.map(str::trim).filter(|voice| !voice.is_empty()) {
        text.push_str("Write it in the voice described in this guide:\n\n<voice>\n");
        text.push_str(voice);
        text.push_str("\n</voice>\n\n");
    }
    text.push_str("Topic:\n");
    text.push_str(topic.trim());
    text.push_str(&format!(
        "\n\nReply with the {label} only, ready to paste, with no preamble."
    ));
    text
}

/// Runs the configured command and returns what it printed.
pub fn run(command: &[String], prompt: &str, timeout: Duration) -> Result<String, DraftError> {
    run_in(command, prompt, timeout, None)
}

/// Like [`run`], from a chosen working folder.
pub fn run_in(
    command: &[String],
    prompt: &str,
    timeout: Duration,
    cwd: Option<&Path>,
) -> Result<String, DraftError> {
    let (program, args) = command.split_first().ok_or(DraftError::NoCommand)?;
    let uses_placeholder = args.iter().any(|arg| arg.contains(PROMPT_PLACEHOLDER));
    let args: Vec<String> = args
        .iter()
        .map(|arg| arg.replace(PROMPT_PLACEHOLDER, prompt))
        .collect();

    let mut process = Command::new(crate::paths::expand_home(program));
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
        .map_err(|source| DraftError::Spawn {
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
            return Err(DraftError::Timeout(timeout.as_secs()));
        }
    };
    let stdout = stdout.join().unwrap_or_default();
    let stderr = stderr.join().unwrap_or_default();

    if !status.success() {
        let detail = stderr.trim();
        return Err(DraftError::Failed(if detail.is_empty() {
            status.to_string()
        } else {
            tail(detail, 400)
        }));
    }
    let draft = stdout.trim();
    if draft.is_empty() {
        return Err(DraftError::Empty);
    }
    Ok(draft.to_owned())
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Draft {
    pub id: i64,
    pub kind: String,
    pub topic: String,
    pub text: String,
    pub created_at: DateTime<Utc>,
}

pub struct DraftStore {
    db: Connection,
}

const SCHEMA: &str = "
    CREATE TABLE IF NOT EXISTS drafts (
        id INTEGER PRIMARY KEY,
        kind TEXT NOT NULL,
        topic TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
";

impl DraftStore {
    pub fn open(path: &Path) -> rusqlite::Result<Self> {
        Self::init(Connection::open(path)?)
    }

    pub fn in_memory() -> rusqlite::Result<Self> {
        Self::init(Connection::open_in_memory()?)
    }

    fn init(db: Connection) -> rusqlite::Result<Self> {
        db.execute_batch(SCHEMA)?;
        Ok(Self { db })
    }

    pub fn add(
        &self,
        kind: &str,
        topic: &str,
        text: &str,
        now: DateTime<Utc>,
    ) -> rusqlite::Result<Draft> {
        self.db.execute(
            "INSERT INTO drafts (kind, topic, text, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![kind, topic.trim(), text, now],
        )?;
        Ok(Draft {
            id: self.db.last_insert_rowid(),
            kind: kind.to_owned(),
            topic: topic.trim().to_owned(),
            text: text.to_owned(),
            created_at: now,
        })
    }

    pub fn recent(&self, limit: usize) -> rusqlite::Result<Vec<Draft>> {
        let mut query = self.db.prepare(
            "SELECT id, kind, topic, text, created_at FROM drafts ORDER BY id DESC LIMIT ?1",
        )?;
        let rows = query.query_map(params![limit as i64], |row| {
            Ok(Draft {
                id: row.get(0)?,
                kind: row.get(1)?,
                topic: row.get(2)?,
                text: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?;
        rows.collect()
    }

    pub fn count_since(&self, since: DateTime<Utc>) -> rusqlite::Result<usize> {
        self.db.query_row(
            "SELECT COUNT(*) FROM drafts WHERE created_at >= ?1",
            params![since],
            |row| row.get::<_, i64>(0).map(|n| n as usize),
        )
    }

    pub fn delete(&self, id: i64) -> rusqlite::Result<bool> {
        Ok(self
            .db
            .execute("DELETE FROM drafts WHERE id = ?1", params![id])?
            > 0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sh(script: &str) -> Vec<String> {
        vec!["/bin/sh".into(), "-c".into(), script.into()]
    }

    #[test]
    fn prompt_includes_voice_only_when_given() {
        let with = prompt("linkedin", " shipping on Fridays ", Some("Direct. Dry."));
        assert!(with.starts_with("Write a LinkedIn post about the topic below."));
        assert!(with.contains("<voice>\nDirect. Dry.\n</voice>"));
        assert!(with.contains("Topic:\nshipping on Fridays\n"));

        let without = prompt("weekly-update", "launch", Some("  "));
        assert!(!without.contains("<voice>"));
        assert!(without.starts_with("Write a weekly update about"));
    }

    #[cfg(unix)]
    #[test]
    fn passes_the_prompt_as_an_argument() {
        let command = vec![
            "/bin/sh".into(),
            "-c".into(),
            "printf 'draft: %s' \"$0\"".into(),
            "{prompt}".into(),
        ];
        let out = run(&command, "hello", Duration::from_secs(5)).unwrap();
        assert_eq!(out, "draft: hello");
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
        assert!(matches!(failed, Err(DraftError::Failed(message)) if message == "not logged in"));

        let empty = run(&sh("true"), "x", Duration::from_secs(5));
        assert!(matches!(empty, Err(DraftError::Empty)));

        let slow = run(&sh("sleep 5"), "x", Duration::from_secs(1));
        assert!(matches!(slow, Err(DraftError::Timeout(1))));

        let missing = run(
            &["peeps-no-such-agent".to_owned()],
            "x",
            Duration::from_secs(1),
        );
        assert!(matches!(missing, Err(DraftError::Spawn { .. })));
        assert!(matches!(
            run(&[], "x", Duration::from_secs(1)),
            Err(DraftError::NoCommand)
        ));
    }

    #[test]
    fn stores_drafts_newest_first() {
        let store = DraftStore::in_memory().unwrap();
        let now = Utc::now();
        store.add("linkedin", "a", "first", now).unwrap();
        let second = store.add("x", "b", "second", now).unwrap();
        let recent = store.recent(5).unwrap();
        assert_eq!(recent[0].text, "second");
        assert_eq!(
            store
                .count_since(now - chrono::TimeDelta::hours(1))
                .unwrap(),
            2
        );
        assert!(store.delete(second.id).unwrap());
        assert_eq!(store.recent(5).unwrap().len(), 1);
    }

    #[test]
    fn tail_respects_character_boundaries() {
        assert_eq!(tail("héllo", 4), "llo");
        assert_eq!(tail("short", 100), "short");
    }
}
