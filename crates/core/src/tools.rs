//! What the user's own agent can do in peeps: look at the pets and the day, keep the to-do list,
//! schedule drafts, leave notes for products, keep each product's brief, draft email for approval
//! and keep track of payments and posts.

use chrono::{NaiveDate, NaiveTime};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::notes::Delivery;
use crate::todos::{Repeat, TodoInput};

/// A tool as listed to the agent.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Definition {
    pub name: &'static str,
    pub description: &'static str,
    pub input_schema: Value,
}

/// A request from the agent, checked and typed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Call {
    Overview,
    ListTodos,
    AddTodo(TodoInput),
    CompleteTodo {
        id: i64,
    },
    ScheduleDraft {
        kind: String,
        topic: String,
        repeat: Repeat,
        start: NaiveDate,
        time: NaiveTime,
    },
    LeaveNote {
        product: String,
        text: String,
        when: Delivery,
    },
    ReadBrief {
        product: String,
    },
    WriteBrief {
        product: String,
        text: String,
    },
    LogDecision {
        product: String,
        decision: String,
    },
    DraftEmail {
        from: Option<String>,
        to: String,
        subject: String,
        body: String,
        in_reply_to: Option<String>,
    },
    WaitingReplies,
    ProductNumbers {
        product: String,
    },
    SaveDraft {
        kind: String,
        topic: String,
        text: String,
    },
    LogPayment {
        product: String,
        amount: String,
        currency: String,
        note: String,
    },
    LogPost {
        product: String,
        channel: String,
        note: String,
    },
}

fn product_arg() -> Value {
    json!({ "type": "string", "description": "The product's id, as listed by peeps_overview." })
}

pub fn definitions() -> Vec<Definition> {
    vec![
        Definition {
            name: "peeps_overview",
            description: "The user's products with each pet's mood, what it needs and whether an agent is working, plus open to-dos and the next calendar events. Start here.",
            input_schema: json!({ "type": "object", "properties": {} }),
        },
        Definition {
            name: "list_todos",
            description: "Open to-dos with their ids, tags, due dates, repeats and reminders.",
            input_schema: json!({ "type": "object", "properties": {} }),
        },
        Definition {
            name: "add_todo",
            description: "Adds a to-do. Put tags in the title as #tag. A reminder notifies the user; repeats can be daily, weekdays, weekly, monthly, or every 1, 2 or 3 hours between `time` and `until`.",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "title": { "type": "string", "description": "What to do, with optional #tags." },
                    "due": { "type": "string", "description": "YYYY-MM-DD." },
                    "time": { "type": "string", "description": "HH:MM, 24-hour, the user's time." },
                    "repeat": { "type": "string", "enum": ["never", "daily", "weekdays", "weekly", "monthly", "hourly", "every2h", "every3h"] },
                    "remindMinutes": { "type": "integer", "description": "Minutes before the time to notify; 0 for on time. Omit for no reminder." },
                    "until": { "type": "string", "description": "HH:MM; when repeats through the day stop." }
                },
                "required": ["title"]
            }),
        },
        Definition {
            name: "complete_todo",
            description: "Ticks a to-do off by id. Repeating ones move to their next date.",
            input_schema: json!({
                "type": "object",
                "properties": { "id": { "type": "integer" } },
                "required": ["id"]
            }),
        },
        Definition {
            name: "schedule_draft",
            description: "Has peeps write a post on a schedule in the user's voice, like a LinkedIn post every Monday at 09:00. The user is notified when each draft is ready; nothing is posted.",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "kind": { "type": "string", "description": "linkedin, x, or another kind the user set up." },
                    "topic": { "type": "string" },
                    "repeat": { "type": "string", "enum": ["never", "daily", "weekdays", "weekly", "monthly"] },
                    "start": { "type": "string", "description": "YYYY-MM-DD, the first day it may run." },
                    "time": { "type": "string", "description": "HH:MM, 24-hour." }
                },
                "required": ["kind", "topic", "repeat", "start", "time"]
            }),
        },
        Definition {
            name: "leave_note",
            description: "Leaves a note for a product's coding agent, read when its next session starts or after its next step. Use it to hand work to that product.",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "product": product_arg(),
                    "text": { "type": "string" },
                    "when": { "type": "string", "enum": ["nextSession", "nextStep"] }
                },
                "required": ["product", "text"]
            }),
        },
        Definition {
            name: "read_brief",
            description: "A product's brief in Markdown: goal, audience, voice, numbers, links and past decisions. Read it before advising on a product.",
            input_schema: json!({
                "type": "object",
                "properties": { "product": product_arg() },
                "required": ["product"]
            }),
        },
        Definition {
            name: "write_brief",
            description: "Replaces a product's brief with new Markdown. Keep the user's words; only change what they asked for.",
            input_schema: json!({
                "type": "object",
                "properties": { "product": product_arg(), "text": { "type": "string" } },
                "required": ["product", "text"]
            }),
        },
        Definition {
            name: "log_decision",
            description: "Records a decision the user made about a product, dated, in its brief, so later advice remembers it.",
            input_schema: json!({
                "type": "object",
                "properties": { "product": product_arg(), "decision": { "type": "string" } },
                "required": ["product", "decision"]
            }),
        },
        Definition {
            name: "draft_email",
            description: "Prepares an email from one of the user's own accounts. It is NOT sent: the user sees it in peeps, can edit it, and sends it themselves. Say that it is waiting for them.",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "from": { "type": "string", "description": "Which of the user's addresses to send from; omit for their first account. peeps_overview lists them." },
                    "to": { "type": "string", "description": "One or more addresses, separated by commas." },
                    "subject": { "type": "string" },
                    "body": { "type": "string", "description": "Plain text, signed off as the user." },
                    "inReplyTo": { "type": "string", "description": "The Message-ID being answered, to keep the thread." }
                },
                "required": ["to", "subject", "body"]
            }),
        },
        Definition {
            name: "waiting_replies",
            description: "Emails the user sent from peeps in the last 30 days that have had no reply, oldest first. Useful for follow-ups.",
            input_schema: json!({ "type": "object", "properties": {} }),
        },
        Definition {
            name: "save_draft",
            description: "Keeps a finished post, script or caption in the user's Write tab, ready to copy and post. Nothing is published.",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "kind": { "type": "string", "description": "Where it goes, like linkedin, x, tiktok script, instagram caption or youtube short." },
                    "topic": { "type": "string", "description": "A short title, with the product's name." },
                    "text": { "type": "string", "description": "The full text, ready to use." }
                },
                "required": ["kind", "topic", "text"]
            }),
        },
        Definition {
            name: "product_numbers",
            description: "A product's payments and posts over the last 7 and 30 days, from PayPal, YouTube and what the user logged, with the latest entries.",
            input_schema: json!({
                "type": "object",
                "properties": { "product": product_arg() },
                "required": ["product"]
            }),
        },
        Definition {
            name: "log_payment",
            description: "Records a payment the user received outside PayPal, like a bank transfer. PayPal payments arrive on their own; don't log those.",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "product": product_arg(),
                    "amount": { "type": "string", "description": "Like 49 or 49.50." },
                    "currency": { "type": "string", "description": "A code like USD; defaults to USD." },
                    "note": { "type": "string", "description": "Who paid, or what for." }
                },
                "required": ["product", "amount"]
            }),
        },
        Definition {
            name: "log_post",
            description: "Records that the user posted, for channels peeps can't read itself. YouTube uploads arrive on their own.",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "product": product_arg(),
                    "channel": { "type": "string", "enum": crate::numbers::CHANNELS },
                    "note": { "type": "string", "description": "What the post was." }
                },
                "required": ["product", "channel"]
            }),
        },
    ]
}

#[derive(Deserialize)]
struct SaveDraftArgs {
    kind: String,
    topic: String,
    text: String,
}

#[derive(Deserialize)]
struct PaymentArgs {
    product: String,
    amount: String,
    #[serde(default = "usd")]
    currency: String,
    #[serde(default)]
    note: String,
}

fn usd() -> String {
    "USD".into()
}

#[derive(Deserialize)]
struct PostArgs {
    product: String,
    channel: String,
    #[serde(default)]
    note: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct EmailArgs {
    from: Option<String>,
    to: String,
    subject: String,
    body: String,
    in_reply_to: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TodoArgs {
    title: String,
    due: Option<NaiveDate>,
    time: Option<NaiveTime>,
    #[serde(default)]
    repeat: Repeat,
    remind_minutes: Option<i64>,
    until: Option<NaiveTime>,
}

#[derive(Deserialize)]
struct Id {
    id: i64,
}

#[derive(Deserialize)]
struct Draft {
    kind: String,
    topic: String,
    repeat: Repeat,
    start: NaiveDate,
    time: NaiveTime,
}

#[derive(Deserialize)]
struct Note {
    product: String,
    text: String,
    #[serde(default = "next_session")]
    when: Delivery,
}

fn next_session() -> Delivery {
    Delivery::NextSession
}

#[derive(Deserialize)]
struct Product {
    product: String,
}

#[derive(Deserialize)]
struct Brief {
    product: String,
    text: String,
}

#[derive(Deserialize)]
struct Decision {
    product: String,
    decision: String,
}

/// Checks a request against the tool's inputs. Errors read well to the agent, so it can fix them.
pub fn parse(name: &str, args: Value) -> Result<Call, String> {
    let args = if args.is_null() { json!({}) } else { args };
    let bad = |error: serde_json::Error| format!("bad arguments for {name}: {error}");
    Ok(match name {
        "peeps_overview" => Call::Overview,
        "list_todos" => Call::ListTodos,
        "add_todo" => {
            let todo: TodoArgs = serde_json::from_value(args).map_err(bad)?;
            if todo.title.trim().is_empty() {
                return Err("a to-do needs a title".into());
            }
            Call::AddTodo(TodoInput {
                title: todo.title,
                due: todo.due,
                time: todo.time,
                repeat: todo.repeat,
                remind_minutes: todo.remind_minutes,
                until: todo.until,
            })
        }
        "complete_todo" => Call::CompleteTodo {
            id: serde_json::from_value::<Id>(args).map_err(bad)?.id,
        },
        "schedule_draft" => {
            let draft: Draft = serde_json::from_value(args).map_err(bad)?;
            Call::ScheduleDraft {
                kind: draft.kind,
                topic: draft.topic,
                repeat: draft.repeat,
                start: draft.start,
                time: draft.time,
            }
        }
        "leave_note" => {
            let note: Note = serde_json::from_value(args).map_err(bad)?;
            Call::LeaveNote {
                product: note.product,
                text: note.text,
                when: note.when,
            }
        }
        "read_brief" => Call::ReadBrief {
            product: serde_json::from_value::<Product>(args)
                .map_err(bad)?
                .product,
        },
        "write_brief" => {
            let brief: Brief = serde_json::from_value(args).map_err(bad)?;
            Call::WriteBrief {
                product: brief.product,
                text: brief.text,
            }
        }
        "log_decision" => {
            let decision: Decision = serde_json::from_value(args).map_err(bad)?;
            Call::LogDecision {
                product: decision.product,
                decision: decision.decision,
            }
        }
        "draft_email" => {
            let email: EmailArgs = serde_json::from_value(args).map_err(bad)?;
            if email.to.trim().is_empty() {
                return Err("an email needs someone to go to".into());
            }
            Call::DraftEmail {
                from: email.from,
                to: email.to,
                subject: email.subject,
                body: email.body,
                in_reply_to: email.in_reply_to,
            }
        }
        "waiting_replies" => Call::WaitingReplies,
        "save_draft" => {
            let draft: SaveDraftArgs = serde_json::from_value(args).map_err(bad)?;
            if draft.text.trim().is_empty() {
                return Err("a draft needs some text".into());
            }
            Call::SaveDraft {
                kind: draft.kind.trim().to_lowercase(),
                topic: draft.topic,
                text: draft.text,
            }
        }
        "product_numbers" => Call::ProductNumbers {
            product: serde_json::from_value::<Product>(args)
                .map_err(bad)?
                .product,
        },
        "log_payment" => {
            let payment: PaymentArgs = serde_json::from_value(args).map_err(bad)?;
            Call::LogPayment {
                product: payment.product,
                amount: payment.amount,
                currency: payment.currency,
                note: payment.note,
            }
        }
        "log_post" => {
            let post: PostArgs = serde_json::from_value(args).map_err(bad)?;
            Call::LogPost {
                product: post.product,
                channel: post.channel,
                note: post.note,
            }
        }
        other => return Err(format!("peeps has no tool called {other}")),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_definition_parses_with_its_required_fields() {
        let examples = [
            ("peeps_overview", json!({})),
            ("list_todos", json!(null)),
            (
                "add_todo",
                json!({ "title": "Drink water", "repeat": "every2h", "time": "09:00", "until": "21:00", "remindMinutes": 0 }),
            ),
            ("complete_todo", json!({ "id": 3 })),
            (
                "schedule_draft",
                json!({ "kind": "linkedin", "topic": "Shipped", "repeat": "weekly", "start": "2026-10-26", "time": "09:00" }),
            ),
            (
                "leave_note",
                json!({ "product": "funderly", "text": "Use annual pricing" }),
            ),
            ("read_brief", json!({ "product": "funderly" })),
            (
                "write_brief",
                json!({ "product": "funderly", "text": "# Funderly" }),
            ),
            (
                "log_decision",
                json!({ "product": "funderly", "decision": "Annual pricing" }),
            ),
            (
                "draft_email",
                json!({ "to": "sara@example.com", "subject": "Welcome", "body": "Hi" }),
            ),
            ("waiting_replies", json!({})),
            ("product_numbers", json!({ "product": "funderly" })),
            (
                "save_draft",
                json!({ "kind": "TikTok script", "topic": "Part 4", "text": "Hook…" }),
            ),
            (
                "log_payment",
                json!({ "product": "funderly", "amount": "49" }),
            ),
            (
                "log_post",
                json!({ "product": "enigma", "channel": "tiktok" }),
            ),
        ];
        let names: Vec<_> = definitions().iter().map(|d| d.name).collect();
        assert_eq!(names.len(), examples.len());
        for (name, args) in examples {
            assert!(names.contains(&name), "{name} is not listed");
            assert!(parse(name, args).is_ok(), "{name} did not parse");
        }
    }

    #[test]
    fn parses_typed_arguments() {
        let call = parse(
            "add_todo",
            json!({ "title": "Drink water", "repeat": "every2h", "time": "09:00", "until": "21:00", "remindMinutes": 0 }),
        )
        .unwrap();
        let Call::AddTodo(todo) = call else {
            panic!("wrong call")
        };
        assert_eq!(todo.repeat, Repeat::EveryTwoHours);
        assert_eq!(todo.until, NaiveTime::from_hms_opt(21, 0, 0));
        assert_eq!(
            parse("leave_note", json!({ "product": "f", "text": "x" })).unwrap(),
            Call::LeaveNote {
                product: "f".into(),
                text: "x".into(),
                when: Delivery::NextSession
            }
        );
    }

    #[test]
    fn explains_mistakes() {
        assert!(parse("add_todo", json!({ "title": " " }))
            .unwrap_err()
            .contains("title"));
        assert!(parse("complete_todo", json!({ "id": "x" }))
            .unwrap_err()
            .contains("complete_todo"));
        assert!(parse("send_rocket", json!({}))
            .unwrap_err()
            .contains("no tool"));
    }
}
