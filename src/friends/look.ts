import type { PetKind } from "../lib/types";
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

/** A friend's peep looks the same every time, picked from their code. */
export function friendLook(code: string): {
  color: string;
  kind: PetKind;
  wear: Wear | null;
} {
  let hash = 0;
  for (const char of code) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return {
    color: COLORS[hash % COLORS.length] ?? "#FFD2BC",
    kind: KINDS[(hash >>> 8) % KINDS.length] ?? "bao",
    wear: WEAR[(hash >>> 16) % WEAR.length] ?? null,
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
