//! What each product earned and posted: payments logged by hand or pulled from PayPal, and posts
//! marked by hand or pulled from YouTube. Imported entries take their source's id as their uid, so
//! two computers pulling the same payment count it once.

use std::collections::BTreeMap;
use std::path::Path;

use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Payment,
    Post,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub uid: String,
    pub product: String,
    pub kind: Kind,
    /// Minor units (cents), so sums are exact. Posts have none.
    pub amount_cents: Option<i64>,
    pub currency: Option<String>,
    /// Where it came from or went: `manual`, `paypal`, `youtube`, `tiktok`, `instagram`.
    pub channel: String,
    pub note: String,
    pub at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted: bool,
}

/// A product's numbers since a point in time.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Summary {
    /// Cents per currency; PayPal and manual payments can differ in currency.
    pub revenue: BTreeMap<String, i64>,
    pub payments: usize,
    pub posts: BTreeMap<String, usize>,
    pub last_post_at: Option<DateTime<Utc>>,
}

/// Cents as money, like `USD 49.50`.
pub fn money(cents: i64, currency: &str) -> String {
    format!("{currency} {}.{:02}", cents / 100, cents % 100)
}

/// One plain line an agent or a person can read.
pub fn describe(summary: &Summary) -> String {
    let revenue = if summary.payments == 0 {
        "no payments".to_owned()
    } else {
        let totals: Vec<String> = summary
            .revenue
            .iter()
            .map(|(currency, cents)| money(*cents, currency))
            .collect();
        format!(
            "{} from {} payment{}",
            totals.join(" + "),
            summary.payments,
            if summary.payments == 1 { "" } else { "s" }
        )
    };
    let posts = if summary.posts.is_empty() {
        "no posts".to_owned()
    } else {
        let counts: Vec<String> = summary
            .posts
            .iter()
            .map(|(channel, count)| format!("{count} {channel}"))
            .collect();
        format!("posts: {}", counts.join(", "))
    };
    format!("{revenue}; {posts}")
}

/// Turns "12.50" or "12" into 1250 cents. Rejects negatives and more than two decimals.
pub fn parse_amount(text: &str) -> Option<i64> {
    let text = text.trim().trim_start_matches(['$', '£', '€']);
    let (whole, fraction) = text.split_once('.').unwrap_or((text, ""));
    if whole.is_empty() && fraction.is_empty() || fraction.len() > 2 {
        return None;
    }
    let whole: i64 = if whole.is_empty() {
        0
    } else {
        whole.replace(',', "").parse().ok()?
    };
    let fraction: i64 = match fraction.len() {
        0 => 0,
        1 => fraction.parse::<i64>().ok()? * 10,
        _ => fraction.parse().ok()?,
    };
    (whole >= 0).then_some(whole * 100 + fraction)
}

/// Where a post can go, for logging one by hand.
pub const CHANNELS: [&str; 6] = ["tiktok", "instagram", "youtube", "linkedin", "x", "other"];

/// A payment the user logs themselves, like a bank transfer or cash.
pub fn manual_payment(
    product: &str,
    amount: &str,
    currency: &str,
    note: &str,
    now: DateTime<Utc>,
) -> Result<Entry, String> {
    let cents = parse_amount(amount)
        .filter(|cents| *cents > 0)
        .ok_or_else(|| format!("`{amount}` isn't an amount; try 49 or 49.50"))?;
    let currency = currency.trim().to_uppercase();
    if currency.len() != 3 || !currency.chars().all(|c| c.is_ascii_alphabetic()) {
        return Err(format!("`{currency}` isn't a currency code like USD"));
    }
    Ok(Entry {
        uid: crate::todos::new_uid(),
        product: product.to_owned(),
        kind: Kind::Payment,
        amount_cents: Some(cents),
        currency: Some(currency),
        channel: "manual".into(),
        note: note.trim().to_owned(),
        at: now,
        updated_at: now,
        deleted: false,
    })
}

/// A post the user marks as done, for channels peeps can't read on its own.
pub fn manual_post(
    product: &str,
    channel: &str,
    note: &str,
    now: DateTime<Utc>,
) -> Result<Entry, String> {
    let channel = channel.trim().to_lowercase();
    if !CHANNELS.contains(&channel.as_str()) {
        return Err(format!(
            "`{channel}` isn't a channel peeps knows; use one of {}",
            CHANNELS.join(", ")
        ));
    }
    Ok(Entry {
        uid: crate::todos::new_uid(),
        product: product.to_owned(),
        kind: Kind::Post,
        amount_cents: None,
        currency: None,
        channel,
        note: note.trim().to_owned(),
        at: now,
        updated_at: now,
        deleted: false,
    })
}

const SCHEMA: &str = "
    CREATE TABLE IF NOT EXISTS ledger (
        uid TEXT PRIMARY KEY,
        product TEXT NOT NULL,
        kind TEXT NOT NULL,
        amount_cents INTEGER,
        currency TEXT,
        channel TEXT NOT NULL,
        note TEXT NOT NULL,
        at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0
    );
";

pub struct Ledger {
    db: Connection,
}

impl Ledger {
    pub fn open(path: &Path) -> rusqlite::Result<Self> {
        Self::init(Connection::open(path)?)
    }

    pub fn in_memory() -> rusqlite::Result<Self> {
        Self::init(Connection::open_in_memory()?)
    }

    fn init(db: Connection) -> rusqlite::Result<Self> {
        db.execute_batch(SCHEMA)?;
        Ok(Self { db })
    }

    /// Adds an entry, or leaves an imported one alone if it is already here.
    /// Returns whether it was new.
    pub fn add(&self, entry: &Entry) -> rusqlite::Result<bool> {
        let added = self.db.execute(
            "INSERT OR IGNORE INTO ledger
             (uid, product, kind, amount_cents, currency, channel, note, at, updated_at, deleted)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                entry.uid,
                entry.product,
                kind_str(entry.kind),
                entry.amount_cents,
                entry.currency,
                entry.channel,
                entry.note,
                entry.at,
                entry.updated_at,
                entry.deleted,
            ],
        )?;
        Ok(added > 0)
    }

    /// Marks an entry deleted, so the deletion reaches the other computers.
    pub fn remove(&self, uid: &str, now: DateTime<Utc>) -> rusqlite::Result<bool> {
        let changed = self.db.execute(
            "UPDATE ledger SET deleted = 1, updated_at = ?2 WHERE uid = ?1 AND deleted = 0",
            params![uid, now],
        )?;
        Ok(changed > 0)
    }

    pub fn get(&self, uid: &str) -> rusqlite::Result<Option<Entry>> {
        self.db
            .query_row(
                "SELECT * FROM ledger WHERE uid = ?1",
                params![uid],
                from_row,
            )
            .optional()
    }

    /// A product's live entries, newest first.
    pub fn recent(&self, product: &str, limit: usize) -> rusqlite::Result<Vec<Entry>> {
        let mut query = self.db.prepare(
            "SELECT * FROM ledger WHERE product = ?1 AND deleted = 0 ORDER BY at DESC LIMIT ?2",
        )?;
        let rows = query.query_map(params![product, limit as i64], from_row)?;
        rows.collect()
    }

    pub fn summary(&self, product: &str, since: DateTime<Utc>) -> rusqlite::Result<Summary> {
        let mut query = self
            .db
            .prepare("SELECT * FROM ledger WHERE product = ?1 AND deleted = 0 AND at >= ?2")?;
        let rows = query.query_map(params![product, since], from_row)?;
        let mut summary = Summary::default();
        for entry in rows {
            let entry = entry?;
            match entry.kind {
                Kind::Payment => {
                    summary.payments += 1;
                    let currency = entry.currency.clone().unwrap_or_else(|| "USD".into());
                    *summary.revenue.entry(currency).or_default() +=
                        entry.amount_cents.unwrap_or(0);
                }
                Kind::Post => {
                    *summary.posts.entry(entry.channel.clone()).or_default() += 1;
                    if summary.last_post_at.is_none_or(|last| entry.at > last) {
                        summary.last_post_at = Some(entry.at);
                    }
                }
            }
        }
        Ok(summary)
    }

    /// Every entry, deleted ones included, for the sync folder.
    pub fn records(&self) -> rusqlite::Result<Vec<Entry>> {
        let mut query = self.db.prepare("SELECT * FROM ledger")?;
        let rows = query.query_map([], from_row)?;
        rows.collect()
    }

    /// Takes in another computer's entries; the newer edit of each wins. Returns how many changed.
    pub fn apply(&self, records: &[Entry]) -> rusqlite::Result<usize> {
        let mut changed = 0;
        for record in records {
            let local: Option<DateTime<Utc>> = self
                .db
                .query_row(
                    "SELECT updated_at FROM ledger WHERE uid = ?1",
                    params![record.uid],
                    |row| row.get(0),
                )
                .optional()?;
            match local {
                None if record.deleted => continue,
                None => {
                    self.add(record)?;
                    changed += 1;
                }
                Some(local) if record.updated_at > local => {
                    self.db.execute(
                        "UPDATE ledger SET product = ?2, kind = ?3, amount_cents = ?4,
                         currency = ?5, channel = ?6, note = ?7, at = ?8, updated_at = ?9,
                         deleted = ?10 WHERE uid = ?1",
                        params![
                            record.uid,
                            record.product,
                            kind_str(record.kind),
                            record.amount_cents,
                            record.currency,
                            record.channel,
                            record.note,
                            record.at,
                            record.updated_at,
                            record.deleted,
                        ],
                    )?;
                    changed += 1;
                }
                Some(_) => {}
            }
        }
        Ok(changed)
    }
}

fn kind_str(kind: Kind) -> &'static str {
    match kind {
        Kind::Payment => "payment",
        Kind::Post => "post",
    }
}

fn from_row(row: &Row<'_>) -> rusqlite::Result<Entry> {
    let kind: String = row.get("kind")?;
    Ok(Entry {
        uid: row.get("uid")?,
        product: row.get("product")?,
        kind: if kind == "post" {
            Kind::Post
        } else {
            Kind::Payment
        },
        amount_cents: row.get("amount_cents")?,
        currency: row.get("currency")?,
        channel: row.get("channel")?,
        note: row.get("note")?,
        at: row.get("at")?,
        updated_at: row.get("updated_at")?,
        deleted: row.get("deleted")?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn at(day: u32) -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 10, day, 12, 0, 0).unwrap()
    }

    fn payment(uid: &str, cents: i64, currency: &str, day: u32) -> Entry {
        Entry {
            uid: uid.into(),
            product: "funderly".into(),
            kind: Kind::Payment,
            amount_cents: Some(cents),
            currency: Some(currency.into()),
            channel: if uid.starts_with("paypal:") {
                "paypal".into()
            } else {
                "manual".into()
            },
            note: String::new(),
            at: at(day),
            updated_at: at(day),
            deleted: false,
        }
    }

    fn post(uid: &str, channel: &str, day: u32) -> Entry {
        Entry {
            uid: uid.into(),
            product: "enigma".into(),
            kind: Kind::Post,
            amount_cents: None,
            currency: None,
            channel: channel.into(),
            note: String::new(),
            at: at(day),
            updated_at: at(day),
            deleted: false,
        }
    }

    #[test]
    fn amounts_parse_to_exact_cents() {
        assert_eq!(parse_amount("12.50"), Some(1250));
        assert_eq!(parse_amount("$1,200"), Some(120_000));
        assert_eq!(parse_amount("0.5"), Some(50));
        assert_eq!(parse_amount("9"), Some(900));
        assert_eq!(parse_amount("1.234"), None);
        assert_eq!(parse_amount("-3"), None);
        assert_eq!(parse_amount("abc"), None);
        assert_eq!(parse_amount(""), None);
    }

    #[test]
    fn manual_entries_are_checked() {
        let paid = manual_payment("funderly", "49.5", "usd", " Bank transfer ", at(14)).unwrap();
        assert_eq!(paid.amount_cents, Some(4950));
        assert_eq!(paid.currency.as_deref(), Some("USD"));
        assert_eq!(paid.note, "Bank transfer");
        assert_eq!(paid.channel, "manual");
        assert!(manual_payment("funderly", "0", "USD", "", at(14)).is_err());
        assert!(manual_payment("funderly", "10", "dollars", "", at(14)).is_err());

        let posted = manual_post("enigma", "TikTok", "Part 3 teaser", at(14)).unwrap();
        assert_eq!(posted.kind, Kind::Post);
        assert_eq!(posted.channel, "tiktok");
        assert!(manual_post("enigma", "myspace", "", at(14)).is_err());
        assert_ne!(
            posted.uid,
            manual_post("enigma", "tiktok", "", at(14)).unwrap().uid
        );
    }

    #[test]
    fn the_same_paypal_payment_counts_once() {
        let ledger = Ledger::in_memory().unwrap();
        assert!(ledger.add(&payment("paypal:7XK", 4900, "USD", 14)).unwrap());
        assert!(!ledger.add(&payment("paypal:7XK", 4900, "USD", 14)).unwrap());
        ledger.add(&payment("manual-1", 2000, "USD", 15)).unwrap();
        ledger.add(&payment("manual-2", 1500, "GBP", 16)).unwrap();
        ledger.add(&payment("old", 99_900, "USD", 1)).unwrap();

        let week = ledger.summary("funderly", at(13)).unwrap();
        assert_eq!(week.payments, 3);
        assert_eq!(week.revenue["USD"], 6900);
        assert_eq!(week.revenue["GBP"], 1500);
        assert_eq!(
            describe(&week),
            "GBP 15.00 + USD 69.00 from 3 payments; no posts"
        );
        assert_eq!(describe(&Summary::default()), "no payments; no posts");
    }

    #[test]
    fn posts_count_per_channel_with_the_latest() {
        let ledger = Ledger::in_memory().unwrap();
        ledger.add(&post("youtube:abc", "youtube", 14)).unwrap();
        ledger.add(&post("t1", "tiktok", 16)).unwrap();
        ledger.add(&post("t2", "tiktok", 15)).unwrap();
        let week = ledger.summary("enigma", at(13)).unwrap();
        assert_eq!(week.posts["tiktok"], 2);
        assert_eq!(week.posts["youtube"], 1);
        assert_eq!(week.last_post_at, Some(at(16)));
        assert_eq!(describe(&week), "no payments; posts: 2 tiktok, 1 youtube");
        assert_eq!(
            ledger.summary("funderly", at(13)).unwrap(),
            Summary::default()
        );
    }

    #[test]
    fn deletions_and_edits_travel_between_computers() {
        let mac = Ledger::in_memory().unwrap();
        let pc = Ledger::in_memory().unwrap();
        mac.add(&payment("manual-1", 2000, "USD", 15)).unwrap();
        mac.add(&payment("manual-2", 3000, "USD", 15)).unwrap();
        assert_eq!(pc.apply(&mac.records().unwrap()).unwrap(), 2);

        mac.remove("manual-1", at(16)).unwrap();
        assert_eq!(pc.apply(&mac.records().unwrap()).unwrap(), 1);
        assert!(pc.get("manual-1").unwrap().unwrap().deleted);
        assert_eq!(pc.summary("funderly", at(13)).unwrap().revenue["USD"], 3000);

        // An older copy coming back does not undo the deletion.
        let stale = payment("manual-1", 2000, "USD", 15);
        assert_eq!(pc.apply(&[stale]).unwrap(), 0);
        assert!(pc
            .recent("funderly", 10)
            .unwrap()
            .iter()
            .all(|e| e.uid != "manual-1"));
    }
}
