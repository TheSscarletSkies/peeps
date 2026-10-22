import { useState } from "react";

import { addTodo, deleteTodo, editTodo, setTodoDone } from "../lib/bridge";
import { announceFed } from "../life/events";
import { LivePet } from "../life/LivePet";
import { Select } from "../lib/Select";
import { FocusBar } from "../focus/FocusBar";
import { FriendsPanel } from "../friends/FriendsPanel";
import { moodWith } from "../focus/clock";
import { Nudges } from "../nudges/Nudges";
import { pastelFor } from "../lib/palette";
import { areaLabel, groupByArea } from "../tracker/areas";
import type {
  DueState,
  Focus,
  Friends,
  Helper,
  OpenTodo,
  Pet,
  ReactionEvent,
  Repeat,
  Tip,
} from "../lib/types";
import {
  draftFrom,
  EMPTY,
  hasTitle,
  inputFrom,
  isDaytime,
  nudgesPerDay,
  REMINDERS,
  REPEATS,
  whenLabel,
  type TodoDraft,
} from "./todoForm";
import { Upcoming } from "./Upcoming";
import { Chat } from "./Chat";

type Tab = "chat" | "today" | "nudges" | "friends";

interface Props {
  initialTab?: Tab;
  helper: Helper;
  focus: Focus | null;
  oneThing: boolean;
  friends: Friends | null;
  areas: string[];
  /** A friend's reaction a moment ago, said under the pet. */
  reaction?: ReactionEvent | null;
  knowsYou?: boolean;
  onTyping: (typing: boolean) => void;
}

export function HelperPanel({
  initialTab = "chat",
  helper,
  focus,
  oneThing,
  friends,
  areas,
  reaction,
  knowsYou,
  onTyping,
}: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const tabs: [Tab, string][] = [
    ["chat", "Chat"],
    ["today", "Today"],
    ["nudges", "Nudges"],
    ["friends", "Friends"],
  ];

  return (
    <section className="panel" aria-label={helper.name}>
      <header className="panel__head panel__head--pet">
        <LivePet
          dropId="helper"
          kind={helper.kind}
          color={helper.color}
          mood={moodWith(helper.mood, focus)}
          heat={0}
          size={52}
          chatty
        />
        <span className="panel__who">
          <span className="panel__name">{helper.name}</span>
          <span className="panel__headline" aria-live="polite">
            {reaction?.line || helper.headline}
          </span>
        </span>
      </header>
      <div className="tabs" role="tablist" aria-label="Helper">
        {tabs.map(([id, label]) => (
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
      {tab === "chat" && (
        <Chat helper={helper} knowsYou={knowsYou} onTyping={onTyping} />
      )}
      {tab === "today" && (
        <FocusBar focus={focus} friends={friends} areas={areas} />
      )}
      {tab === "today" && <Upcoming events={helper.upcoming} limit={3} />}
      {tab === "today" && (
        <Todos helper={helper} areas={areas} onTyping={onTyping} />
      )}
      {tab === "friends" && (
        <FriendsPanel friends={friends} helperName={helper.name} />
      )}
      {tab === "nudges" && (
        <Nudges
          helper={helper}
          oneThing={oneThing}
          onAdd={() => setTab("today")}
        />
      )}
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
  const daytime = isDaytime(draft.repeat);
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
        <label className="visually-hidden" htmlFor={`${id}-repeat`}>
          Repeat
        </label>
        <Select
          id={`${id}-repeat`}
          value={draft.repeat}
          onChange={(next) => set({ repeat: next as Repeat })}
          options={REPEATS.map((option) => ({
            value: option.id,
            label: option.label,
          }))}
        />
        {!daytime && (
          <>
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
          </>
        )}
      </div>
      {daytime && (
        <div className="feed todo-form__window">
          <span>From</span>
          <label className="visually-hidden" htmlFor={`${id}-from`}>
            From
          </label>
          <input
            id={`${id}-from`}
            className="feed__time"
            type="time"
            value={draft.time || "09:00"}
            onChange={(event) => set({ time: event.target.value })}
          />
          <span>to</span>
          <label className="visually-hidden" htmlFor={`${id}-until`}>
            Until
          </label>
          <input
            id={`${id}-until`}
            className="feed__time"
            type="time"
            value={draft.until || "21:00"}
            onChange={(event) => set({ until: event.target.value })}
          />
        </div>
      )}
      {!daytime && draft.due && (
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
          <Select
            id={`${id}-remind`}
            value={draft.remind}
            onChange={(next) => set({ remind: next })}
            options={REMINDERS.map((option) => ({
              value: String(option.minutes ?? ""),
              label:
                option.minutes === 0 && !draft.time
                  ? "Morning of"
                  : option.label,
            }))}
          />
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
  hourly: "Every hour",
  every2h: "Every 2 h",
  every3h: "Every 3 h",
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

  const daytime = isDaytime(todo.repeat);
  // A daily-or-longer repeat done today waits for its next turn instead of skipping ahead.
  const restingToday = !daytime && todo.repeat !== "never" && todo.doneToday;
  const perDay = nudgesPerDay(todo.repeat, todo.time, todo.until);
  const when = daytime
    ? `${todo.time?.slice(0, 5) ?? ""}–${todo.until?.slice(0, 5) ?? ""}`
    : todo.due
      ? whenLabel(todo, DUE_LABEL[todo.dueState] || todo.due)
      : "";

  return (
    <li data-due={restingToday ? "done" : todo.dueState}>
      <input
        type="checkbox"
        aria-label={`Done: ${todo.title}`}
        checked={restingToday}
        disabled={restingToday}
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
            {daytime
              ? `${REPEAT_LABEL[todo.repeat]} · ${todo.liveStreak} of ${perDay} today`
              : restingToday
                ? `Done today${todo.liveStreak > 1 ? ` · ${todo.liveStreak} in a row` : ""}`
                : todo.liveStreak > 1
                  ? `${todo.liveStreak} in a row`
                  : REPEAT_LABEL[todo.repeat]}
          </span>
        )}
        {when && !restingToday && <span className="todos__due">{when}</span>}
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

/** Each tag gets one of the peeps' pastels, the same everywhere. */
export function tagStyle(tag: string) {
  return { ["--tag" as string]: `var(--p-${pastelFor(tag)})` };
}

export function Todos({
  helper,
  areas = [],
  onTyping,
}: {
  helper: Helper;
  /** Groups the list under each area, like Work, Study and Play. */
  areas?: string[];
  onTyping: (typing: boolean) => void;
}) {
  const [draft, setDraft] = useState<TodoDraft>(EMPTY);
  const [tag, setTag] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Hourly nudges would drown the list; they live on their own tab.
  const todos = helper.todos.filter((todo) => !todo.tags.includes("nudge"));
  // Areas lead the filter, in the user's order; other tags follow.
  const tags = [
    ...areas.filter((area) => todos.some((todo) => todo.tags.includes(area))),
    ...[...new Set(todos.flatMap((todo) => todo.tags))]
      .filter((name) => !areas.includes(name))
      .sort(),
  ];
  const shown = tag ? todos.filter((todo) => todo.tags.includes(tag)) : todos;

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
      ) : areas.length > 0 && tag === null ? (
        groupByArea(shown, areas).map((group) => (
          <section
            key={group.area ?? "other"}
            className="area"
            aria-label={areaLabel(group.area)}
          >
            <h3
              className="area__head"
              style={group.area ? tagStyle(group.area) : undefined}
              data-other={group.area ? undefined : true}
            >
              {areaLabel(group.area)}
              <span>{group.todos.length}</span>
            </h3>
            <ul className="todos">
              {group.todos.map((todo) => (
                <TodoRow key={todo.id} todo={todo} onTyping={onTyping} />
              ))}
            </ul>
          </section>
        ))
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
