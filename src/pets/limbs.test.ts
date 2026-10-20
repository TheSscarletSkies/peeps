import { describe, expect, it } from "vitest";

import type { PetKind } from "../lib/types";
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
];
const KINDS: PetKind[] = ["bao", "gyoza", "wonton"];

describe("limbsFor", () => {
  it("keeps every hand inside the drawing", () => {
    for (const kind of KINDS)
      for (const look of LOOKS) {
        const { left, right } = limbsFor(look, kind);
        for (const hand of [left, right]) {
          expect(hand.x).toBeGreaterThanOrEqual(6);
          expect(hand.x).toBeLessThanOrEqual(114);
          expect(hand.y).toBeGreaterThanOrEqual(40);
          expect(hand.y).toBeLessThanOrEqual(92);
        }
      }
  });

  it("gives each moment its own gesture", () => {
    expect(limbsFor("needsYou", "bao").right.motion).toBe("limb-wave");
    expect(limbsFor("celebrate", "bao").left.motion).toBe("limb-cheer");
    expect(limbsFor("eager", "gyoza").left.y).toBeLessThan(50);
    expect(limbsFor("working", "bao").prop).toBe("pencil");
    expect(limbsFor("chill", "wonton").prop).toBe("cup");
    expect(limbsFor("failing", "bao").prop).toBe("sign");
    expect(limbsFor("love", "bao").prop).toBe("heart");
    expect(limbsFor("stalled", "bao").hidden).toBe(true);
  });

  it("is symmetrical when both hands do the same thing", () => {
    const { left, right } = limbsFor("celebrate", "wonton");
    expect(left.x + right.x).toBe(120);
    expect(left.y).toBe(right.y);
  });
});
