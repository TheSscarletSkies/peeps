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

/// Gives Claude Code the peeps tools through `peeps-hook mcp`. They only touch peeps' own data,
/// so they are allowed up front instead of asking each time.
pub fn with_tools(base: &[String], hook: &str) -> Vec<String> {
    let mut command = base.to_vec();
    if !is_claude(base) {
        return command;
    }
    let config = serde_json::json!({
        "mcpServers": { "peeps": { "command": hook, "args": ["mcp"] } }
    });
    command.splice(
        1..1,
        [
            "--mcp-config".to_owned(),
            config.to_string(),
            "--allowedTools".to_owned(),
            "mcp__peeps".to_owned(),
        ],
    );
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
         Use the peeps tools to act: add to-dos and reminders, schedule drafts, leave notes for \
         products, and read or update product briefs. Log decisions the user makes.\n\
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

/// What a product's pet knows when the user talks to it: its brief and how it is doing right now.
pub fn product_context(name: &str, id: &str, today: &str, status: &str, brief: &str) -> String {
    format!(
        "You are the peeps pet for {name} (product id `{id}`), acting as the user's product and \
         marketing strategist for it. Today is {today}.\n\n\
         How it is doing right now:\n{status}\n\n\
         Its brief, which the user keeps up to date:\n<brief>\n{brief}\n</brief>\n\n\
         Be specific and practical. Tie advice to the brief's goal, audience and numbers; when a \
         number you need is missing, ask for it rather than guessing. When the user agrees on next \
         steps, add them as to-dos tagged #{id} with add_todo. When they make a decision, record it \
         with log_decision. Hand coding work to the product's own agent with leave_note. Update \
         the brief with write_brief only when they ask.\n\
         Before sending anything to anyone, show the user exactly what will be sent and ask first."
    )
}

/// What a product's pet is asked each week. The answer lands in its conversation.
pub fn review_prompt(id: &str) -> String {
    format!(
        "It's time for this week's review. Use peeps_overview, read_brief for `{id}`, and what you \
         can see in the project. Write it short: what happened since last week, the numbers that \
         matter (say which ones you could not see so I can add them), and the three moves that \
         would help most this week, best first. Add those three as to-dos tagged #{id}, due by \
         Friday, then finish with a one-line summary."
    )
}

/// Lets Claude Code read a product's folder from the strategy chat.
pub fn with_dirs(base: &[String], dirs: &[String]) -> Vec<String> {
    let mut command = base.to_vec();
    if is_claude(base) && !dirs.is_empty() {
        command.push("--add-dir".to_owned());
        command.extend(dirs.iter().cloned());
    }
    command
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
    CREATE TABLE IF NOT EXISTS chat_sessions (
        scope TEXT PRIMARY KEY,
        session TEXT NOT NULL
    );
";

/// The helper's own conversation; products talk under their ids.
pub const HELPER: &str = "helper";

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
        let has_scope: bool = db
            .prepare("SELECT 1 FROM pragma_table_info('chat') WHERE name = 'scope'")?
            .exists([])?;
        if !has_scope {
            db.execute_batch(
                "ALTER TABLE chat ADD COLUMN scope TEXT NOT NULL DEFAULT 'helper';
                 INSERT OR IGNORE INTO chat_sessions (scope, session)
                     SELECT 'helper', session FROM chat_session WHERE id = 1;",
            )?;
        }
        Ok(Self { db })
    }

    pub fn add(
        &self,
        scope: &str,
        from: Speaker,
        text: &str,
        at: DateTime<Utc>,
    ) -> rusqlite::Result<Message> {
        let speaker = match from {
            Speaker::You => "you",
            Speaker::Helper => "helper",
        };
        self.db.execute(
            "INSERT INTO chat (scope, speaker, text, at) VALUES (?1, ?2, ?3, ?4)",
            params![scope, speaker, text, at],
        )?;
        Ok(Message {
            id: self.db.last_insert_rowid(),
            from,
            text: text.to_owned(),
            at,
        })
    }

    /// The last `limit` messages in one conversation, oldest first.
    pub fn recent(&self, scope: &str, limit: usize) -> rusqlite::Result<Vec<Message>> {
        let mut query = self.db.prepare(
            "SELECT id, speaker, text, at FROM
                 (SELECT * FROM chat WHERE scope = ?1 ORDER BY id DESC LIMIT ?2)
             ORDER BY id",
        )?;
        let rows = query.query_map(params![scope, limit as i64], from_row)?;
        rows.collect()
    }

    pub fn session(&self, scope: &str) -> rusqlite::Result<Option<String>> {
        self.db
            .query_row(
                "SELECT session FROM chat_sessions WHERE scope = ?1",
                params![scope],
                |row| row.get(0),
            )
            .optional()
    }

    pub fn set_session(&self, scope: &str, session: &str) -> rusqlite::Result<()> {
        self.db.execute(
            "INSERT INTO chat_sessions (scope, session) VALUES (?1, ?2)
             ON CONFLICT(scope) DO UPDATE SET session = excluded.session",
            params![scope, session],
        )?;
        Ok(())
    }

    /// Starts one conversation over: clears its messages and forgets it on the agent's side.
    pub fn clear(&self, scope: &str) -> rusqlite::Result<()> {
        self.db
            .execute("DELETE FROM chat WHERE scope = ?1", params![scope])?;
        self.db
            .execute("DELETE FROM chat_sessions WHERE scope = ?1", params![scope])?;
        Ok(())
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
    fn claude_gets_the_peeps_tools() {
        let chat = args(&["claude", "-p", "--output-format", "json"]);
        let with = with_tools(&chat, "/Applications/peeps.app/Contents/MacOS/peeps-hook");
        assert_eq!(with[1], "--mcp-config");
        let config: serde_json::Value = serde_json::from_str(&with[2]).unwrap();
        assert_eq!(config["mcpServers"]["peeps"]["args"][0], "mcp");
        assert_eq!(&with[3..5], &args(&["--allowedTools", "mcp__peeps"])[..]);
        assert_eq!(&with[5..], &chat[1..]);
        assert_eq!(with_tools(&args(&["codex"]), "/x"), args(&["codex"]));
    }

    #[test]
    fn older_conversations_move_to_the_helper() {
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch(
            "CREATE TABLE chat (id INTEGER PRIMARY KEY, speaker TEXT NOT NULL, text TEXT NOT NULL, at TEXT NOT NULL);
             CREATE TABLE chat_session (id INTEGER PRIMARY KEY CHECK (id = 1), session TEXT NOT NULL);
             INSERT INTO chat (speaker, text, at) VALUES ('you', 'old', '2026-10-01T00:00:00Z');
             INSERT INTO chat_session (id, session) VALUES (1, 'kept');",
        )
        .unwrap();
        let store = ChatStore::init(db).unwrap();
        assert_eq!(store.recent(HELPER, 5).unwrap()[0].text, "old");
        assert_eq!(store.session(HELPER).unwrap().as_deref(), Some("kept"));
    }

    #[test]
    fn product_chats_know_the_brief_and_can_read_the_repo() {
        let text = product_context(
            "Funderly",
            "funderly",
            "Tuesday",
            "Hungry: 7 sign-ups waiting",
            "## Goal\n100 paying teams",
        );
        assert!(text.contains("strategist"));
        assert!(text.contains("<brief>\n## Goal\n100 paying teams\n</brief>"));
        assert!(text.contains("tagged #funderly"));
        let claude = args(&["claude", "-p"]);
        assert_eq!(
            with_dirs(&claude, &["/code/funderly".into()]),
            args(&["claude", "-p", "--add-dir", "/code/funderly"])
        );
        assert_eq!(with_dirs(&claude, &[]), claude);
        assert_eq!(
            with_dirs(&args(&["codex"]), &["/x".into()]),
            args(&["codex"])
        );
    }

    #[test]
    fn the_weekly_review_asks_for_three_moves_as_to_dos() {
        let prompt = review_prompt("kaiveni-hiya");
        assert!(prompt.contains("read_brief for `kaiveni-hiya`"));
        assert!(prompt.contains("three moves"));
        assert!(prompt.contains("tagged #kaiveni-hiya"));
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
            store
                .add(HELPER, Speaker::You, &format!("hi {n}"), now)
                .unwrap();
        }
        store.add(HELPER, Speaker::Helper, "hello", now).unwrap();
        store
            .add("funderly", Speaker::You, "pricing?", now)
            .unwrap();
        let recent = store.recent(HELPER, 3).unwrap();
        assert_eq!(
            recent.iter().map(|m| m.text.as_str()).collect::<Vec<_>>(),
            ["hi 3", "hi 4", "hello"]
        );
        assert_eq!(recent[2].from, Speaker::Helper);

        assert_eq!(store.session(HELPER).unwrap(), None);
        store.set_session(HELPER, "one").unwrap();
        store.set_session(HELPER, "two").unwrap();
        store.set_session("funderly", "f").unwrap();
        assert_eq!(store.session(HELPER).unwrap().as_deref(), Some("two"));
        store.clear(HELPER).unwrap();
        assert!(store.recent(HELPER, 10).unwrap().is_empty());
        assert_eq!(store.session(HELPER).unwrap(), None);
        // Each product keeps its own conversation.
        assert_eq!(store.recent("funderly", 10).unwrap()[0].text, "pricing?");
        assert_eq!(store.session("funderly").unwrap().as_deref(), Some("f"));
    }
}
