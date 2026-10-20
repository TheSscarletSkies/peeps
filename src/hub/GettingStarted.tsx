import { useEffect, useState } from "react";

import { hooksStatus } from "../lib/bridge";
import type { Snapshot } from "../lib/types";
import { Dumpling } from "../pets/Dumpling";
import { gettingStarted, type Destination } from "./gettingStarted";

const KEY = "peeps.started";

function dismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === "done";
  } catch {
    return false;
  }
}

export function GettingStarted({
  snapshot,
  onGo,
}: {
  snapshot: Snapshot;
  onGo: (page: Destination) => void;
}) {
  const [hooks, setHooks] = useState(false);
  const [hidden, setHidden] = useState(dismissed);

  useEffect(() => {
    void hooksStatus().then((status) => setHooks(status.installed));
  }, [snapshot]);

  const steps = gettingStarted(snapshot, hooks);
  const left = steps.filter((step) => !step.done).length;
  if (hidden || left === 0) return null;

  const hide = () => {
    try {
      localStorage.setItem(KEY, "done");
    } catch {
      // The guide comes back next time; no harm.
    }
    setHidden(true);
  };

  return (
    <section className="card started" aria-label="Getting started">
      <header className="started__head">
        <Dumpling
          kind={snapshot.helper.kind}
          color={snapshot.helper.color}
          mood="chill"
          expression="love"
          heat={0}
          size={44}
        />
        <div>
          <h2>Let's get you set up</h2>
          <p className="setup__hint">
            {left} of {steps.length} left. I tick these off as you go.
          </p>
        </div>
        <button className="tray__link" onClick={hide}>
          Hide
        </button>
      </header>
      <ol className="started__steps">
        {steps.map((step) => (
          <li key={step.id} data-done={step.done || undefined}>
            <span className="started__check" aria-hidden="true">
              {step.done ? "✓" : ""}
            </span>
            <span className="started__text">
              <strong>{step.title}</strong>
              <span>{step.detail}</span>
            </span>
            {!step.done && (
              <button
                className="button button--small"
                onClick={() => onGo(step.go)}
              >
                Go
              </button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
