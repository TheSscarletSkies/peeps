//! Sends approved email and watches for replies, all through the user's own accounts.

use std::sync::Arc;
use std::time::Duration;

use chrono::{TimeDelta, Utc};
use peeps_core::checks::Secrets;
use peeps_core::mail::{self, Account, Draft, Email};

use crate::secrets::Keychain;
use crate::state::{App, AWAITING_DAYS};

type Result<T> = std::result::Result<T, String>;

const EVERY: Duration = Duration::from_secs(10 * 60);

fn password(account: &Account) -> Option<String> {
    Keychain.get(&mail::secret_name(&account.address))
}

fn account(app: &App, address: &str) -> Result<Account> {
    app.config()
        .mail
        .iter()
        .find(|account| account.address.eq_ignore_ascii_case(address))
        .cloned()
        .ok_or_else(|| format!("`{address}` is not one of your mail accounts"))
}

/// Sends a draft the user approved, with their last edits.
pub async fn send(app: Arc<App>, id: i64, edits: Draft) -> Result<Email> {
    app.mail().revise(id, &edits).map_err(|e| e.to_string())?;
    let email = app
        .mail()
        .get(id)
        .map_err(|e| e.to_string())?
        .ok_or("that email is gone")?;
    let account = account(&app, &email.from)?;
    let secret = password(&account).ok_or_else(|| {
        format!(
            "add the app password for {} on this computer first, under Mail",
            account.address
        )
    })?;
    let outgoing = email.clone();
    let result =
        tauri::async_runtime::spawn_blocking(move || mail::send(&account, &secret, &outgoing))
            .await
            .map_err(|e| e.to_string())?;
    match result {
        Ok(message_id) => {
            app.mail()
                .mark_sent(id, &message_id, Utc::now())
                .map_err(|e| e.to_string())?;
        }
        Err(error) => {
            app.mail()
                .mark_failed(id, &error)
                .map_err(|e| e.to_string())?;
            app.publish();
            return Err(error);
        }
    }
    app.publish();
    app.mail()
        .get(id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "that email is gone".into())
}

/// Checks each account for replies, and which accounts have a password on this computer.
pub async fn run(app: Arc<App>) {
    let mut interval = tokio::time::interval(EVERY);
    loop {
        interval.tick().await;
        let worker = app.clone();
        let changed = tauri::async_runtime::spawn_blocking(move || check(&worker))
            .await
            .unwrap_or(false);
        if changed {
            app.publish();
        }
    }
}

/// Re-reads which accounts are ready right away, for after one is added or removed.
pub fn refresh_ready(app: &App) {
    let ready = app
        .config()
        .mail
        .iter()
        .filter(|account| password(account).is_some())
        .map(|account| account.address.clone())
        .collect();
    app.world().mail_ready = ready;
}

fn check(app: &App) -> bool {
    refresh_ready(app);
    let awaiting = app
        .mail()
        .awaiting(Utc::now() - TimeDelta::days(AWAITING_DAYS))
        .unwrap_or_default();
    let mut changed = false;
    for account in &app.config().mail {
        let Some(secret) = password(account) else {
            continue;
        };
        let mine: Vec<Email> = awaiting
            .iter()
            .filter(|email| email.from.eq_ignore_ascii_case(&account.address))
            .cloned()
            .collect();
        match mail::replied(account, &secret, &mine) {
            Ok(replied) => {
                for id in replied {
                    let _ = app.mail().mark_replied(id, Utc::now());
                    if let Some(email) = mine.iter().find(|email| email.id == id) {
                        app.notify(&format!("{} replied", email.to), &email.subject);
                    }
                    changed = true;
                }
            }
            Err(error) => eprintln!(
                "peeps: could not check {} for replies: {error}",
                account.address
            ),
        }
    }
    changed
}
