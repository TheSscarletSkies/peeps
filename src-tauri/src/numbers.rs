//! Pulls payments from PayPal and uploads from YouTube into the ledger, with the user's own keys.

use std::sync::Arc;
use std::time::Duration;

use chrono::{TimeDelta, Utc};
use peeps_core::checks::Secrets;
use peeps_core::numbers::{self, Entry};
use peeps_core::{paypal, youtube};

use crate::secrets::Keychain;
use crate::state::App;

const EVERY: Duration = Duration::from_secs(30 * 60);

pub async fn run(app: Arc<App>) {
    let mut interval = tokio::time::interval(EVERY);
    loop {
        interval.tick().await;
        refresh(app.clone()).await;
    }
}

/// Reads both sources now. Errors are kept for the Numbers page rather than interrupting.
pub async fn refresh(app: Arc<App>) {
    let worker = app.clone();
    let _ = tauri::async_runtime::spawn_blocking(move || pull(&worker)).await;
    app.publish();
}

fn pull(app: &App) {
    let config = app.config();
    let now = Utc::now();
    let mut errors = Vec::new();
    let mut fresh: Vec<Entry> = Vec::new();

    let paypal_keys = Keychain
        .get(paypal::CLIENT_ID)
        .zip(Keychain.get(paypal::SECRET));
    if let (Some(settings), Some((id, secret))) = (&config.paypal, &paypal_keys) {
        match paypal::token(id, secret, settings.sandbox)
            .and_then(|token| paypal::payments(&token, settings.sandbox, &settings.product, now))
        {
            Ok(entries) => fresh.extend(entries),
            Err(error) => errors.push(format!("PayPal: {error}")),
        }
    }

    let youtube_key = Keychain.get(youtube::KEY);
    if let Some(key) = &youtube_key {
        for product in &config.products {
            let Some(channel) = &product.youtube_channel else {
                continue;
            };
            match youtube::uploads(key, channel, &product.id) {
                Ok(entries) => fresh.extend(entries),
                Err(error) => errors.push(format!("YouTube ({}): {error}", product.name)),
            }
        }
    }

    let mut added = Vec::new();
    {
        let ledger = app.ledger();
        for entry in fresh {
            if ledger.add(&entry).unwrap_or(false) {
                added.push(entry);
            }
        }
    }
    // A first read, or a newly connected account, brings in a month of history; only payments
    // since the last look are news. PayPal lists a payment a few hours late, hence the margin.
    let since = app
        .world()
        .numbers
        .last_checked
        .map(|at| at - TimeDelta::hours(6));
    if let Some(since) = since {
        for entry in added
            .iter()
            .filter(|e| e.amount_cents.is_some() && e.at >= since)
        {
            let name = config
                .product(&entry.product)
                .map(|p| p.name.clone())
                .unwrap_or_default();
            app.notify(
                &format!(
                    "{name}: {} received",
                    numbers::money(
                        entry.amount_cents.unwrap_or(0),
                        entry.currency.as_deref().unwrap_or("USD")
                    )
                ),
                &entry.note,
            );
        }
    }

    let mut world = app.world();
    world.numbers.paypal_ready = config.paypal.is_some() && paypal_keys.is_some();
    world.numbers.youtube_ready = youtube_key.is_some();
    world.numbers.last_checked = Some(now);
    world.numbers.error = (!errors.is_empty()).then(|| errors.join(" · "));
}
