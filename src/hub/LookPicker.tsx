import { useEffect, useState } from "react";

import { worn } from "../friends/look";
import { setHelperName, setWear } from "../lib/bridge";
import type { PeepWear } from "../lib/types";
import { Dumpling } from "../pets/Dumpling";

const LOOKS: { wear: PeepWear; label: string }[] = [
  { wear: "sprout", label: "Sprout" },
  { wear: "bow", label: "Bow" },
  { wear: "headphones", label: "Headphones" },
  { wear: "beanie", label: "Beanie" },
  { wear: "plain", label: "Nothing" },
];

/** What your peep is called, and what it wears, chosen by seeing it on the bun. */
export function LookPicker({ wear, name }: { wear: PeepWear; name: string }) {
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);
  return (
    <>
      <form
        className="feed"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          setHelperName(draft).catch((reason: unknown) =>
            setError(String(reason)),
          );
        }}
      >
        <label className="visually-hidden" htmlFor="peep-name">
          Your peep's name
        </label>
        <input
          id="peep-name"
          value={draft}
          maxLength={24}
          placeholder="Your peep's name"
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          className="button"
          disabled={!draft.trim() || draft.trim() === name}
        >
          Rename
        </button>
      </form>
      <div className="looks" role="radiogroup" aria-label="Your peep's look">
        {LOOKS.map((look) => (
          <button
            key={look.wear}
            type="button"
            role="radio"
            aria-checked={wear === look.wear}
            className="looks__option"
            onClick={() => {
              setError(null);
              setWear(look.wear).catch((reason: unknown) =>
                setError(String(reason)),
              );
            }}
          >
            <Dumpling mood="chill" heat={0} size={64} wear={worn(look.wear)} />
            <span>{look.label}</span>
          </button>
        ))}
      </div>
      {error && (
        <p className="tray__error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
