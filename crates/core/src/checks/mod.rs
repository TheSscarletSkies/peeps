//! Checks read a product's own data and raise a need without involving a model.

mod http;
mod script;
mod template;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

pub use http::HttpCheck;
pub use script::ScriptCheck;
pub use template::{render, Secrets};

/// Unknown keys are rejected by the source structs, since serde cannot combine that rule with `flatten`.
#[derive(Debug, Clone, Deserialize)]
pub struct CheckSpec {
    pub id: String,
    pub signal: Signal,
    /// Shown on the pet when the check fires. `{count}` is replaced with the count.
    pub message: String,
    #[serde(default = "default_interval")]
    pub every_minutes: u32,
    #[serde(flatten)]
    pub source: Source,
}

fn default_interval() -> u32 {
    15
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Signal {
    Hungry,
    LitterBox,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Source {
    Http(HttpCheck),
    Script(ScriptCheck),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Outcome {
    pub triggered: bool,
    pub count: Option<u64>,
    pub message: String,
}

#[derive(Debug, thiserror::Error)]
pub enum CheckError {
    #[error("secret `{0}` is not set")]
    MissingSecret(String),
    #[error("request failed: {0}")]
    Http(String),
    #[error("could not run script: {0}")]
    Spawn(#[from] std::io::Error),
    #[error("script timed out after {0} s")]
    Timeout(u64),
    #[error("script exited with {0}")]
    ScriptFailed(String),
    #[error("unexpected output: {0}")]
    Output(String),
}

impl CheckSpec {
    pub fn run(&self, secrets: &dyn Secrets, now: DateTime<Utc>) -> Result<Outcome, CheckError> {
        let found = match &self.source {
            Source::Http(check) => check.run(secrets, now)?,
            Source::Script(check) => check.run()?,
        };
        Ok(Outcome {
            triggered: found.triggered,
            count: found.count,
            message: found.message.unwrap_or_else(|| self.describe(found.count)),
        })
    }

    pub fn describe(&self, count: Option<u64>) -> String {
        let count = count.map(|n| n.to_string()).unwrap_or_default();
        self.message.replace("{count}", &count)
    }

    pub fn is_due(&self, last_run: Option<DateTime<Utc>>, now: DateTime<Utc>) -> bool {
        last_run.is_none_or(|at| now - at >= chrono::TimeDelta::minutes(self.every_minutes.into()))
    }
}

/// What a source reports before the spec's message template is applied.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Finding {
    pub triggered: bool,
    pub count: Option<u64>,
    pub message: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeDelta;

    fn spec() -> CheckSpec {
        toml::from_str(
            r#"
            id = "signups"
            signal = "hungry"
            message = "{count} sign-ups waiting"
            every_minutes = 10
            kind = "script"
            command = "true"
            "#,
        )
        .unwrap()
    }

    #[test]
    fn message_template_uses_count() {
        assert_eq!(spec().describe(Some(7)), "7 sign-ups waiting");
    }

    #[test]
    fn rejects_misspelled_source_keys() {
        let parsed = toml::from_str::<CheckSpec>(
            r#"
            id = "x"
            signal = "hungry"
            message = "m"
            kind = "script"
            comand = "true"
            "#,
        );
        assert!(parsed.is_err());
    }

    #[test]
    fn due_after_interval() {
        let now = Utc::now();
        let check = spec();
        assert!(check.is_due(None, now));
        assert!(!check.is_due(Some(now - TimeDelta::minutes(5)), now));
        assert!(check.is_due(Some(now - TimeDelta::minutes(10)), now));
    }
}
