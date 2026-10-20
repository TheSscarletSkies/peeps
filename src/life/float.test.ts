import { describe, expect, it } from "vitest";

import { BOX, clampSpot, defaultSpot, openRect, PANEL } from "./float";

const SCREEN = { left: 0, top: 0, width: 1440, height: 860 };

describe("floating pet", () => {
  it("starts bottom right and never leaves the screen", () => {
    const spot = defaultSpot(SCREEN);
    expect(spot.x + BOX).toBeLessThanOrEqual(1440);
    expect(spot.y).toBeGreaterThan(500);
    expect(clampSpot({ x: -50, y: 5000 }, SCREEN)).toEqual({
      x: 8,
      y: 860 - BOX - 8,
    });
  });

  it("opens towards the side with room and keeps the pet still", () => {
    const nearRight = openRect({ x: 1340, y: 600 }, 500, SCREEN);
    expect(nearRight.side).toBe("left");
    expect(nearRight.x + nearRight.width).toBe(1340 + BOX);
    expect(nearRight.y + nearRight.height).toBeLessThanOrEqual(860);
    expect(nearRight.y + nearRight.petTop).toBe(600);

    const nearLeft = openRect({ x: 20, y: 40 }, 300, SCREEN);
    expect(nearLeft.side).toBe("right");
    expect(nearLeft.x).toBe(20);
    expect(nearLeft.petTop).toBe(0);
    expect(nearLeft.width).toBeGreaterThan(PANEL);
  });

  it("fits a tall panel on a short screen", () => {
    const rect = openRect({ x: 600, y: 300 }, 2000, SCREEN);
    expect(rect.height).toBeLessThanOrEqual(860);
    expect(rect.y).toBeGreaterThanOrEqual(0);
  });
});
