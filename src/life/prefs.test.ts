import { describe, expect, it } from "vitest";

import { parsePrefs, shown, toggleHidden } from "./prefs";

describe("notch prefs", () => {
  it("falls back to defaults for anything unreadable", () => {
    expect(parsePrefs(null)).toEqual({
      hidden: [],
      size: "medium",
      place: "auto",
    });
    expect(parsePrefs("not json")).toEqual({
      hidden: [],
      size: "medium",
      place: "auto",
    });
    expect(parsePrefs('{"size":"huge","hidden":[1,"a"]}')).toEqual({
      hidden: ["a"],
      size: "medium",
      place: "auto",
    });
  });

  it("hides and shows a pet", () => {
    const hidden = toggleHidden(
      { hidden: [], size: "small", place: "auto" },
      "funderly",
    );
    expect(hidden.hidden).toEqual(["funderly"]);
    expect(toggleHidden(hidden, "funderly").hidden).toEqual([]);
  });

  it("brings a hidden pet out when it needs you", () => {
    const prefs = {
      hidden: ["funderly"],
      size: "medium" as const,
      place: "auto" as const,
    };
    expect(shown("funderly", false, prefs)).toBe(false);
    expect(shown("funderly", true, prefs)).toBe(true);
    expect(shown("enigma", false, prefs)).toBe(true);
  });
});
