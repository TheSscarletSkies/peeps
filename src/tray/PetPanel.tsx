import { useState } from "react";

import { addNote, decide } from "../lib/bridge";
import type { Delivery, Pet } from "../lib/types";

interface Props {
  pet: Pet;
  onTyping: (typing: boolean) => void;
}

export function PetPanel({ pet, onTyping }: Props) {
  const [text, setText] = useState("");
  const [delivery, setDelivery] = useState<Delivery>("nextSession");
  const [status, setStatus] = useState<string | null>(null);

  const permission = pet.permission;

  const feed = async () => {
    if (!text.trim()) return;
    try {
      await addNote(pet.id, text, delivery);
      setText("");
      setStatus(
        delivery === "nextSession"
          ? `${pet.name} reads this when its next session starts.`
          : `${pet.name} reads this after its next step.`,
      );
    } catch (error) {
      setStatus(String(error));
    }
  };

  return (
    <section className="panel" aria-label={pet.name}>
      <header className="panel__head">
        <span className="panel__name">{pet.name}</span>
        <span className="panel__headline">{pet.headline}</span>
      </header>

      {permission && (
        <div className="panel__permission">
          <code>{permission.summary}</code>
          <div className="panel__actions">
            <button
              className="button button--primary"
              onClick={() => decide(permission.requestId, "allow")}
            >
              Allow
            </button>
            <button
              className="button"
              onClick={() => decide(permission.requestId, "deny")}
            >
              Deny
            </button>
          </div>
        </div>
      )}

      {pet.needs.length > 0 && (
        <ul className="panel__needs">
          {pet.needs.map((need) => (
            <li key={need.checkId} data-signal={need.signal}>
              {need.message}
            </li>
          ))}
        </ul>
      )}

      <form
        className="feed"
        onSubmit={(event) => {
          event.preventDefault();
          void feed();
        }}
      >
        <label className="visually-hidden" htmlFor={`note-${pet.id}`}>
          Note for {pet.name}
        </label>
        <input
          id={`note-${pet.id}`}
          value={text}
          placeholder={`Leave ${pet.name} a note`}
          onChange={(event) => setText(event.target.value)}
          onFocus={() => onTyping(true)}
          onBlur={() => onTyping(false)}
        />
        <select
          aria-label="When to deliver"
          value={delivery}
          onChange={(event) => setDelivery(event.target.value as Delivery)}
        >
          <option value="nextSession">Next session</option>
          <option value="nextStep">Next step</option>
        </select>
        <button
          className="button button--primary"
          type="submit"
          disabled={!text.trim()}
        >
          Feed
        </button>
      </form>
      {status && <p className="panel__status">{status}</p>}
    </section>
  );
}
