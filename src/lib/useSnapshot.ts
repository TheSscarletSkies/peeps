import { useEffect, useState } from "react";

import { loadSnapshot, onSnapshot } from "./bridge";
import type { Snapshot } from "./types";

export function useSnapshot(): Snapshot | null {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    let active = true;
    const unlisten = onSnapshot((next) => {
      if (active) setSnapshot(next);
    });
    loadSnapshot().then((first) => {
      if (active) setSnapshot(first);
    });
    return () => {
      active = false;
      unlisten.then((stop) => stop());
    };
  }, []);

  return snapshot;
}
