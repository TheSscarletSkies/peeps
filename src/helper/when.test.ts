import { describe, expect, it } from "vitest";

import type { CalendarEvent } from "../lib/types";
import { eventCountdown, eventTime, scheduleLabel } from "./when";

const event = (
  start: Date,
  minutes: number,
  allDay = false,
): CalendarEvent => ({
  key: "k",
  calendar: "College",
  title: "Class",
  location: null,
  start: start.toISOString(),
  end: new Date(start.getTime() + minutes * 60_000).toISOString(),
  allDay,
});

describe("event times", () => {
  const now = new Date(2026, 9, 19, 17, 35);

  it("counts down the last hour", () => {
    expect(eventCountdown(event(new Date(2026, 9, 19, 18, 0), 90), now)).toBe(
      "in 25 min",
    );
    expect(eventCountdown(event(new Date(2026, 9, 19, 17, 0), 90), now)).toBe(
      "now",
    );
    expect(eventCountdown(event(new Date(2026, 9, 19, 20, 0), 60), now)).toBe(
      "in 2 h",
    );
    expect(
      eventCountdown(event(new Date(2026, 9, 21, 9, 0), 60), now),
    ).toBeNull();
  });

  it("names the day when it is not today", () => {
    expect(eventTime(event(new Date(2026, 9, 19, 18, 0), 60), now)).toBe(
      "6:00 PM",
    );
    expect(eventTime(event(new Date(2026, 9, 20, 11, 0), 60), now)).toBe(
      "Tomorrow 11:00 AM",
    );
    expect(eventTime(event(new Date(2026, 9, 21, 0, 0), 1440, true), now)).toBe(
      "Wed All day",
    );
  });
});

describe("schedule labels", () => {
  const base = {
    id: 1,
    kind: "linkedin",
    topic: "Shipped",
    time: "09:00:00",
    nextAt: new Date(2026, 9, 26, 9, 0).toISOString(),
  };

  it("reads like a sentence", () => {
    expect(scheduleLabel({ ...base, repeat: "weekly" })).toBe(
      "Every Mon, 9:00 AM",
    );
    expect(scheduleLabel({ ...base, repeat: "daily" })).toBe(
      "Every day, 9:00 AM",
    );
    expect(scheduleLabel({ ...base, repeat: "monthly" })).toBe(
      "Monthly on the 26th, 9:00 AM",
    );
    expect(scheduleLabel({ ...base, repeat: "never" })).toBe(
      "Mon, Oct 26, 9:00 AM",
    );
  });
});
