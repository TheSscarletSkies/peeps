/** A stretch of the notch strip a pet may walk in, in pixels from the left edge. */
export interface Lane {
  start: number;
  end: number;
}

export type PetSize = "small" | "medium" | "large";

export const PET_SIZES: Record<PetSize, number> = {
  small: 22,
  medium: 26,
  large: 34,
};

export interface Layout {
  width: number;
  height: number;
  lanes: [Lane, ...Lane[]];
  /** Left edge of the "all pets" button. */
  iconX: number;
}

const WING_MIN = 64;
const EDGE = 12;
const WANDER = 28;
export const ICON = 20;
/** Screens without a notch still get a small pill at the top. */
const PILL_HEIGHT = 32;

/** Sizes the strip so every pet fits beside the camera with room to wander, plus the "all pets" button. */
export function layout(
  pets: number,
  notch: { width: number; height: number },
  size: number,
): Layout {
  const slot = size + 6;
  const height = Math.max(
    notch.height || PILL_HEIGHT,
    Math.round((size * 100) / 120) + 8,
  );
  if (notch.width <= 0) {
    const width = Math.max(150, pets * slot + WANDER + EDGE * 2 + ICON + 6);
    return {
      width,
      height,
      lanes: [{ start: EDGE, end: width - EDGE - ICON - 6 - size }],
      iconX: width - EDGE - ICON,
    };
  }
  const perWing = Math.max(1, Math.ceil(pets / 2));
  const wing = Math.max(
    WING_MIN,
    (perWing - 1) * slot + WANDER + EDGE + size + 4 + ICON + 6,
  );
  const width = Math.round(notch.width + wing * 2);
  const inner = (width - notch.width) / 2;
  return {
    width,
    height,
    lanes: [
      { start: EDGE, end: inner - size - 4 },
      { start: inner + notch.width + 4, end: width - EDGE - ICON - 6 - size },
    ],
    iconX: width - EDGE - ICON,
  };
}

/** Pets alternate wings so neither side gets crowded. */
export function laneFor(index: number, laneCount: number): number {
  return index % laneCount;
}

export function spot(lane: Lane, random: number): number {
  return lane.start + Math.max(0, lane.end - lane.start) * random;
}

/** Where a dropped pet lands: the closest point of the closest lane. */
export function landing(lanes: Lane[], x: number): { lane: number; x: number } {
  let best = { lane: 0, x, distance: Infinity };
  lanes.forEach((lane, index) => {
    const clamped = Math.min(
      Math.max(x, lane.start),
      Math.max(lane.start, lane.end),
    );
    const distance = Math.abs(clamped - x);
    if (distance < best.distance) best = { lane: index, x: clamped, distance };
  });
  return { lane: best.lane, x: best.x };
}

/** A slow waddle: about 30 px a second. */
export function walkMs(from: number, to: number): number {
  return Math.round(Math.abs(to - from) * 34 + 200);
}
