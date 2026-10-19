/** A stretch of the notch strip a pet may walk in, in pixels from the left edge. */
export interface Lane {
  start: number;
  end: number;
}

export const PET_SIZE = 26;
const WING_MIN = 64;
const SLOT = PET_SIZE + 6;
const EDGE = 14;
const WANDER = 28;

/** Width of the strip: wide enough for every pet beside the notch, or a pill when there is none. */
export function stripWidth(pets: number, notchWidth: number): number {
  if (notchWidth <= 0) return Math.max(150, pets * SLOT + EDGE * 2 + 40);
  // Room for every pet in the wing side by side, plus a little to wander.
  const perWing = Math.ceil(pets / 2);
  const wing = Math.max(
    WING_MIN,
    (perWing - 1) * SLOT + WANDER + EDGE + PET_SIZE + 4,
  );
  return Math.round(notchWidth + wing * 2);
}

/** Where pets may walk: both wings beside the camera, or the whole pill. */
export function lanes(width: number, notchWidth: number): [Lane, ...Lane[]] {
  if (notchWidth <= 0) return [{ start: EDGE, end: width - EDGE - PET_SIZE }];
  const wing = (width - notchWidth) / 2;
  return [
    { start: EDGE, end: wing - PET_SIZE - 4 },
    { start: wing + notchWidth + 4, end: width - EDGE - PET_SIZE },
  ];
}

/** Pets alternate wings so neither side gets crowded. */
export function laneFor(index: number, laneCount: number): number {
  return index % laneCount;
}

export function spot(lane: Lane, random: number): number {
  return lane.start + Math.max(0, lane.end - lane.start) * random;
}

/** A slow waddle: about 30 px a second. */
export function walkMs(from: number, to: number): number {
  return Math.round(Math.abs(to - from) * 34 + 200);
}
