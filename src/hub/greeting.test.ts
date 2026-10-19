import { describe, expect, it } from "vitest";

import { greeting } from "./greeting";

describe("greeting", () => {
  it("follows the time of day", () => {
    expect(greeting(2)).toBe("Up late");
    expect(greeting(9)).toBe("Good morning");
    expect(greeting(14)).toBe("Good afternoon");
    expect(greeting(21)).toBe("Good evening");
  });
});
