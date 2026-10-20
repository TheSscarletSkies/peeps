import { useState } from "react";

import {
  addSchedule,
  addTodo,
  deleteDraft,
  deleteSchedule,
  deleteTodo,
  editTodo,
  setTodoDone,
  writeDraft,
} from "../lib/bridge";
import { announceFed } from "../life/events";
import type {
  DueState,
  Helper,
  OpenTodo,
  Pet,
  Repeat,
  Tip,
} from "../lib/types";
import {
  draftFrom,
  EMPTY,
  hasTitle,
  inputFrom,
  REMINDERS,
  REPEATS,
  whenLabel,
  type TodoDraft,
} from "./todoForm";
import { Upcoming } from "./Upcoming";
import { Chat } from "./Chat";
import { scheduleLabel } from "./when";

type Tab = "ask" | "todo" | "write" | "tokens";

interface Props {
  helper: Helper;
  pets: Pet[];
  tips: Tip[];
  onTyping: (typing: boolean) => void;
}

export function HelperPanel({ helper, pets, tips, onTyping }: Props) {
  const [tab, setTab] = useState<Tab>("ask");

  return (
    <section className="panel" aria-label={helper.name}>
      <header className="panel__head">
        <span className="panel__name">{helper.name}</span>
        <span className="panel__headline">{helper.headline}</span>
      </header>
      <Upcoming events={helper.upcoming} limit={2} />
      <div className="tabs" role="tablist" aria-label="Helper">
        {(
          [
            ["ask", "Ask"],
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
      {tab === "ask" && <Chat helper={helper} onTyping={onTyping} />}
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

/** One form for adding and editing. Time and reminder appear once there is a date. */
function TodoForm({
  id,
  draft,
  onChange,
  onSubmit,
  submitLabel,
  onCancel,
}: {
  id: string;
  draft: TodoDraft;
  onChange: (draft: TodoDraft) => void;
  onSubmit: () => void;
  submitLabel: string;
  onCancel?: () => void;
}) {
  const set = (patch: Partial<TodoDraft>) => onChange({ ...draft, ...patch });
  return (
    <form
      className="todo-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && onCancel) onCancel();
      }}
    >
      <label className="visually-hidden" htmlFor={`${id}-text`}>
        To-do
      </label>
      <input
        id={`${id}-text`}
        value={draft.text}
        autoFocus={Boolean(onCancel)}
        placeholder="Add a to-do, #tags welcome"
        onChange={(event) => set({ text: event.target.value })}
      />
      <div className="feed">
        <label className="visually-hidden" htmlFor={`${id}-due`}>
          Due date
        </label>
        <input
          id={`${id}-due`}
          className="feed__date"
          type="date"
          value={draft.due}
          onChange={(event) => set({ due: event.target.value })}
        />
        <label className="visually-hidden" htmlFor={`${id}-repeat`}>
          Repeat
        </label>
        <select
          id={`${id}-repeat`}
          value={draft.repeat}
          onChange={(event) => set({ repeat: event.target.value as Repeat })}
        >
          {REPEATS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {draft.due && (
        <div className="feed">
          <label className="visually-hidden" htmlFor={`${id}-time`}>
            Time
          </label>
          <input
            id={`${id}-time`}
            className="feed__time"
            type="time"
            value={draft.time}
            onChange={(event) => set({ time: event.target.value })}
          />
          <label className="visually-hidden" htmlFor={`${id}-remind`}>
            Reminder
          </label>
          <select
            id={`${id}-remind`}
            value={draft.remind}
            onChange={(event) => set({ remind: event.target.value })}
          >
            {REMINDERS.map((option) => (
              <option key={option.label} value={option.minutes ?? ""}>
                {option.minutes === 0 && !draft.time
                  ? "Morning of"
                  : option.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="todo-form__actions">
        {onCancel && (
          <button type="button" className="button" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button
          className="button button--primary"
          type="submit"
          disabled={!hasTitle(draft.text)}
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

const REPEAT_LABEL: Record<Repeat, string> = {
  never: "",
  daily: "Daily",
  weekdays: "Weekdays",
  weekly: "Weekly",
  monthly: "Monthly",
};

function TodoRow({
  todo,
  onTyping,
}: {
  todo: OpenTodo;
  onTyping: (typing: boolean) => void;
}) {
  const [draft, setDraft] = useState<TodoDraft | null>(null);

  const close = () => {
    setDraft(null);
    onTyping(false);
  };

  if (draft) {
    return (
      <li className="todos__edit">
        <TodoForm
          id={`todo-${todo.id}`}
          draft={draft}
          onChange={setDraft}
          submitLabel="Save"
          onCancel={close}
          onSubmit={() => void editTodo(todo.id, inputFrom(draft)).then(close)}
        />
      </li>
    );
  }

  const when = todo.due
    ? whenLabel(todo, DUE_LABEL[todo.dueState] || todo.due)
    : "";

  return (
    <li data-due={todo.dueState}>
      <input
        type="checkbox"
        aria-label={`Done: ${todo.title}`}
        checked={false}
        onChange={() => {
          announceFed("helper");
          void setTodoDone(todo.id, true);
        }}
      />
      <button
        className="todos__title"
        title="Edit"
        onClick={() => {
          setDraft(draftFrom(todo));
          onTyping(true);
        }}
      >
        {todo.title}
        {todo.tags.map((tag) => (
          <span key={tag} className="todos__tag" style={tagStyle(tag)}>
            #{tag}
          </span>
        ))}
      </button>
      <span className="todos__meta">
        {todo.repeat !== "never" && (
          <span className="todos__repeat">
            {todo.liveStreak > 1
              ? `${todo.liveStreak} in a row`
              : REPEAT_LABEL[todo.repeat]}
          </span>
        )}
        {when && <span className="todos__due">{when}</span>}
      </span>
      <button
        className="todos__remove"
        aria-label={`Delete ${todo.title}`}
        onClick={() => void deleteTodo(todo.id)}
      >
        ×
      </button>
    </li>
  );
}

/** Each tag gets its own soft colour, the same everywhere. */
function tagStyle(tag: string) {
  let hash = 0;
  for (const char of tag) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return { ["--tag" as string]: `${hash % 360}` };
}

export function Todos({
  helper,
  onTyping,
}: {
  helper: Helper;
  onTyping: (typing: boolean) => void;
}) {
  const [draft, setDraft] = useState<TodoDraft>(EMPTY);
  const [tag, setTag] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tags = [...new Set(helper.todos.flatMap((todo) => todo.tags))].sort();
  const shown = tag
    ? helper.todos.filter((todo) => todo.tags.includes(tag))
    : helper.todos;

  const add = async () => {
    try {
      await addTodo(inputFrom(draft));
      setDraft(EMPTY);
      setError(null);
    } catch (reason) {
      setError(String(reason));
    }
  };

  return (
    <div
      className="helper-tab"
      onFocus={() => onTyping(true)}
      onBlur={() => onTyping(false)}
    >
      {tags.length > 0 && (
        <div className="tag-filter" role="toolbar" aria-label="Filter by tag">
          <button
            className={tag === null ? "chip chip--on" : "chip"}
            onClick={() => setTag(null)}
          >
            All
          </button>
          {tags.map((name) => (
            <button
              key={name}
              className={tag === name ? "chip chip--on" : "chip"}
              onClick={() => setTag(tag === name ? null : name)}
            >
              #{name}
            </button>
          ))}
        </div>
      )}
      {shown.length === 0 ? (
        <p className="setup__hint">Nothing on the list.</p>
      ) : (
        <ul className="todos">
          {shown.map((todo) => (
            <TodoRow key={todo.id} todo={todo} onTyping={onTyping} />
          ))}
        </ul>
      )}
      <TodoForm
        id="new-todo"
        draft={draft}
        onChange={setDraft}
        submitLabel="Add"
        onSubmit={() => void add()}
      />
      {error && <p className="tray__error">{error}</p>}
    </div>
  );
}

function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function draftLabel(helper: Helper, kind: string): string {
  return helper.draftKinds.find((option) => option.id === kind)?.label ?? kind;
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
  const [when, setWhen] = useState<"now" | Repeat>("now");
  const [start, setStart] = useState(today);
  const [time, setTime] = useState("09:00");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  const write = async () => {
    setError(null);
    try {
      if (when === "now") {
        await writeDraft(kind, topic);
      } else {
        await addSchedule({ kind, topic, repeat: when, start, time });
      }
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
          <label className="visually-hidden" htmlFor="draft-when">
            When
          </label>
          <select
            id="draft-when"
            value={when}
            onChange={(event) => setWhen(event.target.value as "now" | Repeat)}
          >
            <option value="now">Now</option>
            {REPEATS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.id === "never" ? "Later, once" : option.label}
              </option>
            ))}
          </select>
          <button
            className="button button--primary"
            type="submit"
            disabled={!topic.trim() || (when === "now" && helper.drafting)}
          >
            {when !== "now"
              ? "Schedule"
              : helper.drafting
                ? "Writing…"
                : "Draft it"}
          </button>
        </div>
        {when !== "now" && (
          <div className="feed">
            <label className="visually-hidden" htmlFor="draft-start">
              Starting
            </label>
            <input
              id="draft-start"
              className="feed__date"
              type="date"
              value={start}
              onChange={(event) => setStart(event.target.value)}
            />
            <label className="visually-hidden" htmlFor="draft-time">
              At
            </label>
            <input
              id="draft-time"
              className="feed__time"
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
            />
          </div>
        )}
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
      {helper.schedules.length > 0 && (
        <ul className="schedules" aria-label="Scheduled drafts">
          {helper.schedules.map((schedule) => (
            <li key={schedule.id}>
              <span className="schedules__when">{scheduleLabel(schedule)}</span>
              <span className="schedules__what">
                {draftLabel(helper, schedule.kind)}: {schedule.topic}
              </span>
              <button
                className="todos__remove"
                aria-label={`Stop scheduling ${schedule.topic}`}
                onClick={() => void deleteSchedule(schedule.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
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
