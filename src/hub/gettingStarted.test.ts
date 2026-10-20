import { describe, expect, it } from "vitest";

import { demoSnapshot } from "../lib/demo";
import { gettingStarted } from "./gettingStarted";

describe("getting started", () => {
  it("ticks off what is already done", () => {
    const steps = gettingStarted(demoSnapshot, false);
    expect(steps.map((step) => [step.id, step.done])).toEqual([
      ["hooks", false],
      ["product", true],
      ["calendar", true],
      ["todo", true],
    ]);
  });

  it("starts with nothing done on a fresh install", () => {
    const fresh = {
      ...demoSnapshot,
      pets: [],
      calendars: [],
      helper: { ...demoSnapshot.helper, todos: [], done: [] },
    };
    expect(gettingStarted(fresh, false).every((step) => !step.done)).toBe(true);
  });
});
