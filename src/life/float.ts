/** Where the floating pet sits: the top left of its box, in screen pixels. */
export interface Spot {
  x: number;
  y: number;
}

export interface Area {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const BOX = 76;
export const PANEL = 380;
const GAP = 8;
const MARGIN = 8;

/** Keeps the pet on screen, a little clear of the edges. */
export function clampSpot(spot: Spot, area: Area): Spot {
  return {
    x: Math.min(
      Math.max(spot.x, area.left + MARGIN),
      area.left + area.width - BOX - MARGIN,
    ),
    y: Math.min(
      Math.max(spot.y, area.top + MARGIN),
      area.top + area.height - BOX - MARGIN,
    ),
  };
}

/** Out of the way by default: bottom right, above the taskbar or Dock. */
export function defaultSpot(area: Area): Spot {
  return clampSpot(
    {
      x: area.left + area.width - BOX - 24,
      y: area.top + area.height - BOX - 120,
    },
    area,
  );
}

export interface OpenRect {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Which side of the pet the panel opens on. */
  side: "left" | "right";
  /** The pet's offset from the top of the window, so it stays where it was. */
  petTop: number;
}

/** The window while the panel is open: the pet stays put and the panel opens towards the roomier side. */
export function openRect(
  spot: Spot,
  panelHeight: number,
  area: Area,
): OpenRect {
  const right = area.left + area.width - (spot.x + BOX);
  const left = spot.x - area.left;
  const side = right >= PANEL + GAP || right >= left ? "right" : "left";
  const width = BOX + GAP + PANEL;
  const height = Math.min(Math.max(BOX, panelHeight), area.height - MARGIN * 2);
  const y = Math.min(
    Math.max(spot.y, area.top + MARGIN),
    area.top + area.height - height - MARGIN,
  );
  return {
    x: side === "right" ? spot.x : spot.x - GAP - PANEL,
    y,
    width,
    height,
    side,
    petTop: spot.y - y,
  };
}
