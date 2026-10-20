//! Understands "remind me to drink water every 2 hours" and friends, so common reminders need no agent.

use chrono::{
    DateTime, Datelike, Days, FixedOffset, NaiveDate, NaiveTime, TimeDelta, Timelike, Weekday,
};

use crate::todos::{Repeat, TodoInput};

/// A reminder read from plain words, with a short description to confirm it back.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Quick {
    pub input: TodoInput,
    pub summary: String,
}

#[derive(Default)]
struct When {
    repeat: Option<Repeat>,
    due: Option<NaiveDate>,
    time: Option<NaiveTime>,
    window: Option<(NaiveTime, NaiveTime)>,
    weekday: Option<Weekday>,
    evening: bool,
}

const TONIGHT: NaiveTime = match NaiveTime::from_hms_opt(20, 0, 0) {
    Some(time) => time,
    None => panic!("eight in the evening exists"),
};

/// Reads "remind me to …"; anything else is left for the agent.
pub fn parse(text: &str, now: DateTime<FixedOffset>) -> Option<Quick> {
    let cleaned = text
        .trim()
        .trim_end_matches(['.', '!', '?'])
        .replace(',', " ");
    let words: Vec<String> = cleaned.split_whitespace().map(str::to_owned).collect();
    let lower: Vec<String> = words.iter().map(|word| word.to_lowercase()).collect();
    if lower.len() < 3 || lower[0] != "remind" || lower[1] != "me" {
        return None;
    }
    let to = lower.iter().skip(2).position(|word| word == "to")? + 2;

    let mut when = When::default();
    // Clauses may come before "to" ("remind me tomorrow at 9 to call mum") or after the task.
    let before = &lower[2..to];
    if !before.is_empty() && strip_clauses(before, &mut when, now) != 0 {
        return None;
    }
    let task_lower = &lower[to + 1..];
    let task_len = strip_clauses(task_lower, &mut when, now);
    if task_len == 0 {
        return None;
    }
    let task = words[to + 1..to + 1 + task_len].join(" ");
    Some(build(capitalise(&task), when, now))
}

/// Removes recognised clauses from the end of `words`, returning how many words are left.
fn strip_clauses(words: &[String], when: &mut When, now: DateTime<FixedOffset>) -> usize {
    let mut end = words.len();
    while end > 0 {
        match clause(&words[..end], when, now) {
            Some(used) => end -= used,
            None => break,
        }
    }
    end
}

/// Tries each kind of clause against the end of `words` and returns how many words it used.
fn clause(words: &[String], when: &mut When, now: DateTime<FixedOffset>) -> Option<usize> {
    let tail = |n: usize| -> Option<Vec<&str>> {
        (words.len() >= n).then(|| {
            words[words.len() - n..]
                .iter()
                .map(String::as_str)
                .collect()
        })
    };

    // "from 9 to 9", "between 9am and 6pm"
    for n in [4, 5, 6] {
        if let Some(t) = tail(n) {
            if let Some(window) = window(&t) {
                when.window = Some(window);
                return Some(n);
            }
        }
    }
    // "every 2 hours", "every two hours", "every hour", "hourly"
    if let Some(t) = tail(3) {
        if t[0] == "every" && matches!(t[2], "hours" | "hrs" | "h") {
            when.repeat = Some(match t[1] {
                "1" | "one" => Repeat::Hourly,
                "2" | "two" => Repeat::EveryTwoHours,
                "3" | "three" => Repeat::EveryThreeHours,
                _ => return None,
            });
            return Some(3);
        }
    }
    if let Some(t) = tail(2) {
        match (t[0], t[1]) {
            ("every", "hour") => {
                when.repeat = Some(Repeat::Hourly);
                return Some(2);
            }
            ("every", "day") => {
                when.repeat = Some(Repeat::Daily);
                return Some(2);
            }
            ("every", "weekday") | ("on", "weekdays") => {
                when.repeat = Some(Repeat::Weekdays);
                return Some(2);
            }
            ("every", "week") => {
                when.repeat = Some(Repeat::Weekly);
                return Some(2);
            }
            ("every", "month") => {
                when.repeat = Some(Repeat::Monthly);
                return Some(2);
            }
            ("every", day) | ("on", day) => {
                if let Some(weekday) = weekday(day) {
                    if t[0] == "every" {
                        when.repeat = Some(Repeat::Weekly);
                    }
                    when.weekday = Some(weekday);
                    return Some(2);
                }
            }
            _ => {}
        }
    }
    // "in 20 minutes", "in 2 hours"
    if let Some(t) = tail(3) {
        if t[0] == "in" {
            if let Ok(amount) = t[1].parse::<i64>() {
                let delta = match t[2] {
                    "minute" | "minutes" | "min" | "mins" => TimeDelta::minutes(amount),
                    "hour" | "hours" => TimeDelta::hours(amount),
                    _ => return None,
                };
                let at = now + delta;
                when.due = Some(at.date_naive());
                when.time = at.time().with_second(0);
                return Some(3);
            }
        }
    }
    // "at 6pm", "at 6 pm", "at 18:30"
    for n in [3, 2] {
        if let Some(t) = tail(n) {
            if t[0] == "at" {
                if let Some(time) = time(&t[1..].join(" ")) {
                    when.time = Some(time);
                    return Some(n);
                }
            }
        }
    }
    let last = words.last()?.as_str();
    match last {
        "hourly" => when.repeat = Some(Repeat::Hourly),
        "daily" => when.repeat = Some(Repeat::Daily),
        "weekdays" => when.repeat = Some(Repeat::Weekdays),
        "weekly" => when.repeat = Some(Repeat::Weekly),
        "monthly" => when.repeat = Some(Repeat::Monthly),
        "today" => when.due = Some(now.date_naive()),
        "tonight" => {
            when.due = Some(now.date_naive());
            when.evening = true;
        }
        "tomorrow" => when.due = now.date_naive().succ_opt(),
        other => {
            when.weekday = Some(weekday(other)?);
        }
    }
    Some(1)
}

fn window(words: &[&str]) -> Option<(NaiveTime, NaiveTime)> {
    let joiner = match *words.first()? {
        "from" => "to",
        "between" => "and",
        _ => return None,
    };
    let split = words.iter().position(|word| *word == joiner)?;
    let start = time(&words[1..split].join(" "))?;
    let end = time(&words[split + 1..].join(" "))?;
    // "from 9 to 9" means nine in the morning to nine at night.
    let end = if end <= start && end.hour() < 12 {
        end + TimeDelta::hours(12)
    } else {
        end
    };
    Some((start, end))
}

/// "6", "6pm", "6 pm", "6:30pm", "18:00", "noon", "midnight".
fn time(text: &str) -> Option<NaiveTime> {
    let text = text.trim().replace(' ', "");
    match text.as_str() {
        "noon" | "midday" => return NaiveTime::from_hms_opt(12, 0, 0),
        "midnight" => return NaiveTime::from_hms_opt(0, 0, 0),
        _ => {}
    }
    let (digits, meridiem) = if let Some(rest) = text.strip_suffix("am") {
        (rest, Some(false))
    } else if let Some(rest) = text.strip_suffix("pm") {
        (rest, Some(true))
    } else {
        (text.as_str(), None)
    };
    let (hour, minute) = match digits.split_once(':') {
        Some((h, m)) => (h.parse::<u32>().ok()?, m.parse::<u32>().ok()?),
        None => (digits.parse::<u32>().ok()?, 0),
    };
    let hour = match meridiem {
        Some(true) if hour < 12 => hour + 12,
        Some(false) if hour == 12 => 0,
        _ => hour,
    };
    NaiveTime::from_hms_opt(hour, minute, 0)
}

fn weekday(word: &str) -> Option<Weekday> {
    Some(match word.trim_end_matches('s') {
        "monday" | "mon" => Weekday::Mon,
        "tuesday" | "tue" | "tues" => Weekday::Tue,
        "wednesday" | "wed" => Weekday::Wed,
        "thursday" | "thu" | "thurs" => Weekday::Thu,
        "friday" | "fri" => Weekday::Fri,
        "saturday" | "sat" => Weekday::Sat,
        "sunday" | "sun" => Weekday::Sun,
        _ => return None,
    })
}

fn next_weekday(from: NaiveDate, weekday: Weekday) -> NaiveDate {
    let ahead = (7 + weekday.num_days_from_monday() - from.weekday().num_days_from_monday()) % 7;
    from.checked_add_days(Days::new(u64::from(ahead)))
        .unwrap_or(from)
}

fn build(title: String, mut when: When, now: DateTime<FixedOffset>) -> Quick {
    let today = now.date_naive();
    let repeat = when.repeat.unwrap_or_default();

    if repeat.hours().is_some() {
        let (start, end) = when.window.unwrap_or((
            NaiveTime::from_hms_opt(9, 0, 0).unwrap_or_default(),
            NaiveTime::from_hms_opt(21, 0, 0).unwrap_or_default(),
        ));
        let every = match repeat {
            Repeat::Hourly => "every hour".to_owned(),
            Repeat::EveryTwoHours => "every 2 hours".to_owned(),
            _ => "every 3 hours".to_owned(),
        };
        return Quick {
            summary: format!("{every}, {} to {}", clock(start), clock(end)),
            input: TodoInput {
                title,
                due: Some(today),
                time: Some(start),
                until: Some(end),
                repeat,
                remind_minutes: Some(0),
            },
        };
    }

    if let Some(weekday) = when.weekday {
        when.due = Some(next_weekday(today, weekday));
    }
    if when.evening && when.time.is_none() {
        when.time = Some(TONIGHT);
    }
    // A time with no day means the next time that clock comes round.
    if when.due.is_none() {
        if let Some(time) = when.time {
            when.due = Some(if time > now.time() {
                today
            } else {
                today.succ_opt().unwrap_or(today)
            });
        } else if repeat != Repeat::Never {
            when.due = Some(today);
        }
    }

    let summary = describe(repeat, when.due, when.time, today);
    Quick {
        input: TodoInput {
            title,
            due: when.due,
            time: when.time,
            until: None,
            repeat,
            remind_minutes: when.due.map(|_| 0),
        },
        summary,
    }
}

fn describe(
    repeat: Repeat,
    due: Option<NaiveDate>,
    time: Option<NaiveTime>,
    today: NaiveDate,
) -> String {
    let at = time.map(|time| format!(" at {}", clock(time)));
    let day = due.map(|due| match (due - today).num_days() {
        0 => "today".to_owned(),
        1 => "tomorrow".to_owned(),
        _ => format!("on {}", due.format("%A")),
    });
    let at_or_morning = at.clone().unwrap_or_else(|| " in the morning".to_owned());
    match (repeat, day) {
        (Repeat::Daily, _) => format!("every day{at_or_morning}"),
        (Repeat::Weekdays, _) => format!("on weekdays{at_or_morning}"),
        (Repeat::Weekly, Some(_)) => format!(
            "every {}{at_or_morning}",
            due.map(|d| d.format("%A").to_string()).unwrap_or_default()
        ),
        (Repeat::Monthly, _) => format!("every month{at_or_morning}"),
        (_, Some(day)) => format!("{day}{}", at.unwrap_or_else(|| " in the morning".into())),
        _ => "on your list".to_owned(),
    }
}

fn clock(time: NaiveTime) -> String {
    let hour = match time.hour() % 12 {
        0 => 12,
        hour => hour,
    };
    let half = if time.hour() < 12 { "AM" } else { "PM" };
    if time.minute() == 0 {
        format!("{hour} {half}")
    } else {
        format!("{hour}:{:02} {half}", time.minute())
    }
}

fn capitalise(text: &str) -> String {
    let mut chars = text.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().chain(chars).collect(),
        None => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Tuesday 20 October 2026, 14:30, five hours ahead of UTC.
    fn now() -> DateTime<FixedOffset> {
        DateTime::parse_from_rfc3339("2026-10-20T14:30:00+05:00").unwrap()
    }

    fn read(text: &str) -> Quick {
        parse(text, now()).unwrap_or_else(|| panic!("not understood: {text}"))
    }

    fn t(h: u32, m: u32) -> Option<NaiveTime> {
        NaiveTime::from_hms_opt(h, m, 0)
    }

    fn d(text: &str) -> Option<NaiveDate> {
        Some(text.parse().unwrap())
    }

    #[test]
    fn drink_water_every_two_hours() {
        let quick = read("Remind me to drink water every 2 hours");
        assert_eq!(quick.input.title, "Drink water");
        assert_eq!(quick.input.repeat, Repeat::EveryTwoHours);
        assert_eq!((quick.input.time, quick.input.until), (t(9, 0), t(21, 0)));
        assert_eq!(quick.summary, "every 2 hours, 9 AM to 9 PM");
    }

    #[test]
    fn windows_read_naturally() {
        let quick = read("remind me to stretch every hour from 10 to 6.");
        assert_eq!(quick.input.repeat, Repeat::Hourly);
        assert_eq!((quick.input.time, quick.input.until), (t(10, 0), t(18, 0)));
        let quick = read("remind me to stand up hourly between 9am and 5:30pm");
        assert_eq!((quick.input.time, quick.input.until), (t(9, 0), t(17, 30)));
    }

    #[test]
    fn times_and_days() {
        let class = read("remind me to leave for class at 5:30pm");
        assert_eq!(
            (class.input.due, class.input.time),
            (d("2026-10-20"), t(17, 30))
        );
        assert_eq!(class.input.remind_minutes, Some(0));
        assert_eq!(class.summary, "today at 5:30 PM");

        // Nine has passed today, so it means tomorrow morning.
        let call = read("remind me to call the bank at 9");
        assert_eq!(call.input.due, d("2026-10-21"));

        let mum = read("Remind me tomorrow at 10am to call mum");
        assert_eq!(mum.input.title, "Call mum");
        assert_eq!((mum.input.due, mum.input.time), (d("2026-10-21"), t(10, 0)));

        let tonight = read("remind me to pack my bag tonight");
        assert_eq!(
            (tonight.input.due, tonight.input.time),
            (d("2026-10-20"), t(20, 0))
        );

        let soon = read("remind me to check the oven in 20 minutes");
        assert_eq!(
            (soon.input.due, soon.input.time),
            (d("2026-10-20"), t(14, 50))
        );
    }

    #[test]
    fn repeats_by_day() {
        let post = read("remind me to post on LinkedIn every Monday at 9am");
        assert_eq!(post.input.title, "Post on LinkedIn");
        assert_eq!(post.input.repeat, Repeat::Weekly);
        assert_eq!(post.input.due, d("2026-10-26"));
        assert_eq!(post.summary, "every Monday at 9 AM");

        let rent = read("remind me to pay rent monthly");
        assert_eq!(rent.input.repeat, Repeat::Monthly);
        assert_eq!(rent.summary, "every month in the morning");

        let pills = read("remind me to take vitamins every day at 8am");
        assert_eq!(
            (pills.input.repeat, pills.input.time),
            (Repeat::Daily, t(8, 0))
        );
    }

    #[test]
    fn plain_reminders_and_other_messages() {
        let plain = read("remind me to email Sara");
        assert_eq!(plain.input.due, None);
        assert_eq!(plain.input.remind_minutes, None);
        assert_eq!(plain.summary, "on your list");

        assert!(parse("What's on today?", now()).is_none());
        assert!(parse("remind me", now()).is_none());
        assert!(parse("remind me to tomorrow", now()).is_none());
    }
}
