//! What the user's own agent can do in peeps: look at the pets and the day, keep the to-do list,
//! leave notes for products and remember things about the user.

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
    EditTodo {
        id: i64,
        input: TodoInput,
    },
    DeleteTodo {
        id: i64,
    },
    LeaveNote {
        product: String,
        text: String,
        when: Delivery,
    },
    Remember {
        fact: String,
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
            name: "edit_todo",
            description: "Changes a to-do by id: move it to another day, change its time, repeat, reminder, title or #tags (areas like #work, #study, #play are tags). Send every field as it should end up; read them first with list_todos.",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "id": { "type": "integer" },
                    "title": { "type": "string", "description": "What to do, with its #tags." },
                    "due": { "type": "string", "description": "YYYY-MM-DD." },
                    "time": { "type": "string", "description": "HH:MM, 24-hour." },
                    "repeat": { "type": "string", "enum": ["never", "daily", "weekdays", "weekly", "monthly", "hourly", "every2h", "every3h"] },
                    "remindMinutes": { "type": "integer" },
                    "until": { "type": "string", "description": "HH:MM." }
                },
                "required": ["id", "title"]
            }),
        },
        Definition {
            name: "delete_todo",
            description: "Removes a to-do by id, for good. Only when the user asks to delete or cancel it.",
            input_schema: json!({
                "type": "object",
                "properties": { "id": { "type": "integer" } },
                "required": ["id"]
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
            name: "remember",
            description: "Saves something lasting about the user to their About me page, such as their name, what they're building, a preference or a standing instruction. Every conversation in peeps reads that page.",
            input_schema: json!({
                "type": "object",
                "properties": { "fact": { "type": "string", "description": "One short sentence, in the user's terms." } },
                "required": ["fact"]
            }),
        },
    ]
}

#[derive(Deserialize)]
struct Fact {
    fact: String,
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
struct Note {
    product: String,
    text: String,
    #[serde(default = "next_session")]
    when: Delivery,
}

fn next_session() -> Delivery {
    Delivery::NextSession
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
        "delete_todo" => Call::DeleteTodo {
            id: serde_json::from_value::<Id>(args).map_err(bad)?.id,
        },
        "edit_todo" => {
            let id = serde_json::from_value::<Id>(args.clone()).map_err(bad)?.id;
            let todo: TodoArgs = serde_json::from_value(args).map_err(bad)?;
            if todo.title.trim().is_empty() {
                return Err("a to-do needs a title".into());
            }
            Call::EditTodo {
                id,
                input: TodoInput {
                    title: todo.title,
                    due: todo.due,
                    time: todo.time,
                    repeat: todo.repeat,
                    remind_minutes: todo.remind_minutes,
                    until: todo.until,
                },
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
        "remember" => {
            let fact = serde_json::from_value::<Fact>(args).map_err(bad)?.fact;
            if fact.trim().is_empty() {
                return Err("there is nothing to remember".into());
            }
            Call::Remember { fact }
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
            ("delete_todo", json!({ "id": 3 })),
            (
                "edit_todo",
                json!({ "id": 3, "title": "Gym #play", "due": "2026-10-29", "repeat": "weekly" }),
            ),
            (
                "leave_note",
                json!({ "product": "funderly", "text": "Use annual pricing" }),
            ),
            ("remember", json!({ "fact": "Prefers short replies" })),
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
        // An agent resuming an older conversation may still reach for tools peeps dropped.
        for gone in ["draft_email", "schedule_draft", "log_payment", "read_brief"] {
            assert!(parse(gone, json!({})).unwrap_err().contains("no tool"));
        }
    }
}
