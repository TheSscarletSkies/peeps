//! "One thing at a time": notices when the user keeps hopping between apps and suggests an order.
//! Only app names are seen, never window titles or content, and nothing leaves the computer.

use std::collections::{HashMap, VecDeque};

use chrono::{DateTime, TimeDelta, Utc};

const WINDOW: TimeDelta = TimeDelta::minutes(5);
const SWITCHES: usize = 15;
const APPS: usize = 3;
const COOLDOWN: TimeDelta = TimeDelta::minutes(20);

#[derive(Debug, Default)]
pub struct Hops {
    switches: VecDeque<(DateTime<Utc>, String)>,
    current: Option<String>,
    last_nudge: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Suggestion {
    pub title: String,
    pub body: String,
}

impl Hops {
    /// Called every few seconds with the app in front. Returns a gentle word when it is all too much.
    pub fn observe(&mut self, now: DateTime<Utc>, app: &str) -> Option<Suggestion> {
        if app.is_empty() || self.current.as_deref() == Some(app) {
            return None;
        }
        self.current = Some(app.to_owned());
        self.switches.push_back((now, app.to_owned()));
        while self
            .switches
            .front()
            .is_some_and(|(at, _)| now - *at > WINDOW)
        {
            self.switches.pop_front();
        }
        if self.switches.len() < SWITCHES || self.last_nudge.is_some_and(|at| now - at < COOLDOWN) {
            return None;
        }

        let mut visits: HashMap<&str, usize> = HashMap::new();
        for (_, name) in &self.switches {
            *visits.entry(name.as_str()).or_default() += 1;
        }
        if visits.len() < APPS {
            return None;
        }
        let mut ranked: Vec<(&str, usize)> = visits.into_iter().collect();
        ranked.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(b.0)));
        let (first, then) = (ranked[0].0, ranked[1].0);
        let suggestion = Suggestion {
            title: "One thing at a time?".to_owned(),
            body: format!(
                "You've hopped between {} apps {} times in 5 minutes. First {first}, then {then}.",
                ranked.len(),
                self.switches.len()
            ),
        };
        self.last_nudge = Some(now);
        self.switches.clear();
        Some(suggestion)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(seconds: i64) -> DateTime<Utc> {
        DateTime::from_timestamp(1_800_000_000 + seconds, 0).unwrap()
    }

    fn hop(hops: &mut Hops, start: i64, apps: &[&str], times: usize) -> Option<Suggestion> {
        let mut said = None;
        for i in 0..times {
            let app = apps[i % apps.len()];
            if let Some(s) = hops.observe(at(start + i as i64 * 10), app) {
                said = Some(s);
            }
        }
        said
    }

    #[test]
    fn quiet_work_says_nothing() {
        let mut hops = Hops::default();
        // Two apps back and forth is normal: writing with notes open.
        assert_eq!(hop(&mut hops, 0, &["Word", "Notes"], 40), None);
        // Staying put is not a switch.
        assert_eq!(hop(&mut hops, 1000, &["Word"], 40), None);
    }

    #[test]
    fn many_hops_get_an_order() {
        let mut hops = Hops::default();
        let said = hop(&mut hops, 0, &["Chrome", "Notion", "Chrome", "Slack"], 16).unwrap();
        assert_eq!(said.title, "One thing at a time?");
        assert!(
            said.body.contains("First Chrome, then Notion."),
            "{}",
            said.body
        );
    }

    #[test]
    fn slow_switching_and_cooldown() {
        let mut hops = Hops::default();
        // Fifteen switches spread over an hour are fine.
        for i in 0..15 {
            let app = ["A", "B", "C"][i % 3];
            assert_eq!(hops.observe(at(i as i64 * 240), app), None);
        }
        let mut hops = Hops::default();
        assert!(hop(&mut hops, 0, &["A", "B", "C"], 15).is_some());
        assert_eq!(hop(&mut hops, 200, &["A", "B", "C"], 30), None);
        assert!(hop(&mut hops, 2000, &["A", "B", "C"], 15).is_some());
    }
}
