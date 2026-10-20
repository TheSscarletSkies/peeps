import { useState } from "react";

import { addNote, decide } from "../lib/bridge";
import type { Mood, Pet, ProductNumbers } from "../lib/types";
import { NumbersStrip } from "../numbers/NumbersStrip";
import { announceFed } from "../life/events";
import { LivePet } from "../life/LivePet";

export const MOOD_LABEL: Record<Mood, string> = {
  needsYou: "Needs you",
  failing: "Failing",
  steaming: "Steaming",
  hungry: "Hungry",
  litterBox: "Litter box",
  sweating: "Sweating",
  working: "Working",
  stalled: "Napping",
  chill: "Chill",
};

interface Props {
  pet: Pet;
  celebrating?: boolean;
  arriving?: boolean;
  numbers?: ProductNumbers;
  /** Opens the pet's full panel: notes, strategy chat and brief. */
  onOpen: () => void;
}

export function ProductCard({
  pet,
  celebrating,
  arriving,
  numbers,
  onOpen,
}: Props) {
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const permission = pet.permission;

  const feed = async () => {
    if (!note.trim()) return;
    await addNote(pet.id, note, "nextSession");
    announceFed(pet.id);
    setNote("");
    setSent(true);
  };

  return (
    <article className="pet-card" style={{ ["--pet" as string]: pet.color }}>
      <div className="pet-card__stage">
        <LivePet
          id={pet.id}
          celebrating={celebrating}
          arriving={arriving}
          kind={pet.kind}
          color={pet.color}
          mood={pet.mood}
          heat={pet.heat}
          size={104}
        />
      </div>
      <div className="pet-card__body">
        <div className="pet-card__title">
          <h3>{pet.name}</h3>
          <span className="mood" data-mood={pet.mood}>
            {MOOD_LABEL[pet.mood]}
          </span>
        </div>
        <p className="pet-card__headline">{pet.headline}</p>
        <NumbersStrip productId={pet.id} name={pet.name} numbers={numbers} />
        <button className="tray__link pet-card__open" onClick={onOpen}>
          Ask {pet.name} · Brief
        </button>

        {permission && (
          <div className="pet-card__ask">
            <code>{permission.summary}</code>
            <div className="pet-card__actions">
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
          <ul className="pet-card__needs">
            {pet.needs.map((need) => (
              <li key={need.checkId}>{need.message}</li>
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
          <label className="visually-hidden" htmlFor={`card-note-${pet.id}`}>
            Note for {pet.name}
          </label>
          <input
            id={`card-note-${pet.id}`}
            value={note}
            placeholder={sent ? "Fed. Leave another?" : "Leave a note"}
            onChange={(event) => {
              setNote(event.target.value);
              setSent(false);
            }}
          />
          <button
            className="button button--primary"
            type="submit"
            disabled={!note.trim()}
          >
            Feed
          </button>
        </form>
      </div>
    </article>
  );
}
