import { describe, expect, it } from "vitest";

import type { Focus } from "../lib/types";
import { left, moodWith, progress } from "./clock";

const START = Date.parse("2026-10-21T09:00:00Z");
const focus: Focus = {
  phase: "focus",
  startedAt: new Date(START).toISOString(),
  endsAt: new Date(START + 25 * 60_000).toISOString(),
  focusMinutes: 25,
  task: null,
  area: null,
};

describe("focus clock", () => {
  it("counts down in minutes and seconds", () => {
    expect(left(focus, START)).toBe("25:00");
    expect(left(focus, START + 61_500)).toBe("23:59");
    expect(left(focus, START + 99 * 60_000)).toBe("0:00");
  });

  it("tracks progress through the break too", () => {
    expect(progress(focus, START + 12.5 * 60_000)).toBeCloseTo(0.5);
    const rest: Focus = {
      ...focus,
      phase: "break",
      endsAt: new Date(START + 30 * 60_000).toISOString(),
    };
    expect(progress(rest, START + 27.5 * 60_000)).toBeCloseTo(0.5);
  });

  it("puts the pet to work while focusing", () => {
    expect(moodWith("chill", focus)).toBe("working");
    expect(moodWith("needsYou", focus)).toBe("needsYou");
    expect(moodWith("chill", null)).toBe("chill");
  });
});
