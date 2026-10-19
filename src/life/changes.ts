import type { Mood, Pet } from "../lib/types";

const BUSY: Mood[] = ["working", "sweating", "steaming"];
const DONE: Mood[] = ["chill", "stalled"];

/** Pets whose agents just finished: they were busy and are now calm. */
export function finished(previous: Pet[], next: Pet[]): string[] {
  const before = new Map(previous.map((pet) => [pet.id, pet.mood]));
  return next
    .filter((pet) => {
      const was = before.get(pet.id);
      return was !== undefined && BUSY.includes(was) && DONE.includes(pet.mood);
    })
    .map((pet) => pet.id);
}

/** Pets that were not there before. */
export function arrived(previous: Pet[], next: Pet[]): string[] {
  const known = new Set(previous.map((pet) => pet.id));
  return next.filter((pet) => !known.has(pet.id)).map((pet) => pet.id);
}

/** Pets that started needing attention since the last update. */
export function newlyUrgent(
  previous: Pet[],
  next: Pet[],
  urgent: (mood: Mood) => boolean,
): string[] {
  const before = new Map(previous.map((pet) => [pet.id, pet.mood]));
  return next
    .filter((pet) => {
      const was = before.get(pet.id);
      return urgent(pet.mood) && (was === undefined || !urgent(was));
    })
    .map((pet) => pet.id);
}
