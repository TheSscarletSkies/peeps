import type { Snapshot } from "../lib/types";

export type Destination = "products" | "reminders" | "todo" | "ask";

export interface Step {
  id: string;
  title: string;
  detail: string;
  done: boolean;
  go: Destination;
}

/** The first things to do, ticked off as they happen. */
export function gettingStarted(
  snapshot: Snapshot,
  hooksInstalled: boolean,
): Step[] {
  return [
    {
      id: "hooks",
      title: "Connect Claude Code",
      detail: "So pets know when an agent is working, stuck or asking.",
      done: hooksInstalled,
      go: "products",
    },
    {
      id: "about",
      title: "Tell your helper about you",
      detail: "A few quick questions, so every answer fits you.",
      done: snapshot.knowsYou,
      go: "ask",
    },
    {
      id: "product",
      title: "Add your first product",
      detail: "Pick its folder; it hatches as a pet.",
      done: snapshot.pets.length > 0,
      go: "products",
    },
    {
      id: "calendar",
      title: "Add a calendar",
      detail: "Classes, calls and exams, with a nudge before each.",
      done: snapshot.calendars.length > 0,
      go: "reminders",
    },
    {
      id: "todo",
      title: "Give the helper a to-do",
      detail: "Tag it, give it a date, make it repeat.",
      done: snapshot.helper.todos.length > 0 || snapshot.helper.done.length > 0,
      go: "todo",
    },
  ];
}
