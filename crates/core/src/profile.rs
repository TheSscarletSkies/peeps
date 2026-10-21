//! What the user tells peeps about themselves: who they are, what they work on and how they like
//! things done. Plain Markdown beside the config, so it syncs, and every conversation reads it.

use std::path::{Path, PathBuf};

use chrono::NaiveDate;

const NOTES: &str = "## Things to remember";

pub fn path(config: &Path) -> PathBuf {
    config
        .parent()
        .map(|parent| parent.join("about-me.md"))
        .unwrap_or_else(|| PathBuf::from("about-me.md"))
}

/// Headings for a profile nobody has written yet; the helper fills them in by asking.
pub fn template() -> String {
    format!(
        "# About me\n\n\
         ## Who I am\n\n\n\
         ## What I'm working on\n\n\n\
         ## How I like things done\n\n\n\
         {NOTES}\n\n"
    )
}

pub fn read(config: &Path) -> String {
    std::fs::read_to_string(path(config)).unwrap_or_else(|_| template())
}

pub fn write(config: &Path, text: &str) -> std::io::Result<()> {
    let target = path(config);
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let staging = target.with_extension("md.peeps-tmp");
    std::fs::write(&staging, text)?;
    std::fs::rename(staging, target)
}

/// True while the profile holds nothing but its headings.
pub fn is_empty(profile: &str) -> bool {
    profile
        .lines()
        .all(|line| line.trim().is_empty() || line.trim_start().starts_with('#'))
}

/// Adds a dated line to the things to remember, creating that section if it's missing.
pub fn remember(profile: &str, day: NaiveDate, fact: &str) -> String {
    let line = format!("- {day}: {}\n", fact.trim().replace('\n', " "));
    match profile.find(NOTES) {
        Some(start) => {
            let body = start + NOTES.len();
            let end = profile[body..]
                .find("\n## ")
                .map(|offset| body + offset + 1)
                .unwrap_or(profile.len());
            let mut out = profile[..end].trim_end().to_owned();
            out.push_str(if out.ends_with(NOTES) { "\n\n" } else { "\n" });
            out.push_str(&line);
            if end < profile.len() {
                out.push('\n');
                out.push_str(&profile[end..]);
            }
            out
        }
        None => format!("{}\n\n{NOTES}\n\n{line}", profile.trim_end()),
    }
}

/// What every conversation is told about the user. An empty profile asks the agent to get to
/// know them first.
pub fn context(profile: &str) -> String {
    if is_empty(profile) {
        "You don't know the user yet. Before long, get to know them: ask one or two short \
         questions at a time (their name, what they do, what they're building and why, who it's \
         for, how they like to work and be spoken to). Save each answer with the remember tool, \
         and still help with whatever they asked."
            .to_owned()
    } else {
        format!(
            "About the user, in their own words. Follow it, and save anything new and lasting they \
             tell you with the remember tool.\n<about_me>\n{}\n</about_me>",
            profile.trim()
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn day() -> NaiveDate {
        NaiveDate::from_ymd_opt(2026, 10, 21).unwrap()
    }

    #[test]
    fn a_new_profile_asks_the_agent_to_get_to_know_the_user() {
        assert!(is_empty(&template()));
        assert!(context(&template()).contains("get to know them"));
        let written = template().replace(
            "## Who I am\n",
            "## Who I am\n\nMariyam, a student founder.",
        );
        assert!(!is_empty(&written));
        assert!(context(&written).contains("<about_me>\n# About me"));
    }

    #[test]
    fn remembered_things_land_in_their_section() {
        let once = remember(&template(), day(), "Prefers short replies");
        assert!(once.ends_with("## Things to remember\n\n- 2026-10-21: Prefers short replies\n"));
        let twice = remember(&once, day(), "Classes on Tuesday nights");
        assert!(twice.contains("short replies\n- 2026-10-21: Classes"));
        let elsewhere = remember("# About me\n\nHi", day(), "Likes tea");
        assert!(elsewhere.ends_with("## Things to remember\n\n- 2026-10-21: Likes tea\n"));
        let middle = remember("## Things to remember\n\n- a\n\n## Later\n\nx", day(), "b");
        assert_eq!(
            middle,
            "## Things to remember\n\n- a\n- 2026-10-21: b\n\n## Later\n\nx"
        );
    }

    #[test]
    fn profiles_are_kept_beside_the_config() {
        let dir = tempfile::tempdir().unwrap();
        let config = dir.path().join("config.toml");
        assert_eq!(read(&config), template());
        write(&config, "# About me\nMariyam").unwrap();
        assert_eq!(read(&config), "# About me\nMariyam");
    }
}
