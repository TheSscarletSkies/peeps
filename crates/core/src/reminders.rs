//! Turns calendar events and to-dos into notifications at the right lead time.

use chrono::{DateTime, FixedOffset, TimeDelta, Utc};

use crate::calendar::Event;
use crate::config::{CalendarFeed, Reminders};
use crate::todos::Todo;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Reminder {
    /// Stable per occurrence, so the same reminder is never shown twice.
    pub key: String,
    pub title: String,
    pub body: String,
    pub at: DateTime<Utc>,
}

/// All-day events, like exams, remind on the morning they happen.
const MORNING_HOURS: i64 = 9;

/// Minutes of warning for a title: the first matching rule, then the calendar's own, then the default.
/// `None` means the event is muted.
pub fn lead(title: &str, calendar: Option<i64>, settings: &Reminders) -> Option<i64> {
    let lower = title.to_lowercase();
    match settings.rules.iter().find(|rule| {
        !rule.contains.trim().is_empty() && lower.contains(&rule.contains.trim().to_lowercase())
    }) {
        Some(rule) if rule.mute => None,
        Some(rule) => Some(rule.minutes),
        None => Some(calendar.unwrap_or(settings.default_minutes)),
    }
}

pub fn for_events(
    events: &[Event],
    feeds: &[CalendarFeed],
    settings: &Reminders,
    zone: FixedOffset,
) -> Vec<Reminder> {
    events
        .iter()
        .filter_map(|event| {
            let feed = feeds.iter().find(|feed| feed.name == event.calendar)?;
            if !feed.notify {
                return None;
            }
            let minutes = lead(&event.title, feed.remind_minutes, settings)?;
            let anchor = if event.all_day {
                event.start + TimeDelta::hours(MORNING_HOURS)
            } else {
                event.start
            };
            let mut body = if event.all_day {
                "Today".to_owned()
            } else {
                format!("Starts at {}", clock(event.start, zone))
            };
            if !event.all_day && minutes > 0 {
                body.push_str(&format!(" · in {}", span(minutes)));
            }
            if let Some(place) = &event.location {
                body.push_str(&format!(" · {place}"));
            }
            Some(Reminder {
                key: format!("event:{}", event.key),
                title: event.title.clone(),
                body,
                at: anchor - TimeDelta::minutes(minutes),
            })
        })
        .collect()
}

pub fn for_todos(todos: &[Todo], zone: FixedOffset) -> Vec<Reminder> {
    todos
        .iter()
        .filter_map(|todo| {
            let at = todo.remind_at(zone)?;
            let body = match todo.time {
                Some(_) => format!("Due at {}", clock(at_due(todo, at), zone)),
                None => "Due today".to_owned(),
            };
            Some(Reminder {
                key: format!("todo:{}:{}", todo.id, at.timestamp()),
                title: todo.title.clone(),
                body,
                at,
            })
        })
        .collect()
}

fn at_due(todo: &Todo, remind_at: DateTime<Utc>) -> DateTime<Utc> {
    remind_at + TimeDelta::minutes(todo.remind_minutes.unwrap_or(0))
}

/// Reminders whose moment fell in `(after, upto]`, so each one fires exactly once.
pub fn due(reminders: &[Reminder], after: DateTime<Utc>, upto: DateTime<Utc>) -> Vec<Reminder> {
    reminders
        .iter()
        .filter(|reminder| reminder.at > after && reminder.at <= upto)
        .cloned()
        .collect()
}

fn clock(at: DateTime<Utc>, zone: FixedOffset) -> String {
    at.with_timezone(&zone).format("%-I:%M %p").to_string()
}

fn span(minutes: i64) -> String {
    match minutes {
        m if m % 1440 == 0 => plural(m / 1440, "day"),
        m if m % 60 == 0 => plural(m / 60, "hour"),
        m => format!("{m} min"),
    }
}

fn plural(n: i64, unit: &str) -> String {
    if n == 1 {
        format!("1 {unit}")
    } else {
        format!("{n} {unit}s")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::ReminderRule;

    fn zone() -> FixedOffset {
        FixedOffset::east_opt(5 * 3600).unwrap()
    }

    fn at(text: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(text)
            .unwrap()
            .with_timezone(&Utc)
    }

    fn settings() -> Reminders {
        Reminders {
            default_minutes: 15,
            rules: vec![
                ReminderRule {
                    contains: "Class".into(),
                    minutes: 30,
                    mute: false,
                },
                ReminderRule {
                    contains: "focus".into(),
                    minutes: 0,
                    mute: true,
                },
            ],
        }
    }

    fn feed(name: &str, minutes: Option<i64>) -> CalendarFeed {
        CalendarFeed {
            name: name.into(),
            url: String::new(),
            remind_minutes: minutes,
            notify: true,
        }
    }

    fn event(title: &str, start: &str, all_day: bool) -> Event {
        Event {
            key: format!("College:{title}"),
            calendar: "College".into(),
            title: title.into(),
            location: Some("Room 4".into()),
            start: at(start),
            end: at(start) + TimeDelta::hours(1),
            all_day,
        }
    }

    #[test]
    fn rules_win_then_calendar_then_default() {
        let settings = settings();
        assert_eq!(lead("Marketing class", Some(5), &settings), Some(30));
        assert_eq!(lead("Focus time", None, &settings), None);
        assert_eq!(lead("Dentist", Some(60), &settings), Some(60));
        assert_eq!(lead("Dentist", None, &settings), Some(15));
    }

    #[test]
    fn class_tonight_reminds_half_an_hour_early() {
        let reminders = for_events(
            &[event("Marketing class", "2026-10-20T13:00:00Z", false)],
            &[feed("College", None)],
            &settings(),
            zone(),
        );
        assert_eq!(reminders[0].at, at("2026-10-20T12:30:00Z"));
        assert_eq!(reminders[0].body, "Starts at 6:00 PM · in 30 min · Room 4");
    }

    #[test]
    fn all_day_events_remind_in_the_morning_and_muted_calendars_stay_quiet() {
        let exam = event("Finance exam", "2026-10-23T19:00:00Z", true);
        let reminders = for_events(
            std::slice::from_ref(&exam),
            &[feed("College", Some(60))],
            &settings(),
            zone(),
        );
        // Midnight local is 19:00 UTC; nine o'clock less an hour is 8 am local, 03:00 UTC.
        assert_eq!(reminders[0].at, at("2026-10-24T03:00:00Z"));
        assert_eq!(reminders[0].body, "Today · Room 4");

        let quiet = CalendarFeed {
            notify: false,
            ..feed("College", None)
        };
        assert!(for_events(&[exam], &[quiet], &settings(), zone()).is_empty());
    }

    #[test]
    fn each_reminder_fires_once() {
        let reminders = for_events(
            &[event("Marketing class", "2026-10-20T13:00:00Z", false)],
            &[feed("College", None)],
            &settings(),
            zone(),
        );
        let fire = at("2026-10-20T12:30:00Z");
        assert_eq!(
            due(&reminders, fire - TimeDelta::seconds(30), fire).len(),
            1
        );
        assert!(due(&reminders, fire, fire + TimeDelta::seconds(30)).is_empty());
    }

    #[test]
    fn spans_read_naturally() {
        assert_eq!(span(30), "30 min");
        assert_eq!(span(60), "1 hour");
        assert_eq!(span(120), "2 hours");
        assert_eq!(span(1440), "1 day");
    }
}
