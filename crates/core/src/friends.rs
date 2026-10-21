//! Friends: peeps that know each other by a code and pass hearts, pokes and focus through ntfy.
//!
//! ntfy is a free public relay, so everything is sealed with a key made from the code. The relay
//! sees random-looking channel names and noise; anyone without the code sees nothing useful.

use base64::Engine;
use chrono::{DateTime, TimeDelta, Utc};
use ring::aead::{Aad, LessSafeKey, Nonce, UnboundKey, CHACHA20_POLY1305, NONCE_LEN};
use ring::digest::{digest, SHA256};
use ring::rand::{SecureRandom, SystemRandom};
use serde::{Deserialize, Serialize};

pub const RELAY: &str = "https://ntfy.sh";
/// No 0/O or 1/I, so a code read out loud or from a screenshot types back right.
const ALPHABET: &[u8] = b"23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_LEN: usize = 10;
/// A friend who said nothing for this long has stepped away.
const AROUND: TimeDelta = TimeDelta::minutes(15);
/// How often a peep tells its friends it is still here.
pub const HEARTBEAT: TimeDelta = TimeDelta::minutes(5);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Reaction {
    /// A heart puffed out of steam.
    Heart,
    /// A poke with chopsticks: "you got this".
    Poke,
    /// A bonk with a little rolling pin; the pet gets dizzy.
    Bonk,
    /// A teacup: time for a break together?
    Tea,
}

impl Reaction {
    pub fn line(self, from: &str) -> String {
        match self {
            Self::Heart => format!("{from} sent you a steamy heart"),
            Self::Poke => format!("{from} poked you with chopsticks: you got this"),
            Self::Bonk => format!("{from} bonked you with a rolling pin"),
            Self::Tea => format!("{from} is making tea. Break together?"),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Message {
    /// Sent to a new friend's inbox, so they add you back without typing your code.
    Hello { code: String, name: String },
    React {
        code: String,
        name: String,
        reaction: Reaction,
    },
    /// Posted to your own status channel for your friends to read.
    Status {
        name: String,
        focus_until: Option<DateTime<Utc>>,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Friend {
    pub code: String,
    pub name: String,
}

/// Who you are to your friends, and who they are. Kept on this computer.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Circle {
    pub code: String,
    pub name: String,
    pub friends: Vec<Friend>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Presence {
    Focusing,
    Around,
    Away,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FriendView {
    pub code: String,
    pub name: String,
    pub presence: Presence,
    pub focus_until: Option<DateTime<Utc>>,
}

/// The last thing heard from a friend.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Heard {
    pub at: Option<DateTime<Utc>>,
    pub focus_until: Option<DateTime<Utc>>,
}

impl Heard {
    pub fn presence(&self, now: DateTime<Utc>) -> Presence {
        match self.at {
            Some(at) if now - at <= AROUND => {
                if self.focus_until.is_some_and(|until| until > now) {
                    Presence::Focusing
                } else {
                    Presence::Around
                }
            }
            _ => Presence::Away,
        }
    }
}

pub fn new_code() -> String {
    let mut bytes = [0u8; CODE_LEN];
    // A failing system random source is not something to recover from quietly.
    SystemRandom::new()
        .fill(&mut bytes)
        .expect("system random source");
    let raw: String = bytes
        .iter()
        .map(|b| ALPHABET[usize::from(*b) % ALPHABET.len()] as char)
        .collect();
    format_code(&raw)
}

fn format_code(raw: &str) -> String {
    let (a, b) = raw.split_at(raw.len() / 2);
    format!("{a}-{b}")
}

/// Accepts a code however it was typed: lower case, spaces, missing dash, a leading "PEEP".
pub fn normalize(input: &str) -> Option<String> {
    let mut raw: String = input
        .chars()
        .filter(char::is_ascii_alphanumeric)
        .map(|c| c.to_ascii_uppercase())
        .collect();
    if raw.len() == CODE_LEN + 4 && raw.starts_with("PEEP") {
        raw.drain(..4);
    }
    (raw.len() == CODE_LEN && raw.bytes().all(|b| ALPHABET.contains(&b))).then(|| format_code(&raw))
}

fn hash(purpose: &str, code: &str) -> [u8; 32] {
    let mut out = [0u8; 32];
    out.copy_from_slice(digest(&SHA256, format!("peeps:{purpose}:{code}").as_bytes()).as_ref());
    out
}

/// Where messages for this code go.
pub fn inbox(code: &str) -> String {
    topic("inbox", code)
}

/// Where this code's peep says whether it is focusing.
pub fn status(code: &str) -> String {
    topic("status", code)
}

fn topic(purpose: &str, code: &str) -> String {
    let hex: String = hash(purpose, code)[..12]
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect();
    format!("peeps-{hex}")
}

fn key(code: &str) -> LessSafeKey {
    let bytes = hash("key", code);
    LessSafeKey::new(UnboundKey::new(&CHACHA20_POLY1305, &bytes).expect("32-byte key"))
}

/// Sealed with the code's key, as base64 text the relay can carry.
pub fn seal(code: &str, message: &Message) -> String {
    let mut nonce = [0u8; NONCE_LEN];
    SystemRandom::new()
        .fill(&mut nonce)
        .expect("system random source");
    let mut data = serde_json::to_vec(message).expect("messages always serialize");
    key(code)
        .seal_in_place_append_tag(Nonce::assume_unique_for_key(nonce), Aad::empty(), &mut data)
        .expect("sealing never fails for small messages");
    let mut out = nonce.to_vec();
    out.extend(data);
    base64::engine::general_purpose::STANDARD.encode(out)
}

/// None for anything not sealed with this code, which is everything a stranger could send.
pub fn open(code: &str, text: &str) -> Option<Message> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(text.trim())
        .ok()?;
    if bytes.len() <= NONCE_LEN {
        return None;
    }
    let (nonce, rest) = bytes.split_at(NONCE_LEN);
    let mut data = rest.to_vec();
    let nonce = Nonce::try_assume_unique_for_key(nonce).ok()?;
    let plain = key(code)
        .open_in_place(nonce, Aad::empty(), &mut data)
        .ok()?;
    serde_json::from_slice(plain).ok()
}

/// One message from the relay's JSON stream; keepalives and opens are skipped.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Incoming {
    pub id: String,
    pub at: DateTime<Utc>,
    pub topic: String,
    pub text: String,
}

pub fn parse_line(line: &str) -> Option<Incoming> {
    #[derive(Deserialize)]
    struct Line {
        id: String,
        time: i64,
        event: String,
        topic: String,
        message: Option<String>,
    }
    let line: Line = serde_json::from_str(line).ok()?;
    if line.event != "message" {
        return None;
    }
    Some(Incoming {
        id: line.id,
        at: DateTime::from_timestamp(line.time, 0)?,
        topic: line.topic,
        text: line.message?,
    })
}

/// The address to stream every channel from, picking up just after `since`.
pub fn stream_url(topics: &[String], since: Option<DateTime<Utc>>) -> String {
    let since = since.map_or_else(|| "15m".to_owned(), |at| at.timestamp().to_string());
    format!("{RELAY}/{}/json?since={since}", topics.join(","))
}

/// A reaction is a moment; one that arrives long after it was sent, say after a laptop slept, is skipped.
pub fn fresh(sent: DateTime<Utc>, now: DateTime<Utc>) -> bool {
    now - sent <= TimeDelta::minutes(2)
}

fn agent(read_timeout: std::time::Duration) -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout_connect(std::time::Duration::from_secs(10))
        .timeout_read(read_timeout)
        .build()
}

/// Seals a message with `code` and posts it to a channel.
pub fn post(topic: &str, code: &str, message: &Message) -> Result<(), String> {
    post_to(RELAY, topic, code, message)
}

fn post_to(relay: &str, topic: &str, code: &str, message: &Message) -> Result<(), String> {
    agent(std::time::Duration::from_secs(10))
        .post(&format!("{relay}/{topic}"))
        .send_string(&seal(code, message))
        .map(|_| ())
        .map_err(|error| format!("Couldn't reach your friend just now: {error}"))
}

/// Reads the relay's stream line by line until it drops or `keep_going` says stop.
pub fn stream(url: &str, mut keep_going: impl FnMut(&str) -> bool) -> Result<(), String> {
    use std::io::BufRead;
    // ntfy sends a keepalive every 45 seconds, so a quiet minute and a half means the line is gone.
    let response = agent(std::time::Duration::from_secs(90))
        .get(url)
        .call()
        .map_err(|error| error.to_string())?;
    for line in std::io::BufReader::new(response.into_reader()).lines() {
        let line = line.map_err(|error| error.to_string())?;
        if !keep_going(&line) {
            break;
        }
    }
    Ok(())
}

impl Circle {
    pub fn new(name: &str) -> Self {
        Self {
            code: new_code(),
            name: name.to_owned(),
            friends: Vec::new(),
        }
    }

    /// Adds a friend once; a later hello only updates their name.
    pub fn befriend(&mut self, code: &str, name: &str) -> bool {
        if code == self.code {
            return false;
        }
        if let Some(friend) = self.friends.iter_mut().find(|f| f.code == code) {
            if !name.is_empty() {
                friend.name = name.to_owned();
            }
            return false;
        }
        self.friends.push(Friend {
            code: code.to_owned(),
            name: if name.is_empty() { "A friend" } else { name }.to_owned(),
        });
        true
    }

    pub fn unfriend(&mut self, code: &str) {
        self.friends.retain(|f| f.code != code);
    }

    /// Every channel to listen on: your inbox and each friend's status.
    pub fn topics(&self) -> Vec<String> {
        std::iter::once(inbox(&self.code))
            .chain(self.friends.iter().map(|f| status(&f.code)))
            .collect()
    }

    /// The code whose key opens a message on this channel.
    pub fn code_for(&self, topic: &str) -> Option<&str> {
        if topic == inbox(&self.code) {
            return Some(&self.code);
        }
        self.friends
            .iter()
            .find(|f| status(&f.code) == topic)
            .map(|f| f.code.as_str())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codes_read_back_however_typed() {
        let code = new_code();
        assert_eq!(code.len(), CODE_LEN + 1);
        assert_eq!(normalize(&code).as_deref(), Some(code.as_str()));
        assert_eq!(
            normalize(&code.to_lowercase().replace('-', " ")).as_deref(),
            Some(code.as_str())
        );
        assert_eq!(
            normalize(&format!("PEEP-{code}")).as_deref(),
            Some(code.as_str())
        );
        assert_eq!(normalize("hello"), None);
        assert_eq!(normalize("1111111111"), None);
    }

    #[test]
    fn only_the_code_opens_a_message() {
        let message = Message::React {
            code: "ABCDE-FGHJK".into(),
            name: "Sara".into(),
            reaction: Reaction::Bonk,
        };
        let sealed = seal("ABCDE-FGHJK", &message);
        assert!(!sealed.contains("Sara"));
        assert_eq!(open("ABCDE-FGHJK", &sealed), Some(message));
        assert_eq!(open("ZZZZZ-ZZZZZ", &sealed), None);
        assert_eq!(open("ABCDE-FGHJK", "not even base64!"), None);
        // Sealing twice gives different text, so the relay can't tell repeats apart.
        assert_ne!(
            sealed,
            seal("ABCDE-FGHJK", &open("ABCDE-FGHJK", &sealed).unwrap())
        );
    }

    #[test]
    fn channels_differ_and_hide_the_code() {
        let code = "ABCDE-FGHJK";
        assert_ne!(inbox(code), status(code));
        assert!(!inbox(code).contains("ABCDE"));
        let mut circle = Circle::new("Mariyam");
        circle.code = code.into();
        assert!(circle.befriend("ZYXWV-UTSRQ", "Sara"));
        assert!(!circle.befriend("ZYXWV-UTSRQ", "Sara A"));
        assert!(!circle.befriend(code, "me"));
        assert_eq!(circle.friends[0].name, "Sara A");
        assert_eq!(circle.topics().len(), 2);
        assert_eq!(circle.code_for(&status("ZYXWV-UTSRQ")), Some("ZYXWV-UTSRQ"));
        assert_eq!(circle.code_for(&inbox(code)), Some(code));
        assert_eq!(circle.code_for(&inbox("ZYXWV-UTSRQ")), None);
    }

    #[test]
    fn reads_the_relay_stream() {
        assert_eq!(
            parse_line(r#"{"id":"a","time":1800000000,"event":"keepalive","topic":"t"}"#),
            None
        );
        let got = parse_line(
            r#"{"id":"x1","time":1800000000,"event":"message","topic":"peeps-ab","message":"c2VhbGVk"}"#,
        )
        .unwrap();
        assert_eq!(got.topic, "peeps-ab");
        assert_eq!(got.text, "c2VhbGVk");
        assert_eq!(parse_line("garbage"), None);
        let url = stream_url(&["a".into(), "b".into()], None);
        assert_eq!(url, "https://ntfy.sh/a,b/json?since=15m");
        let now = got.at;
        assert!(fresh(now, now + TimeDelta::seconds(30)));
        assert!(!fresh(now, now + TimeDelta::minutes(10)));
    }

    /// A one-shot stand-in for ntfy: answers a single request and hands back what it was sent.
    fn fake_relay(reply: &'static str) -> (String, std::thread::JoinHandle<String>) {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        let handle = std::thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            let mut request = vec![0u8; 8192];
            let n = socket.read(&mut request).unwrap();
            let mut text = String::from_utf8_lossy(&request[..n]).into_owned();
            // The body can arrive in a second packet.
            if !text.contains("\r\n\r\n") || text.ends_with("\r\n\r\n") {
                socket
                    .set_read_timeout(Some(std::time::Duration::from_millis(300)))
                    .unwrap();
                if let Ok(more) = socket.read(&mut request) {
                    text.push_str(&String::from_utf8_lossy(&request[..more]));
                }
            }
            write!(
                socket,
                "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{reply}",
                reply.len()
            )
            .unwrap();
            text
        });
        (url, handle)
    }

    #[test]
    fn posts_sealed_and_streams_lines() {
        let (url, relay) = fake_relay("{}");
        let message = Message::Status {
            name: "Sara".into(),
            focus_until: None,
        };
        post_to(&url, "peeps-x", "ABCDE-FGHJK", &message).unwrap();
        let request = relay.join().unwrap();
        assert!(request.starts_with("POST /peeps-x "));
        let body = request.split("\r\n\r\n").nth(1).unwrap();
        assert_eq!(open("ABCDE-FGHJK", body), Some(message));

        let (url, relay) = fake_relay("{\"event\":\"open\"}\nline two\n");
        let mut lines = Vec::new();
        stream(&url, |line| {
            lines.push(line.to_owned());
            true
        })
        .unwrap();
        relay.join().unwrap();
        assert_eq!(lines, ["{\"event\":\"open\"}", "line two"]);
    }

    #[test]
    fn presence_follows_what_was_heard() {
        let now = DateTime::from_timestamp(1_800_000_000, 0).unwrap();
        assert_eq!(Heard::default().presence(now), Presence::Away);
        let heard = Heard {
            at: Some(now - TimeDelta::minutes(2)),
            focus_until: Some(now + TimeDelta::minutes(10)),
        };
        assert_eq!(heard.presence(now), Presence::Focusing);
        assert_eq!(
            heard.presence(now + TimeDelta::minutes(11)),
            Presence::Around
        );
        assert_eq!(heard.presence(now + TimeDelta::minutes(30)), Presence::Away);
    }
}
