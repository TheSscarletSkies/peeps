import { useState } from "react";

import {
  addTodo,
  deleteDraft,
  deleteTodo,
  setTodoDone,
  writeDraft,
} from "../lib/bridge";
import type { DueState, Helper, Pet, Tip, TodoKind } from "../lib/types";

type Tab = "todo" | "write" | "tokens";

interface Props {
  helper: Helper;
  pets: Pet[];
  tips: Tip[];
  onTyping: (typing: boolean) => void;
}

export function HelperPanel({ helper, pets, tips, onTyping }: Props) {
  const [tab, setTab] = useState<Tab>("todo");

  return (
    <section className="panel" aria-label={helper.name}>
      <header className="panel__head">
        <span className="panel__name">{helper.name}</span>
        <span className="panel__headline">{helper.headline}</span>
      </header>
      <div className="tabs" role="tablist" aria-label="Helper">
        {(
          [
            ["todo", "To-do"],
            ["write", "Write"],
            ["tokens", "Tokens"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "chip chip--on" : "chip"}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "todo" && <Todos helper={helper} onTyping={onTyping} />}
      {tab === "write" && <Write helper={helper} onTyping={onTyping} />}
      {tab === "tokens" && <Tokens helper={helper} pets={pets} tips={tips} />}
    </section>
  );
}

const DUE_LABEL: Record<DueState, string> = {
  overdue: "Overdue",
  today: "Today",
  soon: "Soon",
  later: "",
  undated: "",
};

export function Todos({
  helper,
  onTyping,
}: {
  helper: Helper;
  onTyping: (typing: boolean) => void;
}) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [kind, setKind] = useState<TodoKind>("task");
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    if (!title.trim()) return;
    try {
      await addTodo(title, kind, due || null);
      setTitle("");
      setDue("");
      setError(null);
    } catch (reason) {
      setError(String(reason));
    }
  };

  return (
    <div className="helper-tab">
      {helper.todos.length === 0 ? (
        <p className="setup__hint">Nothing on the list.</p>
      ) : (
        <ul className="todos">
          {helper.todos.map((todo) => (
            <li key={todo.id} data-due={todo.dueState}>
              <input
                type="checkbox"
                aria-label={`Done: ${todo.title}`}
                onChange={() => void setTodoDone(todo.id, true)}
              />
              <span className="todos__title">
                {todo.kind === "study" && (
                  <span className="todos__tag">Study</span>
                )}
                {todo.title}
              </span>
              {todo.due && (
                <span className="todos__due">
                  {DUE_LABEL[todo.dueState] || todo.due}
                </span>
              )}
              <button
                className="todos__remove"
                aria-label={`Delete ${todo.title}`}
                onClick={() => void deleteTodo(todo.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="feed"
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
      >
        <label className="visually-hidden" htmlFor="todo-title">
          New to-do
        </label>
        <input
          id="todo-title"
          value={title}
          placeholder="Add a to-do"
          onChange={(event) => setTitle(event.target.value)}
          onFocus={() => onTyping(true)}
          onBlur={() => onTyping(false)}
        />
        <label className="visually-hidden" htmlFor="todo-due">
          Due date
        </label>
        <input
          id="todo-due"
          className="feed__date"
          type="date"
          value={due}
          onChange={(event) => setDue(event.target.value)}
        />
        <button
          type="button"
          className={kind === "study" ? "chip chip--on" : "chip"}
          aria-pressed={kind === "study"}
          onClick={() => setKind(kind === "study" ? "task" : "study")}
        >
          Study
        </button>
        <button
          className="button button--primary"
          type="submit"
          disabled={!title.trim()}
        >
          Add
        </button>
      </form>
      {error && <p className="tray__error">{error}</p>}
    </div>
  );
}

export function Write({
  helper,
  onTyping,
}: {
  helper: Helper;
  onTyping: (typing: boolean) => void;
}) {
  const [kind, setKind] = useState(helper.draftKinds[0]?.id ?? "linkedin");
  const [topic, setTopic] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  const write = async () => {
    setError(null);
    try {
      await writeDraft(kind, topic);
      setTopic("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const copy = async (id: number, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
  };

  return (
    <div className="helper-tab">
      <form
        className="write"
        onSubmit={(event) => {
          event.preventDefault();
          void write();
        }}
      >
        <div className="write__row">
          <label className="visually-hidden" htmlFor="draft-kind">
            Kind of draft
          </label>
          <select
            id="draft-kind"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
          >
            {helper.draftKinds.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            className="button button--primary"
            type="submit"
            disabled={!topic.trim() || helper.drafting}
          >
            {helper.drafting ? "Writing…" : "Draft it"}
          </button>
        </div>
        <label className="visually-hidden" htmlFor="draft-topic">
          What to write about
        </label>
        <textarea
          id="draft-topic"
          rows={2}
          value={topic}
          placeholder="What should it be about?"
          onChange={(event) => setTopic(event.target.value)}
          onFocus={() => onTyping(true)}
          onBlur={() => onTyping(false)}
        />
      </form>
      {error && <p className="tray__error">{error}</p>}
      <ul className="drafts">
        {helper.drafts.map((draft) => (
          <li key={draft.id}>
            <p className="drafts__text">{draft.text}</p>
            <div className="drafts__actions">
              <span className="setup__hint">{draft.topic}</span>
              <button
                className="button button--small"
                onClick={() => void copy(draft.id, draft.text)}
              >
                {copied === draft.id ? "Copied" : "Copy"}
              </button>
              <button
                className="button button--small"
                onClick={() => void deleteDraft(draft.id)}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const compact = new Intl.NumberFormat("en", { notation: "compact" });

export function Tokens({
  helper,
  pets,
  tips,
}: {
  helper: Helper;
  pets: Pet[];
  tips: Tip[];
}) {
  const total = helper.week.products.reduce(
    (sum, entry) => sum + entry.tokens,
    0,
  );
  const name = (id: string) => pets.find((pet) => pet.id === id)?.name ?? id;

  if (total === 0) {
    return (
      <p className="setup__hint">
        No agent activity in your products this week.
      </p>
    );
  }

  return (
    <div className="helper-tab">
      <p className="setup__hint">
        {compact.format(total)} tokens in the last 7 days
      </p>
      <ul className="week">
        {helper.week.products.map((entry) => (
          <li key={entry.productId}>
            <span className="week__name">{name(entry.productId)}</span>
            <span className="week__bar">
              <span style={{ width: `${(entry.tokens / total) * 100}%` }} />
            </span>
            <span className="week__count">{compact.format(entry.tokens)}</span>
          </li>
        ))}
      </ul>
      {tips.map((tip) => (
        <p key={`${tip.productId}-${tip.text}`} className="tray__tip">
          {name(tip.productId)}: {tip.text}
        </p>
      ))}
    </div>
  );
}
