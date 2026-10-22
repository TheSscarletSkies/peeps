import type { PetKind } from "../lib/types";
import { doing } from "../tracker/areas";

const COLORS = [
  "#FFD2BC",
  "#FFC9D6",
  "#DFCFFF",
  "#C9E0FF",
  "#C6EFD8",
  "#FFE7C9",
];
const KINDS: PetKind[] = ["bao", "gyoza", "wonton"];

/** A friend's peep looks the same every time, picked from their code. */
export function friendLook(code: string): { color: string; kind: PetKind } {
  let hash = 0;
  for (const char of code) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return {
    color: COLORS[hash % COLORS.length] ?? "#FFD2BC",
    kind: KINDS[(hash >>> 8) % KINDS.length] ?? "bao",
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
