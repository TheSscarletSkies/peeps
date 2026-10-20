import { useEffect, useState } from "react";

import { readBrief, writeBrief } from "../lib/bridge";
import type { Pet } from "../lib/types";

/** The product's brief: what its pet knows when advising. Plain Markdown the user and agent share. */
export function BriefEditor({
  pet,
  onTyping,
}: {
  pet: Pet;
  onTyping: (typing: boolean) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void readBrief(pet.id, pet.name).then((brief) => {
      if (live) setText(brief);
    });
    return () => {
      live = false;
    };
  }, [pet.id, pet.name]);

  const save = async () => {
    if (text === null) return;
    try {
      await writeBrief(pet.id, text);
      setSaved(true);
      setError(null);
    } catch (reason) {
      setError(String(reason));
    }
  };

  if (text === null) return <p className="setup__hint">Opening the brief…</p>;

  return (
    <div className="brief">
      <p className="setup__hint">
        Goal, audience, voice and numbers. {pet.name}'s pet reads this before
        advising, and records decisions here.
      </p>
      <label className="visually-hidden" htmlFor={`brief-${pet.id}`}>
        {pet.name} brief
      </label>
      <textarea
        id={`brief-${pet.id}`}
        className="brief__text"
        value={text}
        spellCheck
        onChange={(event) => {
          setText(event.target.value);
          setSaved(false);
        }}
        onFocus={() => onTyping(true)}
        onBlur={() => onTyping(false)}
      />
      <div className="todo-form__actions">
        <button
          className="button button--primary"
          disabled={saved}
          onClick={() => void save()}
        >
          {saved ? "Saved" : "Save brief"}
        </button>
      </div>
      {error && <p className="tray__error">{error}</p>}
    </div>
  );
}
