import { describe, expect, it } from "vitest";

import { stickerFor, withoutEmoji } from "./nudgeArt";

describe("nudge art", () => {
  it("swaps emoji for peeps' own drawings", () => {
    expect(withoutEmoji("Take a break ☕")).toBe("Take a break");
    expect(withoutEmoji("💧 Drink  water 👍🏽")).toBe("Drink water");
    expect(stickerFor("Take a break ☕")).toBe("tea");
    expect(stickerFor("Drink water")).toBe("water");
    expect(stickerFor("Finance exam")).toBe("study");
    expect(stickerFor("Pay rent")).toBe("bell");
  });
});
