import { useCallback, useEffect, useRef, useState } from "react";

import { onNudge } from "../lib/bridge";
import type { Nudge } from "../lib/types";

/** The reminder the pets are saying right now, with Done and Later. Later brings it back after the minutes chosen. */
export function useNudge(): {
  nudge: Nudge | null;
  dismiss: () => void;
  later: (minutes: number) => void;
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
  const later = useCallback(
    (minutes: number) => {
      const again = nudge;
      setNudge(null);
      window.clearTimeout(timer.current);
      if (again)
        timer.current = window.setTimeout(
          () => setNudge(again),
          minutes * 60_000,
        );
    },
    [nudge],
  );

  return { nudge, dismiss, later };
}
