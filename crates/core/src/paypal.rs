//! Payments received through the user's own PayPal account, read with a REST app they create at
//! developer.paypal.com. Only completed, incoming payments are counted.

use std::time::Duration;

use chrono::{DateTime, TimeDelta, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::numbers::{Entry, Kind};

pub const CLIENT_ID: &str = "paypal-client-id";
pub const SECRET: &str = "paypal-secret";

/// Which product PayPal payments belong to. The app's keys live in the keychain.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all(serialize = "camelCase"))]
pub struct Settings {
    pub product: String,
    /// Sandbox keys talk to PayPal's test servers.
    #[serde(default)]
    pub sandbox: bool,
}

fn base(sandbox: bool) -> &'static str {
    if sandbox {
        "https://api-m.sandbox.paypal.com"
    } else {
        "https://api-m.paypal.com"
    }
}

const TIMEOUT: Duration = Duration::from_secs(30);

/// PayPal's reporting API reaches back at most 31 days per request.
pub const WINDOW_DAYS: i64 = 30;

/// Trades the app's keys for an access token, which also proves the keys work.
pub fn token(client_id: &str, secret: &str, sandbox: bool) -> Result<String, String> {
    let response = ureq::post(&format!("{}/v1/oauth2/token", base(sandbox)))
        .timeout(TIMEOUT)
        .set(
            "Authorization",
            &format!("Basic {}", basic(client_id, secret)),
        )
        .send_form(&[("grant_type", "client_credentials")]);
    let body: Value = match response {
        Ok(response) => response.into_json().map_err(|e| e.to_string())?,
        Err(ureq::Error::Status(401, _)) => {
            return Err("PayPal didn't accept the client ID and secret".into())
        }
        Err(error) => return Err(format!("could not reach PayPal: {error}")),
    };
    body["access_token"]
        .as_str()
        .map(str::to_owned)
        .ok_or_else(|| "PayPal sent no access token".into())
}

/// Completed incoming payments in the last `WINDOW_DAYS`, as ledger entries for `product`.
pub fn payments(
    token: &str,
    sandbox: bool,
    product: &str,
    now: DateTime<Utc>,
) -> Result<Vec<Entry>, String> {
    let start = now - TimeDelta::days(WINDOW_DAYS);
    let mut entries = Vec::new();
    let mut page = 1;
    loop {
        let response = ureq::get(&format!("{}/v1/reporting/transactions", base(sandbox)))
            .timeout(TIMEOUT)
            .set("Authorization", &format!("Bearer {token}"))
            .query(
                "start_date",
                &start.format("%Y-%m-%dT%H:%M:%SZ").to_string(),
            )
            .query("end_date", &now.format("%Y-%m-%dT%H:%M:%SZ").to_string())
            .query("fields", "transaction_info,payer_info")
            .query("page_size", "100")
            .query("page", &page.to_string())
            .call();
        let body: Value = match response {
            Ok(response) => response.into_json().map_err(|e| e.to_string())?,
            Err(ureq::Error::Status(403, _)) => {
                return Err(
                    "the PayPal app needs the Transaction Search feature; tick it in the app's settings"
                        .into(),
                )
            }
            Err(error) => return Err(format!("could not read PayPal transactions: {error}")),
        };
        entries.extend(parse(&body, product, now));
        let pages = body["total_pages"].as_i64().unwrap_or(1);
        if page >= pages {
            break;
        }
        page += 1;
    }
    Ok(entries)
}

/// Reads one page of PayPal's transaction report.
pub fn parse(body: &Value, product: &str, now: DateTime<Utc>) -> Vec<Entry> {
    let Some(details) = body["transaction_details"].as_array() else {
        return Vec::new();
    };
    details
        .iter()
        .filter_map(|detail| {
            let info = &detail["transaction_info"];
            // S is success; pending, denied and reversed payments aren't revenue yet.
            if info["transaction_status"].as_str() != Some("S") {
                return None;
            }
            let id = info["transaction_id"].as_str()?;
            let amount = &info["transaction_amount"];
            let cents = crate::numbers::parse_amount(amount["value"].as_str()?)?;
            if cents == 0 {
                return None;
            }
            let at = info["transaction_initiation_date"]
                .as_str()
                .and_then(parse_time)
                .unwrap_or(now);
            let payer = &detail["payer_info"];
            let note = payer["payer_name"]["alternate_full_name"]
                .as_str()
                .or_else(|| payer["email_address"].as_str())
                .unwrap_or_default();
            Some(Entry {
                uid: format!("paypal:{id}"),
                product: product.to_owned(),
                kind: Kind::Payment,
                amount_cents: Some(cents),
                currency: amount["currency_code"].as_str().map(str::to_owned),
                channel: "paypal".into(),
                note: note.to_owned(),
                at,
                updated_at: at,
                deleted: false,
            })
        })
        .collect()
}

/// PayPal writes offsets without a colon, like `2026-10-14T09:00:00+0000`.
fn parse_time(text: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(text)
        .or_else(|_| DateTime::parse_from_str(text, "%Y-%m-%dT%H:%M:%S%z"))
        .ok()
        .map(|at| at.with_timezone(&Utc))
}

fn basic(user: &str, password: &str) -> String {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let bytes = format!("{user}:{password}").into_bytes();
    let mut out = String::new();
    for chunk in bytes.chunks(3) {
        let n = chunk
            .iter()
            .enumerate()
            .fold(0u32, |n, (i, byte)| n | (u32::from(*byte) << (16 - 8 * i)));
        for i in 0..4 {
            if i <= chunk.len() {
                out.push(ALPHABET[(n >> (18 - 6 * i) & 63) as usize] as char);
            } else {
                out.push('=');
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn keeps_completed_incoming_payments() {
        let now = Utc::now();
        let body = json!({
            "transaction_details": [
                {
                    "transaction_info": {
                        "transaction_id": "7XK41",
                        "transaction_status": "S",
                        "transaction_amount": { "currency_code": "USD", "value": "49.00" },
                        "transaction_initiation_date": "2026-10-14T09:00:00+0000"
                    },
                    "payer_info": { "payer_name": { "alternate_full_name": "Sara Bright" } }
                },
                {
                    "transaction_info": {
                        "transaction_id": "PENDING1",
                        "transaction_status": "P",
                        "transaction_amount": { "currency_code": "USD", "value": "20.00" }
                    }
                },
                {
                    "transaction_info": {
                        "transaction_id": "FEE1",
                        "transaction_status": "S",
                        "transaction_amount": { "currency_code": "USD", "value": "-1.72" }
                    }
                }
            ],
            "total_pages": 1
        });
        let entries = parse(&body, "funderly", now);
        assert_eq!(entries.len(), 1);
        let sara = &entries[0];
        assert_eq!(sara.uid, "paypal:7XK41");
        assert_eq!(sara.amount_cents, Some(4900));
        assert_eq!(sara.currency.as_deref(), Some("USD"));
        assert_eq!(sara.note, "Sara Bright");
        assert_eq!(sara.at.to_rfc3339(), "2026-10-14T09:00:00+00:00");
        assert!(parse(&json!({}), "funderly", now).is_empty());
    }

    #[test]
    fn encodes_basic_auth() {
        assert_eq!(basic("id", "secret"), "aWQ6c2VjcmV0");
        assert_eq!(basic("a", "b"), "YTpi");
        assert_eq!(basic("ab", "c"), "YWI6Yw==");
    }
}
