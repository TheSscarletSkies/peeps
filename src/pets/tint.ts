const HOT = "#FF9A8B";

function channels(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  const full =
    value.length === 3 ? [...value].map((c) => c + c).join("") : value;
  const number = Number.parseInt(full, 16);
  if (full.length !== 6 || Number.isNaN(number)) return [0, 0, 0];
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
}

/** Blends two hex colours; `amount` 0 keeps `from`, 1 gives `to`. */
export function mix(from: string, to: string, amount: number): string {
  const t = Math.min(1, Math.max(0, amount));
  const a = channels(from);
  const b = channels(to);
  return (
    "#" +
    a
      .map((channel, i) => Math.round(channel + ((b[i] ?? 0) - channel) * t))
      .map((channel) => channel.toString(16).padStart(2, "0"))
      .join("")
  );
}

/** A pet's body colour, warmed slightly as it burns tokens faster. Most of the flush is in the blush. */
export function flushed(color: string, heat: number): string {
  return mix(color, HOT, heat * 0.15);
}

function toHsl([r, g, b]: [number, number, number]): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === rn
      ? (gn - bn) / d + (gn < bn ? 6 : 0)
      : max === gn
        ? (bn - rn) / d + 2
        : (rn - gn) / d + 4;
  return [h / 6, s, l];
}

function fromHsl([h, s, l]: [number, number, number]): string {
  const hue = (p: number, q: number, t: number) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (u < 1 / 6) return p + (q - p) * 6 * u;
    if (u < 1 / 2) return q;
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return (
    "#" +
    [hue(p, q, h + 1 / 3), hue(p, q, h), hue(p, q, h - 1 / 3)]
      .map((c) =>
        Math.round(c * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

/**
 * A pastel made a touch richer for drawing: more colour and a little less white, so pets read
 * as soft but vivid on light pages and dark ones. Greys stay grey.
 */
export function vivid(color: string): string {
  const [h, s, l] = toHsl(channels(color));
  if (s < 0.05) return color;
  return fromHsl([h, Math.min(1, s * 1.35 + 0.08), Math.max(0, l - 0.05)]);
}

/** The pet's own colour, much darker, for a soft edge that isn't a black line. */
export function edge(color: string): string {
  const [h, s] = toHsl(channels(color));
  return fromHsl([h, Math.min(1, s * 0.6 + 0.2), 0.42]);
}
