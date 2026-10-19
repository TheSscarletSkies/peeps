//! The helper's to-do list, kept in the local database.

use std::path::Path;

use chrono::{
    DateTime, Datelike, Days, FixedOffset, Months, NaiveDate, NaiveTime, TimeZone, Utc, Weekday,
};
use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Repeat {
    #[default]
    Never,
    Daily,
    Weekdays,
    Weekly,
    Monthly,
}

impl Repeat {
    fn as_str(self) -> &'static str {
        match self {
            Self::Never => "never",
            Self::Daily => "daily",
            Self::Weekdays => "weekdays",
            Self::Weekly => "weekly",
            Self::Monthly => "monthly",
        }
    }

    fn parse(text: &str) -> Self {
        match text {
            "daily" => Self::Daily,
            "weekdays" => Self::Weekdays,
            "weekly" => Self::Weekly,
            "monthly" => Self::Monthly,
            _ => Self::Never,
        }
    }

    /// The next occurrence after `date`. Monthly items on the 31st land on the last day of shorter months.
    pub fn after(self, date: NaiveDate) -> Option<NaiveDate> {
        match self {
            Self::Never => None,
            Self::Daily => date.checked_add_days(Days::new(1)),
            Self::Weekdays => {
                let mut next = date.checked_add_days(Days::new(1))?;
                while matches!(next.weekday(), Weekday::Sat | Weekday::Sun) {
                    next = next.checked_add_days(Days::new(1))?;
                }
                Some(next)
            }
            Self::Weekly => date.checked_add_days(Days::new(7)),
            Self::Monthly => date.checked_add_months(Months::new(1)),
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
/// Reminders for to-dos without a time arrive on the morning they are due.
const MORNING: NaiveTime = match NaiveTime::from_hms_opt(9, 0, 0) {
    Some(time) => time,
    None => panic!("nine o'clock exists"),
};

/// What someone typed: a title that may carry `#tags`, and when it is due.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoInput {
    pub title: String,
    pub due: Option<NaiveDate>,
    pub time: Option<NaiveTime>,
    #[serde(default)]
    pub repeat: Repeat,
    /// Minutes before the due time to remind. `None` means no reminder.
    pub remind_minutes: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Todo {
    pub id: i64,
    pub title: String,
    pub tags: Vec<String>,
    pub due: Option<NaiveDate>,
    pub time: Option<NaiveTime>,
    pub repeat: Repeat,
    pub remind_minutes: Option<i64>,
    /// Times in a row a repeating to-do was done on time.
    pub streak: i64,
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

    /// A streak only counts while it is unbroken.
    pub fn live_streak(&self, today: NaiveDate) -> i64 {
        match self.due {
            Some(due) if due < today => 0,
            _ => self.streak,
        }
    }

    /// When to remind, in the user's time zone: the due time, or the morning of, less the lead time.
    pub fn remind_at(&self, zone: FixedOffset) -> Option<DateTime<Utc>> {
        let minutes = self.remind_minutes?;
        let local = self.due?.and_time(self.time.unwrap_or(MORNING));
        let at = zone.from_local_datetime(&local).single()?;
        Some(at.with_timezone(&Utc) - chrono::TimeDelta::minutes(minutes))
    }

    fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        let tags: String = row.get(2)?;
        Ok(Self {
            id: row.get(0)?,
            title: row.get(1)?,
            tags: tags.split_whitespace().map(str::to_owned).collect(),
            due: row.get(3)?,
            time: row.get(4)?,
            repeat: Repeat::parse(&row.get::<_, String>(5)?),
            remind_minutes: row.get(6)?,
            streak: row.get(7)?,
            created_at: row.get(8)?,
            done_at: row.get(9)?,
        })
    }
}

/// Splits `Pay rent #bills #home` into the title and its tags. Tags are lowercase and unique.
pub fn split_tags(text: &str) -> (String, Vec<String>) {
    let mut title = Vec::new();
    let mut tags: Vec<String> = Vec::new();
    for word in text.split_whitespace() {
        let tag = word.strip_prefix('#').filter(|rest| {
            !rest.is_empty()
                && rest
                    .chars()
                    .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
        });
        match tag {
            Some(tag) => {
                let tag = tag.to_lowercase();
                if !tags.contains(&tag) {
                    tags.push(tag);
                }
            }
            None => title.push(word),
        }
    }
    (title.join(" "), tags)
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
    CREATE TABLE IF NOT EXISTS todo_log (
        todo_id INTEGER NOT NULL,
        done_at TEXT NOT NULL
    );
";

/// Columns added after the first release, with how to fill them for older rows.
const ADDED: [(&str, &str); 5] = [
    ("tags", "TEXT NOT NULL DEFAULT ''"),
    ("time", "TEXT"),
    ("repeat", "TEXT NOT NULL DEFAULT 'never'"),
    ("remind_minutes", "INTEGER"),
    ("streak", "INTEGER NOT NULL DEFAULT 0"),
];

const COLUMNS: &str =
    "id, title, tags, due, time, repeat, remind_minutes, streak, created_at, done_at";

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
        let existing: Vec<String> = db
            .prepare("SELECT name FROM pragma_table_info('todos')")?
            .query_map([], |row| row.get(0))?
            .collect::<rusqlite::Result<_>>()?;
        for (name, definition) in ADDED {
            if !existing.iter().any(|column| column == name) {
                db.execute_batch(&format!("ALTER TABLE todos ADD COLUMN {name} {definition}"))?;
            }
        }
        // Study used to be a kind of to-do; it is a tag now.
        db.execute_batch(
            "UPDATE todos SET tags = TRIM(tags || ' study'), kind = 'task' WHERE kind = 'study'",
        )?;
        Ok(Self { db })
    }

    pub fn add(&self, input: &TodoInput, now: DateTime<Utc>) -> rusqlite::Result<Todo> {
        let (title, tags) = split_tags(&input.title);
        // A repeating to-do needs a first date to count from.
        let due = match (input.due, input.repeat) {
            (None, repeat) if repeat != Repeat::Never => Some(now.date_naive()),
            (due, _) => due,
        };
        self.db.execute(
            "INSERT INTO todos (title, kind, tags, due, time, repeat, remind_minutes, created_at)
             VALUES (?1, 'task', ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                title,
                tags.join(" "),
                due,
                input.time,
                input.repeat.as_str(),
                input.remind_minutes,
                now
            ],
        )?;
        Ok(Todo {
            id: self.db.last_insert_rowid(),
            title,
            tags,
            due,
            time: input.time,
            repeat: input.repeat,
            remind_minutes: input.remind_minutes,
            streak: 0,
            created_at: now,
            done_at: None,
        })
    }

    /// Rewrites a to-do. Returns whether it exists.
    pub fn edit(&self, id: i64, input: &TodoInput) -> rusqlite::Result<bool> {
        let (title, tags) = split_tags(&input.title);
        let changed = self.db.execute(
            "UPDATE todos SET title = ?1, tags = ?2, due = ?3, time = ?4, repeat = ?5,
                 remind_minutes = ?6 WHERE id = ?7",
            params![
                title,
                tags.join(" "),
                input.due,
                input.time,
                input.repeat.as_str(),
                input.remind_minutes,
                id
            ],
        )?;
        Ok(changed > 0)
    }

    /// Ticks a to-do off. A repeating one moves to its next date instead, keeping its streak if it was on time.
    pub fn complete(
        &self,
        id: i64,
        now: DateTime<Utc>,
        today: NaiveDate,
    ) -> rusqlite::Result<bool> {
        let Some(todo) = self.get(id)? else {
            return Ok(false);
        };
        self.db.execute(
            "INSERT INTO todo_log (todo_id, done_at) VALUES (?1, ?2)",
            params![id, now],
        )?;
        let next = todo.due.and_then(|due| {
            let mut next = todo.repeat.after(due)?;
            while next <= today {
                next = todo.repeat.after(next)?;
            }
            Some(next)
        });
        match next {
            Some(next) => {
                let on_time = todo.due.is_some_and(|due| due >= today);
                let streak = if on_time { todo.streak + 1 } else { 1 };
                self.db.execute(
                    "UPDATE todos SET due = ?1, streak = ?2 WHERE id = ?3",
                    params![next, streak, id],
                )?;
            }
            None => {
                self.db.execute(
                    "UPDATE todos SET done_at = ?1 WHERE id = ?2",
                    params![now, id],
                )?;
            }
        }
        Ok(true)
    }

    /// Puts a finished to-do back on the list.
    pub fn reopen(&self, id: i64) -> rusqlite::Result<bool> {
        let changed = self
            .db
            .execute("UPDATE todos SET done_at = NULL WHERE id = ?1", params![id])?;
        Ok(changed > 0)
    }

    pub fn delete(&self, id: i64) -> rusqlite::Result<bool> {
        self.db
            .execute("DELETE FROM todo_log WHERE todo_id = ?1", params![id])?;
        Ok(self
            .db
            .execute("DELETE FROM todos WHERE id = ?1", params![id])?
            > 0)
    }

    fn get(&self, id: i64) -> rusqlite::Result<Option<Todo>> {
        let mut query = self
            .db
            .prepare(&format!("SELECT {COLUMNS} FROM todos WHERE id = ?1"))?;
        let mut rows = query.query_map(params![id], Todo::from_row)?;
        rows.next().transpose()
    }

    /// Open to-dos, soonest due first, undated last.
    pub fn open_items(&self) -> rusqlite::Result<Vec<Todo>> {
        let mut query = self.db.prepare(&format!(
            "SELECT {COLUMNS} FROM todos WHERE done_at IS NULL
             ORDER BY due IS NULL, due, time IS NULL, time, id"
        ))?;
        let rows = query.query_map([], Todo::from_row)?;
        rows.collect()
    }

    /// Ticks since `since`, repeats included.
    pub fn done_since(&self, since: DateTime<Utc>) -> rusqlite::Result<usize> {
        self.db.query_row(
            "SELECT COUNT(*) FROM todo_log WHERE done_at >= ?1",
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

    fn input(title: &str) -> TodoInput {
        TodoInput {
            title: title.to_owned(),
            ..TodoInput::default()
        }
    }

    fn dated(title: &str, due: &str) -> TodoInput {
        TodoInput {
            due: Some(day(due)),
            ..input(title)
        }
    }

    #[test]
    fn tags_come_out_of_the_title() {
        assert_eq!(
            split_tags("Pay rent #Bills #home #bills"),
            (
                "Pay rent".to_owned(),
                vec!["bills".to_owned(), "home".to_owned()]
            )
        );
        assert_eq!(
            split_tags("Fix issue #12 and C# notes # done"),
            (
                "Fix issue and C# notes # done".to_owned(),
                vec!["12".to_owned()]
            )
        );
    }

    #[test]
    fn orders_open_items_by_due_date() {
        let store = TodoStore::in_memory().unwrap();
        let now = Utc::now();
        store.add(&input("Undated"), now).unwrap();
        store.add(&dated("Later", "2026-11-01"), now).unwrap();
        store
            .add(&dated(" Sooner #study", "2026-10-20"), now)
            .unwrap();

        let open = store.open_items().unwrap();
        let titles: Vec<_> = open.iter().map(|t| t.title.as_str()).collect();
        assert_eq!(titles, ["Sooner", "Later", "Undated"]);
        assert_eq!(open[0].tags, ["study"]);
    }

    #[test]
    fn edits_keep_the_item_in_place() {
        let store = TodoStore::in_memory().unwrap();
        let todo = store.add(&input("Read ch 4"), Utc::now()).unwrap();
        assert!(store
            .edit(todo.id, &dated("Read chapter 4 #study", "2026-10-24"))
            .unwrap());
        let open = store.open_items().unwrap();
        assert_eq!(open[0].title, "Read chapter 4");
        assert_eq!(open[0].tags, ["study"]);
        assert_eq!(open[0].due, Some(day("2026-10-24")));
        assert!(!store.edit(999, &input("x")).unwrap());
    }

    #[test]
    fn finishing_moves_an_item_out_of_the_open_list() {
        let store = TodoStore::in_memory().unwrap();
        let now = Utc::now();
        let todo = store.add(&input("Post"), now).unwrap();

        assert!(store.complete(todo.id, now, now.date_naive()).unwrap());
        assert!(store.open_items().unwrap().is_empty());
        assert_eq!(
            store.done_since(now - chrono::TimeDelta::days(7)).unwrap(),
            1
        );
        assert_eq!(
            store.done_since(now + chrono::TimeDelta::days(1)).unwrap(),
            0
        );
        assert!(store.reopen(todo.id).unwrap());
        assert_eq!(store.open_items().unwrap().len(), 1);
    }

    #[test]
    fn repeating_items_roll_forward_and_keep_a_streak() {
        let store = TodoStore::in_memory().unwrap();
        let now = Utc::now();
        let today = day("2026-10-19");
        let habit = TodoInput {
            repeat: Repeat::Daily,
            ..dated("Stretch #habit", "2026-10-19")
        };
        let todo = store.add(&habit, now).unwrap();

        store.complete(todo.id, now, today).unwrap();
        let open = store.open_items().unwrap();
        assert_eq!(open[0].due, Some(day("2026-10-20")));
        assert_eq!(open[0].streak, 1);

        store.complete(todo.id, now, day("2026-10-20")).unwrap();
        assert_eq!(store.open_items().unwrap()[0].streak, 2);

        // Skipping days breaks the streak, and the next date is in the future.
        store.complete(todo.id, now, day("2026-10-25")).unwrap();
        let open = store.open_items().unwrap();
        assert_eq!(open[0].streak, 1);
        assert_eq!(open[0].due, Some(day("2026-10-26")));
        assert_eq!(
            store.done_since(now - chrono::TimeDelta::days(1)).unwrap(),
            3
        );
    }

    #[test]
    fn repeats_land_on_sensible_days() {
        assert_eq!(
            Repeat::Monthly.after(day("2026-01-31")),
            Some(day("2026-02-28"))
        );
        assert_eq!(
            Repeat::Weekdays.after(day("2026-10-23")),
            Some(day("2026-10-26"))
        );
        assert_eq!(
            Repeat::Weekly.after(day("2026-10-19")),
            Some(day("2026-10-26"))
        );
        assert_eq!(Repeat::Never.after(day("2026-10-19")), None);
    }

    #[test]
    fn reminders_respect_time_and_lead() {
        let zone = FixedOffset::east_opt(5 * 3600).unwrap();
        let store = TodoStore::in_memory().unwrap();
        let exam = TodoInput {
            time: NaiveTime::from_hms_opt(18, 0, 0),
            remind_minutes: Some(30),
            ..dated("Exam #college", "2026-10-21")
        };
        let todo = store.add(&exam, Utc::now()).unwrap();
        assert_eq!(
            todo.remind_at(zone).unwrap().to_rfc3339(),
            "2026-10-21T12:30:00+00:00"
        );

        let bill = store
            .add(
                &TodoInput {
                    remind_minutes: Some(0),
                    ..dated("Rent", "2026-11-01")
                },
                Utc::now(),
            )
            .unwrap();
        assert_eq!(
            bill.remind_at(zone).unwrap().to_rfc3339(),
            "2026-11-01T04:00:00+00:00"
        );
        assert!(store
            .add(&dated("No reminder", "2026-11-01"), Utc::now())
            .unwrap()
            .remind_at(zone)
            .is_none());
    }

    #[test]
    fn old_study_items_become_tags() {
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch(
            "CREATE TABLE todos (id INTEGER PRIMARY KEY, title TEXT NOT NULL, kind TEXT NOT NULL,
                 due TEXT, created_at TEXT NOT NULL, done_at TEXT);
             INSERT INTO todos (title, kind, created_at) VALUES ('Read', 'study', '2026-10-01T00:00:00Z');",
        )
        .unwrap();
        let store = TodoStore::init(db).unwrap();
        assert_eq!(store.open_items().unwrap()[0].tags, ["study"]);
    }
}
