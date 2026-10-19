import { toBlob } from "html-to-image";
import { useRef, useState } from "react";

import { saveImage } from "../lib/bridge";
import type { Snapshot } from "../lib/types";
import { Dumpling } from "../pets/Dumpling";
import { recap } from "./recap";

const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function RecapPage({ snapshot }: { snapshot: Snapshot }) {
  const card = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("");
  const week = recap(snapshot.helper, snapshot.pets, new Date());
  const { helper } = snapshot;

  const render = async () => {
    if (!card.current) throw new Error("Nothing to share yet.");
    const blob = await toBlob(card.current, {
      pixelRatio: 2,
      style: { borderRadius: "0" },
    });
    if (!blob) throw new Error("Could not draw the card.");
    return blob;
  };

  const save = async () => {
    try {
      const where = await saveImage(`peeps week ${week.range}`, await render());
      setStatus(`Saved to ${where}`);
    } catch (error) {
      setStatus(String(error));
    }
  };

  const copy = async () => {
    try {
      const blob = await render();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      setStatus("Copied. Paste it anywhere.");
    } catch {
      setStatus("Copying isn't allowed here, so save it instead.");
    }
  };

  return (
    <div className="recap">
      <div ref={card} className="recap-card">
        <header className="recap-card__head">
          <span className="recap-card__brand">
            <Dumpling
              kind={helper.kind}
              color={helper.color}
              mood="chill"
              heat={0}
              size={34}
            />
            my week with peeps
          </span>
          <span className="recap-card__range">{week.range}</span>
        </header>

        <div className="recap-card__hero">
          <strong>{week.hours}</strong>
          <span>hours of agents working for me</span>
        </div>

        <dl className="recap-card__stats">
          <Stat label="tokens" value={compact.format(week.tokens)} />
          <Stat label="to-dos done" value={String(week.todosDone)} />
          <Stat label="drafts written" value={String(week.drafts)} />
          <Stat label="busiest day" value={week.busiestDay ?? "none"} />
        </dl>

        <ul className="recap-card__pets">
          {week.lines.map((line) => (
            <li key={line.id} style={{ ["--pet" as string]: line.color }}>
              <Dumpling
                seed={line.id}
                kind={line.kind}
                color={line.color}
                mood={line.hours > 0 ? "working" : "stalled"}
                heat={0}
                size={46}
              />
              <span className="recap-card__name">{line.name}</span>
              <span className="recap-card__hours">{line.hours}h</span>
            </li>
          ))}
        </ul>

        <div className="recap-card__lineup" aria-hidden="true">
          {week.lines.map((line) => (
            <Dumpling
              key={line.id}
              seed={line.id}
              kind={line.kind}
              color={line.color}
              mood="chill"
              expression="celebrate"
              heat={0}
              size={76}
            />
          ))}
          <Dumpling
            kind={helper.kind}
            color={helper.color}
            mood="chill"
            expression="celebrate"
            heat={0}
            size={64}
          />
        </div>

        <footer className="recap-card__foot">made with peeps</footer>
      </div>

      <div className="recap__actions">
        <button className="button button--primary" onClick={() => void save()}>
          Save image
        </button>
        <button className="button" onClick={() => void copy()}>
          Copy
        </button>
        {status && <p className="setup__hint">{status}</p>}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
