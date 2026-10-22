//! Two peeps studying together through a stand-in for ntfy that speaks the same HTTP: messages are
//! published with a POST to /<topic> and read back with GET /<t1>,<t2>/json?since=15m.

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use chrono::{TimeDelta, Utc};
use peeps_core::config::Wear;
use peeps_core::friends::{self, Circle, Heard, Message, Presence, Reaction, Received};

#[derive(Default)]
struct Store {
    messages: Vec<(String, i64, String, String)>,
}

/// Answers each request on its own thread, like ntfy: POST stores, GET replays the topics asked for.
fn relay() -> String {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let store = Arc::new(Mutex::new(Store::default()));
    std::thread::spawn(move || {
        for socket in listener.incoming().flatten() {
            let store = Arc::clone(&store);
            std::thread::spawn(move || serve(socket, &store));
        }
    });
    url
}

fn serve(socket: TcpStream, store: &Mutex<Store>) {
    let mut reader = BufReader::new(socket.try_clone().unwrap());
    let mut first = String::new();
    reader.read_line(&mut first).unwrap();
    let mut length = 0usize;
    loop {
        let mut header = String::new();
        reader.read_line(&mut header).unwrap();
        if header.trim().is_empty() {
            break;
        }
        if let Some(value) = header.to_ascii_lowercase().strip_prefix("content-length:") {
            length = value.trim().parse().unwrap();
        }
    }
    let mut body = vec![0u8; length];
    reader.read_exact(&mut body).unwrap();
    let mut parts = first.split_whitespace();
    let (method, path) = (parts.next().unwrap(), parts.next().unwrap());
    let mut socket = socket;
    if method == "POST" {
        let mut store = store.lock().unwrap();
        let id = format!("m{}", store.messages.len());
        let topic = path.trim_start_matches('/').to_owned();
        store.messages.push((
            id,
            Utc::now().timestamp(),
            topic,
            String::from_utf8(body).unwrap(),
        ));
        write!(
            socket,
            "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{{}}"
        )
        .unwrap();
        return;
    }
    assert!(path.ends_with("/json?since=15m"), "asked for {path}");
    let topics: Vec<&str> = path
        .trim_start_matches('/')
        .split('/')
        .next()
        .unwrap()
        .split(',')
        .collect();
    let mut out = String::from("{\"event\":\"open\"}\n");
    for (id, time, topic, message) in &store.lock().unwrap().messages {
        if topics.contains(&topic.as_str()) {
            out.push_str(
                &serde_json::json!({
                    "id": id, "time": time, "event": "message", "topic": topic, "message": message
                })
                .to_string(),
            );
            out.push('\n');
        }
    }
    out.push_str("{\"event\":\"keepalive\"}\n");
    write!(
        socket,
        "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{out}",
        out.len()
    )
    .unwrap();
}

/// One peep: what it knows, and everything it has handled so far.
struct Peep {
    circle: Circle,
    heard: HashMap<String, Heard>,
    seen: Vec<String>,
}

impl Peep {
    fn new(name: &str) -> Self {
        Self {
            circle: Circle::new(name),
            heard: HashMap::new(),
            seen: Vec::new(),
        }
    }

    /// Reconnects and handles whatever is new, the way the app's listener does.
    fn check(&mut self, relay: &str) -> Vec<Received> {
        let mut got = Vec::new();
        let url = friends::stream_url(relay, &self.circle.topics());
        friends::stream(&url, |line| {
            if let Some(incoming) = friends::parse_line(line) {
                if !self.seen.contains(&incoming.id) {
                    self.seen.push(incoming.id.clone());
                    if let Some(received) =
                        self.circle.receive(&mut self.heard, &incoming, Utc::now())
                    {
                        got.push(received);
                    }
                }
            }
            true
        })
        .unwrap();
        got
    }

    fn post_status(&self, relay: &str, focus_minutes: Option<i64>) {
        let message = Message::Status {
            name: self.circle.name.clone(),
            focus_until: focus_minutes.map(|m| Utc::now() + TimeDelta::minutes(m)),
            area: Some("study".into()),
            wear: Some(Wear::Bow),
        };
        let topic = friends::status(&self.circle.code);
        friends::post_to(relay, &topic, &self.circle.code, &message).unwrap();
    }

    fn presence_of(&self, other: &Peep) -> Presence {
        self.heard
            .get(&other.circle.code)
            .cloned()
            .unwrap_or_default()
            .presence(Utc::now())
    }
}

#[test]
fn two_friends_study_together() {
    let relay = relay();
    let mut mariyam = Peep::new("Mariyam");
    let mut sara = Peep::new("Sara");

    // Sara is already focusing when Mariyam adds her code.
    sara.post_status(&relay, Some(25));
    let sara_code = friends::normalize(&sara.circle.code.to_lowercase()).unwrap();
    assert!(mariyam.circle.befriend(&sara_code, ""));
    let hello = Message::Hello {
        code: mariyam.circle.code.clone(),
        name: "Mariyam".into(),
    };
    friends::post_to(&relay, &friends::inbox(&sara_code), &sara_code, &hello).unwrap();

    // Sara's peep hears the hello and adds Mariyam back without typing anything.
    assert_eq!(
        sara.check(&relay),
        [Received::NewFriend {
            name: "Mariyam".into()
        }]
    );
    assert_eq!(sara.circle.friends[0].code, mariyam.circle.code);

    // Mariyam sees Sara at the table, by name, even though Sara said so before being added.
    mariyam.check(&relay);
    assert_eq!(mariyam.circle.friends[0].name, "Sara");
    assert_eq!(mariyam.presence_of(&sara), Presence::Focusing);

    // Mariyam joins; Sara's table gets a second seat.
    mariyam.post_status(&relay, Some(24));
    sara.check(&relay);
    assert_eq!(sara.presence_of(&mariyam), Presence::Focusing);

    // A bonk lands on Sara's peep, once.
    let bonk = Message::React {
        code: mariyam.circle.code.clone(),
        name: "Mariyam".into(),
        reaction: Reaction::Bonk,
    };
    friends::post_to(&relay, &friends::inbox(&sara_code), &sara_code, &bonk).unwrap();
    let got = sara.check(&relay);
    assert_eq!(
        got,
        [Received::Reaction {
            from: "Mariyam".into(),
            reaction: Reaction::Bonk,
            line: "Mariyam bonked you with a rolling pin".into(),
        }]
    );
    assert!(
        sara.check(&relay).is_empty(),
        "replayed messages are handled once"
    );

    // A stranger who learns Sara's code can't poke her, and can't pretend to be Mariyam's status.
    let stranger = Message::React {
        code: "ZZZZZ-ZZZZZ".into(),
        name: "Stranger".into(),
        reaction: Reaction::Bonk,
    };
    friends::post_to(&relay, &friends::inbox(&sara_code), &sara_code, &stranger).unwrap();
    let fake = Message::Status {
        name: "Mariyam".into(),
        focus_until: None,
        area: None,
        wear: None,
    };
    friends::post_to(&relay, &friends::inbox(&sara_code), &sara_code, &fake).unwrap();
    assert!(sara.check(&relay).is_empty());
    assert_eq!(sara.presence_of(&mariyam), Presence::Focusing);

    // Break time: Mariyam's status says she stopped focusing.
    mariyam.post_status(&relay, None);
    sara.check(&relay);
    assert_eq!(sara.presence_of(&mariyam), Presence::Around);

    std::thread::sleep(Duration::from_millis(10));
}
