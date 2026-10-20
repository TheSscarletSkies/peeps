import { useEffect, useState } from "react";

import type { PetSize } from "./roam";

/** How the notch looks: which pets hide and how big they are. Kept per computer. */
/** Where pets live: the notch or top of the screen, or floating anywhere. Auto floats when there is no notch. */
export type Place = "auto" | "notch" | "float";

export interface Prefs {
  hidden: string[];
  size: PetSize;
  place: Place;
}

const KEY = "peeps.notch";
const DEFAULTS: Prefs = { hidden: [], size: "medium", place: "auto" };
const PLACES: Place[] = ["auto", "notch", "float"];
const SIZES: PetSize[] = ["small", "medium", "large"];

export function parsePrefs(text: string | null): Prefs {
  try {
    const value = JSON.parse(text ?? "{}") as Partial<Prefs>;
    return {
      hidden: Array.isArray(value.hidden)
        ? value.hidden.filter((id): id is string => typeof id === "string")
        : DEFAULTS.hidden,
      size: SIZES.includes(value.size as PetSize)
        ? (value.size as PetSize)
        : DEFAULTS.size,
      place: PLACES.includes(value.place as Place)
        ? (value.place as Place)
        : DEFAULTS.place,
    };
  } catch {
    return DEFAULTS;
  }
}

function read(): Prefs {
  try {
    return parsePrefs(localStorage.getItem(KEY));
  } catch {
    return DEFAULTS;
  }
}

/** Hidden pets still come out when they need you. */
export function shown(id: string, urgent: boolean, prefs: Prefs): boolean {
  return urgent || !prefs.hidden.includes(id);
}

export function toggleHidden(prefs: Prefs, id: string): Prefs {
  const hidden = prefs.hidden.includes(id)
    ? prefs.hidden.filter((other) => other !== id)
    : [...prefs.hidden, id];
  return { ...prefs, hidden };
}

/** Shared by every window: a change in the peeps window shows up in the notch straight away. */
export function usePrefs(): [Prefs, (next: Prefs) => void] {
  const [prefs, setPrefs] = useState(read);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === KEY) setPrefs(parsePrefs(event.newValue));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const save = (next: Prefs) => {
    setPrefs(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Without storage the choice lasts until the app restarts.
    }
  };

  return [prefs, save];
}
