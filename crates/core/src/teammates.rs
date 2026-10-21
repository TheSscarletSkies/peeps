//! Teammates: named roles for a product, each with a playbook the user edits, a rhythm to work on
//! and its own conversation. They draft and suggest; the user approves anything that leaves.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::todos::Repeat;

/// A teammate as written in the config, under its product. Its playbook is a Markdown file.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct Teammate {
    pub id: String,
    pub name: String,
    pub role: String,
}

/// A starting point: who the teammate is and how often it works.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Role {
    pub id: &'static str,
    pub name: &'static str,
    pub title: &'static str,
    pub summary: &'static str,
    pub repeat: Repeat,
    pub time: &'static str,
    pub playbook: &'static str,
}

pub const ROLES: [Role; 6] = [
    Role {
        id: "sales",
        name: "Sana",
        title: "Sales co-chair",
        summary: "Follows up sign-ups and payers, drafts outreach, owns revenue.",
        repeat: Repeat::Weekdays,
        time: "09:00",
        playbook: "## What I own\n\nRevenue. Every new sign-up gets a welcome, every trial gets a nudge before it ends, \
                   every payer gets a thank-you.\n\n\
                   ## Each shift\n\n\
                   1. Check product_numbers and peeps_overview for new sign-ups, payments and anything stuck.\n\
                   2. Draft the emails that should go out today with draft_email, one per person.\n\
                   3. Check waiting_replies and draft a gentle follow-up for anyone quiet for 4 days.\n\
                   4. Add a to-do for anything only the founder can do, like a call.\n\
                   5. If a connector reaches payments or sign-ups (PayPal, Stripe, Supabase), log new \
                   payments with log_payment so the numbers stay current without anyone typing them.\n\n\
                   ## Rules\n\n- Short, warm, specific. No discounts unless the brief says so.\n",
    },
    Role {
        id: "growth",
        name: "Gio",
        title: "Growth marketer",
        summary: "Plans the week's content and channels, drafts posts in your voice.",
        repeat: Repeat::Weekly,
        time: "10:00",
        playbook: "## What I own\n\nGetting the right people to notice the product.\n\n\
                   ## Each shift\n\n\
                   1. Read the brief and last week's numbers.\n\
                   2. Pick this week's angle and the channels that fit the audience.\n\
                   3. Draft the week's posts with save_draft, one per post, ready to copy.\n\
                   4. Add a to-do for each post with the day it should go out.\n\n\
                   ## Rules\n\n- One clear idea per post. Hooks in the first line.\n",
    },
    Role {
        id: "showrunner",
        name: "Remy",
        title: "Showrunner",
        summary: "Plans episodes and writes scripts for TikTok, Reels and Shorts.",
        repeat: Repeat::Weekly,
        time: "11:00",
        playbook: "## What I own\n\nThe story: what comes next, and how each episode hooks the viewer.\n\n\
                   ## Each shift\n\n\
                   1. Read the brief for the story so far and what is planned.\n\
                   2. Check which posts went out with product_numbers.\n\
                   3. Write the next episodes' scripts with save_draft: a 2-second hook, the beat, a cliffhanger.\n\
                   4. Suggest captions and add a to-do for each recording day.\n\
                   5. Keep continuity: log decisions about the plot with log_decision.\n",
    },
    Role {
        id: "launch",
        name: "Lina",
        title: "Launch marketer",
        summary: "Runs the countdown: daily launch tasks, posts and outreach.",
        repeat: Repeat::Daily,
        time: "09:30",
        playbook: "## What I own\n\nThe launch, from now until launch day and the week after.\n\n\
                   ## Each shift\n\n\
                   1. Check the launch date and goals in the brief.\n\
                   2. Say what today's launch tasks are and add them as to-dos.\n\
                   3. Draft today's post with save_draft and any outreach with draft_email.\n\
                   4. Flag anything at risk for the launch date.\n",
    },
    Role {
        id: "analyst",
        name: "Ada",
        title: "Numbers analyst",
        summary: "A weekly read of the numbers: what moved, why, and what to try.",
        repeat: Repeat::Weekly,
        time: "16:00",
        playbook: "## What I own\n\nKnowing what is working.\n\n\
                   ## Each shift\n\n\
                   1. Pull anything new from connected tools (payments, sign-ups, views) and log it \
                   with log_payment or log_post, then compare the last 7 and 30 days with \
                   product_numbers.\n\
                   2. Say what moved and the likeliest reason, in three lines.\n\
                   3. Name one experiment for next week and add it as a to-do.\n\
                   4. List any number that is missing and how to get it.\n",
    },
    Role {
        id: "custom",
        name: "Pip",
        title: "Teammate",
        summary: "Start blank and write the playbook yourself.",
        repeat: Repeat::Weekly,
        time: "09:00",
        playbook: "## What I own\n\n\n## Each shift\n\n1. \n\n## Rules\n\n- \n",
    },
];

pub fn role(id: &str) -> Option<&'static Role> {
    ROLES.iter().find(|role| role.id == id)
}

const SELLS: [&str; 11] = [
    "sign-up",
    "signup",
    "sign up",
    "trial",
    "pricing",
    "customer",
    "paypal",
    "payment",
    "subscription",
    "revenue",
    "fundrais",
];
const TELLS: [&str; 10] = [
    "episode", "story", "series", "chapter", "season", "tiktok", "reel", "shorts", "youtube",
    "video",
];
const LAUNCHES: [&str; 6] = [
    "launch",
    "waitlist",
    "pre-order",
    "preorder",
    "coming soon",
    "beta",
];

/// Up to two roles a product most likely needs, from what peeps knows about it: its name, brief,
/// checks and where its numbers come from. Roles it already has are left out.
pub fn suggest(signals: &str, taken: &[&str]) -> Vec<&'static str> {
    let text = signals.to_lowercase();
    let score = |words: &[&str]| words.iter().filter(|word| text.contains(*word)).count();
    let mut picks: Vec<(usize, [&'static str; 2])> = vec![
        (score(&SELLS), ["sales", "growth"]),
        (score(&TELLS), ["showrunner", "growth"]),
        (score(&LAUNCHES), ["launch", "growth"]),
    ];
    // The strongest signal wins; a stable sort keeps sales ahead on a tie.
    picks.sort_by_key(|pick| std::cmp::Reverse(pick.0));
    let roles = match picks.first() {
        Some((score, roles)) if *score > 0 => *roles,
        _ => ["growth", "analyst"],
    };
    roles
        .into_iter()
        .filter(|role| !taken.contains(role))
        .collect()
}

/// Kind of the schedule that wakes a teammate; its topic is the teammate's scope.
pub const SHIFT: &str = "teammate";

/// The conversation a teammate keeps, which is also its schedule topic.
pub fn scope(product: &str, teammate: &str) -> String {
    format!("{product}/{teammate}")
}

/// Splits a teammate's scope into product and teammate ids.
pub fn parse_scope(scope: &str) -> Option<(&str, &str)> {
    scope
        .split_once('/')
        .filter(|(product, teammate)| !product.is_empty() && !teammate.is_empty())
}

/// The product a conversation belongs to, so its approvals show on that pet.
pub fn product_of(scope: &str) -> &str {
    parse_scope(scope).map_or(scope, |(product, _)| product)
}

pub fn dir(config: &Path) -> PathBuf {
    config
        .parent()
        .map(|parent| parent.join("teammates"))
        .unwrap_or_else(|| PathBuf::from("teammates"))
}

pub fn path(config: &Path, product: &str, teammate: &str) -> PathBuf {
    dir(config).join(product).join(format!("{teammate}.md"))
}

/// The playbook, or the role's starting one when none has been written yet.
pub fn read(config: &Path, product: &str, teammate: &Teammate) -> String {
    std::fs::read_to_string(path(config, product, &teammate.id)).unwrap_or_else(|_| {
        role(&teammate.role)
            .map(|role| role.playbook.to_owned())
            .unwrap_or_default()
    })
}

pub fn write(config: &Path, product: &str, teammate: &str, text: &str) -> std::io::Result<()> {
    let target = path(config, product, teammate);
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let staging = target.with_extension("md.peeps-tmp");
    std::fs::write(&staging, text)?;
    std::fs::rename(staging, target)
}

/// Who the agent is when it answers as this teammate.
pub fn context(teammate: &Teammate, product_context: &str, playbook: &str) -> String {
    let title = role(&teammate.role).map_or("teammate", |role| role.title);
    format!(
        "You are {name}, the {title} on the user's team for this product. Work from your playbook, \
         which the user wrote for you, and speak as {name} in the first person.\n\n\
         <playbook>\n{playbook}\n</playbook>\n\n\
         Anything meant for other people is a draft for the user to approve: emails with \
         draft_email, posts and scripts with save_draft. Never send or publish anything yourself. \
         Tag to-dos you add with the product id.\n\n{product_context}",
        name = teammate.name,
    )
}

/// What a teammate is asked when its shift comes round.
pub fn shift_prompt() -> String {
    "It's time for your shift. Follow your playbook using the peeps tools. Then report in this \
     shape, short:\n\
     **Done**: what you did, one line each.\n\
     **Waiting for you**: drafts and to-dos that need the user, with where to find them.\n\
     **One question**: the one thing you need from the user to do better next time."
        .to_owned()
}

/// A short, readable id from a name: "Sales co-chair" becomes `sales-co-chair`.
pub fn slug(name: &str) -> String {
    let mut slug = String::new();
    for c in name.trim().to_lowercase().chars() {
        if c.is_ascii_alphanumeric() {
            slug.push(c);
        } else if !slug.ends_with('-') && !slug.is_empty() {
            slug.push('-');
        }
    }
    slug.trim_end_matches('-').to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scopes_name_the_product_and_teammate() {
        assert_eq!(scope("funderly", "sana"), "funderly/sana");
        assert_eq!(parse_scope("funderly/sana"), Some(("funderly", "sana")));
        assert_eq!(parse_scope("funderly"), None);
        assert_eq!(parse_scope("/sana"), None);
        assert_eq!(product_of("funderly/sana"), "funderly");
        assert_eq!(product_of("helper"), "helper");
    }

    #[test]
    fn every_role_has_a_playbook_that_drafts_rather_than_sends() {
        for role in ROLES {
            assert!(!role.playbook.is_empty(), "{} has no playbook", role.id);
            assert!(!role.playbook.contains("send_email"), "{}", role.id);
            assert_eq!(role.time.len(), 5);
        }
        assert_eq!(role("showrunner").unwrap().title, "Showrunner");
        assert!(role("ceo").is_none());
    }

    #[test]
    fn playbooks_start_from_the_role_and_are_kept_as_written() {
        let dir = tempfile::tempdir().unwrap();
        let config = dir.path().join("config.toml");
        let remy = Teammate {
            id: "remy".into(),
            name: "Remy".into(),
            role: "showrunner".into(),
        };
        assert!(read(&config, "enigma", &remy).contains("cliffhanger"));
        write(&config, "enigma", "remy", "# Remy\nOnly Shorts.").unwrap();
        assert_eq!(read(&config, "enigma", &remy), "# Remy\nOnly Shorts.");
        assert!(dir.path().join("teammates/enigma/remy.md").exists());
    }

    #[test]
    fn the_agent_is_told_who_it_is_and_never_to_send() {
        let sana = Teammate {
            id: "sana".into(),
            name: "Sana".into(),
            role: "sales".into(),
        };
        let text = context(&sana, "PRODUCT", "PLAYBOOK");
        assert!(text.starts_with("You are Sana, the Sales co-chair"));
        assert!(text.contains("<playbook>\nPLAYBOOK\n</playbook>"));
        assert!(text.contains("Never send or publish"));
        assert!(text.ends_with("PRODUCT"));
        assert!(shift_prompt().contains("**One question**"));
    }

    #[test]
    fn suggests_roles_from_what_the_product_is() {
        assert_eq!(
            suggest("Funderly. 7 sign-ups waiting; payments via PayPal", &[]),
            ["sales", "growth"]
        );
        assert_eq!(
            suggest(
                "Enigma Archives: a mystery story told in episodes on TikTok",
                &[]
            ),
            ["showrunner", "growth"]
        );
        assert_eq!(
            suggest("Kaiveni Hiya. Launch on 1 December, waitlist open", &[]),
            ["launch", "growth"]
        );
        assert_eq!(suggest("A new thing", &[]), ["growth", "analyst"]);
        assert_eq!(suggest("Sign-ups and pricing", &["sales"]), ["growth"]);
        assert!(suggest("trial customers", &["sales", "growth"]).is_empty());
    }

    #[test]
    fn slugs_are_short_and_safe() {
        assert_eq!(slug("Sales co-chair"), "sales-co-chair");
        assert_eq!(slug("  Remy!! "), "remy");
        assert_eq!(slug("Ünïcode"), "n-code");
    }
}
