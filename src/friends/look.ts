import type { PeepWear, PetKind } from "../lib/types";
import type { BunWear } from "../pets/Bun";
import type { Wear } from "../pets/Dumpling";
import { doing } from "../tracker/areas";

const COLORS = [
  "#FFD2BC",
  "#FFC9D6",
  "#DFCFFF",
  "#C9E0FF",
  "#C6EFD8",
  "#FFE7C9",
];
const KINDS: PetKind[] = ["bao", "xiaolongbao", "gyoza", "mochi", "onigiri"];
const WEAR: (Wear | null)[] = [null, "bow", "headphones", "beanie", null];

/** What a peep wears, drawn: "plain" is nothing on its head. */
export function worn(wear: PeepWear): BunWear {
  return wear === "plain" ? null : wear;
}

/**
 * A friend's peep looks the same every time: wearing what they picked, or, from a peeps too old
 * to say, something picked from their code.
 */
export function friendLook(
  code: string,
  chosen: PeepWear | null = null,
): {
  color: string;
  kind: PetKind;
  wear: BunWear;
} {
  let hash = 0;
  for (const char of code) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return {
    color: COLORS[hash % COLORS.length] ?? "#FFD2BC",
    kind: KINDS[(hash >>> 8) % KINDS.length] ?? "bao",
    wear: chosen ? worn(chosen) : (WEAR[(hash >>> 16) % WEAR.length] ?? null),
  };
}

/** "Focusing · 18 min left", "Around", "Away". */
export function presenceLine(
  presence: "focusing" | "around" | "away",
  focusUntil: string | null,
  now: number,
  area: string | null = null,
): string {
  if (presence === "focusing" && focusUntil) {
    const minutes = Math.max(
      1,
      Math.round((Date.parse(focusUntil) - now) / 60_000),
    );
    return `${doing(area)} · ${minutes} min left`;
  }
  if (presence === "focusing") return doing(area);
  return presence === "around" ? "Around" : "Away";
}
