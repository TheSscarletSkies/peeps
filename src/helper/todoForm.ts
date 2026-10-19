import type { Repeat, Todo, TodoInput } from "../lib/types";

export const REPEATS: { id: Repeat; label: string }[] = [
  { id: "never", label: "Once" },
  { id: "daily", label: "Daily" },
  { id: "weekdays", label: "Weekdays" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

/** Lead times on offer; `null` turns the reminder off. */
export const REMINDERS: { minutes: number | null; label: string }[] = [
  { minutes: null, label: "No reminder" },
  { minutes: 0, label: "On time" },
  { minutes: 10, label: "10 min before" },
  { minutes: 30, label: "30 min before" },
  { minutes: 60, label: "1 hour before" },
  { minutes: 1440, label: "1 day before" },
  { minutes: 4320, label: "3 days before" },
];

export interface TodoDraft {
  text: string;
  due: string;
  time: string;
  repeat: Repeat;
  remind: string;
}

export const EMPTY: TodoDraft = {
  text: "",
  due: "",
  time: "",
  repeat: "never",
  remind: "",
};

/** Puts the tags back on the end of the title so they can be edited as text. */
export function draftFrom(todo: Todo): TodoDraft {
  return {
    text: [todo.title, ...todo.tags.map((tag) => `#${tag}`)].join(" "),
    due: todo.due ?? "",
    time: todo.time?.slice(0, 5) ?? "",
    repeat: todo.repeat,
    remind: todo.remindMinutes === null ? "" : String(todo.remindMinutes),
  };
}

export function inputFrom(draft: TodoDraft): TodoInput {
  return {
    title: draft.text.trim(),
    due: draft.due || null,
    time: draft.time || null,
    repeat: draft.repeat,
    remindMinutes: draft.remind === "" ? null : Number(draft.remind),
  };
}

/** Words left once the `#tags` are taken out: a to-do needs at least one. */
export function hasTitle(text: string): boolean {
  return text
    .split(/\s+/)
    .some((word) => word && !/^#[\p{L}\p{N}_-]+$/u.test(word));
}

export function whenLabel(todo: Todo, fallback: string): string {
  const time = todo.time?.slice(0, 5);
  return [fallback, time].filter(Boolean).join(" · ");
}
