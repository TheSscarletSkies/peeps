import type { Reaction } from "../lib/types";

/** What a friend's reaction looks like on your peep, drawn in the dumpling's own style. */
export function ReactionArt({ kind }: { kind: Reaction }) {
  return (
    <svg
      className={`reaction reaction--${kind}`}
      viewBox="0 0 120 100"
      aria-hidden="true"
    >
      {kind === "heart" && (
        // A heart made of steam, puffing up out of the bun.
        <g className="reaction__rise">
          <path
            d="M60 44c-9-9-24-4-22 8 2 10 22 22 22 22s20-12 22-22c2-12-13-17-22-8z"
            fill="#ffd6e0"
            stroke="#ff9fb5"
            strokeWidth="2.5"
          />
          <circle cx="44" cy="80" r="5" fill="#fff" opacity="0.8" />
          <circle cx="76" cy="84" r="4" fill="#fff" opacity="0.7" />
          <circle cx="60" cy="90" r="3" fill="#fff" opacity="0.6" />
        </g>
      )}
      {kind === "poke" && (
        <g className="reaction__jab" stroke="#b9773f" strokeLinecap="round">
          <line x1="132" y1="18" x2="92" y2="52" strokeWidth="4" />
          <line x1="136" y1="28" x2="95" y2="58" strokeWidth="4" />
        </g>
      )}
      {kind === "bonk" && (
        <>
          <g className="reaction__swing">
            <rect x="18" y="4" width="16" height="8" rx="4" fill="#b9773f" />
            <rect x="30" y="0" width="60" height="16" rx="8" fill="#f2cf9b" />
            <rect x="86" y="4" width="16" height="8" rx="4" fill="#b9773f" />
          </g>
          <g className="reaction__stars" fill="#ffd66b">
            <path d="M30 26l2 5 5 1-5 2-2 5-2-5-5-2 5-1z" />
            <path d="M90 22l2 4 4 1-4 2-2 4-2-4-4-2 4-1z" />
          </g>
        </>
      )}
      {kind === "study" && (
        // A little open book with a bookmark, held up like a seat being saved.
        <g className="reaction__pop">
          <path
            d="M78 70l14 4 14-4v18l-14 4-14-4z"
            fill="#fff8ef"
            stroke="#c9b29a"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M92 74v18" stroke="#c9b29a" strokeWidth="2" />
          <path d="M98 72v10l3-2 3 2V71" fill="#ff9fb5" />
        </g>
      )}
      {kind === "tea" && (
        <g className="reaction__pop">
          <ellipse cx="98" cy="92" rx="18" ry="4" fill="#e9dccb" />
          <path
            d="M84 74h26v6a13 13 0 0 1-26 0z"
            fill="#fff8ef"
            stroke="#c9b29a"
            strokeWidth="2"
          />
          <path
            d="M110 77a5 5 0 0 1 0 8"
            fill="none"
            stroke="#c9b29a"
            strokeWidth="2"
          />
          <path
            className="reaction__steam"
            d="M92 68c-3-4 3-6 0-10M100 68c-3-4 3-6 0-10"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      )}
    </svg>
  );
}
