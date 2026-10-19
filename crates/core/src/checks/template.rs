use chrono::{DateTime, SecondsFormat, TimeDelta, Utc};

use super::CheckError;

/// Looks up secrets referenced as `{secret:NAME}`, normally from the OS keychain.
pub trait Secrets {
    fn get(&self, name: &str) -> Option<String>;
}

/// Replaces `{secret:NAME}`, `{days_ago:N}` and `{hours_ago:N}` placeholders.
pub fn render(text: &str, secrets: &dyn Secrets, now: DateTime<Utc>) -> Result<String, CheckError> {
    let mut out = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(start) = rest.find('{') {
        out.push_str(&rest[..start]);
        let after = &rest[start + 1..];
        let Some(end) = after.find('}') else {
            out.push_str(&rest[start..]);
            return Ok(out);
        };
        let token = &after[..end];
        match expand(token, secrets, now)? {
            Some(value) => out.push_str(&value),
            None => {
                out.push('{');
                out.push_str(token);
                out.push('}');
            }
        }
        rest = &after[end + 1..];
    }
    out.push_str(rest);
    Ok(out)
}

fn expand(
    token: &str,
    secrets: &dyn Secrets,
    now: DateTime<Utc>,
) -> Result<Option<String>, CheckError> {
    let Some((name, arg)) = token.split_once(':') else {
        return Ok(None);
    };
    let ago = |delta: Option<TimeDelta>| {
        delta.map(|delta| (now - delta).to_rfc3339_opts(SecondsFormat::Secs, true))
    };
    Ok(match name {
        "secret" => Some(
            secrets
                .get(arg)
                .ok_or_else(|| CheckError::MissingSecret(arg.to_owned()))?,
        ),
        "days_ago" => ago(arg.parse().ok().and_then(TimeDelta::try_days)),
        "hours_ago" => ago(arg.parse().ok().and_then(TimeDelta::try_hours)),
        _ => None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    struct Fixed;

    impl Secrets for Fixed {
        fn get(&self, name: &str) -> Option<String> {
            (name == "db").then(|| "s3cret".to_owned())
        }
    }

    fn now() -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 10, 19, 12, 0, 0).unwrap()
    }

    #[test]
    fn expands_dates_and_secrets() {
        let text = "created_at=lt.{days_ago:7}&key={secret:db}";
        assert_eq!(
            render(text, &Fixed, now()).unwrap(),
            "created_at=lt.2026-10-12T12:00:00Z&key=s3cret"
        );
    }

    #[test]
    fn leaves_other_braces_alone() {
        assert_eq!(
            render("{count} and {x", &Fixed, now()).unwrap(),
            "{count} and {x"
        );
    }

    #[test]
    fn missing_secret_is_an_error() {
        assert!(matches!(
            render("{secret:nope}", &Fixed, now()),
            Err(CheckError::MissingSecret(name)) if name == "nope"
        ));
    }
}
