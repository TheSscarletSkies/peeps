import { describe, expect, it } from "vitest";

import { demoSnapshot } from "../lib/demo";
import { gettingStarted } from "./setupSteps";

describe("getting started", () => {
  it("ticks off what is already done", () => {
    const steps = gettingStarted(demoSnapshot);
    expect(steps.map((step) => [step.id, step.done])).toEqual([
      ["hi", false],
      [
        "nudge",
        demoSnapshot.helper.todos.some((t) => t.tags.includes("nudge")),
      ],
      ["calendar", true],
    ]);
  });

  it("starts with nothing done on a fresh install", () => {
    const fresh = {
      ...demoSnapshot,
      calendars: [],
      helper: { ...demoSnapshot.helper, todos: [], done: [] },
    };
    expect(gettingStarted(fresh).every((step) => !step.done)).toBe(true);
  });
});
