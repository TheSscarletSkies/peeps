//! Calendar feeds: the private iCal links Google, Outlook and iCloud hand out, read without signing in.

use chrono::{
    DateTime, FixedOffset, NaiveDate, NaiveDateTime, NaiveTime, TimeDelta, TimeZone, Utc,
};
use rrule::{RRuleSet, Tz};
use serde::Serialize;

/// One VEVENT as written in the feed, before repeats are expanded.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FeedEvent {
    pub uid: String,
    pub title: String,
    pub location: Option<String>,
    /// The DTSTART line exactly as written, for the recurrence expander.
    pub start_line: String,
    pub start: Moment,
    pub duration: TimeDelta,
    pub rrule: Option<String>,
    pub exdates: Vec<String>,
    /// Set when this event replaces one occurrence of a repeating event.
    pub recurrence_id: Option<Moment>,
    pub cancelled: bool,
}

/// A start or end as calendars write it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Moment {
    /// A whole day, such as an exam date.
    Day(NaiveDate),
    /// An exact instant.
    At(DateTime<Utc>),
}

impl Moment {
    /// The instant this moment begins, reading floating and all-day times in the user's zone.
    pub fn instant(self, zone: FixedOffset) -> DateTime<Utc> {
        match self {
            Self::At(at) => at,
            Self::Day(day) => local(day.and_time(NaiveTime::MIN), zone),
        }
    }
}

/// One occurrence on someone's calendar.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Event {
    pub key: String,
    pub calendar: String,
    pub title: String,
    pub location: Option<String>,
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
    pub all_day: bool,
}

const FETCH_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(20);
/// Feeds larger than this are not calendars anyone keeps by hand.
const MAX_FEED_BYTES: u64 = 20 * 1024 * 1024;

/// Downloads a feed. `webcal://` links are fetched over HTTPS, and `{secret:…}` comes from the keychain.
pub fn fetch(
    url: &str,
    secrets: &dyn crate::checks::Secrets,
    now: DateTime<Utc>,
) -> Result<String, String> {
    let url = crate::checks::render(url, secrets, now).map_err(|error| error.to_string())?;
    let url = match url.strip_prefix("webcal://") {
        Some(rest) => format!("https://{rest}"),
        None => url,
    };
    let response = ureq::get(&url)
        .timeout(FETCH_TIMEOUT)
        .call()
        .map_err(|error| match error {
            ureq::Error::Status(code, _) => {
                format!("the calendar link answered {code}; it may have been reset")
            }
            ureq::Error::Transport(_) => "could not reach the calendar".to_owned(),
        })?;
    let mut body = String::new();
    std::io::Read::read_to_string(
        &mut std::io::Read::take(response.into_reader(), MAX_FEED_BYTES),
        &mut body,
    )
    .map_err(|_| "the calendar could not be read".to_owned())?;
    if !body.contains("BEGIN:VCALENDAR") {
        return Err("that link is not an iCal calendar".to_owned());
    }
    Ok(body)
}

/// Turns RFC 5545 text into events. Lines that cannot be read are skipped rather than failing the feed.
pub fn parse(text: &str, zone: FixedOffset) -> Vec<FeedEvent> {
    let mut events = Vec::new();
    let mut current: Option<Vec<(String, String)>> = None;
    for line in unfold(text) {
        match line.as_str() {
            "BEGIN:VEVENT" => current = Some(Vec::new()),
            "END:VEVENT" => {
                if let Some(event) = current.take().and_then(|props| build(&props, zone)) {
                    events.push(event);
                }
            }
            _ => {
                if let (Some(props), Some((name, value))) = (current.as_mut(), line.split_once(':'))
                {
                    props.push((name.to_owned(), value.to_owned()));
                }
            }
        }
    }
    events
}

/// Long lines continue on the next line after a space or tab.
fn unfold(text: &str) -> Vec<String> {
    let mut lines: Vec<String> = Vec::new();
    for raw in text.lines() {
        let raw = raw.trim_end_matches('\r');
        match (raw.strip_prefix([' ', '\t']), lines.last_mut()) {
            (Some(rest), Some(last)) => last.push_str(rest),
            _ => lines.push(raw.to_owned()),
        }
    }
    lines
}

fn build(props: &[(String, String)], zone: FixedOffset) -> Option<FeedEvent> {
    let find = |key: &str| {
        props
            .iter()
            .find(|(name, _)| name == key || name.starts_with(&format!("{key};")))
    };
    let (start_name, start_value) = find("DTSTART")?;
    let start = moment(start_name, start_value, zone)?;
    let end = find("DTEND").and_then(|(name, value)| moment(name, value, zone));
    let duration = match (start, end) {
        (Moment::Day(a), Some(Moment::Day(b))) => b - a,
        (Moment::At(a), Some(Moment::At(b))) => b - a,
        (Moment::Day(_), _) => TimeDelta::days(1),
        _ => TimeDelta::zero(),
    };
    Some(FeedEvent {
        uid: find("UID").map(|(_, v)| v.clone()).unwrap_or_default(),
        title: find("SUMMARY")
            .map(|(_, v)| unescape(v))
            .unwrap_or_else(|| "Busy".to_owned()),
        location: find("LOCATION")
            .map(|(_, v)| unescape(v))
            .filter(|v| !v.is_empty()),
        start_line: format!("{start_name}:{start_value}"),
        start,
        duration,
        rrule: find("RRULE").map(|(_, v)| v.clone()),
        exdates: props
            .iter()
            .filter(|(name, _)| name == "EXDATE" || name.starts_with("EXDATE;"))
            .map(|(name, value)| format!("{name}:{value}"))
            .collect(),
        recurrence_id: find("RECURRENCE-ID").and_then(|(name, value)| moment(name, value, zone)),
        cancelled: find("STATUS").is_some_and(|(_, v)| v == "CANCELLED"),
    })
}

fn unescape(text: &str) -> String {
    text.replace("\\n", " ")
        .replace("\\N", " ")
        .replace("\\,", ",")
        .replace("\\;", ";")
        .replace("\\\\", "\\")
}

/// Reads `DTSTART;TZID=Asia/Karachi:20261020T180000`, `…:20261020T130000Z`, `…;VALUE=DATE:20261020`
/// or a floating time, which belongs to the user's own zone.
fn moment(name: &str, value: &str, zone: FixedOffset) -> Option<Moment> {
    if name.contains("VALUE=DATE") && !name.contains("VALUE=DATE-TIME") || value.len() == 8 {
        return NaiveDate::parse_from_str(value, "%Y%m%d")
            .ok()
            .map(Moment::Day);
    }
    if let Some(utc) = value.strip_suffix('Z') {
        let naive = NaiveDateTime::parse_from_str(utc, "%Y%m%dT%H%M%S").ok()?;
        return Some(Moment::At(naive.and_utc()));
    }
    let naive = NaiveDateTime::parse_from_str(value, "%Y%m%dT%H%M%S").ok()?;
    let named = name
        .split(';')
        .find_map(|param| param.strip_prefix("TZID="))
        .and_then(|tz| tz.trim_matches('"').parse::<chrono_tz::Tz>().ok());
    Some(Moment::At(match named {
        Some(tz) => tz
            .from_local_datetime(&naive)
            .earliest()?
            .with_timezone(&Utc),
        // Outlook writes Windows zone names; those, and floating times, are the user's own zone.
        None => local(naive, zone),
    }))
}

fn local(naive: NaiveDateTime, zone: FixedOffset) -> DateTime<Utc> {
    zone.from_local_datetime(&naive)
        .single()
        .map(|at| at.with_timezone(&Utc))
        .unwrap_or_else(|| naive.and_utc())
}

/// Every occurrence that overlaps `from..to`, soonest first.
pub fn occurrences(
    calendar: &str,
    events: &[FeedEvent],
    from: DateTime<Utc>,
    to: DateTime<Utc>,
    zone: FixedOffset,
) -> Vec<Event> {
    let moved: Vec<(&str, DateTime<Utc>)> = events
        .iter()
        .filter_map(|event| {
            event
                .recurrence_id
                .map(|id| (event.uid.as_str(), id.instant(zone)))
        })
        .collect();

    let mut found = Vec::new();
    for event in events.iter().filter(|event| !event.cancelled) {
        let starts = match (&event.rrule, event.recurrence_id) {
            (Some(rule), None) => expand(event, rule, from - event.duration, to, zone)
                .into_iter()
                // An edited occurrence is listed as its own event.
                .filter(|start| !moved.contains(&(event.uid.as_str(), *start)))
                .collect(),
            _ => vec![event.start.instant(zone)],
        };
        for start in starts {
            let end = start + event.duration;
            if end > from && start < to {
                found.push(Event {
                    key: format!("{calendar}:{}:{}", event.uid, start.timestamp()),
                    calendar: calendar.to_owned(),
                    title: event.title.clone(),
                    location: event.location.clone(),
                    start,
                    end,
                    all_day: matches!(event.start, Moment::Day(_)),
                });
            }
        }
    }
    found.sort_by_key(|event| event.start);
    found
}

/// Expands a repeating event. Feeds the expander can't read fall back to the first occurrence.
fn expand(
    event: &FeedEvent,
    rule: &str,
    from: DateTime<Utc>,
    to: DateTime<Utc>,
    zone: FixedOffset,
) -> Vec<DateTime<Utc>> {
    const LIMIT: u16 = 200;
    let mut text = format!("{}\nRRULE:{rule}", start_for_expander(event, zone));
    for exdate in &event.exdates {
        text.push('\n');
        text.push_str(exdate);
    }
    let Ok(set) = text.parse::<RRuleSet>() else {
        return vec![event.start.instant(zone)];
    };
    let from = from.with_timezone(&Tz::UTC);
    let to = to.with_timezone(&Tz::UTC);
    set.after(from)
        .before(to)
        .all(LIMIT)
        .dates
        .into_iter()
        .map(|at| match event.start {
            // All-day repeats come back at midnight UTC; move them to midnight where the user is.
            Moment::Day(_) => Moment::Day(at.date_naive()).instant(zone),
            Moment::At(_) => at.with_timezone(&Utc),
        })
        .collect()
}

/// The expander only knows IANA zones, so anything else is restated in UTC.
fn start_for_expander(event: &FeedEvent, zone: FixedOffset) -> String {
    let known_zone = event
        .start_line
        .split(':')
        .next()
        .and_then(|name| {
            name.split(';')
                .find_map(|param| param.strip_prefix("TZID="))
        })
        .is_none_or(|tz| tz.trim_matches('"').parse::<chrono_tz::Tz>().is_ok());
    let floating = matches!(event.start, Moment::At(_))
        && !event.start_line.ends_with('Z')
        && !event.start_line.contains("TZID=");
    if known_zone && !floating {
        return event.start_line.clone();
    }
    format!(
        "DTSTART:{}",
        event.start.instant(zone).format("%Y%m%dT%H%M%SZ")
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    const FEED: &str = "BEGIN:VCALENDAR\r
VERSION:2.0\r
BEGIN:VEVENT\r
UID:class-1\r
SUMMARY:Marketing class\r
LOCATION:Room 4\\, Block B\r
DTSTART;TZID=Asia/Karachi:20261006T180000\r
DTEND;TZID=Asia/Karachi:20261006T193000\r
RRULE:FREQ=WEEKLY;BYDAY=TU,TH\r
EXDATE;TZID=Asia/Karachi:20261022T180000\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:class-1\r
SUMMARY:Marketing class (moved)\r
RECURRENCE-ID;TZID=Asia/Karachi:20261027T180000\r
DTSTART;TZID=Asia/Karachi:20261027T200000\r
DTEND;TZID=Asia/Karachi:20261027T213000\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:exam\r
SUMMARY:Finance exam\r
DTSTART;VALUE=DATE:20261024\r
DTEND;VALUE=DATE:20261025\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:call\r
SUMMARY:Investor call with a very long title that wraps onto\r
  the next line\r
DTSTART:20261021T090000Z\r
DTEND:20261021T093000Z\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:gone\r
SUMMARY:Cancelled thing\r
STATUS:CANCELLED\r
DTSTART:20261021T100000Z\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:outlook\r
SUMMARY:Standup\r
DTSTART;TZID=Pakistan Standard Time:20261021T100000\r
END:VEVENT\r
END:VCALENDAR\r
";

    fn karachi() -> FixedOffset {
        FixedOffset::east_opt(5 * 3600).unwrap()
    }

    fn at(text: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(text)
            .unwrap()
            .with_timezone(&Utc)
    }

    fn week() -> Vec<Event> {
        let events = parse(FEED, karachi());
        occurrences(
            "College",
            &events,
            at("2026-10-19T00:00:00Z"),
            at("2026-10-29T00:00:00Z"),
            karachi(),
        )
    }

    #[test]
    fn reads_titles_places_and_folded_lines() {
        let events = parse(FEED, karachi());
        assert_eq!(events.len(), 6);
        assert_eq!(events[0].location.as_deref(), Some("Room 4, Block B"));
        assert_eq!(
            events[3].title,
            "Investor call with a very long title that wraps onto the next line"
        );
    }

    #[test]
    fn expands_weekly_classes_with_skips_and_moves() {
        let classes: Vec<_> = week()
            .into_iter()
            .filter(|event| event.title.starts_with("Marketing"))
            .map(|event| (event.title, event.start.to_rfc3339()))
            .collect();
        assert_eq!(
            classes,
            [
                // Tuesday the 20th; Thursday the 22nd is skipped.
                (
                    "Marketing class".to_owned(),
                    "2026-10-20T13:00:00+00:00".to_owned()
                ),
                // Tuesday the 27th was moved two hours later.
                (
                    "Marketing class (moved)".to_owned(),
                    "2026-10-27T15:00:00+00:00".to_owned()
                ),
            ]
        );
    }

    #[test]
    fn all_day_events_start_at_local_midnight() {
        let exam = week()
            .into_iter()
            .find(|event| event.title == "Finance exam")
            .unwrap();
        assert!(exam.all_day);
        assert_eq!(exam.start.to_rfc3339(), "2026-10-23T19:00:00+00:00");
        assert_eq!(exam.end - exam.start, TimeDelta::days(1));
    }

    #[test]
    fn skips_cancelled_and_reads_windows_zones_as_local() {
        let events = week();
        assert!(events.iter().all(|event| event.title != "Cancelled thing"));
        let standup = events
            .iter()
            .find(|event| event.title == "Standup")
            .unwrap();
        assert_eq!(standup.start.to_rfc3339(), "2026-10-21T05:00:00+00:00");
    }

    #[test]
    fn results_are_in_order() {
        let events = week();
        assert!(events.windows(2).all(|pair| pair[0].start <= pair[1].start));
    }
}
