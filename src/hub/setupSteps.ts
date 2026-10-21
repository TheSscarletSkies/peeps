import type { Snapshot } from "../lib/types";

export type Destination = "chat" | "settings" | "nudges";

export interface Step {
  id: string;
  title: string;
  detail: string;
  done: boolean;
  go: Destination;
}

/** The first things to do, ticked off as they happen. */
export function gettingStarted(snapshot: Snapshot): Step[] {
  return [
    {
      id: "hi",
      title: `Say hi to ${snapshot.helper.name}`,
      detail: "A few quick questions, so it knows you.",
      done: snapshot.knowsYou,
      go: "chat",
    },
    {
      id: "nudge",
      title: "Turn on a nudge",
      detail: "Stretch, water or resting your eyes.",
      done: snapshot.helper.todos.some((todo) => todo.tags.includes("nudge")),
      go: "nudges",
    },
    {
      id: "calendar",
      title: "Add a calendar",
      detail: "Classes, calls and exams, with a nudge before each.",
      done: snapshot.calendars.length > 0,
      go: "settings",
    },
  ];
}
