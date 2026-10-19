import { describe, expect, it } from "vitest";

import type { Mood, Pet } from "../lib/types";
import { arrived, finished, newlyUrgent } from "./changes";

const pet = (id: string, mood: Mood): Pet => ({
  id,
  name: id,
  kind: "bao",
  color: "#FFF3E3",
  mood,
  heat: 0,
  headline: "",
  needs: [],
  permission: null,
  liveSessions: 0,
});

describe("finished", () => {
  it("celebrates busy pets that calm down", () => {
    expect(
      finished(
        [pet("a", "working"), pet("b", "sweating"), pet("c", "chill")],
        [pet("a", "chill"), pet("b", "needsYou"), pet("c", "chill")],
      ),
    ).toEqual(["a"]);
  });

  it("ignores pets it has not seen before", () => {
    expect(finished([], [pet("a", "chill")])).toEqual([]);
  });
});

describe("arrived", () => {
  it("finds new pets", () => {
    expect(
      arrived([pet("a", "chill")], [pet("a", "chill"), pet("b", "chill")]),
    ).toEqual(["b"]);
  });
});

describe("newlyUrgent", () => {
  const urgent = (mood: Mood) => mood === "needsYou" || mood === "failing";

  it("reports a pet only when it starts needing you", () => {
    expect(
      newlyUrgent([pet("a", "working")], [pet("a", "needsYou")], urgent),
    ).toEqual(["a"]);
    expect(
      newlyUrgent([pet("a", "needsYou")], [pet("a", "failing")], urgent),
    ).toEqual([]);
  });
});
