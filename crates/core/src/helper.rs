//! The helper pet: its mood, headline and the weekly recap.

use std::collections::{BTreeMap, HashSet};

use chrono::{DateTime, Datelike, FixedOffset, NaiveDate, TimeDelta, Utc};
use serde::Serialize;

use crate::calendar::Event;
use crate::chat::Message;
use crate::config::{Helper, PetKind};
use crate::drafts::{self, Draft};
use crate::mood::Mood;
use crate::schedule::Schedule;
use crate::snapshot::PermissionView;
use crate::todos::{Due, Todo};
use crate::usage::Usage;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HelperView {
    pub name: String,
    pub kind: PetKind,
    pub color: String,
    pub mood: Mood,
    pub headline: String,
    pub todos: Vec<TodoView>,
    pub done: Vec<Todo>,
    pub drafts: Vec<Draft>,
    pub draft_kinds: Vec<DraftKind>,
    pub drafting: bool,
    pub week: Week,
    pub todos_done_this_week: usize,
    pub drafts_this_week: usize,
    /// The next few calendar events, soonest first.
    pub upcoming: Vec<Event>,
    pub chat: Vec<Message>,
    /// True while the agent is answering a chat message.
    pub chatting: bool,
    pub schedules: Vec<Schedule>,
    /// The helper's own agent asking to use a tool.
    pub permission: Option<PermissionView>,
    /// The model and effort the user picked, if any.
    pub model: Option<String>,
    pub effort: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoView {
    #[serde(flatten)]
    pub todo: Todo,
    pub due_state: Due,
    /// The streak while it is unbroken, zero once a repeat is missed.
    pub live_streak: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DraftKind {
    pub id: String,
    pub label: String,
}

/// The last seven days of agent work.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Week {
    /// Busiest first.
    pub products: Vec<ProductWeek>,
    /// The weekday with the most tokens, in the user's time zone.
    pub busiest_day: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductWeek {
    pub product_id: String,
    pub tokens: u64,
    /// Minutes in which an agent produced at least one reply.
    pub active_minutes: u64,
}

pub struct HelperInputs<'a> {
    pub config: &'a Helper,
    pub open: Vec<Todo>,
    pub done: Vec<Todo>,
    pub drafts: Vec<Draft>,
    pub drafting: bool,
    pub week: Week,
    pub todos_done_this_week: usize,
    pub drafts_this_week: usize,
    pub today: NaiveDate,
    pub upcoming: Vec<Event>,
    pub now: DateTime<Utc>,
    pub chat: Vec<Message>,
    pub chatting: bool,
    pub schedules: Vec<Schedule>,
    pub permission: Option<PermissionView>,
}

/// Events starting this soon take over the helper's headline.
const SOON_MINUTES: i64 = 60;

pub fn view(inputs: HelperInputs<'_>) -> HelperView {
    let todos: Vec<TodoView> = inputs
        .open
        .into_iter()
        .map(|todo| TodoView {
            due_state: todo.due_state(inputs.today),
            live_streak: todo.live_streak(inputs.today),
            todo,
        })
        .collect();
    let count = |state: Due| todos.iter().filter(|t| t.due_state == state).count();
    let (overdue, today) = (count(Due::Overdue), count(Due::Today));

    let next = inputs.upcoming.iter().find(|event| {
        !event.all_day
            && event.start > inputs.now
            && (event.start - inputs.now).num_minutes() <= SOON_MINUTES
    });

    let (mood, headline) = if inputs.permission.is_some() {
        (Mood::NeedsYou, "Asking to use a tool".to_owned())
    } else if inputs.chatting {
        (Mood::Working, "Thinking…".to_owned())
    } else if let Some(event) = next {
        let minutes = (event.start - inputs.now).num_minutes().max(1);
        (Mood::NeedsYou, format!("{} in {minutes} min", event.title))
    } else if inputs.drafting {
        (Mood::Working, "Writing a draft…".to_owned())
    } else if overdue > 0 {
        // Its own to-dos make the helper peckish, not alarmed; only asks and imminent events need you.
        (
            Mood::Hungry,
            plural(overdue, "to-do overdue", "to-dos overdue"),
        )
    } else if today > 0 {
        (
            Mood::Chill,
            plural(today, "to-do due today", "to-dos due today"),
        )
    } else if todos.is_empty() {
        (Mood::Chill, "All clear. Ask me anything".to_owned())
    } else {
        (
            Mood::Chill,
            plural(todos.len(), "thing on the list", "things on the list"),
        )
    };

    HelperView {
        name: inputs.config.name.clone(),
        kind: inputs.config.pet.kind,
        color: inputs.config.pet.color.clone(),
        mood,
        headline,
        todos,
        done: inputs.done,
        drafts: inputs.drafts,
        draft_kinds: inputs
            .config
            .voices
            .keys()
            .map(|id| DraftKind {
                id: id.clone(),
                label: drafts::label(id),
            })
            .collect(),
        drafting: inputs.drafting,
        week: inputs.week,
        todos_done_this_week: inputs.todos_done_this_week,
        drafts_this_week: inputs.drafts_this_week,
        upcoming: inputs.upcoming,
        chat: inputs.chat,
        chatting: inputs.chatting,
        schedules: inputs.schedules,
        permission: inputs.permission,
        model: inputs.config.model.clone(),
        effort: inputs.config.effort.clone(),
    }
}

fn plural(n: usize, one: &str, many: &str) -> String {
    format!("{n} {}", if n == 1 { one } else { many })
}

/// Sums the last seven days of usage per product, in the user's time zone.
pub fn weekly<'a>(
    usage: impl IntoIterator<Item = (&'a str, &'a [Usage])>,
    now: DateTime<Utc>,
    zone: FixedOffset,
) -> Week {
    let since = now - TimeDelta::days(7);
    let mut tokens: BTreeMap<&str, u64> = BTreeMap::new();
    let mut minutes: BTreeMap<&str, HashSet<i64>> = BTreeMap::new();
    let mut days = [0u64; 7];
    for (product, entries) in usage {
        for entry in entries.iter().filter(|e| e.at > since && e.at <= now) {
            *tokens.entry(product).or_default() += entry.total();
            minutes
                .entry(product)
                .or_default()
                .insert(entry.at.timestamp() / 60);
            let day = entry.at.with_timezone(&zone).weekday();
            days[day.num_days_from_monday() as usize] += entry.total();
        }
    }
    let mut products: Vec<ProductWeek> = tokens
        .into_iter()
        .filter(|(_, tokens)| *tokens > 0)
        .map(|(product, tokens)| ProductWeek {
            product_id: product.to_owned(),
            tokens,
            active_minutes: minutes.get(product).map_or(0, |set| set.len() as u64),
        })
        .collect();
    products.sort_by_key(|entry| std::cmp::Reverse(entry.tokens));
    let busiest_day = (0..7)
        .filter(|&i| days[i] > 0)
        .max_by_key(|&i| days[i])
        .map(|i| WEEKDAYS[i].to_owned());
    Week {
        products,
        busiest_day,
    }
}

const WEEKDAYS: [&str; 7] = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
];

#[cfg(test)]
mod tests {
    use super::*;
    use crate::todos::Repeat;

    fn todo(due: Option<&str>) -> Todo {
        Todo {
            id: 1,
            title: "Post".into(),
            tags: Vec::new(),
            due: due.map(|d| d.parse().unwrap()),
            time: None,
            repeat: Repeat::Never,
            remind_minutes: None,
            until: None,
            streak: 0,
            created_at: Utc::now(),
            done_at: None,
        }
    }

    fn mood(open: Vec<Todo>, drafting: bool) -> (Mood, String) {
        let config = Helper::default();
        let helper = view(HelperInputs {
            config: &config,
            open,
            done: Vec::new(),
            drafts: Vec::new(),
            drafting,
            week: Week::default(),
            todos_done_this_week: 0,
            drafts_this_week: 0,
            today: "2026-10-19".parse().unwrap(),
            upcoming: Vec::new(),
            now: Utc::now(),
            chat: Vec::new(),
            chatting: false,
            schedules: Vec::new(),
            permission: None,
        });
        (helper.mood, helper.headline)
    }

    #[test]
    fn moods_follow_the_list() {
        assert_eq!(
            mood(vec![], false),
            (Mood::Chill, "All clear. Ask me anything".into())
        );
        assert_eq!(
            mood(vec![todo(Some("2026-10-25")), todo(None)], false),
            (Mood::Chill, "2 things on the list".into())
        );
        assert_eq!(
            mood(vec![todo(Some("2026-10-19"))], false),
            (Mood::Chill, "1 to-do due today".into())
        );
        assert_eq!(
            mood(
                vec![todo(Some("2026-10-01")), todo(Some("2026-10-19"))],
                false
            ),
            (Mood::Hungry, "1 to-do overdue".into())
        );
        assert_eq!(mood(vec![todo(Some("2026-10-01"))], true).0, Mood::Working);
    }

    #[test]
    fn offers_configured_draft_kinds() {
        let config = Helper::default();
        let helper = view(HelperInputs {
            config: &config,
            open: Vec::new(),
            done: Vec::new(),
            drafts: Vec::new(),
            drafting: false,
            week: Week::default(),
            todos_done_this_week: 0,
            drafts_this_week: 0,
            today: "2026-10-19".parse().unwrap(),
            upcoming: Vec::new(),
            now: Utc::now(),
            chat: Vec::new(),
            chatting: false,
            schedules: Vec::new(),
            permission: None,
        });
        let labels: Vec<_> = helper
            .draft_kinds
            .iter()
            .map(|k| k.label.as_str())
            .collect();
        assert_eq!(labels, ["LinkedIn post", "post for X"]);
    }

    #[test]
    fn weekly_sums_recent_usage_per_product() {
        let now: DateTime<Utc> = "2026-10-19T12:00:00Z".parse().unwrap();
        let at = |text: &str| text.parse::<DateTime<Utc>>().unwrap();
        let usage = |when: &str, input: u64| Usage {
            at: at(when),
            model: "m".into(),
            input,
            output: 0,
            cache_read: 0,
            cache_write: 0,
        };
        // Two replies in the same minute count as one active minute.
        let shop = [
            usage("2026-10-18T09:00:10Z", 100),
            usage("2026-10-18T09:00:50Z", 20),
            usage("2026-10-01T09:00:00Z", 999),
        ];
        let blog = [usage("2026-10-16T23:30:00Z", 300)];
        let shop_again = [usage("2026-10-17T10:00:00Z", 50)];
        let idle = [usage("2026-09-01T10:00:00Z", 5)];
        let week = weekly(
            [
                ("shop", &shop[..]),
                ("blog", &blog[..]),
                ("shop", &shop_again[..]),
                ("idle", &idle[..]),
            ],
            now,
            FixedOffset::east_opt(0).unwrap(),
        );
        assert_eq!(
            week.products,
            [
                ProductWeek {
                    product_id: "blog".into(),
                    tokens: 300,
                    active_minutes: 1
                },
                ProductWeek {
                    product_id: "shop".into(),
                    tokens: 170,
                    active_minutes: 2
                },
            ]
        );
        assert_eq!(week.busiest_day.as_deref(), Some("Friday"));

        // The same late-night reply lands on Saturday two hours east.
        let east = weekly(
            [("blog", &blog[..])],
            now,
            FixedOffset::east_opt(2 * 3600).unwrap(),
        );
        assert_eq!(east.busiest_day.as_deref(), Some("Saturday"));
    }

    #[test]
    fn an_event_within_the_hour_takes_the_headline() {
        let now = Utc::now();
        let config = Helper::default();
        let class = Event {
            key: "c".into(),
            calendar: "College".into(),
            title: "Marketing class".into(),
            location: None,
            start: now + TimeDelta::minutes(25),
            end: now + TimeDelta::minutes(115),
            all_day: false,
        };
        let helper = view(HelperInputs {
            config: &config,
            open: Vec::new(),
            done: Vec::new(),
            drafts: Vec::new(),
            drafting: false,
            week: Week::default(),
            todos_done_this_week: 0,
            drafts_this_week: 0,
            today: now.date_naive(),
            upcoming: vec![class],
            now,
            chat: Vec::new(),
            chatting: false,
            schedules: Vec::new(),
            permission: None,
        });
        assert_eq!(helper.mood, Mood::NeedsYou);
        assert_eq!(helper.headline, "Marketing class in 25 min");
    }
}
