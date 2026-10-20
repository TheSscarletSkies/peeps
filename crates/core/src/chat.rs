//! Talking to the helper: each message runs the user's own agent, resuming the same conversation.

use std::path::Path;

use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Speaker {
    You,
    Helper,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Message {
    pub id: i64,
    pub from: Speaker,
    pub text: String,
    pub at: DateTime<Utc>,
}

/// What the agent said, and the conversation to resume next time if it reported one.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Reply {
    pub text: String,
    pub session: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ClaudeResult {
    result: Option<String>,
    session_id: Option<String>,
    #[serde(default)]
    is_error: bool,
}

/// Reads Claude Code's `--output-format json` result, or plain text from any other agent.
pub fn parse_reply(stdout: &str) -> Result<Reply, String> {
    let trimmed = stdout.trim();
    match serde_json::from_str::<ClaudeResult>(trimmed) {
        Ok(result) if result.is_error => Err(result
            .result
            .unwrap_or_else(|| "the agent reported an error".to_owned())),
        Ok(ClaudeResult {
            result: Some(text),
            session_id,
            ..
        }) => Ok(Reply {
            text: text.trim().to_owned(),
            session: session_id,
        }),
        _ => Ok(Reply {
            text: trimmed.to_owned(),
            session: None,
        }),
    }
}

fn is_claude(base: &[String]) -> bool {
    base.first().is_some_and(|program| {
        Path::new(program)
            .file_stem()
            .is_some_and(|stem| stem == "claude")
    })
}

/// Adds the chosen model and effort right after the program, so a trailing `{prompt}` stays last.
/// Other agents have their own flags and are left as configured.
pub fn with_agent(base: &[String], model: Option<&str>, effort: Option<&str>) -> Vec<String> {
    let mut command = base.to_vec();
    if !is_claude(base) {
        return command;
    }
    let mut flags = Vec::new();
    if let Some(model) = model {
        flags.extend(["--model".to_owned(), model.to_owned()]);
    }
    if let Some(effort) = effort {
        flags.extend(["--effort".to_owned(), effort.to_owned()]);
    }
    command.splice(1..1, flags);
    command
}

/// The command for one turn: Claude Code resumes the conversation and gets the helper's context.
pub fn command(base: &[String], session: Option<&str>, context: &str) -> Vec<String> {
    let mut command = base.to_vec();
    if is_claude(base) {
        if let Some(session) = session {
            command.push("--resume".to_owned());
            command.push(session.to_owned());
        }
        if !context.is_empty() {
            command.push("--append-system-prompt".to_owned());
            command.push(context.to_owned());
        }
    }
    command
}

/// What the helper knows about the user's day, given to the agent with every message.
pub fn context(
    name: &str,
    today: &str,
    todos: &[String],
    events: &[String],
    products: &[String],
) -> String {
    let list = |items: &[String]| {
        if items.is_empty() {
            "none".to_owned()
        } else {
            items
                .iter()
                .map(|item| format!("- {item}"))
                .collect::<Vec<_>>()
                .join("\n")
        }
    };
    format!(
        "You are {name}, the user's helper in the peeps app. Be brief and warm. Today is {today}.\n\
         Their products: {}.\n\nOpen to-dos:\n{}\n\nComing up:\n{}\n\n\
         Before sending anything to anyone, show the user exactly what will be sent and ask first.",
        if products.is_empty() {
            "none".to_owned()
        } else {
            products.join(", ")
        },
        list(todos),
        list(events),
    )
}

const SCHEMA: &str = "
    CREATE TABLE IF NOT EXISTS chat (
        id INTEGER PRIMARY KEY,
        speaker TEXT NOT NULL,
        text TEXT NOT NULL,
        at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chat_session (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        session TEXT NOT NULL
    );
";

pub struct ChatStore {
    db: Connection,
}

impl ChatStore {
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

    pub fn add(&self, from: Speaker, text: &str, at: DateTime<Utc>) -> rusqlite::Result<Message> {
        let speaker = match from {
            Speaker::You => "you",
            Speaker::Helper => "helper",
        };
        self.db.execute(
            "INSERT INTO chat (speaker, text, at) VALUES (?1, ?2, ?3)",
            params![speaker, text, at],
        )?;
        Ok(Message {
            id: self.db.last_insert_rowid(),
            from,
            text: text.to_owned(),
            at,
        })
    }

    /// The last `limit` messages, oldest first.
    pub fn recent(&self, limit: usize) -> rusqlite::Result<Vec<Message>> {
        let mut query = self.db.prepare(
            "SELECT id, speaker, text, at FROM (SELECT * FROM chat ORDER BY id DESC LIMIT ?1) ORDER BY id",
        )?;
        let rows = query.query_map(params![limit as i64], from_row)?;
        rows.collect()
    }

    pub fn session(&self) -> rusqlite::Result<Option<String>> {
        self.db
            .query_row("SELECT session FROM chat_session WHERE id = 1", [], |row| {
                row.get(0)
            })
            .optional()
    }

    pub fn set_session(&self, session: &str) -> rusqlite::Result<()> {
        self.db.execute(
            "INSERT INTO chat_session (id, session) VALUES (1, ?1)
             ON CONFLICT(id) DO UPDATE SET session = excluded.session",
            params![session],
        )?;
        Ok(())
    }

    /// Starts over: clears the messages and forgets the conversation.
    pub fn clear(&self) -> rusqlite::Result<()> {
        self.db
            .execute_batch("DELETE FROM chat; DELETE FROM chat_session;")
    }
}

fn from_row(row: &Row<'_>) -> rusqlite::Result<Message> {
    let speaker: String = row.get(1)?;
    Ok(Message {
        id: row.get(0)?,
        from: if speaker == "you" {
            Speaker::You
        } else {
            Speaker::Helper
        },
        text: row.get(2)?,
        at: row.get(3)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(list: &[&str]) -> Vec<String> {
        list.iter().map(|arg| (*arg).to_owned()).collect()
    }

    #[test]
    fn reads_claude_json_and_plain_text() {
        let json =
            r#"{"type":"result","result":" Done! Added it. ","session_id":"abc","is_error":false}"#;
        assert_eq!(
            parse_reply(json).unwrap(),
            Reply {
                text: "Done! Added it.".into(),
                session: Some("abc".into())
            }
        );
        assert_eq!(parse_reply("hello\n").unwrap().text, "hello");
        assert!(parse_reply(r#"{"result":"Credit balance is too low","is_error":true}"#).is_err());
    }

    #[test]
    fn resumes_only_claude() {
        let claude = args(&["/usr/local/bin/claude", "-p", "--output-format", "json"]);
        let turn = command(&claude, Some("abc"), "ctx");
        assert_eq!(
            &turn[4..],
            &args(&["--resume", "abc", "--append-system-prompt", "ctx"])[..]
        );
        let other = args(&["codex", "exec"]);
        assert_eq!(command(&other, Some("abc"), "ctx"), other);
    }

    #[test]
    fn model_and_effort_go_before_the_prompt() {
        let drafts = args(&["claude", "-p", "{prompt}"]);
        assert_eq!(
            with_agent(&drafts, Some("opus"), Some("high")),
            args(&["claude", "--model", "opus", "--effort", "high", "-p", "{prompt}"])
        );
        assert_eq!(with_agent(&drafts, None, None), drafts);
        let other = args(&["codex", "exec"]);
        assert_eq!(with_agent(&other, Some("opus"), None), other);
    }

    #[test]
    fn context_lists_the_day() {
        let text = context(
            "Bao",
            "Tuesday 20 October",
            &["Pay rent (due today)".into()],
            &[],
            &["Funderly".into()],
        );
        assert!(text.contains("You are Bao"));
        assert!(text.contains("- Pay rent (due today)"));
        assert!(text.contains("Coming up:\nnone"));
        assert!(text.contains("ask first"));
    }

    #[test]
    fn keeps_messages_and_the_conversation() {
        let store = ChatStore::in_memory().unwrap();
        let now = Utc::now();
        for n in 0..5 {
            store.add(Speaker::You, &format!("hi {n}"), now).unwrap();
        }
        store.add(Speaker::Helper, "hello", now).unwrap();
        let recent = store.recent(3).unwrap();
        assert_eq!(
            recent.iter().map(|m| m.text.as_str()).collect::<Vec<_>>(),
            ["hi 3", "hi 4", "hello"]
        );
        assert_eq!(recent[2].from, Speaker::Helper);

        assert_eq!(store.session().unwrap(), None);
        store.set_session("one").unwrap();
        store.set_session("two").unwrap();
        assert_eq!(store.session().unwrap().as_deref(), Some("two"));
        store.clear().unwrap();
        assert!(store.recent(10).unwrap().is_empty());
        assert_eq!(store.session().unwrap(), None);
    }
}
