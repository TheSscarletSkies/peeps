import { describe, expect, it } from "vitest";

import { variantFor } from "./variant";

describe("variantFor", () => {
  it("gives the same pet the same build every time", () => {
    expect(variantFor("funderly")).toEqual(variantFor("funderly"));
  });

  it("gives different products different builds", () => {
    const builds = ["funderly", "enigma-archives", "kaiveni-hiya", "shop"].map(
      (id) => JSON.stringify(variantFor(id)),
    );
    expect(new Set(builds).size).toBe(builds.length);
  });

  it("stays within a cute range", () => {
    for (let i = 0; i < 500; i += 1) {
      const v = variantFor(`product-${i}`);
      expect(v.width).toBeGreaterThanOrEqual(0.93);
      expect(v.width).toBeLessThanOrEqual(1.1);
      expect(v.height).toBeGreaterThanOrEqual(0.95);
      expect(v.height).toBeLessThanOrEqual(1.1);
      expect(v.width - v.height).toBeLessThanOrEqual(0.06 + 1e-9);
      expect(Math.abs(v.eyeSpread)).toBeLessThanOrEqual(3);
      expect(v.blush).toBeGreaterThanOrEqual(0.85);
    }
  });
});
