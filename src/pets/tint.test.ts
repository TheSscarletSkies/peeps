import { describe, expect, it } from "vitest";

import { flushed, mix } from "./tint";

describe("mix", () => {
  it("returns the ends of the range", () => {
    expect(mix("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mix("#000000", "#ffffff", 1)).toBe("#ffffff");
  });

  it("blends halfway and clamps the amount", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mix("#000000", "#ffffff", 4)).toBe("#ffffff");
  });

  it("accepts short hex", () => {
    expect(mix("#fff", "#000", 0)).toBe("#ffffff");
  });
});

describe("flushed", () => {
  it("leaves a calm pet its own colour", () => {
    expect(flushed("#F6E3B4", 0)).toBe("#f6e3b4");
  });

  it("reddens a hot pet without losing its colour entirely", () => {
    const hot = flushed("#F6E3B4", 1);
    expect(hot).not.toBe("#ff7a5c");
    expect(hot).not.toBe("#f6e3b4");
  });
});
