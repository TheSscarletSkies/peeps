/** How one pet's build differs from the base shape. Stable for a given seed. */
export interface Variant {
  /** Horizontal stretch: above 1 is chubbier. */
  width: number;
  /** Vertical stretch: above 1 is taller. */
  height: number;
  /** Extra space between the eyes, in drawing units. */
  eyeSpread: number;
  /** Blush size relative to the base. */
  blush: number;
}

export const BASE: Variant = { width: 1, height: 1, eyeSpread: 0, blush: 1 };

// FNV-1a: tiny, fast and stable across runs, which is all a look needs.
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

/** Picks a value in [min, max] from a few bits of the hash, so each trait varies on its own. */
function pick(seed: number, shift: number, min: number, max: number): number {
  const unit = ((seed >>> shift) & 0xff) / 0xff;
  return min + unit * (max - min);
}

/** A pet may be a little wider than tall, never so much that it looks squashed. */
const MAX_SQUASH = 0.06;

export function variantFor(seed: string): Variant {
  const value = hash(seed);
  const width = pick(value, 0, 0.93, 1.1);
  return {
    width,
    height: Math.max(pick(value, 8, 0.95, 1.1), width - MAX_SQUASH),
    eyeSpread: pick(value, 16, -2.5, 3),
    blush: pick(value, 24, 0.85, 1.25),
  };
}
