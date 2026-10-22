import { describe, expect, it } from "vitest";

import { friendLook, presenceLine } from "./look";

describe("friends", () => {
  it("gives each friend the same look every time", () => {
    expect(friendLook("S4RAH-B9K2T")).toEqual(friendLook("S4RAH-B9K2T"));
    const looks = new Set(
      ["S4RAH-B9K2T", "AL1Q7-M3NVW", "Z0EEP-QW8RT", "7KQ2M-XH4PD"].map(
        (code) => friendLook(code).color,
      ),
    );
    expect(looks.size).toBeGreaterThan(1);
  });

  it("says what a friend is up to", () => {
    const now = Date.parse("2026-10-21T09:00:00Z");
    expect(presenceLine("focusing", "2026-10-21T09:18:00Z", now)).toBe(
      "Focusing · 18 min left",
    );
    expect(presenceLine("focusing", "2026-10-21T09:18:00Z", now, "study")).toBe(
      "Studying · 18 min left",
    );
    expect(presenceLine("around", null, now)).toBe("Around");
    expect(presenceLine("away", null, now)).toBe("Away");
  });
});
