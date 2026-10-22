//! New versions of peeps. The app asks the latest GitHub release on launch and every few hours;
//! this decides what counts as newer, what Settings shows and when to say so out loud.

use std::cmp::Ordering;
use std::time::Duration;

use serde::Serialize;

/// How often a running app looks for a new release.
pub const CHECK_EVERY: Duration = Duration::from_secs(6 * 60 * 60);

/// A release version: `0.2.0`, `v0.2.0` or `1.0.0-beta.2`. Build metadata after `+` is ignored.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Version {
    numbers: [u64; 3],
    pre: Vec<String>,
}

impl Version {
    pub fn parse(text: &str) -> Option<Self> {
        let text = text.trim();
        let text = text.strip_prefix('v').unwrap_or(text);
        let text = text.split('+').next().unwrap_or(text);
        let (core, pre) = match text.split_once('-') {
            Some((core, pre)) => (core, pre.split('.').map(str::to_owned).collect()),
            None => (text, Vec::new()),
        };
        let mut parts = core.split('.');
        let mut numbers = [0; 3];
        for slot in &mut numbers {
            *slot = parts.next()?.parse().ok()?;
        }
        if parts.next().is_some() || pre.iter().any(String::is_empty) {
            return None;
        }
        Some(Self { numbers, pre })
    }
}

impl Ord for Version {
    fn cmp(&self, other: &Self) -> Ordering {
        self.numbers.cmp(&other.numbers).then_with(|| {
            // A pre-release comes before the release it leads up to.
            match (self.pre.is_empty(), other.pre.is_empty()) {
                (true, true) => Ordering::Equal,
                (true, false) => Ordering::Greater,
                (false, true) => Ordering::Less,
                (false, false) => compare_pre(&self.pre, &other.pre),
            }
        })
    }
}

impl PartialOrd for Version {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

/// Semantic versioning's order: numbers by value and below words, words alphabetically, and a
/// shorter list first when one is the start of the other.
fn compare_pre(a: &[String], b: &[String]) -> Ordering {
    for (x, y) in a.iter().zip(b) {
        let order = match (x.parse::<u64>(), y.parse::<u64>()) {
            (Ok(x), Ok(y)) => x.cmp(&y),
            (Ok(_), Err(_)) => Ordering::Less,
            (Err(_), Ok(_)) => Ordering::Greater,
            (Err(_), Err(_)) => x.cmp(y),
        };
        if order != Ordering::Equal {
            return order;
        }
    }
    a.len().cmp(&b.len())
}

/// Whether `offered` should replace `current`. Anything unreadable is never offered, so a
/// malformed release can't push itself onto everyone.
pub fn is_newer(current: &str, offered: &str) -> bool {
    match (Version::parse(current), Version::parse(offered)) {
        (Some(current), Some(offered)) => offered > current,
        _ => false,
    }
}

/// What one look at the latest release found.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Check {
    Found(String),
    UpToDate,
    /// Offline, no release published yet, or the feed couldn't be read.
    Failed,
}

/// A newer peeps waiting for the user to restart into it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Ready {
    pub version: String,
    /// Downloading and installing, after the user pressed Restart.
    pub installing: bool,
    /// Why the last install attempt failed, shown on the card so they can try again.
    pub error: Option<String>,
}

impl Ready {
    pub fn new(version: &str) -> Self {
        Self {
            version: version.trim().to_owned(),
            installing: false,
            error: None,
        }
    }
}

/// What Settings shows after a check. A failed check changes nothing: being offline neither
/// hides an update already found nor shows anything new.
pub fn after_check(shown: Option<Ready>, check: Check) -> Option<Ready> {
    match check {
        Check::Found(version) => match shown {
            Some(ready) if ready.version == version.trim() => Some(ready),
            _ => Some(Ready::new(&version)),
        },
        Check::UpToDate => None,
        Check::Failed => shown,
    }
}

/// A notification goes out once for each new version, however often the app checks or restarts.
pub fn should_notify(announced: Option<&str>, found: &str) -> bool {
    announced.map(str::trim) != Some(found.trim())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn newer_follows_semantic_versioning() {
        assert!(is_newer("0.1.1", "0.1.2"));
        assert!(is_newer("0.1.9", "0.2.0"));
        assert!(is_newer("0.9.0", "v1.0.0"));
        assert!(is_newer("0.1.10", "0.1.11"));
        assert!(!is_newer("0.1.10", "0.1.9"));
        assert!(!is_newer("0.2.0", "0.2.0"));
        assert!(!is_newer("0.2.0", "0.1.5"));
        assert!(!is_newer("0.2.0", "0.2.0+build.7"));
    }

    #[test]
    fn pre_releases_come_before_their_release() {
        assert!(is_newer("1.0.0-beta.2", "1.0.0"));
        assert!(!is_newer("1.0.0", "1.0.0-rc.1"));
        assert!(is_newer("1.0.0-alpha", "1.0.0-alpha.1"));
        assert!(is_newer("1.0.0-alpha.1", "1.0.0-beta"));
        assert!(is_newer("1.0.0-beta.2", "1.0.0-beta.11"));
        assert!(is_newer("1.0.0-1", "1.0.0-alpha"));
    }

    #[test]
    fn unreadable_versions_are_never_offered() {
        assert!(!is_newer("0.1.1", "latest"));
        assert!(!is_newer("0.1.1", "0.2"));
        assert!(!is_newer("0.1.1", "0.2.0.1"));
        assert!(!is_newer("0.1.1", "0.2.0-"));
        assert!(!is_newer("0.1.1", ""));
        assert!(!is_newer("dev", "9.9.9"));
    }

    #[test]
    fn a_found_update_stays_through_failed_checks_and_goes_when_current() {
        let found = after_check(None, Check::Found("0.2.0".into()));
        assert_eq!(found, Some(Ready::new("0.2.0")));
        assert_eq!(after_check(found.clone(), Check::Failed), found);
        assert_eq!(after_check(None, Check::Failed), None);
        assert_eq!(after_check(found, Check::UpToDate), None);
    }

    #[test]
    fn checking_again_leaves_an_install_in_progress_alone() {
        let installing = Some(Ready {
            installing: true,
            ..Ready::new("0.2.0")
        });
        assert_eq!(
            after_check(installing.clone(), Check::Found("0.2.0".into())),
            installing
        );
        // A newer release replaces the card, and any old error with it.
        let failed = Some(Ready {
            error: Some("download stopped".into()),
            ..Ready::new("0.2.0")
        });
        assert_eq!(
            after_check(failed, Check::Found("0.2.1".into())),
            Some(Ready::new("0.2.1"))
        );
    }

    #[test]
    fn each_version_is_announced_once() {
        assert!(should_notify(None, "0.2.0"));
        assert!(!should_notify(Some("0.2.0\n"), "0.2.0"));
        assert!(should_notify(Some("0.2.0"), "0.2.1"));
    }

    #[test]
    fn the_card_reads_in_camel_case() {
        let json = serde_json::to_value(Ready::new("0.2.0")).unwrap();
        assert_eq!(json["version"], "0.2.0");
        assert_eq!(json["installing"], false);
        assert!(json["error"].is_null());
    }
}
