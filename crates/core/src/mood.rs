use chrono::TimeDelta;
use serde::Serialize;

use crate::config::Settings;

/// What a pet is feeling, most urgent first.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Mood {
    NeedsYou,
    Failing,
    Steaming,
    Hungry,
    LitterBox,
    Sweating,
    Working,
    Stalled,
    Chill,
}

/// Everything known about a product at one moment.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Signals {
    pub awaiting_permission: bool,
    pub failed: bool,
    pub working_for: Option<TimeDelta>,
    /// Share of the context window used by the fullest live session, 0 to 1.
    pub context_used: f32,
    pub tokens_per_minute: u64,
    pub hungry: bool,
    pub litter_box: bool,
    pub stalled: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct Feeling {
    pub mood: Mood,
    /// How flushed the pet looks, 0 to 1, from the token burn rate.
    pub heat: f32,
}

pub fn feel(signals: &Signals, settings: &Settings) -> Feeling {
    let working_for = signals.working_for.filter(|d| *d >= TimeDelta::zero());
    let mood = if signals.awaiting_permission {
        Mood::NeedsYou
    } else if signals.failed {
        Mood::Failing
    } else if signals.context_used >= settings.steam_at_context {
        Mood::Steaming
    } else if signals.hungry {
        Mood::Hungry
    } else if signals.litter_box {
        Mood::LitterBox
    } else if working_for.is_some_and(|d| d >= TimeDelta::minutes(settings.sweat_after_minutes)) {
        Mood::Sweating
    } else if working_for.is_some() {
        Mood::Working
    } else if signals.stalled {
        Mood::Stalled
    } else {
        Mood::Chill
    };
    Feeling {
        mood,
        heat: heat(signals.tokens_per_minute, settings),
    }
}

fn heat(tokens_per_minute: u64, settings: &Settings) -> f32 {
    if settings.full_heat_tokens_per_minute == 0 {
        return 0.0;
    }
    (tokens_per_minute as f32 / settings.full_heat_tokens_per_minute as f32).clamp(0.0, 1.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mood(signals: Signals) -> Mood {
        feel(&signals, &Settings::default()).mood
    }

    #[test]
    fn calm_by_default() {
        assert_eq!(mood(Signals::default()), Mood::Chill);
    }

    #[test]
    fn permission_beats_everything() {
        assert_eq!(
            mood(Signals {
                awaiting_permission: true,
                failed: true,
                hungry: true,
                context_used: 0.99,
                ..Signals::default()
            }),
            Mood::NeedsYou
        );
    }

    #[test]
    fn needs_rank_above_work() {
        assert_eq!(
            mood(Signals {
                hungry: true,
                working_for: Some(TimeDelta::minutes(90)),
                ..Signals::default()
            }),
            Mood::Hungry
        );
    }

    #[test]
    fn long_work_makes_it_sweat() {
        let working = |minutes| Signals {
            working_for: Some(TimeDelta::minutes(minutes)),
            ..Signals::default()
        };
        assert_eq!(mood(working(5)), Mood::Working);
        assert_eq!(mood(working(30)), Mood::Sweating);
    }

    #[test]
    fn full_context_steams() {
        let filled = |context_used| Signals {
            context_used,
            ..Signals::default()
        };
        assert_eq!(mood(filled(0.5)), Mood::Chill);
        assert_eq!(mood(filled(0.9)), Mood::Steaming);
    }

    #[test]
    fn stalled_only_when_idle() {
        let stalled = Signals {
            stalled: true,
            ..Signals::default()
        };
        assert_eq!(mood(stalled.clone()), Mood::Stalled);
        assert_eq!(
            mood(Signals {
                working_for: Some(TimeDelta::zero()),
                ..stalled
            }),
            Mood::Working
        );
    }

    #[test]
    fn heat_scales_with_burn_and_caps() {
        let settings = Settings::default();
        let heat = |tokens_per_minute| {
            feel(
                &Signals {
                    tokens_per_minute,
                    ..Signals::default()
                },
                &settings,
            )
            .heat
        };
        assert_eq!(heat(0), 0.0);
        assert!((heat(settings.full_heat_tokens_per_minute / 2) - 0.5).abs() < 1e-6);
        assert_eq!(heat(u64::MAX), 1.0);
    }
}
