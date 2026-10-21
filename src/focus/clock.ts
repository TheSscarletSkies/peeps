import type { Focus, Mood } from "../lib/types";

/** "12:05" left, never below zero. */
export function left(focus: Focus, now: number): string {
  const seconds = Math.max(
    0,
    Math.ceil((Date.parse(focus.endsAt) - now) / 1000),
  );
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

/** How far through the current phase, from 0 to 1. */
export function progress(focus: Focus, now: number): number {
  const end = Date.parse(focus.endsAt);
  const start =
    focus.phase === "focus"
      ? Date.parse(focus.startedAt)
      : Date.parse(focus.startedAt) + focus.focusMinutes * 60_000;
  if (end <= start) return 1;
  return Math.min(1, Math.max(0, (now - start) / (end - start)));
}

export const LENGTHS = [15, 25, 50];

/** The pet works alongside during a focus session, unless something needs the user. */
export function moodWith(mood: Mood, focus: Focus | null): Mood {
  return focus?.phase === "focus" && mood !== "needsYou" ? "working" : mood;
}
