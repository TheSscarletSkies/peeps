//! Drafts the helper writes on a schedule, like a LinkedIn post every Monday at nine.

use std::path::Path;

use chrono::{DateTime, FixedOffset, NaiveDate, NaiveTime, TimeZone, Utc};
use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};

use crate::todos::Repeat;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Schedule {
    pub id: i64,
    pub kind: String,
    pub topic: String,
    /// `Never` runs once and is then removed.
    pub repeat: Repeat,
    pub time: NaiveTime,
    pub next_at: DateTime<Utc>,
    /// The computer that writes it, so a synced schedule runs once and not on every laptop.
    #[serde(default)]
    pub device: String,
}

/// A schedule as it travels between computers.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleRecord {
    pub uid: String,
    pub updated_at: DateTime<Utc>,
    pub deleted: bool,
    #[serde(flatten)]
    pub schedule: Schedule,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewSchedule {
    pub kind: String,
    pub topic: String,
    pub repeat: Repeat,
    /// The first day it may run.
    pub start: NaiveDate,
    pub time: NaiveTime,
}

/// The first run of `repeat` from `start` at `time`, in the user's zone, strictly after `after`.
pub fn next_run(
    repeat: Repeat,
    start: NaiveDate,
    time: NaiveTime,
    zone: FixedOffset,
    after: DateTime<Utc>,
) -> Option<DateTime<Utc>> {
    let mut day = start;
    // A year of daily runs is far more than any schedule needs to look ahead.
    for _ in 0..400 {
        let at = zone
            .from_local_datetime(&day.and_time(time))
            .single()?
            .with_timezone(&Utc);
        if at > after {
            return Some(at);
        }
        day = repeat.after(day)?;
    }
    None
}

const SCHEMA: &str = "
    CREATE TABLE IF NOT EXISTS schedules (
        id INTEGER PRIMARY KEY,
        kind TEXT NOT NULL,
        topic TEXT NOT NULL,
        repeat TEXT NOT NULL,
        time TEXT NOT NULL,
        next_at TEXT NOT NULL
    );
";

const ADDED: [(&str, &str); 4] = [
    ("device", "TEXT NOT NULL DEFAULT ''"),
    ("uid", "TEXT"),
    ("updated_at", "TEXT"),
    ("deleted", "INTEGER NOT NULL DEFAULT 0"),
];

const COLUMNS: &str = "id, kind, topic, repeat, time, next_at, device";

pub struct ScheduleStore {
    db: Connection,
}

impl ScheduleStore {
    pub fn open(path: &Path) -> rusqlite::Result<Self> {
        Self::init(Connection::open(path)?)
    }

    pub fn in_memory() -> rusqlite::Result<Self> {
        Self::init(Connection::open_in_memory()?)
    }

    fn init(db: Connection) -> rusqlite::Result<Self> {
        db.execute_batch(SCHEMA)?;
        let existing: Vec<String> = db
            .prepare("SELECT name FROM pragma_table_info('schedules')")?
            .query_map([], |row| row.get(0))?
            .collect::<rusqlite::Result<_>>()?;
        for (name, definition) in ADDED {
            if !existing.iter().any(|column| column == name) {
                db.execute_batch(&format!(
                    "ALTER TABLE schedules ADD COLUMN {name} {definition}"
                ))?;
            }
        }
        let unnamed: Vec<i64> = db
            .prepare("SELECT id FROM schedules WHERE uid IS NULL")?
            .query_map([], |row| row.get(0))?
            .collect::<rusqlite::Result<_>>()?;
        for id in unnamed {
            db.execute(
                "UPDATE schedules SET uid = ?1, updated_at = ?2 WHERE id = ?3",
                params![crate::todos::new_uid(), Utc::now(), id],
            )?;
        }
        Ok(Self { db })
    }

    /// Adds a schedule, or returns `None` when it would never run (a one-off in the past).
    pub fn add(
        &self,
        new: &NewSchedule,
        zone: FixedOffset,
        now: DateTime<Utc>,
        device: &str,
    ) -> rusqlite::Result<Option<Schedule>> {
        let Some(next_at) = next_run(new.repeat, new.start, new.time, zone, now) else {
            return Ok(None);
        };
        self.db.execute(
            "INSERT INTO schedules (kind, topic, repeat, time, next_at, device, uid, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                new.kind,
                new.topic.trim(),
                repeat_text(new.repeat),
                new.time,
                next_at,
                device,
                crate::todos::new_uid(),
                now
            ],
        )?;
        Ok(Some(Schedule {
            id: self.db.last_insert_rowid(),
            kind: new.kind.clone(),
            topic: new.topic.trim().to_owned(),
            repeat: new.repeat,
            time: new.time,
            next_at,
            device: device.to_owned(),
        }))
    }

    /// Soonest first.
    pub fn all(&self) -> rusqlite::Result<Vec<Schedule>> {
        let mut query = self.db.prepare(&format!(
            "SELECT {COLUMNS} FROM schedules WHERE deleted = 0 ORDER BY next_at"
        ))?;
        let rows = query.query_map([], from_row)?;
        rows.collect()
    }

    /// Schedules this computer should run now. Ones made before syncing existed belong to everyone.
    pub fn due(&self, now: DateTime<Utc>, device: &str) -> rusqlite::Result<Vec<Schedule>> {
        Ok(self
            .all()?
            .into_iter()
            .filter(|schedule| {
                schedule.next_at <= now && (schedule.device.is_empty() || schedule.device == device)
            })
            .collect())
    }

    /// Moves a schedule to its next run after `now`, or removes it if it was a one-off.
    pub fn advance(&self, id: i64, zone: FixedOffset, now: DateTime<Utc>) -> rusqlite::Result<()> {
        let Some(schedule) = self.all()?.into_iter().find(|s| s.id == id) else {
            return Ok(());
        };
        let day = schedule.next_at.with_timezone(&zone).date_naive();
        let next = schedule
            .repeat
            .after(day)
            .and_then(|start| next_run(schedule.repeat, start, schedule.time, zone, now));
        match next {
            Some(next_at) => self.db.execute(
                "UPDATE schedules SET next_at = ?1, updated_at = ?3 WHERE id = ?2",
                params![next_at, id, now],
            )?,
            None => self.delete_inner(id)?,
        };
        Ok(())
    }

    pub fn delete(&self, id: i64) -> rusqlite::Result<bool> {
        Ok(self.delete_inner(id)? > 0)
    }

    /// Leaves a marker so the deletion reaches other computers.
    fn delete_inner(&self, id: i64) -> rusqlite::Result<usize> {
        self.db.execute(
            "UPDATE schedules SET deleted = 1, updated_at = ?2 WHERE id = ?1 AND deleted = 0",
            params![id, Utc::now()],
        )
    }

    pub fn records(&self) -> rusqlite::Result<Vec<ScheduleRecord>> {
        let mut query = self.db.prepare(&format!(
            "SELECT {COLUMNS}, uid, updated_at, deleted FROM schedules WHERE uid IS NOT NULL"
        ))?;
        let rows = query.query_map([], |row| {
            Ok(ScheduleRecord {
                schedule: from_row(row)?,
                uid: row.get(7)?,
                updated_at: row.get(8)?,
                deleted: row.get(9)?,
            })
        })?;
        rows.collect()
    }

    /// Takes in another computer's schedules; the newer edit of each wins.
    pub fn apply(&self, records: &[ScheduleRecord]) -> rusqlite::Result<usize> {
        let mut changed = 0;
        for record in records {
            let local: Option<DateTime<Utc>> = self
                .db
                .query_row(
                    "SELECT updated_at FROM schedules WHERE uid = ?1",
                    params![record.uid],
                    |row| row.get(0),
                )
                .optional()?;
            let schedule = &record.schedule;
            let values = params![
                schedule.kind,
                schedule.topic,
                repeat_text(schedule.repeat),
                schedule.time,
                schedule.next_at,
                schedule.device,
                record.updated_at,
                record.deleted,
                record.uid,
            ];
            match local {
                None if record.deleted => continue,
                None => {
                    self.db.execute(
                        "INSERT INTO schedules (kind, topic, repeat, time, next_at, device, updated_at,
                             deleted, uid)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                        values,
                    )?;
                }
                Some(updated) if updated >= record.updated_at => continue,
                Some(_) => {
                    self.db.execute(
                        "UPDATE schedules SET kind = ?1, topic = ?2, repeat = ?3, time = ?4,
                             next_at = ?5, device = ?6, updated_at = ?7, deleted = ?8
                         WHERE uid = ?9",
                        values,
                    )?;
                }
            }
            changed += 1;
        }
        Ok(changed)
    }
}

fn repeat_text(repeat: Repeat) -> String {
    serde_json::to_value(repeat)
        .ok()
        .and_then(|value| value.as_str().map(str::to_owned))
        .unwrap_or_else(|| "never".to_owned())
}

fn from_row(row: &Row<'_>) -> rusqlite::Result<Schedule> {
    let repeat: String = row.get(3)?;
    Ok(Schedule {
        id: row.get(0)?,
        kind: row.get(1)?,
        topic: row.get(2)?,
        repeat: serde_json::from_value(serde_json::Value::String(repeat)).unwrap_or_default(),
        time: row.get(4)?,
        next_at: row.get(5)?,
        device: row.get(6)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn zone() -> FixedOffset {
        FixedOffset::east_opt(5 * 3600).unwrap()
    }

    fn at(text: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(text)
            .unwrap()
            .with_timezone(&Utc)
    }

    fn monday_post() -> NewSchedule {
        NewSchedule {
            kind: "linkedin".into(),
            topic: " What I shipped this week ".into(),
            repeat: Repeat::Weekly,
            start: "2026-10-19".parse().unwrap(),
            time: NaiveTime::from_hms_opt(9, 0, 0).unwrap(),
        }
    }

    #[test]
    fn first_run_is_the_next_slot() {
        let store = ScheduleStore::in_memory().unwrap();
        // Monday 10 am local: this Monday's nine o'clock has passed, so next Monday.
        let schedule = store
            .add(&monday_post(), zone(), at("2026-10-19T05:00:00Z"), "mac")
            .unwrap()
            .unwrap();
        assert_eq!(schedule.next_at, at("2026-10-26T04:00:00Z"));
        assert_eq!(schedule.topic, "What I shipped this week");
    }

    #[test]
    fn running_moves_it_a_week_on() {
        let store = ScheduleStore::in_memory().unwrap();
        let schedule = store
            .add(&monday_post(), zone(), at("2026-10-19T03:00:00Z"), "mac")
            .unwrap()
            .unwrap();
        assert_eq!(schedule.next_at, at("2026-10-19T04:00:00Z"));

        let now = at("2026-10-19T04:00:30Z");
        assert_eq!(store.due(now, "mac").unwrap().len(), 1);
        store.advance(schedule.id, zone(), now).unwrap();
        assert!(store.due(now, "mac").unwrap().is_empty());
        assert_eq!(store.all().unwrap()[0].next_at, at("2026-10-26T04:00:00Z"));
    }

    #[test]
    fn one_offs_disappear_after_running_and_past_ones_are_refused() {
        let store = ScheduleStore::in_memory().unwrap();
        let once = NewSchedule {
            repeat: Repeat::Never,
            start: "2026-10-21".parse().unwrap(),
            ..monday_post()
        };
        let schedule = store
            .add(&once, zone(), at("2026-10-19T00:00:00Z"), "mac")
            .unwrap()
            .unwrap();
        store
            .advance(schedule.id, zone(), at("2026-10-21T04:00:01Z"))
            .unwrap();
        assert!(store.all().unwrap().is_empty());

        let past = NewSchedule {
            repeat: Repeat::Never,
            start: "2026-10-01".parse().unwrap(),
            ..monday_post()
        };
        assert!(store
            .add(&past, zone(), at("2026-10-19T00:00:00Z"), "mac")
            .unwrap()
            .is_none());
    }

    #[test]
    fn a_missed_run_catches_up_once() {
        let store = ScheduleStore::in_memory().unwrap();
        let daily = NewSchedule {
            repeat: Repeat::Daily,
            ..monday_post()
        };
        let schedule = store
            .add(&daily, zone(), at("2026-10-19T00:00:00Z"), "mac")
            .unwrap()
            .unwrap();
        // The laptop was asleep for three days; it drafts once, then waits for tomorrow.
        let now = at("2026-10-22T08:00:00Z");
        assert_eq!(store.due(now, "mac").unwrap().len(), 1);
        store.advance(schedule.id, zone(), now).unwrap();
        assert_eq!(store.all().unwrap()[0].next_at, at("2026-10-23T04:00:00Z"));
    }

    #[test]
    fn synced_schedules_run_only_on_their_own_computer() {
        let mac = ScheduleStore::in_memory().unwrap();
        let windows = ScheduleStore::in_memory().unwrap();
        mac.add(&monday_post(), zone(), at("2026-10-19T03:00:00Z"), "mac")
            .unwrap();
        assert_eq!(windows.apply(&mac.records().unwrap()).unwrap(), 1);

        let now = at("2026-10-19T04:00:30Z");
        assert_eq!(windows.all().unwrap().len(), 1);
        assert!(windows.due(now, "windows").unwrap().is_empty());
        assert_eq!(mac.due(now, "mac").unwrap().len(), 1);

        let id = windows.all().unwrap()[0].id;
        windows.delete(id).unwrap();
        mac.apply(&windows.records().unwrap()).unwrap();
        assert!(mac.all().unwrap().is_empty());
    }
}
