import { useEffect, useState } from "react";

import { onReaction } from "../lib/bridge";
import type { ReactionEvent } from "../lib/types";
import { announceReaction } from "../life/events";

const SHOW_MS = 6000;

/** Hands each friend's reaction to your peep, and keeps the line for a moment so a card can show it. */
export function useReactions(): ReactionEvent | null {
  const [last, setLast] = useState<ReactionEvent | null>(null);

  useEffect(() => {
    let timer = 0;
    const stop = onReaction((event) => {
      announceReaction("helper", event.reaction);
      setLast(event);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setLast(null), SHOW_MS);
    });
    return () => {
      window.clearTimeout(timer);
      void stop.then((unlisten) => unlisten());
    };
  }, []);

  return last;
}
