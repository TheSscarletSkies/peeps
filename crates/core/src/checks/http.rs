use std::collections::BTreeMap;
use std::time::Duration;

use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::Value;

use super::{render, CheckError, Finding, Secrets};

/// Fetches JSON and counts results: the array length, or a number at `count_pointer`.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HttpCheck {
    pub url: String,
    #[serde(default)]
    pub headers: BTreeMap<String, String>,
    /// JSON pointer (RFC 6901) to the value to count, e.g. `/data/pending`.
    #[serde(default)]
    pub count_pointer: Option<String>,
    /// The check fires when the count reaches this value.
    #[serde(default = "default_threshold")]
    pub threshold: u64,
}

fn default_threshold() -> u64 {
    1
}

const TIMEOUT: Duration = Duration::from_secs(20);

impl HttpCheck {
    pub(crate) fn run(
        &self,
        secrets: &dyn Secrets,
        now: DateTime<Utc>,
    ) -> Result<Finding, CheckError> {
        let url = render(&self.url, secrets, now)?;
        let mut request = ureq::get(&url).timeout(TIMEOUT);
        for (name, value) in &self.headers {
            request = request.set(name, &render(value, secrets, now)?);
        }
        let body: Value = request
            .call()
            .map_err(|error| CheckError::Http(error.to_string()))?
            .into_json()
            .map_err(|error| CheckError::Output(error.to_string()))?;
        self.evaluate(&body)
    }

    pub(crate) fn evaluate(&self, body: &Value) -> Result<Finding, CheckError> {
        let count = count(body, self.count_pointer.as_deref())?;
        Ok(Finding {
            triggered: count >= self.threshold,
            count: Some(count),
            message: None,
        })
    }
}

fn count(body: &Value, pointer: Option<&str>) -> Result<u64, CheckError> {
    let target = match pointer {
        Some(pointer) => body
            .pointer(pointer)
            .ok_or_else(|| CheckError::Output(format!("nothing at {pointer}")))?,
        None => body,
    };
    match target {
        Value::Array(items) => Ok(items.len() as u64),
        Value::Number(number) => number
            .as_u64()
            .ok_or_else(|| CheckError::Output(format!("{number} is not a whole count"))),
        other => Err(CheckError::Output(format!("cannot count {other}"))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn check(pointer: Option<&str>, threshold: u64) -> HttpCheck {
        HttpCheck {
            url: String::new(),
            headers: BTreeMap::new(),
            count_pointer: pointer.map(str::to_owned),
            threshold,
        }
    }

    #[test]
    fn counts_array_rows() {
        let found = check(None, 1)
            .evaluate(&json!([{ "id": 1 }, { "id": 2 }]))
            .unwrap();
        assert!(found.triggered);
        assert_eq!(found.count, Some(2));
    }

    #[test]
    fn reads_number_at_pointer() {
        let found = check(Some("/stats/pending"), 5)
            .evaluate(&json!({ "stats": { "pending": 3 } }))
            .unwrap();
        assert!(!found.triggered);
        assert_eq!(found.count, Some(3));
    }

    #[test]
    fn empty_result_does_not_fire() {
        assert!(!check(None, 1).evaluate(&json!([])).unwrap().triggered);
    }

    #[test]
    fn rejects_uncountable_values() {
        assert!(check(None, 1).evaluate(&json!("text")).is_err());
        assert!(check(Some("/missing"), 1).evaluate(&json!({})).is_err());
    }
}
