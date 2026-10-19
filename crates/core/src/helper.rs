//! The helper pet: its mood, headline and the weekly token report.

use std::collections::BTreeMap;

use chrono::{DateTime, NaiveDate, TimeDelta, Utc};
use serde::Serialize;

use crate::config::{Helper, PetKind};
use crate::drafts::{self, Draft};
use crate::mood::Mood;
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
    pub week: Vec<ProductTokens>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoView {
    #[serde(flatten)]
    pub todo: Todo,
    pub due_state: Due,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DraftKind {
    pub id: String,
    pub label: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductTokens {
    pub product_id: String,
    pub tokens: u64,
}

pub struct HelperInputs<'a> {
    pub config: &'a Helper,
    pub open: Vec<Todo>,
    pub done: Vec<Todo>,
    pub drafts: Vec<Draft>,
    pub drafting: bool,
    pub week: Vec<ProductTokens>,
    pub today: NaiveDate,
}

pub fn view(inputs: HelperInputs<'_>) -> HelperView {
    let todos: Vec<TodoView> = inputs
        .open
        .into_iter()
        .map(|todo| TodoView {
            due_state: todo.due_state(inputs.today),
            todo,
        })
        .collect();
    let count = |state: Due| todos.iter().filter(|t| t.due_state == state).count();
    let (overdue, today) = (count(Due::Overdue), count(Due::Today));

    let (mood, headline) = if inputs.drafting {
        (Mood::Working, "Writing a draft…".to_owned())
    } else if overdue > 0 {
        (
            Mood::NeedsYou,
            plural(overdue, "to-do overdue", "to-dos overdue"),
        )
    } else if today > 0 {
        (
            Mood::Hungry,
            plural(today, "to-do due today", "to-dos due today"),
        )
    } else if todos.is_empty() {
        (Mood::Stalled, "Nothing on the list".to_owned())
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
    }
}

fn plural(n: usize, one: &str, many: &str) -> String {
    format!("{n} {}", if n == 1 { one } else { many })
}

/// Tokens each product used over the last seven days, busiest first.
pub fn weekly_tokens<'a>(
    usage: impl IntoIterator<Item = (&'a str, &'a [Usage])>,
    now: DateTime<Utc>,
) -> Vec<ProductTokens> {
    let since = now - TimeDelta::days(7);
    let mut totals: BTreeMap<&str, u64> = BTreeMap::new();
    for (product, entries) in usage {
        let sum: u64 = entries
            .iter()
            .filter(|entry| entry.at > since && entry.at <= now)
            .map(Usage::total)
            .sum();
        *totals.entry(product).or_default() += sum;
    }
    let mut week: Vec<ProductTokens> = totals
        .into_iter()
        .filter(|(_, tokens)| *tokens > 0)
        .map(|(product, tokens)| ProductTokens {
            product_id: product.to_owned(),
            tokens,
        })
        .collect();
    week.sort_by_key(|entry| std::cmp::Reverse(entry.tokens));
    week
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::todos::TodoKind;

    fn todo(due: Option<&str>) -> Todo {
        Todo {
            id: 1,
            title: "Post".into(),
            kind: TodoKind::Task,
            due: due.map(|d| d.parse().unwrap()),
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
            week: Vec::new(),
            today: "2026-10-19".parse().unwrap(),
        });
        (helper.mood, helper.headline)
    }

    #[test]
    fn moods_follow_the_list() {
        assert_eq!(
            mood(vec![], false),
            (Mood::Stalled, "Nothing on the list".into())
        );
        assert_eq!(
            mood(vec![todo(Some("2026-10-25")), todo(None)], false),
            (Mood::Chill, "2 things on the list".into())
        );
        assert_eq!(
            mood(vec![todo(Some("2026-10-19"))], false),
            (Mood::Hungry, "1 to-do due today".into())
        );
        assert_eq!(
            mood(
                vec![todo(Some("2026-10-01")), todo(Some("2026-10-19"))],
                false
            ),
            (Mood::NeedsYou, "1 to-do overdue".into())
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
            week: Vec::new(),
            today: "2026-10-19".parse().unwrap(),
        });
        let labels: Vec<_> = helper
            .draft_kinds
            .iter()
            .map(|k| k.label.as_str())
            .collect();
        assert_eq!(labels, ["LinkedIn post", "post for X"]);
    }

    #[test]
    fn weekly_tokens_sum_recent_usage_per_product() {
        let now: DateTime<Utc> = "2026-10-19T12:00:00Z".parse().unwrap();
        let usage = |days_ago: i64, input: u64| Usage {
            at: now - TimeDelta::days(days_ago),
            model: "m".into(),
            input,
            output: 0,
            cache_read: 0,
            cache_write: 0,
        };
        let shop = [usage(1, 100), usage(10, 999)];
        let blog = [usage(0, 300)];
        let shop2 = [usage(2, 50)];
        let idle = [usage(30, 5)];
        let week = weekly_tokens(
            [
                ("shop", &shop[..]),
                ("blog", &blog[..]),
                ("shop", &shop2[..]),
                ("idle", &idle[..]),
            ],
            now,
        );
        assert_eq!(
            week,
            [
                ProductTokens {
                    product_id: "blog".into(),
                    tokens: 300
                },
                ProductTokens {
                    product_id: "shop".into(),
                    tokens: 150
                },
            ]
        );
    }
}
