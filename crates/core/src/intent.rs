//! Everyday requests understood without the agent: adding, ticking off, moving and removing
//! to-dos, "what's left?", and starting or stopping a focus session. They cost no tokens and
//! answer at once; anything else goes to Claude.

use chrono::{Days, NaiveDate};

use crate::quick::{next_weekday, weekday};
use crate::todos::Todo;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Intent {
    Add {
        title: String,
        due: Option<NaiveDate>,
    },
    Done {
        query: String,
    },
    Delete {
        query: String,
    },
    Move {
        query: String,
        due: NaiveDate,
    },
    Left,
    Focus {
        minutes: i64,
        area: Option<String>,
    },
    StopFocus,
}

/// Which to-do a few words point at.
#[derive(Debug, PartialEq, Eq)]
pub enum Found<'a> {
    One(&'a Todo),
    None,
    Several(Vec<&'a Todo>),
}

const DEFAULT_FOCUS: i64 = 25;

fn tidy(text: &str) -> String {
    text.trim()
        .trim_end_matches(['.', '!', '?'])
        .trim()
        .to_lowercase()
        .replace('’', "'")
}

/// "tomorrow", "today", "on friday", "next week" at the end of a phrase, and what is left before it.
fn trailing_day(text: &str, today: NaiveDate) -> (String, Option<NaiveDate>) {
    let words: Vec<&str> = text.split_whitespace().collect();
    let cut = |n: usize| words[..words.len() - n].join(" ");
    let last = words.last().copied().unwrap_or("");
    let before = words.len().checked_sub(2).map(|i| words[i]).unwrap_or("");
    let day = match last {
        "today" | "tonight" => Some((1, today)),
        "tomorrow" => Some((1, today + Days::new(1))),
        "week" if before == "next" => Some((2, today + Days::new(7))),
        word => weekday(word).map(|day| {
            // "Thursday" said on a Thursday means next week's.
            let mut date = next_weekday(today, day);
            if date == today {
                date = date + Days::new(7);
            }
            (1, date)
        }),
    };
    match day {
        Some((n, date)) => {
            let mut rest = cut(n);
            for joiner in [" on", " for", " to", " by"] {
                if let Some(stripped) = rest.strip_suffix(joiner) {
                    rest = stripped.to_owned();
                }
            }
            (rest, Some(date))
        }
        None => (text.to_owned(), None),
    }
}

fn after<'a>(text: &'a str, starts: &[&str]) -> Option<&'a str> {
    starts
        .iter()
        .find_map(|start| text.strip_prefix(start))
        .map(str::trim)
        .filter(|rest| !rest.is_empty())
}

/// Plain words to an intent, or None when it should go to the agent.
pub fn parse(text: &str, today: NaiveDate, areas: &[String]) -> Option<Intent> {
    let said = tidy(text);
    // Questions and long messages are for Claude; these are short commands.
    if said.split_whitespace().count() > 12 || said.contains('\n') {
        return None;
    }

    const LEFT: [&str; 9] = [
        "what's left",
        "what's left today",
        "what is left",
        "what's on today",
        "what's due today",
        "what do i have today",
        "my list",
        "show my list",
        "what's left for today",
    ];
    if LEFT.contains(&said.as_str()) {
        return Some(Intent::Left);
    }

    const STOP: [&str; 8] = [
        "stop",
        "stop focus",
        "stop focusing",
        "stop the session",
        "end session",
        "end the session",
        "stop studying",
        "stop working",
    ];
    if STOP.contains(&said.as_str()) {
        return Some(Intent::StopFocus);
    }

    if let Some(focus) = focus(&said, areas) {
        return Some(focus);
    }

    if let Some(rest) = after(&said, &["move ", "reschedule ", "push "]) {
        let (query, due) = trailing_day(rest, today);
        return due.map(|due| Intent::Move { query, due });
    }
    if let Some(rest) = after(&said, &["delete ", "remove ", "cancel "]) {
        return Some(Intent::Delete {
            query: rest.trim_start_matches("the ").to_owned(),
        });
    }
    if let Some(rest) = after(
        &said,
        &[
            "i did ",
            "i finished ",
            "finished ",
            "done with ",
            "done ",
            "did ",
            "tick off ",
            "completed ",
        ],
    ) {
        return Some(Intent::Done {
            query: rest
                .trim_start_matches("my ")
                .trim_start_matches("the ")
                .to_owned(),
        });
    }
    if let Some(rest) = said.strip_suffix(" done").filter(|r| !r.is_empty()) {
        return Some(Intent::Done {
            query: rest.to_owned(),
        });
    }
    if let Some(rest) = after(&said, &["add ", "todo ", "to do "]) {
        let rest = rest
            .strip_suffix(" to my list")
            .or_else(|| rest.strip_suffix(" to the list"))
            .unwrap_or(rest);
        let (title, due) = trailing_day(rest, today);
        // Keep what the user typed, tags and capitals included.
        let original = text.trim();
        let start = original.len()
            - original
                .trim_start_matches(|c: char| !c.is_whitespace())
                .len();
        let typed = original[start..].trim();
        let title = typed
            .get(..title.len())
            .filter(|t| t.to_lowercase() == title)
            .map_or(title.clone(), str::to_owned);
        return (!title.is_empty()).then_some(Intent::Add { title, due });
    }
    None
}

fn focus(said: &str, areas: &[String]) -> Option<Intent> {
    let words: Vec<&str> = said
        .split_whitespace()
        .map(|w| w.trim_end_matches(','))
        .filter(|w| {
            !matches!(
                *w,
                "let's"
                    | "lets"
                    | "start"
                    | "a"
                    | "an"
                    | "for"
                    | "me"
                    | "please"
                    | "session"
                    | "timer"
                    | "block"
            )
        })
        .collect();
    let kind = words.iter().find_map(|w| match *w {
        "focus" | "focusing" => Some(None),
        "study" | "studying" => Some(Some("study")),
        "work" | "working" => Some(Some("work")),
        _ => None,
    })?;
    let minutes = words.iter().find_map(|w| {
        let digits: String = w.chars().take_while(char::is_ascii_digit).collect();
        digits.parse::<i64>().ok()
    });
    let hours = words.iter().any(|w| {
        w.starts_with("hour")
            || *w == "h"
            || w.ends_with('h') && w.len() > 1 && w[..w.len() - 1].parse::<i64>().is_ok()
    });
    // Every other word has to be about time, so "work on my essay" isn't mistaken for a session.
    let about_time = words.iter().all(|w| {
        matches!(
            *w,
            "focus"
                | "focusing"
                | "study"
                | "studying"
                | "work"
                | "working"
                | "min"
                | "mins"
                | "minute"
                | "minutes"
                | "hour"
                | "hours"
                | "h"
                | "m"
        ) || w
            .chars()
            .all(|c| c.is_ascii_digit() || c == 'm' || c == 'h')
    });
    if !about_time {
        return None;
    }
    let minutes = minutes.map_or(DEFAULT_FOCUS, |n| if hours { n * 60 } else { n });
    let area = kind
        .filter(|area| areas.iter().any(|a| a == area))
        .map(str::to_owned);
    Some(Intent::Focus { minutes, area })
}

/// Finds the open to-do a few words describe: an exact title first, then one containing them.
pub fn find<'a>(todos: &'a [Todo], query: &str) -> Found<'a> {
    let query = query.trim().to_lowercase();
    if query.is_empty() {
        return Found::None;
    }
    if let Some(exact) = todos.iter().find(|t| t.title.to_lowercase() == query) {
        return Found::One(exact);
    }
    let mut close: Vec<&Todo> = todos
        .iter()
        .filter(|t| t.title.to_lowercase().contains(&query))
        .collect();
    if close.is_empty() {
        // "did my reading" should find "Read chapter 4": match on the word's stem.
        let stem: String = query.chars().take(4).collect();
        close = todos
            .iter()
            .filter(|t| stem.len() >= 4 && t.title.to_lowercase().contains(&stem))
            .collect();
    }
    match close.len() {
        0 => Found::None,
        1 => Found::One(close[0]),
        _ => Found::Several(close),
    }
}

/// "3 things left today:" and the list, nudges left out; overdue ones first.
pub fn left_reply(todos: &[Todo], today: NaiveDate) -> String {
    let mut left: Vec<&Todo> = todos
        .iter()
        .filter(|t| !t.tags.iter().any(|tag| tag == "nudge"))
        .filter(|t| t.due.is_some_and(|due| due <= today))
        .collect();
    left.sort_by_key(|t| (t.due, t.time));
    match left.len() {
        0 => "Nothing left today. Nice!".to_owned(),
        n => {
            let lines: Vec<String> = left
                .iter()
                .take(8)
                .map(|t| {
                    let late = if t.due.is_some_and(|due| due < today) {
                        " (overdue)"
                    } else {
                        ""
                    };
                    format!("- {}{late}", t.title)
                })
                .collect();
            let more = if n > 8 {
                format!("\n…and {} more", n - 8)
            } else {
                String::new()
            };
            format!(
                "{n} {} left today:\n{}{more}",
                if n == 1 { "thing" } else { "things" },
                lines.join("\n")
            )
        }
    }
}

/// "Which one? Gym, Gym bag", for when a few words fit more than one to-do.
pub fn which_reply(several: &[&Todo]) -> String {
    let names: Vec<&str> = several.iter().take(5).map(|t| t.title.as_str()).collect();
    format!("Which one? {}", names.join(", "))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::todos::Repeat;

    fn today() -> NaiveDate {
        // A Thursday.
        NaiveDate::from_ymd_opt(2026, 10, 22).unwrap()
    }

    fn areas() -> Vec<String> {
        ["work", "study", "play"].map(String::from).to_vec()
    }

    fn read(text: &str) -> Option<Intent> {
        parse(text, today(), &areas())
    }

    #[test]
    fn everyday_list_commands() {
        assert_eq!(read("What's left today?"), Some(Intent::Left));
        assert_eq!(
            read("add Buy milk #home tomorrow"),
            Some(Intent::Add {
                title: "Buy milk #home".into(),
                due: Some(NaiveDate::from_ymd_opt(2026, 10, 23).unwrap())
            })
        );
        assert_eq!(
            read("Add call the bank to my list"),
            Some(Intent::Add {
                title: "call the bank".into(),
                due: None
            })
        );
        assert_eq!(
            read("I did my reading"),
            Some(Intent::Done {
                query: "reading".into()
            })
        );
        assert_eq!(
            read("gym done"),
            Some(Intent::Done {
                query: "gym".into()
            })
        );
        assert_eq!(
            read("move gym to Thursday"),
            Some(Intent::Move {
                query: "gym".into(),
                due: NaiveDate::from_ymd_opt(2026, 10, 29).unwrap()
            })
        );
        assert_eq!(
            read("delete the dentist"),
            Some(Intent::Delete {
                query: "dentist".into()
            })
        );
    }

    #[test]
    fn focus_sessions_by_word() {
        assert_eq!(
            read("start a 50 min study session"),
            Some(Intent::Focus {
                minutes: 50,
                area: Some("study".into())
            })
        );
        assert_eq!(
            read("let's work"),
            Some(Intent::Focus {
                minutes: 25,
                area: Some("work".into())
            })
        );
        assert_eq!(
            read("focus for 1 hour"),
            Some(Intent::Focus {
                minutes: 60,
                area: None
            })
        );
        assert_eq!(read("stop"), Some(Intent::StopFocus));
        assert_eq!(read("work on my essay"), None);
    }

    #[test]
    fn real_questions_go_to_claude() {
        assert_eq!(read("How should I plan my week around the exam?"), None);
        assert_eq!(read("move the meeting"), None, "no day, so Claude asks");
        assert_eq!(read("hello"), None);
    }

    #[test]
    fn says_what_is_left() {
        let mut gym = todo_for_test(1, "Gym");
        gym.due = Some(today());
        let mut late = todo_for_test(2, "Pay rent");
        late.due = Some(today() - Days::new(2));
        let later = todo_for_test(3, "Someday");
        assert_eq!(
            left_reply(&[gym, late, later], today()),
            "2 things left today:\n- Pay rent (overdue)\n- Gym"
        );
        assert_eq!(left_reply(&[], today()), "Nothing left today. Nice!");
    }

    fn todo_for_test(id: i64, title: &str) -> Todo {
        Todo {
            id,
            title: title.into(),
            tags: vec![],
            due: None,
            time: None,
            repeat: Repeat::Never,
            remind_minutes: None,
            until: None,
            streak: 0,
            created_at: chrono::Utc::now(),
            done_at: None,
        }
    }

    #[test]
    fn finds_the_todo_meant() {
        let todo = |id, title: &str| Todo {
            id,
            title: title.into(),
            tags: vec![],
            due: None,
            time: None,
            repeat: Repeat::Never,
            remind_minutes: None,
            until: None,
            streak: 0,
            created_at: chrono::Utc::now(),
            done_at: None,
        };
        let list = [
            todo(1, "Read chapter 4"),
            todo(2, "Gym"),
            todo(3, "Gym bag"),
        ];
        assert_eq!(find(&list, "gym"), Found::One(&list[1]));
        assert_eq!(find(&list, "reading"), Found::One(&list[0]));
        assert!(matches!(find(&list, "bag"), Found::One(t) if t.id == 3));
        assert_eq!(find(&list, "taxes"), Found::None);
        assert!(matches!(find(&list, "g"), Found::Several(_)));
    }
}
