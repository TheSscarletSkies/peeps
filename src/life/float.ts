import type { PetSize } from "./roam";

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

export const BOX = 100;

/** The floating pet is bigger than the notch ones; large stays well short of taking over the desk. */
export const FLOAT_PET: Record<PetSize, number> = {
  small: 56,
  medium: 80,
  large: 104,
};

/** Room around the pet for its hands, bubble and shadow. */
export function boxFor(size: PetSize): number {
  return FLOAT_PET[size] + 20;
}

export const PANEL = 380;
const GAP = 8;
const MARGIN = 8;

/** Keeps the pet on screen, a little clear of the edges. */
export function clampSpot(
  spot: Spot,
  area: Area,
  box = BOX,
  width = box,
): Spot {
  return {
    x: Math.min(
      Math.max(spot.x, area.left + MARGIN),
      area.left + area.width - width - MARGIN,
    ),
    y: Math.min(
      Math.max(spot.y, area.top + MARGIN),
      area.top + area.height - box - MARGIN,
    ),
  };
}

/** Out of the way by default: bottom right, above the taskbar or Dock. */
export function defaultSpot(area: Area, box = BOX): Spot {
  return clampSpot(
    {
      x: area.left + area.width - box - 24,
      y: area.top + area.height - box - 120,
    },
    area,
    box,
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
  box = BOX,
  width = box,
): OpenRect {
  const right = area.left + area.width - (spot.x + width);
  const left = spot.x - area.left;
  const side = right >= PANEL + GAP || right >= left ? "right" : "left";
  const total = width + GAP + PANEL;
  const height = Math.min(Math.max(box, panelHeight), area.height - MARGIN * 2);
  const y = Math.min(
    Math.max(spot.y, area.top + MARGIN),
    area.top + area.height - height - MARGIN,
  );
  return {
    x: side === "right" ? spot.x : spot.x - GAP - PANEL,
    y,
    width: total,
    height,
    side,
    petTop: spot.y - y,
  };
}
