import { useEffect, useRef, useState } from "react";

import type { Mood, Pet } from "../lib/types";
import { arrived, finished, newlyUrgent } from "./changes";
import { boop, soundEnabled } from "./sound";

const CELEBRATE_MS = 2600;
const HATCH_MS = 1800;
const URGENT: Mood[] = [
  "needsYou",
  "failing",
  "steaming",
  "hungry",
  "litterBox",
];

/** Watches snapshots for finished work and new pets. Only one window should pass `withSound`. */
export function usePetEvents(pets: Pet[], withSound = false) {
  const previous = useRef<Pet[] | null>(null);
  const [celebrating, setCelebrating] = useState<Set<string>>(new Set());
  const [arriving, setArriving] = useState<Set<string>>(new Set());

  useEffect(() => {
    const before = previous.current;
    previous.current = pets;
    if (!before) return;

    const flash = (
      ids: string[],
      set: typeof setCelebrating,
      duration: number,
    ) => {
      if (ids.length === 0) return;
      set((current) => new Set([...current, ...ids]));
      window.setTimeout(
        () =>
          set((current) => {
            const next = new Set(current);
            ids.forEach((id) => next.delete(id));
            return next;
          }),
        duration,
      );
    };

    flash(finished(before, pets), setCelebrating, CELEBRATE_MS);
    flash(arrived(before, pets), setArriving, HATCH_MS);
    if (
      withSound &&
      soundEnabled() &&
      newlyUrgent(before, pets, (mood) => URGENT.includes(mood)).length > 0
    ) {
      boop();
    }
  }, [pets, withSound]);

  return { celebrating, arriving };
}
