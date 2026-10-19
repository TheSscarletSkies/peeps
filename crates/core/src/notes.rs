//! Notes left for a product's agent, delivered through its hooks.

use std::path::Path;

use chrono::{DateTime, Utc};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Delivery {
    /// Read when the product's next agent session starts.
    NextSession,
    /// Read after the running session's next tool call.
    NextStep,
}

impl Delivery {
    fn as_str(self) -> &'static str {
        match self {
            Self::NextSession => "next_session",
            Self::NextStep => "next_step",
        }
    }

    fn parse(text: &str) -> Self {
        match text {
            "next_step" => Self::NextStep,
            _ => Self::NextSession,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: i64,
    pub product_id: String,
    pub text: String,
    pub delivery: Delivery,
    pub created_at: DateTime<Utc>,
    pub delivered_at: Option<DateTime<Utc>>,
}

pub struct NoteStore {
    db: Connection,
}

const SCHEMA: &str = "
    CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY,
        product_id TEXT NOT NULL,
        text TEXT NOT NULL,
        delivery TEXT NOT NULL,
        created_at TEXT NOT NULL,
        delivered_at TEXT
    );
    CREATE INDEX IF NOT EXISTS notes_pending ON notes (product_id) WHERE delivered_at IS NULL;
";

impl NoteStore {
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
        product_id: &str,
        text: &str,
        delivery: Delivery,
        now: DateTime<Utc>,
    ) -> rusqlite::Result<Note> {
        self.db.execute(
            "INSERT INTO notes (product_id, text, delivery, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![product_id, text.trim(), delivery.as_str(), now],
        )?;
        Ok(Note {
            id: self.db.last_insert_rowid(),
            product_id: product_id.to_owned(),
            text: text.trim().to_owned(),
            delivery,
            created_at: now,
            delivered_at: None,
        })
    }

    /// Hands over pending notes. `NextStep` delivery takes only notes meant for a running session.
    pub fn take(
        &mut self,
        product_id: &str,
        at: Delivery,
        now: DateTime<Utc>,
    ) -> rusqlite::Result<Vec<Note>> {
        let tx = self.db.transaction()?;
        let notes = {
            let mut query = tx.prepare(
                "SELECT id, product_id, text, delivery, created_at FROM notes
                 WHERE product_id = ?1 AND delivered_at IS NULL AND (?2 = 'next_session' OR delivery = ?2)
                 ORDER BY id",
            )?;
            let rows = query.query_map(params![product_id, at.as_str()], |row| {
                Ok(Note {
                    id: row.get(0)?,
                    product_id: row.get(1)?,
                    text: row.get(2)?,
                    delivery: Delivery::parse(&row.get::<_, String>(3)?),
                    created_at: row.get(4)?,
                    delivered_at: Some(now),
                })
            })?;
            rows.collect::<rusqlite::Result<Vec<_>>>()?
        };
        for note in &notes {
            tx.execute(
                "UPDATE notes SET delivered_at = ?1 WHERE id = ?2",
                params![now, note.id],
            )?;
        }
        tx.commit()?;
        Ok(notes)
    }

    pub fn recent(&self, limit: usize) -> rusqlite::Result<Vec<Note>> {
        let mut query = self.db.prepare(
            "SELECT id, product_id, text, delivery, created_at, delivered_at FROM notes
             ORDER BY id DESC LIMIT ?1",
        )?;
        let rows = query.query_map(params![limit as i64], |row| {
            Ok(Note {
                id: row.get(0)?,
                product_id: row.get(1)?,
                text: row.get(2)?,
                delivery: Delivery::parse(&row.get::<_, String>(3)?),
                created_at: row.get(4)?,
                delivered_at: row.get(5)?,
            })
        })?;
        rows.collect()
    }
}

/// The text injected into the agent's context.
pub fn for_agent(notes: &[Note]) -> Option<String> {
    if notes.is_empty() {
        return None;
    }
    let lines: Vec<String> = notes
        .iter()
        .map(|note| format!("- {}", note.text))
        .collect();
    Some(format!(
        "The user left these notes for this project in peeps. Follow them:\n{}",
        lines.join("\n")
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn delivers_each_note_once() {
        let mut store = NoteStore::in_memory().unwrap();
        let now = Utc::now();
        store
            .add("shop", " Use annual pricing. ", Delivery::NextSession, now)
            .unwrap();
        store
            .add("blog", "Not for shop", Delivery::NextSession, now)
            .unwrap();

        let notes = store.take("shop", Delivery::NextSession, now).unwrap();
        assert_eq!(notes.len(), 1);
        assert_eq!(notes[0].text, "Use annual pricing.");
        assert!(store
            .take("shop", Delivery::NextSession, now)
            .unwrap()
            .is_empty());
    }

    #[test]
    fn next_step_only_takes_urgent_notes() {
        let mut store = NoteStore::in_memory().unwrap();
        let now = Utc::now();
        store
            .add("shop", "later", Delivery::NextSession, now)
            .unwrap();
        store.add("shop", "now", Delivery::NextStep, now).unwrap();

        let urgent = store.take("shop", Delivery::NextStep, now).unwrap();
        assert_eq!(
            urgent.iter().map(|n| n.text.as_str()).collect::<Vec<_>>(),
            ["now"]
        );
        let rest = store.take("shop", Delivery::NextSession, now).unwrap();
        assert_eq!(
            rest.iter().map(|n| n.text.as_str()).collect::<Vec<_>>(),
            ["later"]
        );
    }

    #[test]
    fn recent_lists_newest_first_with_delivery_state() {
        let mut store = NoteStore::in_memory().unwrap();
        let now = Utc::now();
        store
            .add("shop", "first", Delivery::NextSession, now)
            .unwrap();
        store.take("shop", Delivery::NextSession, now).unwrap();
        store
            .add("shop", "second", Delivery::NextSession, now)
            .unwrap();

        let recent = store.recent(10).unwrap();
        assert_eq!(recent[0].text, "second");
        assert!(recent[0].delivered_at.is_none());
        assert!(recent[1].delivered_at.is_some());
    }

    #[test]
    fn formats_notes_for_the_agent() {
        assert_eq!(for_agent(&[]), None);
        let note = Note {
            id: 1,
            product_id: "shop".into(),
            text: "Ship on Friday".into(),
            delivery: Delivery::NextSession,
            created_at: Utc::now(),
            delivered_at: None,
        };
        assert!(for_agent(&[note]).unwrap().ends_with("- Ship on Friday"));
    }
}
