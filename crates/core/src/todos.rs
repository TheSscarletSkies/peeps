//! The helper's to-do list, kept in the local database.

use std::path::Path;

use chrono::{DateTime, NaiveDate, Utc};
use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum TodoKind {
    Task,
    Study,
}

impl TodoKind {
    fn as_str(self) -> &'static str {
        match self {
            Self::Task => "task",
            Self::Study => "study",
        }
    }

    fn parse(text: &str) -> Self {
        match text {
            "study" => Self::Study,
            _ => Self::Task,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Due {
    Overdue,
    Today,
    Soon,
    Later,
    Undated,
}

/// Due dates within this many days count as soon.
const SOON_DAYS: i64 = 2;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Todo {
    pub id: i64,
    pub title: String,
    pub kind: TodoKind,
    pub due: Option<NaiveDate>,
    pub created_at: DateTime<Utc>,
    pub done_at: Option<DateTime<Utc>>,
}

impl Todo {
    pub fn due_state(&self, today: NaiveDate) -> Due {
        let Some(due) = self.due else {
            return Due::Undated;
        };
        match (due - today).num_days() {
            days if days < 0 => Due::Overdue,
            0 => Due::Today,
            days if days <= SOON_DAYS => Due::Soon,
            _ => Due::Later,
        }
    }

    fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(Self {
            id: row.get(0)?,
            title: row.get(1)?,
            kind: TodoKind::parse(&row.get::<_, String>(2)?),
            due: row.get(3)?,
            created_at: row.get(4)?,
            done_at: row.get(5)?,
        })
    }
}

const SCHEMA: &str = "
    CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        kind TEXT NOT NULL,
        due TEXT,
        created_at TEXT NOT NULL,
        done_at TEXT
    );
";

const COLUMNS: &str = "id, title, kind, due, created_at, done_at";

pub struct TodoStore {
    db: Connection,
}

impl TodoStore {
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
        title: &str,
        kind: TodoKind,
        due: Option<NaiveDate>,
        now: DateTime<Utc>,
    ) -> rusqlite::Result<Todo> {
        let title = title.trim();
        self.db.execute(
            "INSERT INTO todos (title, kind, due, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![title, kind.as_str(), due, now],
        )?;
        Ok(Todo {
            id: self.db.last_insert_rowid(),
            title: title.to_owned(),
            kind,
            due,
            created_at: now,
            done_at: None,
        })
    }

    /// Marks a to-do done, or open again when `done` is false. Returns whether it exists.
    pub fn set_done(&self, id: i64, done: bool, now: DateTime<Utc>) -> rusqlite::Result<bool> {
        let done_at = done.then_some(now);
        let changed = self.db.execute(
            "UPDATE todos SET done_at = ?1 WHERE id = ?2",
            params![done_at, id],
        )?;
        Ok(changed > 0)
    }

    pub fn delete(&self, id: i64) -> rusqlite::Result<bool> {
        Ok(self
            .db
            .execute("DELETE FROM todos WHERE id = ?1", params![id])?
            > 0)
    }

    /// Open to-dos, soonest due first, undated last.
    pub fn open_items(&self) -> rusqlite::Result<Vec<Todo>> {
        let mut query = self.db.prepare(&format!(
            "SELECT {COLUMNS} FROM todos WHERE done_at IS NULL
             ORDER BY due IS NULL, due, id"
        ))?;
        let rows = query.query_map([], Todo::from_row)?;
        rows.collect()
    }

    pub fn done_since(&self, since: DateTime<Utc>) -> rusqlite::Result<usize> {
        self.db.query_row(
            "SELECT COUNT(*) FROM todos WHERE done_at >= ?1",
            params![since],
            |row| row.get::<_, i64>(0).map(|n| n as usize),
        )
    }

    /// Recently finished to-dos, newest first.
    pub fn recently_done(&self, limit: usize) -> rusqlite::Result<Vec<Todo>> {
        let mut query = self.db.prepare(&format!(
            "SELECT {COLUMNS} FROM todos WHERE done_at IS NOT NULL
             ORDER BY done_at DESC LIMIT ?1"
        ))?;
        let rows = query.query_map(params![limit as i64], Todo::from_row)?;
        rows.collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn day(text: &str) -> NaiveDate {
        text.parse().unwrap()
    }

    #[test]
    fn orders_open_items_by_due_date() {
        let store = TodoStore::in_memory().unwrap();
        let now = Utc::now();
        store.add("Undated", TodoKind::Task, None, now).unwrap();
        store
            .add("Later", TodoKind::Task, Some(day("2026-11-01")), now)
            .unwrap();
        store
            .add(" Sooner ", TodoKind::Study, Some(day("2026-10-20")), now)
            .unwrap();

        let titles: Vec<_> = store
            .open_items()
            .unwrap()
            .into_iter()
            .map(|t| t.title)
            .collect();
        assert_eq!(titles, ["Sooner", "Later", "Undated"]);
    }

    #[test]
    fn finishing_moves_an_item_out_of_the_open_list() {
        let store = TodoStore::in_memory().unwrap();
        let now = Utc::now();
        let todo = store.add("Post", TodoKind::Task, None, now).unwrap();

        assert!(store.set_done(todo.id, true, now).unwrap());
        assert!(store.open_items().unwrap().is_empty());
        assert_eq!(
            store.done_since(now - chrono::TimeDelta::days(7)).unwrap(),
            1
        );
        assert_eq!(
            store.done_since(now + chrono::TimeDelta::days(1)).unwrap(),
            0
        );
        assert_eq!(store.recently_done(5).unwrap()[0].title, "Post");

        assert!(store.set_done(todo.id, false, now).unwrap());
        assert_eq!(store.open_items().unwrap().len(), 1);

        assert!(store.delete(todo.id).unwrap());
        assert!(!store.delete(todo.id).unwrap());
        assert!(!store.set_done(todo.id, true, now).unwrap());
    }

    #[test]
    fn due_states() {
        let today = day("2026-10-19");
        let todo = |due: Option<&str>| Todo {
            id: 1,
            title: "x".into(),
            kind: TodoKind::Task,
            due: due.map(day),
            created_at: Utc::now(),
            done_at: None,
        };
        assert_eq!(todo(Some("2026-10-18")).due_state(today), Due::Overdue);
        assert_eq!(todo(Some("2026-10-19")).due_state(today), Due::Today);
        assert_eq!(todo(Some("2026-10-21")).due_state(today), Due::Soon);
        assert_eq!(todo(Some("2026-10-25")).due_state(today), Due::Later);
        assert_eq!(todo(None).due_state(today), Due::Undated);
    }
}
