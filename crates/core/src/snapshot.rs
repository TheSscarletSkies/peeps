//! Folds sessions, check results and token usage into the view the interface draws.

use std::collections::HashMap;
use std::path::PathBuf;

use chrono::{DateTime, TimeDelta, Utc};
use serde::Serialize;

use crate::advice::Tip;
use crate::checks::{Outcome, Signal};
use crate::config::{Config, PetKind, Product};
use crate::mood::{feel, Mood, Signals};
use crate::notes::Note;
use crate::session::{Activity, Sessions};
use crate::usage::{self, Transcript};

const BURN_WINDOW: TimeDelta = TimeDelta::minutes(5);

#[derive(Debug, Clone)]
pub struct CheckRun {
    pub at: DateTime<Utc>,
    pub outcome: Result<Outcome, String>,
}

/// Latest result per `(product id, check id)`.
pub type CheckResults = HashMap<(String, String), CheckRun>;

#[derive(Debug, Clone)]
pub struct PendingPermission {
    pub request_id: u64,
    pub session_id: String,
    pub product_id: String,
    pub tool: String,
    pub summary: String,
}

pub struct Inputs<'a> {
    pub config: &'a Config,
    pub sessions: &'a Sessions,
    pub checks: &'a CheckResults,
    pub transcripts: &'a HashMap<PathBuf, Transcript>,
    pub permissions: &'a [PendingPermission],
    pub notes: Vec<Note>,
    pub tips: Vec<Tip>,
    pub now: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub pets: Vec<PetView>,
    pub notes: Vec<Note>,
    pub tips: Vec<Tip>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PetView {
    pub id: String,
    pub name: String,
    pub kind: PetKind,
    pub color: String,
    pub mood: Mood,
    pub heat: f32,
    pub headline: String,
    pub needs: Vec<NeedView>,
    pub permission: Option<PermissionView>,
    pub live_sessions: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NeedView {
    pub check_id: String,
    pub signal: Signal,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionView {
    pub request_id: u64,
    pub tool: String,
    pub summary: String,
}

pub fn build(inputs: Inputs<'_>) -> Snapshot {
    let pets = inputs
        .config
        .products
        .iter()
        .map(|product| pet(product, &inputs))
        .collect();
    Snapshot {
        pets,
        notes: inputs.notes,
        tips: inputs.tips,
    }
}

fn pet(product: &Product, inputs: &Inputs<'_>) -> PetView {
    let settings = &inputs.config.settings;
    let sessions: Vec<_> = inputs.sessions.for_product(&product.id).collect();
    let needs = needs(product, inputs.checks);
    let permission = inputs
        .permissions
        .iter()
        .find(|pending| pending.product_id == product.id)
        .map(|pending| PermissionView {
            request_id: pending.request_id,
            tool: pending.tool.clone(),
            summary: pending.summary.clone(),
        });

    let usages: Vec<&[usage::Usage]> = sessions
        .iter()
        .filter_map(|session| session.transcript.as_ref())
        .filter_map(|path| inputs.transcripts.get(path))
        .map(Transcript::entries)
        .collect();
    let failure = sessions.iter().find_map(|session| match &session.activity {
        Activity::Failed { reason } => Some(reason.clone()),
        _ => None,
    });
    let working_since = sessions
        .iter()
        .filter_map(|session| session.working_since)
        .min();
    let stalled = product.expect_activity_every_hours.is_some_and(|hours| {
        inputs
            .sessions
            .last_activity(&product.id)
            .is_some_and(|at| inputs.now - at > TimeDelta::hours(hours))
    });

    let signals = Signals {
        awaiting_permission: permission.is_some(),
        failed: failure.is_some(),
        working_for: working_since.map(|since| inputs.now - since),
        context_used: usages
            .iter()
            .map(|entries| usage::context_used(entries, settings.context_window_tokens))
            .fold(0.0, f32::max),
        tokens_per_minute: usages
            .iter()
            .map(|entries| usage::burn_rate(entries, inputs.now, BURN_WINDOW))
            .sum(),
        hungry: needs.iter().any(|need| need.signal == Signal::Hungry),
        litter_box: needs.iter().any(|need| need.signal == Signal::LitterBox),
        stalled,
    };
    let feeling = feel(&signals, settings);

    let headline = match feeling.mood {
        Mood::NeedsYou => permission
            .as_ref()
            .map(|p| format!("Waiting for your OK: {}", p.summary))
            .unwrap_or_default(),
        Mood::Failing => failure.unwrap_or_default(),
        Mood::Steaming => format!(
            "Context {}% full",
            (signals.context_used * 100.0).round() as u32
        ),
        Mood::Hungry => need_message(&needs, Signal::Hungry),
        Mood::LitterBox => need_message(&needs, Signal::LitterBox),
        Mood::Sweating | Mood::Working => {
            let minutes = signals.working_for.map_or(0, |d| d.num_minutes());
            if minutes < 1 {
                "Working".to_owned()
            } else {
                format!("Working for {minutes} min")
            }
        }
        Mood::Stalled => "No agent activity lately".to_owned(),
        Mood::Chill => "All good".to_owned(),
    };

    PetView {
        id: product.id.clone(),
        name: product.name.clone(),
        kind: product.pet.kind,
        color: product.pet.color.clone(),
        mood: feeling.mood,
        heat: feeling.heat,
        headline,
        needs,
        permission,
        live_sessions: sessions.len(),
    }
}

fn needs(product: &Product, results: &CheckResults) -> Vec<NeedView> {
    product
        .checks
        .iter()
        .filter_map(|check| {
            let run = results.get(&(product.id.clone(), check.id.clone()))?;
            let outcome = run.outcome.as_ref().ok()?;
            outcome.triggered.then(|| NeedView {
                check_id: check.id.clone(),
                signal: check.signal,
                message: outcome.message.clone(),
            })
        })
        .collect()
}

fn need_message(needs: &[NeedView], signal: Signal) -> String {
    needs
        .iter()
        .find(|need| need.signal == signal)
        .map(|need| need.message.clone())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::HookInput;
    use serde_json::json;

    fn config() -> Config {
        Config::parse(
            r#"
            [[product]]
            id = "shop"
            name = "Shop"
            paths = ["/code/shop"]
            expect_activity_every_hours = 24

            [[product.check]]
            id = "signups"
            signal = "hungry"
            message = "{count} sign-ups waiting"
            kind = "script"
            command = "true"
            "#,
        )
        .unwrap()
    }

    fn snapshot(
        config: &Config,
        sessions: &Sessions,
        checks: &CheckResults,
        permissions: &[PendingPermission],
        now: DateTime<Utc>,
    ) -> PetView {
        let transcripts = HashMap::new();
        build(Inputs {
            config,
            sessions,
            checks,
            transcripts: &transcripts,
            permissions,
            notes: Vec::new(),
            tips: Vec::new(),
            now,
        })
        .pets
        .remove(0)
    }

    #[test]
    fn idle_product_is_chill() {
        let config = config();
        let pet = snapshot(
            &config,
            &Sessions::default(),
            &CheckResults::new(),
            &[],
            Utc::now(),
        );
        assert_eq!(pet.mood, Mood::Chill);
        assert_eq!(pet.headline, "All good");
    }

    #[test]
    fn triggered_check_makes_it_hungry() {
        let config = config();
        let mut checks = CheckResults::new();
        checks.insert(
            ("shop".into(), "signups".into()),
            CheckRun {
                at: Utc::now(),
                outcome: Ok(Outcome {
                    triggered: true,
                    count: Some(7),
                    message: "7 sign-ups waiting".into(),
                }),
            },
        );
        let pet = snapshot(&config, &Sessions::default(), &checks, &[], Utc::now());
        assert_eq!(pet.mood, Mood::Hungry);
        assert_eq!(pet.headline, "7 sign-ups waiting");
        assert_eq!(pet.needs.len(), 1);
    }

    #[test]
    fn pending_permission_needs_you() {
        let config = config();
        let permissions = [PendingPermission {
            request_id: 4,
            session_id: "s1".into(),
            product_id: "shop".into(),
            tool: "Bash".into(),
            summary: "git push".into(),
        }];
        let pet = snapshot(
            &config,
            &Sessions::default(),
            &CheckResults::new(),
            &permissions,
            Utc::now(),
        );
        assert_eq!(pet.mood, Mood::NeedsYou);
        assert_eq!(pet.headline, "Waiting for your OK: git push");
        assert_eq!(pet.permission.unwrap().request_id, 4);
    }

    #[test]
    fn quiet_product_stalls() {
        let config = config();
        let mut sessions = Sessions::default();
        let then = Utc::now() - TimeDelta::hours(30);
        let input: HookInput =
            serde_json::from_value(json!({ "session_id": "s1", "hook_event_name": "SessionEnd" }))
                .unwrap();
        sessions.apply(&input, Some("shop".into()), then);
        let pet = snapshot(&config, &sessions, &CheckResults::new(), &[], Utc::now());
        assert_eq!(pet.mood, Mood::Stalled);
    }
}
