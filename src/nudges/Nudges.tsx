import { useState } from "react";

import { addTodo, deleteTodo } from "../lib/bridge";
import type { Helper } from "../lib/types";
import { REPEATS, whenLabel } from "../helper/todoForm";
import { ownReminders, presetTodo, PRESETS, type Preset } from "./presets";

/** Gentle nudges through the day, each one switch, and the reminders the user set up. */
export function Nudges({
  helper,
  onAdd,
}: {
  helper: Helper;
  /** Where to set up a reminder of your own; the to-do form has every repeat and time. */
  onAdd?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const own = ownReminders(helper.todos);

  const toggle = async (preset: Preset) => {
    setError(null);
    try {
      const on = presetTodo(preset, helper.todos);
      if (on) await deleteTodo(on.id);
      else await addTodo(preset.input);
    } catch (reason) {
      setError(String(reason));
    }
  };

  return (
    <div className="helper-tab nudges">
      <ul className="nudges__list" aria-label="Nudges">
        {PRESETS.map((preset) => {
          const on = Boolean(presetTodo(preset, helper.todos));
          return (
            <li key={preset.id} className="review-toggle">
              <span>
                <strong>{preset.title}</strong>
                {preset.line}
              </span>
              <button
                className={on ? "chip chip--on" : "chip"}
                role="switch"
                aria-checked={on}
                aria-label={preset.title}
                onClick={() => void toggle(preset)}
              >
                {on ? "On" : "Off"}
              </button>
            </li>
          );
        })}
      </ul>
      <h3 className="nudges__head">Your reminders</h3>
      {own.length === 0 ? (
        <p className="setup__hint">
          None yet. Tell {helper.name} “remind me to call mum at 6”, or add one
          with a time or a repeat.
        </p>
      ) : (
        <ul className="nudges__list" aria-label="Your reminders">
          {own.map((todo) => (
            <li key={todo.id} className="review-toggle">
              <span>
                <strong>{todo.title}</strong>
                {whenLabel(
                  todo,
                  todo.repeat === "never"
                    ? (todo.due ?? "")
                    : (REPEATS.find((r) => r.id === todo.repeat)?.label ?? ""),
                )}
              </span>
              <button
                className="button button--small"
                aria-label={`Remove ${todo.title}`}
                onClick={() => void deleteTodo(todo.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {onAdd && (
        <button className="tray__link" onClick={onAdd}>
          Add a reminder
        </button>
      )}
      {error && <p className="tray__error">{error}</p>}
    </div>
  );
}
