import { describe, expect, it } from "vitest";

import { nextMonday } from "./ReviewToggle";

describe("weekly review start", () => {
  it("is always the coming Monday", () => {
    expect(nextMonday(new Date(2026, 9, 20))).toBe("2026-10-26");
    expect(nextMonday(new Date(2026, 9, 25))).toBe("2026-10-26");
    expect(nextMonday(new Date(2026, 9, 26))).toBe("2026-11-02");
  });
});
