import { describe, expect, it } from "vitest";

import { laneFor, lanes, spot, stripWidth, PET_SIZE } from "./roam";

describe("roam", () => {
  it("keeps pets out of the camera notch", () => {
    const width = stripWidth(4, 190);
    const [left, right = left] = lanes(width, 190);
    const wing = (width - 190) / 2;
    expect(left.end + PET_SIZE).toBeLessThanOrEqual(wing);
    expect(right.start).toBeGreaterThanOrEqual(wing + 190);
    expect(right.end + PET_SIZE).toBeLessThanOrEqual(width);
  });

  it("fits every pet in a wing side by side", () => {
    const width = stripWidth(6, 190);
    for (const lane of lanes(width, 190)) {
      expect(lane.end - lane.start).toBeGreaterThanOrEqual(2 * (PET_SIZE + 6));
    }
  });

  it("grows the wings as products are added", () => {
    expect(stripWidth(8, 190)).toBeGreaterThan(stripWidth(2, 190));
  });

  it("uses one lane without a notch", () => {
    const width = stripWidth(3, 0);
    expect(lanes(width, 0)).toHaveLength(1);
    expect(laneFor(5, 1)).toBe(0);
  });

  it("spots stay inside their lane", () => {
    const lane = { start: 10, end: 60 };
    expect(spot(lane, 0)).toBe(10);
    expect(spot(lane, 1)).toBe(60);
  });
});
