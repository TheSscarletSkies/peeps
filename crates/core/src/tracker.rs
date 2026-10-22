//! Areas of life and a week of habits: the tracker side of the to-do list.

use chrono::{DateTime, FixedOffset, NaiveDate, TimeDelta, Utc};
use serde::Serialize;

use crate::todos::{Repeat, Todo};

const MAX_AREAS: usize = 8;

/// Tag-shaped, lower case, no repeats, at most a handful.
pub fn clean_areas(areas: &[String]) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for area in areas {
        let area: String = area
            .trim()
            .trim_start_matches('#')
            .to_lowercase()
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
            .take(20)
            .collect();
        if !area.is_empty() && !out.contains(&area) && out.len() < MAX_AREAS {
            out.push(area);
        }
    }
    out
}

/// The first of a to-do's tags that is one of the areas.
pub fn area_of(tags: &[String], areas: &[String]) -> Option<String> {
    tags.iter().find(|tag| areas.contains(tag)).cloned()
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HabitWeek {
    pub id: i64,
    pub title: String,
    pub area: Option<String>,
    /// The last seven days, oldest first, ending today.
    pub days: Vec<HabitDay>,
    pub streak: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HabitDay {
    pub date: NaiveDate,
    pub done: bool,
}

/// Every repeating to-do with a dot for each of the last seven days it was ticked off.
pub fn habit_week(
    todos: &[Todo],
    log: &[(i64, DateTime<Utc>)],
    areas: &[String],
    today: NaiveDate,
    zone: FixedOffset,
) -> Vec<HabitWeek> {
    let first = today - TimeDelta::days(6);
    todos
        .iter()
        .filter(|todo| todo.repeat != Repeat::Never)
        .map(|todo| {
            let ticked: Vec<NaiveDate> = log
                .iter()
                .filter(|(id, _)| *id == todo.id)
                .map(|(_, at)| at.with_timezone(&zone).date_naive())
                .collect();
            HabitWeek {
                id: todo.id,
                title: todo.title.clone(),
                area: area_of(&todo.tags, areas),
                days: (0..7)
                    .map(|offset| {
                        let date = first + TimeDelta::days(offset);
                        HabitDay {
                            date,
                            done: ticked.contains(&date),
                        }
                    })
                    .collect(),
                streak: todo.live_streak(today),
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_week_of_dots_for_each_habit() {
        use crate::todos::{TodoInput, TodoStore};
        let store = TodoStore::in_memory().unwrap();
        let zone = FixedOffset::east_opt(0).unwrap();
        let day = |d: u32| NaiveDate::from_ymd_opt(2026, 10, d).unwrap();
        let at = |d: u32| day(d).and_hms_opt(9, 0, 0).unwrap().and_utc();
        let input = |title: &str, repeat| TodoInput {
            title: title.into(),
            due: Some(day(19)),
            time: None,
            repeat,
            remind_minutes: None,
            until: None,
        };
        let read = store
            .add(&input("Read 20 pages #study", Repeat::Daily), at(19))
            .unwrap();
        store
            .add(&input("Pay rent", Repeat::Never), at(19))
            .unwrap();
        store.complete(read.id, at(19), day(19)).unwrap();
        store.complete(read.id, at(21), day(21)).unwrap();

        let week = habit_week(
            &store.open_items().unwrap(),
            &store.log_since(at(15)).unwrap(),
            &["study".into()],
            day(22),
            zone,
        );
        assert_eq!(week.len(), 1, "one-off to-dos aren't habits");
        assert_eq!(week[0].area.as_deref(), Some("study"));
        let dots: Vec<bool> = week[0].days.iter().map(|d| d.done).collect();
        assert_eq!(dots, [false, false, false, true, false, true, false]);
        assert_eq!(week[0].days[6].date, day(22));
    }

    #[test]
    fn areas_are_tidy_tags() {
        let given = ["Work", "#study", "work", " side project! ", ""].map(String::from);
        assert_eq!(clean_areas(&given), ["work", "study", "sideproject"]);
        let tags = ["habit", "study"].map(String::from);
        assert_eq!(
            area_of(&tags, &clean_areas(&given)).as_deref(),
            Some("study")
        );
        assert_eq!(area_of(&["habit".into()], &["work".into()]), None);
    }
}
