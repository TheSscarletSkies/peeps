//! Focus sessions: a stretch of work, then a break, with the pet keeping time.

use chrono::{DateTime, TimeDelta, Utc};
use serde::Serialize;

pub const FOCUS_MINUTES: i64 = 25;
pub const BREAK_MINUTES: i64 = 5;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Session {
    pub started_at: DateTime<Utc>,
    pub focus_minutes: i64,
    pub break_minutes: i64,
    /// What it is for, if they said; the pet mentions it when time is up.
    pub task: Option<String>,
    /// Study, work or another of the user's areas, shown to friends as "studying" or "working".
    pub area: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Phase {
    Focus,
    Break,
    Over,
}

/// A moment worth telling the user about.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Turn {
    BreakStarts,
    BreakEnds,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FocusView {
    pub phase: Phase,
    pub started_at: DateTime<Utc>,
    pub ends_at: DateTime<Utc>,
    pub focus_minutes: i64,
    pub task: Option<String>,
    pub area: Option<String>,
}

impl Session {
    pub fn new(started_at: DateTime<Utc>, focus_minutes: i64, task: Option<String>) -> Self {
        // Short sessions get short breaks, the way the 25/5 rhythm scales.
        let break_minutes = (focus_minutes / 5).clamp(1, 15);
        let task = task.map(|t| t.trim().to_owned()).filter(|t| !t.is_empty());
        Self {
            started_at,
            focus_minutes: focus_minutes.clamp(1, 180),
            break_minutes,
            task,
            area: None,
        }
    }

    pub fn in_area(mut self, area: Option<String>) -> Self {
        self.area = area.filter(|a| !a.trim().is_empty());
        self
    }

    fn focus_end(&self) -> DateTime<Utc> {
        self.started_at + TimeDelta::minutes(self.focus_minutes)
    }

    fn break_end(&self) -> DateTime<Utc> {
        self.focus_end() + TimeDelta::minutes(self.break_minutes)
    }

    pub fn phase(&self, now: DateTime<Utc>) -> Phase {
        if now < self.focus_end() {
            Phase::Focus
        } else if now < self.break_end() {
            Phase::Break
        } else {
            Phase::Over
        }
    }

    /// What happened between two ticks, so a slow or sleeping loop still says it once.
    pub fn turn(&self, after: DateTime<Utc>, now: DateTime<Utc>) -> Option<Turn> {
        let crossed = |at: DateTime<Utc>| after < at && at <= now;
        if crossed(self.break_end()) {
            Some(Turn::BreakEnds)
        } else if crossed(self.focus_end()) {
            Some(Turn::BreakStarts)
        } else {
            None
        }
    }

    pub fn view(&self, now: DateTime<Utc>) -> Option<FocusView> {
        let phase = self.phase(now);
        let ends_at = match phase {
            Phase::Focus => self.focus_end(),
            Phase::Break => self.break_end(),
            Phase::Over => return None,
        };
        Some(FocusView {
            phase,
            started_at: self.started_at,
            ends_at,
            focus_minutes: self.focus_minutes,
            task: self.task.clone(),
            area: self.area.clone(),
        })
    }

    /// What the pet says at each turn.
    pub fn line(&self, turn: Turn) -> (String, String) {
        match turn {
            Turn::BreakStarts => (
                "Break time".to_owned(),
                match &self.task {
                    Some(task) => format!(
                        "{} minutes on {task}, nice. Stretch for {}.",
                        self.focus_minutes, self.break_minutes
                    ),
                    None => format!(
                        "{} minutes done, nice. Stretch for {}.",
                        self.focus_minutes, self.break_minutes
                    ),
                },
            ),
            Turn::BreakEnds => (
                "Break's over".to_owned(),
                "Ready for another round?".to_owned(),
            ),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(minutes: i64) -> DateTime<Utc> {
        DateTime::from_timestamp(1_800_000_000, 0).unwrap() + TimeDelta::minutes(minutes)
    }

    #[test]
    fn focus_then_break_then_over() {
        let session = Session::new(at(0), 25, None);
        assert_eq!(session.break_minutes, 5);
        assert_eq!(session.phase(at(10)), Phase::Focus);
        assert_eq!(session.phase(at(26)), Phase::Break);
        assert_eq!(session.phase(at(30)), Phase::Over);
        assert_eq!(session.view(at(26)).unwrap().ends_at, at(30));
        assert_eq!(session.view(at(31)), None);
    }

    #[test]
    fn each_turn_is_told_once() {
        let session = Session::new(at(0), 25, Some(" essay ".into()));
        assert_eq!(session.turn(at(24), at(25)), Some(Turn::BreakStarts));
        assert_eq!(session.turn(at(25), at(26)), None);
        assert_eq!(session.turn(at(29), at(30)), Some(Turn::BreakEnds));
        // Woken from sleep long after: only the latest turn.
        assert_eq!(session.turn(at(1), at(90)), Some(Turn::BreakEnds));
        assert!(session.line(Turn::BreakStarts).1.contains("on essay"));
    }

    #[test]
    fn odd_lengths_stay_sensible() {
        assert_eq!(Session::new(at(0), 3, None).break_minutes, 1);
        assert_eq!(Session::new(at(0), 120, None).break_minutes, 15);
        assert_eq!(Session::new(at(0), 999, None).focus_minutes, 180);
        assert_eq!(Session::new(at(0), 25, Some("  ".into())).task, None);
    }
}
