import { useCallback, useEffect, useRef, useState } from "react";

import { onNudge } from "../lib/bridge";
import type { Nudge } from "../lib/types";

const LATER_MS = 15 * 60_000;

/** The reminder the pets are saying right now, with Done and Later. Later brings it back in 15 minutes. */
export function useNudge(): {
  nudge: Nudge | null;
  dismiss: () => void;
  later: () => void;
} {
  const [nudge, setNudge] = useState<Nudge | null>(null);
  const timer = useRef(0);

  useEffect(() => {
    const stop = onNudge(setNudge);
    return () => {
      void stop.then((unlisten) => unlisten());
      window.clearTimeout(timer.current);
    };
  }, []);

  const dismiss = useCallback(() => setNudge(null), []);
  const later = useCallback(() => {
    const again = nudge;
    setNudge(null);
    window.clearTimeout(timer.current);
    if (again)
      timer.current = window.setTimeout(() => setNudge(again), LATER_MS);
  }, [nudge]);

  return { nudge, dismiss, later };
}
