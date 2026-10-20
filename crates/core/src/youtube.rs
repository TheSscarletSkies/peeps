//! A channel's latest uploads, read with a free YouTube Data API key. Each upload becomes a post.

use std::time::Duration;

use chrono::{DateTime, Utc};
use serde_json::Value;

use crate::numbers::{Entry, Kind};

pub const KEY: &str = "youtube-key";

const TIMEOUT: Duration = Duration::from_secs(20);

/// Every channel has an "uploads" playlist whose id swaps the channel's `UC` for `UU`.
pub fn uploads_playlist(channel: &str) -> Option<String> {
    let channel = channel.trim();
    channel
        .strip_prefix("UC")
        .filter(|rest| !rest.is_empty())
        .map(|rest| format!("UU{rest}"))
}

/// Takes a channel id or a channel link and returns the id, if it has one.
pub fn channel_id(text: &str) -> Option<String> {
    let text = text.trim().trim_end_matches('/');
    let id = text.rsplit('/').next().unwrap_or(text);
    (id.starts_with("UC") && id.len() == 24).then(|| id.to_owned())
}

pub fn uploads(key: &str, channel: &str, product: &str) -> Result<Vec<Entry>, String> {
    let playlist =
        uploads_playlist(channel).ok_or_else(|| format!("`{channel}` is not a channel id"))?;
    let response = ureq::get("https://www.googleapis.com/youtube/v3/playlistItems")
        .timeout(TIMEOUT)
        .query("part", "snippet,contentDetails")
        .query("playlistId", &playlist)
        .query("maxResults", "10")
        .query("key", key)
        .call();
    let body: Value = match response {
        Ok(response) => response.into_json().map_err(|e| e.to_string())?,
        Err(ureq::Error::Status(400 | 403, _)) => {
            return Err("YouTube didn't accept the API key".into())
        }
        Err(ureq::Error::Status(404, _)) => return Err("YouTube couldn't find that channel".into()),
        Err(error) => return Err(format!("could not reach YouTube: {error}")),
    };
    Ok(parse(&body, product))
}

pub fn parse(body: &Value, product: &str) -> Vec<Entry> {
    let Some(items) = body["items"].as_array() else {
        return Vec::new();
    };
    items
        .iter()
        .filter_map(|item| {
            let id = item["contentDetails"]["videoId"].as_str()?;
            let at = item["contentDetails"]["videoPublishedAt"]
                .as_str()
                .or_else(|| item["snippet"]["publishedAt"].as_str())
                .and_then(|text| DateTime::parse_from_rfc3339(text).ok())?
                .with_timezone(&Utc);
            Some(Entry {
                uid: format!("youtube:{id}"),
                product: product.to_owned(),
                kind: Kind::Post,
                amount_cents: None,
                currency: None,
                channel: "youtube".into(),
                note: item["snippet"]["title"]
                    .as_str()
                    .unwrap_or_default()
                    .to_owned(),
                at,
                updated_at: at,
                deleted: false,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn finds_the_uploads_playlist_and_channel_ids() {
        assert_eq!(
            uploads_playlist("UCabcdefghijklmnopqrstuv").as_deref(),
            Some("UUabcdefghijklmnopqrstuv")
        );
        assert_eq!(uploads_playlist("@enigma"), None);
        assert_eq!(
            channel_id("https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv/").as_deref(),
            Some("UCabcdefghijklmnopqrstuv")
        );
        assert_eq!(channel_id("https://youtube.com/@enigmaarchives"), None);
    }

    #[test]
    fn uploads_become_posts() {
        let body = json!({ "items": [
            {
                "snippet": { "title": "The Lighthouse Letters, part 3", "publishedAt": "2026-10-15T18:00:00Z" },
                "contentDetails": { "videoId": "dQw4", "videoPublishedAt": "2026-10-15T17:59:00Z" }
            },
            { "snippet": { "title": "Private video" }, "contentDetails": {} }
        ]});
        let posts = parse(&body, "enigma");
        assert_eq!(posts.len(), 1);
        assert_eq!(posts[0].uid, "youtube:dQw4");
        assert_eq!(posts[0].channel, "youtube");
        assert_eq!(posts[0].note, "The Lighthouse Letters, part 3");
        assert_eq!(posts[0].at.to_rfc3339(), "2026-10-15T17:59:00+00:00");
    }
}
