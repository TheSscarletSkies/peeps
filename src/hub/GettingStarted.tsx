import { useEffect, useState } from "react";

import { hooksStatus } from "../lib/bridge";
import type { Snapshot } from "../lib/types";
import { Dumpling } from "../pets/Dumpling";
import { gettingStarted, type Destination } from "./setupSteps";

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
  // A slim bar with the next step; the full list is one click away.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void hooksStatus().then((status) =>
      setHooks(status.installed && status.agent !== null),
    );
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

  const next = steps.find((step) => !step.done);
  const done = steps.length - left;

  return (
    <section
      className="card started"
      aria-label="Getting started"
      data-open={open || undefined}
    >
      <header className="started__head">
        <Dumpling
          kind={snapshot.helper.kind}
          color={snapshot.helper.color}
          mood="chill"
          expression="love"
          heat={0}
          size={40}
        />
        <div className="started__summary">
          <h2>
            Set up · {done} of {steps.length}
          </h2>
          <span
            className="started__bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={steps.length}
            aria-valuenow={done}
            aria-label="Setup progress"
          >
            <span style={{ width: `${(done / steps.length) * 100}%` }} />
          </span>
        </div>
        {next && !open && (
          <span className="started__next">
            <span>
              Next: <strong>{next.title}</strong>
            </span>
            <button
              className="button button--small button--primary"
              onClick={() => onGo(next.go)}
            >
              Go
            </button>
          </span>
        )}
        <button className="tray__link" onClick={() => setOpen(!open)}>
          {open ? "Show less" : "Show all"}
        </button>
        <button className="tray__link" onClick={hide}>
          Hide
        </button>
      </header>
      {open && (
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
      )}
    </section>
  );
}
