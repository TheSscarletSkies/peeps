import type { Repeat, Todo, TodoInput } from "../lib/types";

export const REPEATS: { id: Repeat; label: string }[] = [
  { id: "never", label: "Once" },
  { id: "daily", label: "Daily" },
  { id: "weekdays", label: "Weekdays" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "hourly", label: "Every hour" },
  { id: "every2h", label: "Every 2 hours" },
  { id: "every3h", label: "Every 3 hours" },
];

/** Repeats that come round during the day, between a start and an end time. */
export function isDaytime(repeat: Repeat): boolean {
  return repeat === "hourly" || repeat === "every2h" || repeat === "every3h";
}

/** Lead times on offer; `null` turns the reminder off. */
const STEP_HOURS: Partial<Record<Repeat, number>> = {
  hourly: 1,
  every2h: 2,
  every3h: 3,
};

/** How many nudges a through-the-day repeat gives between its from and until times. */
export function nudgesPerDay(
  repeat: Repeat,
  from: string | null,
  until: string | null,
): number {
  const step = STEP_HOURS[repeat];
  if (!step) return 0;
  const minutes = (time: string | null, fallback: number) => {
    if (!time) return fallback;
    const [h = 0, m = 0] = time.split(":").map(Number);
    return h * 60 + m;
  };
  const span = minutes(until, 21 * 60) - minutes(from, 9 * 60);
  return span < 0 ? 0 : Math.floor(span / (step * 60)) + 1;
}

export const REMINDERS: { minutes: number | null; label: string }[] = [
  { minutes: null, label: "No reminder" },
  { minutes: 0, label: "On time" },
  { minutes: 10, label: "10 min before" },
  { minutes: 15, label: "15 min before" },
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
  until: string;
}

export const EMPTY: TodoDraft = {
  text: "",
  due: "",
  time: "",
  repeat: "never",
  remind: "",
  until: "",
};

/** Puts the tags back on the end of the title so they can be edited as text. */
export function draftFrom(todo: Todo): TodoDraft {
  return {
    text: [todo.title, ...todo.tags.map((tag) => `#${tag}`)].join(" "),
    due: todo.due ?? "",
    time: todo.time?.slice(0, 5) ?? "",
    repeat: todo.repeat,
    remind: todo.remindMinutes === null ? "" : String(todo.remindMinutes),
    until: todo.until?.slice(0, 5) ?? "",
  };
}

export function inputFrom(draft: TodoDraft): TodoInput {
  if (isDaytime(draft.repeat)) {
    return {
      title: draft.text.trim(),
      due: null,
      time: draft.time || "09:00",
      repeat: draft.repeat,
      remindMinutes: 0,
      until: draft.until || "21:00",
    };
  }
  return {
    title: draft.text.trim(),
    due: draft.due || null,
    time: draft.time || null,
    repeat: draft.repeat,
    remindMinutes: draft.remind === "" ? null : Number(draft.remind),
    until: null,
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
