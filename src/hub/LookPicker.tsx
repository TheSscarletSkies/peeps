import { useState } from "react";

import { worn } from "../friends/look";
import { setWear } from "../lib/bridge";
import type { PeepWear } from "../lib/types";
import { Dumpling } from "../pets/Dumpling";

const LOOKS: { wear: PeepWear; label: string }[] = [
  { wear: "sprout", label: "Sprout" },
  { wear: "bow", label: "Bow" },
  { wear: "headphones", label: "Headphones" },
  { wear: "beanie", label: "Beanie" },
  { wear: "plain", label: "Nothing" },
];

/** What your peep wears, chosen by seeing it on the bun. */
export function LookPicker({ wear }: { wear: PeepWear }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <>
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
            <Dumpling
              kind="bao"
              color="#FFF3E3"
              mood="chill"
              heat={0}
              size={64}
              wear={worn(look.wear)}
            />
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
