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
