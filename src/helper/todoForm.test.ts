import { describe, expect, it } from "vitest";

import { demoSnapshot } from "../lib/demo";
import { draftFrom, EMPTY, hasTitle, inputFrom } from "./todoForm";

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
    });
  });

  it("sends blanks as nothing", () => {
    expect(inputFrom({ ...EMPTY, text: " Pay rent #bills " })).toEqual({
      title: "Pay rent #bills",
      due: null,
      time: null,
      repeat: "never",
      remindMinutes: null,
    });
  });

  it("needs words besides tags", () => {
    expect(hasTitle("#bills #home")).toBe(false);
    expect(hasTitle("Pay rent #bills")).toBe(true);
    expect(hasTitle("   ")).toBe(false);
  });
});
