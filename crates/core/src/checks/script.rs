use std::io::Read;
use std::process::{Command, Stdio};
use std::time::Duration;

use serde::Deserialize;
use wait_timeout::ChildExt;

use super::{CheckError, Finding};

/// Runs a command that prints `{"triggered": bool, "count"?: n, "message"?: "..."}`.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ScriptCheck {
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default = "default_timeout")]
    pub timeout_seconds: u64,
}

fn default_timeout() -> u64 {
    30
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ScriptOutput {
    triggered: bool,
    #[serde(default)]
    count: Option<u64>,
    #[serde(default)]
    message: Option<String>,
}

impl ScriptCheck {
    pub(crate) fn run(&self) -> Result<Finding, CheckError> {
        let command = crate::paths::expand_home(&self.command);
        let mut child = crate::programs::quietly(&mut Command::new(command))
            .args(&self.args)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()?;

        let status = match child.wait_timeout(Duration::from_secs(self.timeout_seconds))? {
            Some(status) => status,
            None => {
                child.kill()?;
                child.wait()?;
                return Err(CheckError::Timeout(self.timeout_seconds));
            }
        };
        if !status.success() {
            return Err(CheckError::ScriptFailed(status.to_string()));
        }

        let mut stdout = String::new();
        if let Some(mut pipe) = child.stdout.take() {
            pipe.read_to_string(&mut stdout)?;
        }
        parse(&stdout)
    }
}

pub(crate) fn parse(stdout: &str) -> Result<Finding, CheckError> {
    let output: ScriptOutput = serde_json::from_str(stdout.trim())
        .map_err(|error| CheckError::Output(error.to_string()))?;
    Ok(Finding {
        triggered: output.triggered,
        count: output.count,
        message: output.message,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_minimal_output() {
        let found = parse("{\"triggered\": false}\n").unwrap();
        assert_eq!(
            found,
            Finding {
                triggered: false,
                count: None,
                message: None
            }
        );
    }

    #[test]
    fn parses_full_output() {
        let found =
            parse(r#"{"triggered": true, "count": 4, "message": "4 posts behind"}"#).unwrap();
        assert_eq!(found.count, Some(4));
        assert_eq!(found.message.as_deref(), Some("4 posts behind"));
    }

    #[test]
    fn rejects_non_json() {
        assert!(parse("ok").is_err());
    }

    #[cfg(unix)]
    #[test]
    fn runs_a_real_command() {
        let check = ScriptCheck {
            command: "/bin/sh".into(),
            args: vec![
                "-c".into(),
                r#"echo '{"triggered": true, "count": 2}'"#.into(),
            ],
            timeout_seconds: 5,
        };
        let found = check.run().unwrap();
        assert!(found.triggered);
        assert_eq!(found.count, Some(2));
    }

    #[cfg(unix)]
    #[test]
    fn times_out() {
        let check = ScriptCheck {
            command: "/bin/sh".into(),
            args: vec!["-c".into(), "sleep 5".into()],
            timeout_seconds: 1,
        };
        assert!(matches!(check.run(), Err(CheckError::Timeout(1))));
    }
}
