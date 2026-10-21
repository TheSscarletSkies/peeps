//! The helper's to-do list, kept in the local database.

use std::path::Path;

use chrono::{
    DateTime, Datelike, Days, FixedOffset, Months, NaiveDate, NaiveTime, TimeZone, Utc, Weekday,
};
use rusqlite::{params, Connection, OptionalExtension, Row};
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
    /// Through the day, between the to-do's time and `until`: drink water, stretch.
    Hourly,
    #[serde(rename = "every2h")]
    EveryTwoHours,
    #[serde(rename = "every3h")]
    EveryThreeHours,
}

impl Repeat {
    /// Hours between nudges for repeats that come round during the day.
    pub fn hours(self) -> Option<i64> {
        match self {
            Self::Hourly => Some(1),
            Self::EveryTwoHours => Some(2),
            Self::EveryThreeHours => Some(3),
            _ => None,
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::Never => "never",
            Self::Daily => "daily",
            Self::Weekdays => "weekdays",
            Self::Weekly => "weekly",
            Self::Monthly => "monthly",
            Self::Hourly => "hourly",
            Self::EveryTwoHours => "every2h",
            Self::EveryThreeHours => "every3h",
        }
    }

    fn parse(text: &str) -> Self {
        match text {
            "daily" => Self::Daily,
            "weekdays" => Self::Weekdays,
            "weekly" => Self::Weekly,
            "monthly" => Self::Monthly,
            "hourly" => Self::Hourly,
            "every2h" => Self::EveryTwoHours,
            "every3h" => Self::EveryThreeHours,
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
            Self::Hourly | Self::EveryTwoHours | Self::EveryThreeHours => {
                date.checked_add_days(Days::new(1))
            }
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
/// Nudges through the day stop here unless told otherwise.
const EVENING: NaiveTime = match NaiveTime::from_hms_opt(21, 0, 0) {
    Some(time) => time,
    None => panic!("nine in the evening exists"),
};

/// What someone typed: a title that may carry `#tags`, and when it is due.
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoInput {
    pub title: String,
    pub due: Option<NaiveDate>,
    pub time: Option<NaiveTime>,
    #[serde(default)]
    pub repeat: Repeat,
    /// Minutes before the due time to remind. `None` means no reminder.
    pub remind_minutes: Option<i64>,
    /// When nudges through the day stop.
    pub until: Option<NaiveTime>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Todo {
    pub id: i64,
    pub title: String,
    pub tags: Vec<String>,
    pub due: Option<NaiveDate>,
    pub time: Option<NaiveTime>,
    pub repeat: Repeat,
    pub remind_minutes: Option<i64>,
    pub until: Option<NaiveTime>,
    /// Times in a row a repeating to-do was done on time; for nudges through the day, times today.
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

    /// A streak only counts while it is unbroken; a daytime count starts again each morning.
    pub fn live_streak(&self, today: NaiveDate) -> i64 {
        match self.due {
            Some(due) if due < today => 0,
            Some(due) if self.repeat.hours().is_some() && due != today => 0,
            _ => self.streak,
        }
    }

    /// Every nudge for a to-do that repeats through the day, on `day`, in the user's zone.
    pub fn nudges_on(&self, day: NaiveDate, zone: FixedOffset) -> Vec<DateTime<Utc>> {
        let Some(hours) = self.repeat.hours() else {
            return Vec::new();
        };
        if self.remind_minutes.is_none() || self.due.is_some_and(|due| due > day) {
            return Vec::new();
        }
        let start = self.time.unwrap_or(MORNING);
        let end = self.until.unwrap_or(EVENING);
        let mut at = start;
        let mut found = Vec::new();
        while at <= end {
            if let Some(local) = zone.from_local_datetime(&day.and_time(at)).single() {
                found.push(local.with_timezone(&Utc));
            }
            let (next, wrapped) = at.overflowing_add_signed(chrono::TimeDelta::hours(hours));
            if wrapped != 0 {
                break;
            }
            at = next;
        }
        found
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
            until: row.get(10)?,
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

/// A to-do as it travels between computers.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoRecord {
    pub uid: String,
    pub updated_at: DateTime<Utc>,
    pub deleted: bool,
    #[serde(flatten)]
    pub todo: Todo,
}

/// An id that stays the same on every computer.
pub fn new_uid() -> String {
    uuid::Uuid::new_v4().to_string()
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
const ADDED: [(&str, &str); 9] = [
    ("tags", "TEXT NOT NULL DEFAULT ''"),
    ("time", "TEXT"),
    ("repeat", "TEXT NOT NULL DEFAULT 'never'"),
    ("remind_minutes", "INTEGER"),
    ("streak", "INTEGER NOT NULL DEFAULT 0"),
    ("until", "TEXT"),
    // Sync: an id that is the same on every computer, when it last changed, and deletions kept as markers.
    ("uid", "TEXT"),
    ("updated_at", "TEXT"),
    ("deleted", "INTEGER NOT NULL DEFAULT 0"),
];

const COLUMNS: &str =
    "id, title, tags, due, time, repeat, remind_minutes, streak, created_at, done_at, until";

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
        let unnamed: Vec<i64> = db
            .prepare("SELECT id FROM todos WHERE uid IS NULL")?
            .query_map([], |row| row.get(0))?
            .collect::<rusqlite::Result<_>>()?;
        for id in unnamed {
            db.execute(
                "UPDATE todos SET uid = ?1, updated_at = COALESCE(updated_at, created_at) WHERE id = ?2",
                params![new_uid(), id],
            )?;
        }
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
            "INSERT INTO todos (title, kind, tags, due, time, repeat, remind_minutes, created_at, until,
                 uid, updated_at)
             VALUES (?1, 'task', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?7)",
            params![
                title,
                tags.join(" "),
                due,
                input.time,
                input.repeat.as_str(),
                input.remind_minutes,
                now,
                input.until,
                new_uid()
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
            until: input.until,
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
                 remind_minutes = ?6, until = ?7, updated_at = ?9 WHERE id = ?8",
            params![
                title,
                tags.join(" "),
                input.due,
                input.time,
                input.repeat.as_str(),
                input.remind_minutes,
                input.until,
                id,
                Utc::now()
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
        if todo.repeat.hours().is_some() {
            let count = if todo.due == Some(today) {
                todo.streak + 1
            } else {
                1
            };
            self.db.execute(
                "UPDATE todos SET due = ?1, streak = ?2, updated_at = ?4 WHERE id = ?3",
                params![today, count, id, now],
            )?;
            return Ok(true);
        }
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
                    "UPDATE todos SET due = ?1, streak = ?2, updated_at = ?4 WHERE id = ?3",
                    params![next, streak, id, now],
                )?;
            }
            None => {
                self.db.execute(
                    "UPDATE todos SET done_at = ?1, updated_at = ?1 WHERE id = ?2",
                    params![now, id],
                )?;
            }
        }
        Ok(true)
    }

    /// Puts a finished to-do back on the list.
    pub fn reopen(&self, id: i64) -> rusqlite::Result<bool> {
        let changed = self.db.execute(
            "UPDATE todos SET done_at = NULL, updated_at = ?2 WHERE id = ?1",
            params![id, Utc::now()],
        )?;
        Ok(changed > 0)
    }

    /// Marks a to-do deleted; the marker syncs, so it disappears on every computer.
    pub fn delete(&self, id: i64) -> rusqlite::Result<bool> {
        self.db
            .execute("DELETE FROM todo_log WHERE todo_id = ?1", params![id])?;
        Ok(self.db.execute(
            "UPDATE todos SET deleted = 1, updated_at = ?2 WHERE id = ?1 AND deleted = 0",
            params![id, Utc::now()],
        )? > 0)
    }

    /// Every to-do, deleted ones included, as written to the sync folder.
    pub fn records(&self) -> rusqlite::Result<Vec<TodoRecord>> {
        let mut query = self.db.prepare(&format!(
            "SELECT {COLUMNS}, uid, updated_at, deleted FROM todos WHERE uid IS NOT NULL"
        ))?;
        let rows = query.query_map([], |row| {
            Ok(TodoRecord {
                todo: Todo::from_row(row)?,
                uid: row.get(11)?,
                updated_at: row.get(12)?,
                deleted: row.get(13)?,
            })
        })?;
        rows.collect()
    }

    /// Takes in another computer's to-dos: new ones are added, and the newer edit of each wins.
    /// Returns how many changed here.
    pub fn apply(&self, records: &[TodoRecord]) -> rusqlite::Result<usize> {
        let mut changed = 0;
        for record in records {
            let local: Option<(i64, DateTime<Utc>)> = self
                .db
                .query_row(
                    "SELECT id, updated_at FROM todos WHERE uid = ?1",
                    params![record.uid],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .optional()?;
            let todo = &record.todo;
            let values = params![
                todo.title,
                todo.tags.join(" "),
                todo.due,
                todo.time,
                todo.repeat.as_str(),
                todo.remind_minutes,
                todo.until,
                todo.streak,
                todo.created_at,
                todo.done_at,
                record.updated_at,
                record.deleted,
                record.uid,
            ];
            match local {
                None if record.deleted => continue,
                None => {
                    self.db.execute(
                        "INSERT INTO todos (title, kind, tags, due, time, repeat, remind_minutes, until,
                             streak, created_at, done_at, updated_at, deleted, uid)
                         VALUES (?1, 'task', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                        values,
                    )?;
                }
                Some((_, updated)) if updated >= record.updated_at => continue,
                Some(_) => {
                    self.db.execute(
                        "UPDATE todos SET title = ?1, tags = ?2, due = ?3, time = ?4, repeat = ?5,
                             remind_minutes = ?6, until = ?7, streak = ?8, created_at = ?9,
                             done_at = ?10, updated_at = ?11, deleted = ?12
                         WHERE uid = ?13",
                        values,
                    )?;
                }
            }
            changed += 1;
        }
        Ok(changed)
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
            "SELECT {COLUMNS} FROM todos WHERE done_at IS NULL AND deleted = 0
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
            "SELECT {COLUMNS} FROM todos WHERE done_at IS NOT NULL AND deleted = 0
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
    fn daytime_nudges_fill_the_window_and_count_today() {
        let zone = FixedOffset::east_opt(5 * 3600).unwrap();
        let store = TodoStore::in_memory().unwrap();
        let water = TodoInput {
            repeat: Repeat::EveryTwoHours,
            time: NaiveTime::from_hms_opt(9, 0, 0),
            until: NaiveTime::from_hms_opt(15, 0, 0),
            remind_minutes: Some(0),
            ..input("Drink water")
        };
        let todo = store.add(&water, Utc::now()).unwrap();
        // Nudges start the day the to-do is added, so the check uses that day.
        let day = Utc::now().with_timezone(&zone).date_naive();
        let hours: Vec<String> = todo
            .nudges_on(day, zone)
            .iter()
            .map(|at| at.with_timezone(&zone).format("%H:%M").to_string())
            .collect();
        assert_eq!(hours, ["09:00", "11:00", "13:00", "15:00"]);

        store.complete(todo.id, Utc::now(), day).unwrap();
        store.complete(todo.id, Utc::now(), day).unwrap();
        let open = store.open_items().unwrap();
        assert_eq!(open[0].streak, 2);
        assert_eq!(open[0].live_streak(day), 2);
        assert_eq!(open[0].live_streak(day.succ_opt().unwrap()), 0);
        assert!(open[0].done_at.is_none());
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

    #[test]
    fn to_dos_travel_between_computers() {
        let mac = TodoStore::in_memory().unwrap();
        let windows = TodoStore::in_memory().unwrap();
        let earlier = Utc::now() - chrono::TimeDelta::minutes(5);

        let rent = mac
            .add(&dated("Pay rent #bills", "2026-11-01"), earlier)
            .unwrap();
        assert_eq!(windows.apply(&mac.records().unwrap()).unwrap(), 1);
        let there = windows.open_items().unwrap();
        assert_eq!(there[0].title, "Pay rent");
        assert_eq!(there[0].tags, ["bills"]);

        // Applying the same thing again changes nothing.
        assert_eq!(windows.apply(&mac.records().unwrap()).unwrap(), 0);

        // An edit on Windows reaches the Mac; the Mac's older copy does not undo it.
        let id_there = there[0].id;
        windows
            .edit(id_there, &dated("Pay rent and bills #bills", "2026-11-01"))
            .unwrap();
        assert_eq!(windows.apply(&mac.records().unwrap()).unwrap(), 0);
        assert_eq!(mac.apply(&windows.records().unwrap()).unwrap(), 1);
        assert_eq!(mac.open_items().unwrap()[0].title, "Pay rent and bills");

        // Deleting on the Mac removes it on Windows too.
        mac.delete(rent.id).unwrap();
        assert!(mac.open_items().unwrap().is_empty());
        windows.apply(&mac.records().unwrap()).unwrap();
        assert!(windows.open_items().unwrap().is_empty());

        // A marker for something never seen here is not resurrected as a to-do.
        let fresh = TodoStore::in_memory().unwrap();
        assert_eq!(fresh.apply(&mac.records().unwrap()).unwrap(), 0);
        assert!(fresh.records().unwrap().is_empty());
    }

    #[test]
    fn records_survive_the_trip_through_a_file() {
        let store = TodoStore::in_memory().unwrap();
        store
            .add(
                &TodoInput {
                    repeat: Repeat::EveryTwoHours,
                    time: NaiveTime::from_hms_opt(9, 0, 0),
                    until: NaiveTime::from_hms_opt(21, 0, 0),
                    remind_minutes: Some(0),
                    ..input("Drink water")
                },
                Utc::now(),
            )
            .unwrap();
        let json = serde_json::to_string(&store.records().unwrap()).unwrap();
        let back: Vec<TodoRecord> = serde_json::from_str(&json).unwrap();
        assert_eq!(back, store.records().unwrap());
    }
}
