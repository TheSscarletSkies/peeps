import { describe, expect, it } from "vitest";

import { demoSnapshot } from "../lib/demo";
import {
  draftFrom,
  EMPTY,
  hasTitle,
  inputFrom,
  nudgesPerDay,
} from "./todoForm";

describe("todo form", () => {
  it("round-trips a to-do through the form", () => {
    const todo = demoSnapshot.helper.todos.find((item) => item.id === 3);
    if (!todo) throw new Error("demo to-do missing");
    const draft = draftFrom(todo);
    expect(draft.text).toBe("Read chapter 4 #study");
    expect(draft.time).toBe("18:00");
    expect(inputFrom(draft)).toEqual({
      title: "Read chapter 4 #study",
      due: "2026-10-21",
      time: "18:00",
      repeat: "never",
      remindMinutes: 30,
      until: null,
    });
  });

  it("sends blanks as nothing", () => {
    expect(inputFrom({ ...EMPTY, text: " Pay rent #bills " })).toEqual({
      title: "Pay rent #bills",
      due: null,
      time: null,
      repeat: "never",
      remindMinutes: null,
      until: null,
    });
  });

  it("gives daytime nudges a window and always reminds", () => {
    expect(
      inputFrom({ ...EMPTY, text: "Drink water", repeat: "every2h" }),
    ).toEqual({
      title: "Drink water",
      due: null,
      time: "09:00",
      repeat: "every2h",
      remindMinutes: 0,
      until: "21:00",
    });
  });

  it("needs words besides tags", () => {
    expect(hasTitle("#bills #home")).toBe(false);
    expect(hasTitle("Pay rent #bills")).toBe(true);
    expect(hasTitle("   ")).toBe(false);
  });
});

describe("nudgesPerDay", () => {
  it("counts the nudges between from and until", () => {
    expect(nudgesPerDay("every2h", "09:00:00", "21:00:00")).toBe(7);
    expect(nudgesPerDay("every3h", "09:00", "18:00")).toBe(4);
    expect(nudgesPerDay("hourly", null, null)).toBe(13);
    expect(nudgesPerDay("daily", "09:00", "21:00")).toBe(0);
  });
});
