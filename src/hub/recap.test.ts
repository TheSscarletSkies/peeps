import { describe, expect, it } from "vitest";

import { demoSnapshot } from "../lib/demo";
import { recap } from "./recap";

describe("recap", () => {
  const { helper, pets } = demoSnapshot;
  const now = new Date(2026, 9, 19, 12);

  it("adds up the week", () => {
    const week = recap(helper, pets, now);
    expect(week.hours).toBe(18.7);
    expect(week.tokens).toBe(734000);
    expect(week.range).toBe("Oct 13 – Oct 19");
    expect(week.lines.map((line) => line.id)).toEqual([
      "funderly",
      "kaiveni-hiya",
      "enigma-archives",
    ]);
  });

  it("skips products that were removed", () => {
    const week = recap(
      helper,
      pets.filter((pet) => pet.id !== "funderly"),
      now,
    );
    expect(week.lines).toHaveLength(2);
  });
});
