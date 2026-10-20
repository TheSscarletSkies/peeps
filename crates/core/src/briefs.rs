//! A short brief for each product: its goal, audience, voice, numbers and the decisions made along
//! the way. Kept as plain Markdown next to the config, so it syncs with it and anyone can edit it.

use std::path::{Path, PathBuf};

use chrono::NaiveDate;

const DECISIONS: &str = "## Decisions";

/// The briefs folder beside a config file.
pub fn dir(config: &Path) -> PathBuf {
    config
        .parent()
        .map(|parent| parent.join("briefs"))
        .unwrap_or_else(|| PathBuf::from("briefs"))
}

pub fn path(config: &Path, product_id: &str) -> PathBuf {
    dir(config).join(format!("{product_id}.md"))
}

/// What a new brief starts as: headings to fill in, so the agent knows where things go.
pub fn template(name: &str) -> String {
    format!(
        "# {name}\n\n\
         ## Goal\n\nWhat this product is for and what success looks like this quarter.\n\n\
         ## Audience\n\nWho it is for, and where they hang out.\n\n\
         ## Voice\n\nHow it sounds: words to use, words to avoid.\n\n\
         ## Numbers\n\nThe few numbers that matter, and where they come from.\n\n\
         ## Links\n\nSite, socials, dashboards.\n\n\
         {DECISIONS}\n\n"
    )
}

/// The brief, or the template when none has been written yet.
pub fn read(config: &Path, product_id: &str, name: &str) -> String {
    std::fs::read_to_string(path(config, product_id)).unwrap_or_else(|_| template(name))
}

pub fn write(config: &Path, product_id: &str, text: &str) -> std::io::Result<()> {
    let target = path(config, product_id);
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let staging = target.with_extension("md.peeps-tmp");
    std::fs::write(&staging, text)?;
    std::fs::rename(staging, target)
}

/// Adds a dated line under Decisions, creating the section if the brief lacks one.
pub fn with_decision(brief: &str, day: NaiveDate, decision: &str) -> String {
    let line = format!("- {day}: {}\n", decision.trim().replace('\n', " "));
    match brief.find(DECISIONS) {
        Some(start) => {
            let body = start + DECISIONS.len();
            // Decisions go at the end of their section, before any heading that follows it.
            let end = brief[body..]
                .find("\n## ")
                .map(|offset| body + offset + 1)
                .unwrap_or(brief.len());
            let mut out = brief[..end].trim_end().to_owned();
            out.push_str(if out.ends_with(DECISIONS) {
                "\n\n"
            } else {
                "\n"
            });
            out.push_str(&line);
            if end < brief.len() {
                out.push('\n');
                out.push_str(&brief[end..]);
            }
            out
        }
        None => format!("{}\n\n{DECISIONS}\n\n{line}", brief.trim_end()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn day(text: &str) -> NaiveDate {
        text.parse().unwrap()
    }

    #[test]
    fn decisions_collect_under_their_heading() {
        let brief = template("Funderly");
        let once = with_decision(&brief, day("2026-10-20"), "Move to annual pricing");
        let twice = with_decision(&once, day("2026-10-27"), "Pause\nads for a week");
        assert!(twice.ends_with(
            "## Decisions\n\n- 2026-10-20: Move to annual pricing\n- 2026-10-27: Pause ads for a week\n"
        ));
        assert!(twice.starts_with("# Funderly"));
    }

    #[test]
    fn decisions_stay_inside_their_section() {
        let brief = "# X\n\n## Decisions\n\n- 2026-10-01: Start\n\n## Later\n\nNotes\n";
        let out = with_decision(brief, day("2026-10-20"), "Next");
        assert_eq!(
            out,
            "# X\n\n## Decisions\n\n- 2026-10-01: Start\n- 2026-10-20: Next\n\n## Later\n\nNotes\n"
        );
        let bare = with_decision("# Y\nSomething", day("2026-10-20"), "First");
        assert!(bare.ends_with("## Decisions\n\n- 2026-10-20: First\n"));
    }

    #[test]
    fn briefs_live_beside_the_config() {
        let dir = tempfile::tempdir().unwrap();
        let config = dir.path().join("config.toml");
        assert!(read(&config, "funderly", "Funderly").starts_with("# Funderly"));
        write(&config, "funderly", "# Funderly\n\nCustom").unwrap();
        assert_eq!(
            read(&config, "funderly", "Funderly"),
            "# Funderly\n\nCustom"
        );
        assert!(dir.path().join("briefs/funderly.md").exists());
    }
}
