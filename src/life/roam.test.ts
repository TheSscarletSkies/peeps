import { describe, expect, it } from "vitest";

import { ICON, landing, layout, laneFor, PET_SIZES, spot } from "./roam";

const NOTCH = { width: 190, height: 34 };

describe("layout", () => {
  it("keeps pets out of the camera notch and clear of the button", () => {
    for (const size of Object.values(PET_SIZES)) {
      const { width, lanes, iconX } = layout(4, NOTCH, size);
      const [left, right = left] = lanes;
      const wing = (width - NOTCH.width) / 2;
      expect(left.end + size).toBeLessThanOrEqual(wing);
      expect(right.start).toBeGreaterThanOrEqual(wing + NOTCH.width);
      expect(right.end + size).toBeLessThanOrEqual(iconX);
      expect(iconX + ICON).toBeLessThanOrEqual(width);
    }
  });

  it("fits every pet in a wing side by side", () => {
    const size = PET_SIZES.large;
    for (const lane of layout(6, NOTCH, size).lanes) {
      expect(lane.end - lane.start).toBeGreaterThanOrEqual(2 * (size + 6));
    }
  });

  it("grows taller than the menu bar only for large pets", () => {
    expect(layout(3, NOTCH, PET_SIZES.small).height).toBe(34);
    expect(layout(3, NOTCH, PET_SIZES.large).height).toBeGreaterThanOrEqual(34);
  });

  it("uses one lane without a notch", () => {
    expect(layout(3, { width: 0, height: 0 }, 26).lanes).toHaveLength(1);
    expect(laneFor(5, 1)).toBe(0);
  });
});

describe("moving pets", () => {
  it("spots stay inside their lane", () => {
    const lane = { start: 10, end: 60 };
    expect(spot(lane, 0)).toBe(10);
    expect(spot(lane, 1)).toBe(60);
  });

  it("a pet dropped on the notch lands on the nearer side", () => {
    const lanes = [
      { start: 10, end: 80 },
      { start: 300, end: 380 },
    ];
    expect(landing(lanes, 120)).toEqual({ lane: 0, x: 80 });
    expect(landing(lanes, 260)).toEqual({ lane: 1, x: 300 });
    expect(landing(lanes, 340)).toEqual({ lane: 1, x: 340 });
  });
});
