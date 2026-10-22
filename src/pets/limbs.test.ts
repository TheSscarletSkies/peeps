import { describe, expect, it } from "vitest";

import { limbsFor, type Look } from "./limbs";

const LOOKS: Look[] = [
  "needsYou",
  "failing",
  "steaming",
  "hungry",
  "litterBox",
  "sweating",
  "working",
  "stalled",
  "chill",
  "dizzy",
  "celebrate",
  "love",
  "eager",
  "wave",
];

describe("limbsFor", () => {
  it("keeps every hand inside the drawing", () => {
    for (const look of LOOKS) {
      const { left, right } = limbsFor(look);
      for (const hand of [left, right]) {
        expect(hand.x).toBeGreaterThanOrEqual(6);
        expect(hand.x).toBeLessThanOrEqual(114);
        expect(hand.y).toBeGreaterThanOrEqual(40);
        expect(hand.y).toBeLessThanOrEqual(92);
      }
    }
  });

  it("gives each moment its own gesture", () => {
    expect(limbsFor("needsYou").right.motion).toBe("limb-wave");
    expect(limbsFor("wave").hidden).toBeUndefined();
    expect(limbsFor("celebrate").left.motion).toBe("limb-cheer");
    expect(limbsFor("eager").left.y).toBeLessThan(50);
    expect(limbsFor("working").prop).toBe("pencil");
    expect(limbsFor("chill").hidden).toBe(true);
    expect(limbsFor("sweating").hidden).toBe(true);
    expect(limbsFor("failing").prop).toBe("sign");
    expect(limbsFor("love").prop).toBe("heart");
    expect(limbsFor("stalled").napping).toBe(true);
  });

  it("is symmetrical when both hands do the same thing", () => {
    const { left, right } = limbsFor("celebrate");
    expect(left.x + right.x).toBe(120);
    expect(left.y).toBe(right.y);
  });
});
