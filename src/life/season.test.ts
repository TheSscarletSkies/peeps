import { describe, expect, it } from "vitest";

import { seasonalAccessory } from "./season";

describe("seasonalAccessory", () => {
  it("dresses up for the season", () => {
    expect(seasonalAccessory(new Date(2026, 9, 19))).toBeNull();
    expect(seasonalAccessory(new Date(2026, 9, 28))).toBe("witchHat");
    expect(seasonalAccessory(new Date(2026, 11, 5))).toBe("scarf");
    expect(seasonalAccessory(new Date(2027, 1, 20))).toBe("scarf");
    expect(seasonalAccessory(new Date(2027, 2, 1))).toBeNull();
  });
});
