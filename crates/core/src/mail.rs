//! Email through the user's own Gmail or iCloud account. Nothing is sent until the user approves it,
//! and sent mail is watched for replies so the helper can say who hasn't answered.

use std::path::Path;
use std::time::Duration;

use chrono::{DateTime, Utc};
use lettre::message::header::ContentType;
use lettre::message::Mailbox;
use lettre::transport::smtp::authentication::Credentials;
use lettre::{Message, SmtpTransport, Transport};
use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};

/// Where each provider's servers are. Each needs an app password, made in the account's security settings.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Provider {
    #[default]
    Gmail,
    Icloud,
}

pub struct Servers {
    pub imap: &'static str,
    pub smtp: &'static str,
    /// Port 465 speaks TLS from the start; 587 upgrades with STARTTLS.
    pub smtp_port: u16,
}

impl Provider {
    pub fn servers(self) -> Servers {
        match self {
            Self::Gmail => Servers {
                imap: "imap.gmail.com",
                smtp: "smtp.gmail.com",
                smtp_port: 465,
            },
            Self::Icloud => Servers {
                imap: "imap.mail.me.com",
                smtp: "smtp.mail.me.com",
                smtp_port: 587,
            },
        }
    }
}

/// An account as written in the config. Its app password lives in the keychain.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct Account {
    pub address: String,
    #[serde(default)]
    pub provider: Provider,
    /// The name people see the mail from, like "Mariyam at Funderly".
    #[serde(default)]
    pub name: String,
    /// The mailbox that signs in, when `address` is an alias of it: a work address added to a
    /// personal Gmail with "Send mail as", or a custom domain on iCloud.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub login: String,
}

impl Account {
    fn mailbox(&self) -> &str {
        if self.login.trim().is_empty() {
            &self.address
        } else {
            self.login.trim()
        }
    }

    pub fn smtp_login(&self) -> String {
        self.mailbox().to_owned()
    }

    /// iCloud's mail server wants the name part of the address; Apple's own setup guide says so.
    pub fn imap_login(&self) -> String {
        let mailbox = self.mailbox();
        match self.provider {
            Provider::Gmail => mailbox.to_owned(),
            Provider::Icloud => mailbox.split('@').next().unwrap_or(mailbox).to_owned(),
        }
    }
}

/// The keychain entry for an account's app password.
pub fn secret_name(address: &str) -> String {
    format!("mail-{}", address.to_lowercase())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Status {
    /// Waiting for the user to approve.
    Pending,
    Sent,
    Failed,
    Discarded,
}

impl Status {
    fn parse(text: &str) -> Self {
        match text {
            "sent" => Self::Sent,
            "failed" => Self::Failed,
            "discarded" => Self::Discarded,
            _ => Self::Pending,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Email {
    pub id: i64,
    /// The account it goes from.
    pub from: String,
    pub to: String,
    pub subject: String,
    pub body: String,
    /// The Message-ID of the mail this answers, so it threads.
    pub in_reply_to: Option<String>,
    pub status: Status,
    pub message_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub sent_at: Option<DateTime<Utc>>,
    pub replied_at: Option<DateTime<Utc>>,
    pub error: Option<String>,
}

/// What a draft says, before it has an id.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Draft {
    pub from: String,
    pub to: String,
    pub subject: String,
    pub body: String,
    #[serde(default)]
    pub in_reply_to: Option<String>,
}

const SCHEMA: &str = "
    CREATE TABLE IF NOT EXISTS mail (
        id INTEGER PRIMARY KEY,
        sender TEXT NOT NULL,
        recipient TEXT NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        in_reply_to TEXT,
        status TEXT NOT NULL,
        message_id TEXT,
        created_at TEXT NOT NULL,
        sent_at TEXT,
        replied_at TEXT,
        error TEXT
    );
";

const COLUMNS: &str = "id, sender, recipient, subject, body, in_reply_to, status, message_id, \
                       created_at, sent_at, replied_at, error";

pub struct MailStore {
    db: Connection,
}

impl MailStore {
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

    /// Holds a draft for the user to approve.
    pub fn draft(&self, draft: &Draft, now: DateTime<Utc>) -> rusqlite::Result<Email> {
        self.db.execute(
            "INSERT INTO mail (sender, recipient, subject, body, in_reply_to, status, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, 'pending', ?6)",
            params![
                draft.from,
                draft.to.trim(),
                draft.subject.trim(),
                draft.body,
                draft.in_reply_to,
                now
            ],
        )?;
        Ok(self
            .get(self.db.last_insert_rowid())?
            .expect("just inserted"))
    }

    /// The user's last edits before sending.
    pub fn revise(&self, id: i64, draft: &Draft) -> rusqlite::Result<bool> {
        Ok(self.db.execute(
            "UPDATE mail SET sender = ?1, recipient = ?2, subject = ?3, body = ?4
             WHERE id = ?5 AND status IN ('pending', 'failed')",
            params![
                draft.from,
                draft.to.trim(),
                draft.subject.trim(),
                draft.body,
                id
            ],
        )? > 0)
    }

    pub fn mark_sent(&self, id: i64, message_id: &str, at: DateTime<Utc>) -> rusqlite::Result<()> {
        self.db.execute(
            "UPDATE mail SET status = 'sent', message_id = ?2, sent_at = ?3, error = NULL WHERE id = ?1",
            params![id, message_id, at],
        )?;
        Ok(())
    }

    pub fn mark_failed(&self, id: i64, error: &str) -> rusqlite::Result<()> {
        self.db.execute(
            "UPDATE mail SET status = 'failed', error = ?2 WHERE id = ?1",
            params![id, error],
        )?;
        Ok(())
    }

    pub fn discard(&self, id: i64) -> rusqlite::Result<bool> {
        Ok(self.db.execute(
            "UPDATE mail SET status = 'discarded' WHERE id = ?1 AND status != 'sent'",
            params![id],
        )? > 0)
    }

    pub fn mark_replied(&self, id: i64, at: DateTime<Utc>) -> rusqlite::Result<()> {
        self.db.execute(
            "UPDATE mail SET replied_at = ?2 WHERE id = ?1 AND replied_at IS NULL",
            params![id, at],
        )?;
        Ok(())
    }

    pub fn get(&self, id: i64) -> rusqlite::Result<Option<Email>> {
        self.db
            .query_row(
                &format!("SELECT {COLUMNS} FROM mail WHERE id = ?1"),
                params![id],
                from_row,
            )
            .optional()
    }

    /// Drafts waiting for approval and ones that failed to send, oldest first.
    pub fn outbox(&self) -> rusqlite::Result<Vec<Email>> {
        self.list("status IN ('pending', 'failed') ORDER BY id")
    }

    /// Sent mail with no reply yet, oldest first: who hasn't answered.
    pub fn awaiting(&self, since: DateTime<Utc>) -> rusqlite::Result<Vec<Email>> {
        let mut query = self.db.prepare(&format!(
            "SELECT {COLUMNS} FROM mail
             WHERE status = 'sent' AND replied_at IS NULL AND sent_at >= ?1 ORDER BY sent_at"
        ))?;
        let rows = query.query_map(params![since], from_row)?;
        rows.collect()
    }

    pub fn recent_sent(&self, limit: usize) -> rusqlite::Result<Vec<Email>> {
        self.list(&format!(
            "status = 'sent' ORDER BY sent_at DESC LIMIT {}",
            limit as i64
        ))
    }

    fn list(&self, filter: &str) -> rusqlite::Result<Vec<Email>> {
        let mut query = self
            .db
            .prepare(&format!("SELECT {COLUMNS} FROM mail WHERE {filter}"))?;
        let rows = query.query_map([], from_row)?;
        rows.collect()
    }
}

fn from_row(row: &Row<'_>) -> rusqlite::Result<Email> {
    Ok(Email {
        id: row.get(0)?,
        from: row.get(1)?,
        to: row.get(2)?,
        subject: row.get(3)?,
        body: row.get(4)?,
        in_reply_to: row.get(5)?,
        status: Status::parse(&row.get::<_, String>(6)?),
        message_id: row.get(7)?,
        created_at: row.get(8)?,
        sent_at: row.get(9)?,
        replied_at: row.get(10)?,
        error: row.get(11)?,
    })
}

/// A Message-ID on the sender's own domain, so replies can be matched to it later.
pub fn new_message_id(from: &str) -> String {
    let domain = from.rsplit('@').next().unwrap_or("peeps.local");
    format!("<{}@{domain}>", crate::todos::new_uid())
}

/// Builds the message exactly as it will be sent.
pub fn build(account: &Account, email: &Email, message_id: &str) -> Result<Message, String> {
    let from = Mailbox::new(
        Some(account.name.trim().to_owned()).filter(|name| !name.is_empty()),
        account
            .address
            .parse()
            .map_err(|_| format!("`{}` is not an email address", account.address))?,
    );
    let mut builder = Message::builder()
        .from(from)
        .subject(email.subject.clone())
        .message_id(Some(message_id.to_owned()))
        .header(ContentType::TEXT_PLAIN);
    for recipient in email
        .to
        .split([',', ';'])
        .map(str::trim)
        .filter(|r| !r.is_empty())
    {
        builder = builder.to(recipient
            .parse()
            .map_err(|_| format!("`{recipient}` is not an email address"))?);
    }
    if let Some(parent) = &email.in_reply_to {
        builder = builder
            .in_reply_to(parent.clone())
            .references(parent.clone());
    }
    builder
        .body(email.body.clone())
        .map_err(|error| error.to_string())
}

const NETWORK_TIMEOUT: Duration = Duration::from_secs(30);

/// Sends through the account's own server and returns the Message-ID used.
pub fn send(account: &Account, password: &str, email: &Email) -> Result<String, String> {
    let message_id = new_message_id(&account.address);
    let message = build(account, email, &message_id)?;
    let servers = account.provider.servers();
    let credentials = Credentials::new(account.smtp_login(), password.to_owned());
    let transport = if servers.smtp_port == 465 {
        SmtpTransport::relay(servers.smtp)
    } else {
        SmtpTransport::starttls_relay(servers.smtp)
    }
    .map_err(|error| error.to_string())?
    .port(servers.smtp_port)
    .credentials(credentials)
    .timeout(Some(NETWORK_TIMEOUT))
    .build();
    transport.send(&message).map_err(|error| {
        if error.to_string().contains("535") || error.to_string().contains("534") {
            "the app password was not accepted; make a new one and add it again".to_owned()
        } else {
            format!("could not send: {error}")
        }
    })?;
    Ok(message_id)
}

/// Signs in to check the account works, without sending anything.
pub fn check_login(account: &Account, password: &str) -> Result<(), String> {
    let mut session = open_inbox(account, password)?;
    let _ = session.logout();
    Ok(())
}

fn open_inbox(
    account: &Account,
    password: &str,
) -> Result<imap::Session<imap::Connection>, String> {
    let client = imap::ClientBuilder::new(account.provider.servers().imap, 993)
        .connect()
        .map_err(|error| format!("could not reach the mail server: {error}"))?;
    let mut session =
        client
            .login(account.imap_login(), password)
            .map_err(|(error, _)| match error {
                imap::Error::No(_) | imap::Error::Bad(_) => {
                    "the address or app password was not accepted".to_owned()
                }
                other => other.to_string(),
            })?;
    session
        .select("INBOX")
        .map_err(|error| format!("could not open the inbox: {error}"))?;
    Ok(session)
}

/// Which of these sent messages have a reply in the inbox.
pub fn replied(account: &Account, password: &str, sent: &[Email]) -> Result<Vec<i64>, String> {
    if sent.is_empty() {
        return Ok(Vec::new());
    }
    let mut session = open_inbox(account, password)?;
    let mut found = Vec::new();
    for email in sent {
        let Some(id) = &email.message_id else {
            continue;
        };
        let query = format!("HEADER In-Reply-To \"{}\"", id.replace('"', ""));
        if session
            .uid_search(&query)
            .is_ok_and(|hits| !hits.is_empty())
        {
            found.push(email.id);
        }
    }
    let _ = session.logout();
    Ok(found)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn account() -> Account {
        Account {
            address: "hello@funderly.app".into(),
            provider: Provider::Gmail,
            name: "Mariyam at Funderly".into(),
            login: String::new(),
        }
    }

    fn draft(to: &str) -> Draft {
        Draft {
            from: "hello@funderly.app".into(),
            to: to.into(),
            subject: " Welcome to Funderly ".into(),
            body: "Hi Sara,\n\nThanks for signing up.".into(),
            in_reply_to: None,
        }
    }

    #[test]
    fn drafts_wait_for_approval_then_track_replies() {
        let store = MailStore::in_memory().unwrap();
        let now = Utc::now();
        let email = store.draft(&draft("sara@example.com"), now).unwrap();
        assert_eq!(email.status, Status::Pending);
        assert_eq!(email.subject, "Welcome to Funderly");
        assert_eq!(store.outbox().unwrap().len(), 1);

        assert!(store
            .revise(
                email.id,
                &Draft {
                    subject: "Welcome!".into(),
                    ..draft("sara@example.com")
                }
            )
            .unwrap());
        store.mark_sent(email.id, "<a@funderly.app>", now).unwrap();
        assert!(store.outbox().unwrap().is_empty());
        // Sent mail can no longer be edited or thrown away.
        assert!(!store.revise(email.id, &draft("x@example.com")).unwrap());
        assert!(!store.discard(email.id).unwrap());

        let waiting = store.awaiting(now - chrono::TimeDelta::days(1)).unwrap();
        assert_eq!(waiting.len(), 1);
        assert_eq!(waiting[0].subject, "Welcome!");
        store.mark_replied(email.id, now).unwrap();
        assert!(store
            .awaiting(now - chrono::TimeDelta::days(1))
            .unwrap()
            .is_empty());
    }

    #[test]
    fn failures_stay_in_the_outbox_with_the_reason() {
        let store = MailStore::in_memory().unwrap();
        let email = store.draft(&draft("sara@example.com"), Utc::now()).unwrap();
        store.mark_failed(email.id, "could not send").unwrap();
        let outbox = store.outbox().unwrap();
        assert_eq!(outbox[0].status, Status::Failed);
        assert_eq!(outbox[0].error.as_deref(), Some("could not send"));
        assert!(store.discard(email.id).unwrap());
        assert!(store.outbox().unwrap().is_empty());
    }

    #[test]
    fn builds_a_threaded_plain_text_message() {
        let store = MailStore::in_memory().unwrap();
        let mut email = store
            .draft(&draft("sara@example.com, tom@example.com"), Utc::now())
            .unwrap();
        email.in_reply_to = Some("<orig@example.com>".into());
        let message = build(&account(), &email, "<new@funderly.app>").unwrap();
        let raw = String::from_utf8(message.formatted()).unwrap();
        assert!(raw.contains("From: \"Mariyam at Funderly\" <hello@funderly.app>"));
        assert!(raw.contains("sara@example.com"));
        assert!(raw.contains("tom@example.com"));
        assert!(raw.contains("Message-ID: <new@funderly.app>"));
        assert!(raw.contains("In-Reply-To: <orig@example.com>"));
        assert!(raw.contains("Thanks for signing up."));

        email.to = "not an address".into();
        assert!(build(&account(), &email, "<x@y>")
            .unwrap_err()
            .contains("not an email address"));
    }

    #[test]
    fn providers_know_their_servers_and_logins() {
        assert_eq!(Provider::Gmail.servers().smtp_port, 465);
        assert_eq!(Provider::Icloud.servers().imap, "imap.mail.me.com");
        let icloud = Account {
            address: "mariyam@icloud.com".into(),
            provider: Provider::Icloud,
            name: String::new(),
            login: String::new(),
        };
        assert_eq!(icloud.imap_login(), "mariyam");
        assert_eq!(icloud.smtp_login(), "mariyam@icloud.com");
        let alias = Account {
            login: "mariyam.personal@gmail.com".into(),
            ..account()
        };
        assert_eq!(alias.imap_login(), "mariyam.personal@gmail.com");
        assert_eq!(alias.smtp_login(), "mariyam.personal@gmail.com");
        assert_eq!(account().smtp_login(), "hello@funderly.app");
        assert_eq!(secret_name("Hello@Funderly.app"), "mail-hello@funderly.app");
        assert!(new_message_id("hello@funderly.app").ends_with("@funderly.app>"));
    }
}
