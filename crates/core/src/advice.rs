//! Rule-based token tips. They read local data only and never call a model.

use serde::Serialize;

use crate::usage::Usage;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Tip {
    pub product_id: String,
    pub text: String,
}

/// Instruction files above this size cost noticeable tokens on every session.
const LARGE_INSTRUCTIONS_BYTES: u64 = 20_000;
const MIN_REPLIES_FOR_MODEL_TIP: usize = 20;
const SMALL_REPLY_TOKENS: u64 = 400;

/// Flags a `CLAUDE.md` large enough to matter, since it is loaded at the start of every session.
pub fn instructions_size(product_id: &str, bytes: u64) -> Option<Tip> {
    (bytes > LARGE_INSTRUCTIONS_BYTES).then(|| Tip {
        product_id: product_id.to_owned(),
        text: format!(
            "CLAUDE.md is about {}k tokens and loads every session. Trimming it saves tokens on every run.",
            bytes / 4 / 1_000
        ),
    })
}

/// Flags the largest model doing consistently short work.
pub fn model_fit(product_id: &str, entries: &[Usage]) -> Option<Tip> {
    let replies: Vec<u64> = entries
        .iter()
        .filter(|usage| usage.model.contains("opus"))
        .map(|usage| usage.output)
        .collect();
    if replies.len() < MIN_REPLIES_FOR_MODEL_TIP || median(&replies)? >= SMALL_REPLY_TOKENS {
        return None;
    }
    Some(Tip {
        product_id: product_id.to_owned(),
        text: "Runs here use the largest model for short replies. A smaller model would likely do the same work for less.".into(),
    })
}

fn median(values: &[u64]) -> Option<u64> {
    let mut sorted = values.to_vec();
    sorted.sort_unstable();
    sorted.get(sorted.len() / 2).copied()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn reply(model: &str, output: u64) -> Usage {
        Usage {
            at: Utc::now(),
            model: model.into(),
            input: 1_000,
            output,
            cache_read: 0,
            cache_write: 0,
        }
    }

    #[test]
    fn large_instructions_get_a_tip() {
        assert!(instructions_size("shop", 8_000).is_none());
        let tip = instructions_size("shop", 48_000).unwrap();
        assert!(tip.text.starts_with("CLAUDE.md is about 12k tokens"));
    }

    #[test]
    fn short_work_on_the_largest_model_gets_a_tip() {
        let short: Vec<_> = (0..25).map(|_| reply("claude-opus-x", 120)).collect();
        assert!(model_fit("shop", &short).is_some());

        let long: Vec<_> = (0..25).map(|_| reply("claude-opus-x", 2_000)).collect();
        assert!(model_fit("shop", &long).is_none());

        let few: Vec<_> = (0..5).map(|_| reply("claude-opus-x", 120)).collect();
        assert!(model_fit("shop", &few).is_none());

        let small_model: Vec<_> = (0..25).map(|_| reply("claude-haiku-x", 120)).collect();
        assert!(model_fit("shop", &small_model).is_none());
    }
}
