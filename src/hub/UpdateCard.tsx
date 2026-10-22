import { useState } from "react";

import { inApp, installUpdate } from "../lib/bridge";
import type { UpdateReady } from "../lib/types";
import { updateCard } from "./update";

/** A quiet note in Settings when a new peeps is out. Nothing installs until the button is pressed. */
export function UpdateCard({ update }: { update: UpdateReady | null }) {
  const [failed, setFailed] = useState<string | null>(null);
  const card = updateCard(update, inApp());
  if (!card) return null;
  const error = card.error ?? failed;

  const restart = async () => {
    setFailed(null);
    try {
      await installUpdate();
    } catch (reason) {
      setFailed(reason instanceof Error ? reason.message : String(reason));
    }
  };

  return (
    <section className="card update" aria-label="Update">
      <div className="update__text">
        <h2>{card.title}</h2>
        <p className="setup__hint">
          It downloads and installs when you restart. Your to-dos and settings
          stay as they are.
        </p>
        {error && <p className="tray__error">{error}</p>}
      </div>
      <button
        className="button button--primary"
        disabled={card.busy}
        onClick={() => void restart()}
      >
        {card.action}
      </button>
    </section>
  );
}
