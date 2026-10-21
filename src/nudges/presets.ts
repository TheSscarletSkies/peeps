import type { OpenTodo, TodoInput } from "../lib/types";

export interface Preset {
  id: string;
  title: string;
  /** What it says when it comes round. */
  line: string;
  input: TodoInput;
}

/** Nudges a friend would give through the day. Each is an ordinary repeating to-do, tagged #nudge. */
export const PRESETS: Preset[] = [
  {
    id: "stretch",
    title: "Stand up and stretch",
    line: "Every hour, 9 to 6",
    input: {
      title: "Stand up and stretch #nudge",
      due: null,
      time: "09:00",
      until: "18:00",
      repeat: "hourly",
      remindMinutes: 0,
    },
  },
  {
    id: "water",
    title: "Drink water",
    line: "Every 2 hours, 9 to 9",
    input: {
      title: "Drink water #nudge",
      due: null,
      time: "09:00",
      until: "21:00",
      repeat: "every2h",
      remindMinutes: 0,
    },
  },
  {
    id: "eyes",
    title: "Rest your eyes",
    line: "Every 3 hours: look far away for 20 seconds",
    input: {
      title: "Rest your eyes #nudge",
      due: null,
      time: "10:00",
      until: "19:00",
      repeat: "every3h",
      remindMinutes: 0,
    },
  },
];

/** The to-do a preset made, if it is on. */
export function presetTodo(
  preset: Preset,
  todos: OpenTodo[],
): OpenTodo | undefined {
  return todos.find(
    (todo) =>
      todo.tags.includes("nudge") && todo.title.startsWith(preset.title),
  );
}

/** Reminders the user set up themselves: anything that repeats or has a reminder, besides presets. */
export function ownReminders(todos: OpenTodo[]): OpenTodo[] {
  return todos.filter(
    (todo) =>
      !(
        todo.tags.includes("nudge") &&
        PRESETS.some((p) => todo.title.startsWith(p.title))
      ) &&
      (todo.repeat !== "never" || todo.remindMinutes !== null),
  );
}
