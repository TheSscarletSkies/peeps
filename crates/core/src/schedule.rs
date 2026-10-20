//! Drafts the helper writes on a schedule, like a LinkedIn post every Monday at nine.

use std::path::Path;

use chrono::{DateTime, FixedOffset, NaiveDate, NaiveTime, TimeZone, Utc};
use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};

use crate::todos::Repeat;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Schedule {
    pub id: i64,
    pub kind: String,
    pub topic: String,
    /// `Never` runs once and is then removed.
    pub repeat: Repeat,
    pub time: NaiveTime,
    pub next_at: DateTime<Utc>,
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
        Ok(Self { db })
    }

    /// Adds a schedule, or returns `None` when it would never run (a one-off in the past).
    pub fn add(
        &self,
        new: &NewSchedule,
        zone: FixedOffset,
        now: DateTime<Utc>,
    ) -> rusqlite::Result<Option<Schedule>> {
        let Some(next_at) = next_run(new.repeat, new.start, new.time, zone, now) else {
            return Ok(None);
        };
        self.db.execute(
            "INSERT INTO schedules (kind, topic, repeat, time, next_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                new.kind,
                new.topic.trim(),
                repeat_text(new.repeat),
                new.time,
                next_at
            ],
        )?;
        Ok(Some(Schedule {
            id: self.db.last_insert_rowid(),
            kind: new.kind.clone(),
            topic: new.topic.trim().to_owned(),
            repeat: new.repeat,
            time: new.time,
            next_at,
        }))
    }

    /// Soonest first.
    pub fn all(&self) -> rusqlite::Result<Vec<Schedule>> {
        let mut query = self.db.prepare(
            "SELECT id, kind, topic, repeat, time, next_at FROM schedules ORDER BY next_at",
        )?;
        let rows = query.query_map([], from_row)?;
        rows.collect()
    }

    pub fn due(&self, now: DateTime<Utc>) -> rusqlite::Result<Vec<Schedule>> {
        Ok(self
            .all()?
            .into_iter()
            .filter(|schedule| schedule.next_at <= now)
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
                "UPDATE schedules SET next_at = ?1 WHERE id = ?2",
                params![next_at, id],
            )?,
            None => self.delete_inner(id)?,
        };
        Ok(())
    }

    pub fn delete(&self, id: i64) -> rusqlite::Result<bool> {
        Ok(self.delete_inner(id)? > 0)
    }

    fn delete_inner(&self, id: i64) -> rusqlite::Result<usize> {
        self.db
            .execute("DELETE FROM schedules WHERE id = ?1", params![id])
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
            .add(&monday_post(), zone(), at("2026-10-19T05:00:00Z"))
            .unwrap()
            .unwrap();
        assert_eq!(schedule.next_at, at("2026-10-26T04:00:00Z"));
        assert_eq!(schedule.topic, "What I shipped this week");
    }

    #[test]
    fn running_moves_it_a_week_on() {
        let store = ScheduleStore::in_memory().unwrap();
        let schedule = store
            .add(&monday_post(), zone(), at("2026-10-19T03:00:00Z"))
            .unwrap()
            .unwrap();
        assert_eq!(schedule.next_at, at("2026-10-19T04:00:00Z"));

        let now = at("2026-10-19T04:00:30Z");
        assert_eq!(store.due(now).unwrap().len(), 1);
        store.advance(schedule.id, zone(), now).unwrap();
        assert!(store.due(now).unwrap().is_empty());
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
            .add(&once, zone(), at("2026-10-19T00:00:00Z"))
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
            .add(&past, zone(), at("2026-10-19T00:00:00Z"))
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
            .add(&daily, zone(), at("2026-10-19T00:00:00Z"))
            .unwrap()
            .unwrap();
        // The laptop was asleep for three days; it drafts once, then waits for tomorrow.
        let now = at("2026-10-22T08:00:00Z");
        assert_eq!(store.due(now).unwrap().len(), 1);
        store.advance(schedule.id, zone(), now).unwrap();
        assert_eq!(store.all().unwrap()[0].next_at, at("2026-10-23T04:00:00Z"));
    }
}
