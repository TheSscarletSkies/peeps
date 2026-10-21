import { useId } from "react";

import type { Reaction } from "../lib/types";

/** The dumplings' soft edge, the same tone a shade deeper at low opacity. */
const EDGE = {
  strokeOpacity: 0.45,
  strokeWidth: 1.4,
  strokeLinejoin: "round",
} as const;

/** Shade, glow and blush, the same recipe the dumplings use, so stickers look like they belong. */
function Defs({ id }: { id: string }) {
  return (
    <defs>
      <radialGradient id={`${id}shade`} cx="0.42" cy="0.32" r="0.8">
        <stop offset="0.5" stopColor="#B5785A" stopOpacity={0} />
        <stop offset="1" stopColor="#B5785A" stopOpacity={0.28} />
      </radialGradient>
      <radialGradient id={`${id}glow`} cx="0.34" cy="0.28" r="0.45">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity={0.75} />
        <stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
      </radialGradient>
      <radialGradient id={`${id}blush`}>
        <stop offset="0" stopColor="#FF8FA3" stopOpacity={0.75} />
        <stop offset="1" stopColor="#FF8FA3" stopOpacity={0} />
      </radialGradient>
    </defs>
  );
}

/** A soft body: fill with an edge, then shade and glow on top. */
function Soft({
  d,
  fill,
  edge,
  id,
}: {
  d: string;
  fill: string;
  edge: string;
  id: string;
}) {
  return (
    <>
      <path d={d} fill={fill} stroke={edge} {...EDGE} />
      <path d={d} fill={`url(#${id}shade)`} />
      <path d={d} fill={`url(#${id}glow)`} />
    </>
  );
}

/** Two dot eyes, a tiny mouth and blush, centred on (x, y). */
function Face({
  x,
  y,
  id,
  happy = false,
}: {
  x: number;
  y: number;
  id: string;
  happy?: boolean;
}) {
  return (
    <g>
      <ellipse
        cx={x - 6}
        cy={y + 3}
        rx="3.2"
        ry="2"
        fill={`url(#${id}blush)`}
      />
      <ellipse
        cx={x + 6}
        cy={y + 3}
        rx="3.2"
        ry="2"
        fill={`url(#${id}blush)`}
      />
      {happy ? (
        <path
          d={`M${x - 5.5} ${y}q1.5 -2 3 0M${x + 2.5} ${y}q1.5 -2 3 0`}
          stroke="#4A2E22"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
        />
      ) : (
        <>
          <circle cx={x - 4} cy={y} r="1.3" fill="#4A2E22" />
          <circle cx={x + 4} cy={y} r="1.3" fill="#4A2E22" />
        </>
      )}
      <path
        d={`M${x - 1.6} ${y + 2.4}q0.8 1 1.6 0q0.8 1 1.6 0`}
        stroke="#4A2E22"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
      />
    </g>
  );
}

const HEART =
  "M20 33C9 26 4.5 19.5 6.5 13.5 8.5 7.5 15.5 6.5 20 12.5 24.5 6.5 31.5 7.5 33.5 13.5 35.5 19.5 31 26 20 33Z";

/** Each reaction drawn in a 40 by 40 box, like a little sticker. */
export function Sticker({ kind }: { kind: Reaction }) {
  const id = useId().replace(/:/g, "");
  return (
    <g>
      <Defs id={id} />
      {kind === "heart" && (
        <>
          <Soft d={HEART} fill="#FFB8CB" edge="#D9668A" id={id} />
          <ellipse
            cx="12.5"
            cy="13"
            rx="2.6"
            ry="1.4"
            fill="#fff"
            opacity="0.85"
            transform="rotate(-35 12.5 13)"
          />
          <Face x={20} y={19} id={id} />
        </>
      )}
      {kind === "poke" && (
        <>
          {[0, 6].map((shift) => (
            <g
              key={shift}
              transform={`translate(${shift} ${shift * 0.3}) rotate(-38 20 20)`}
            >
              <rect
                x="3"
                y="17"
                width="34"
                height="4.6"
                rx="2.3"
                fill="#E9B27C"
                stroke="#9C6232"
                {...EDGE}
              />
              <rect
                x="3"
                y="17"
                width="9"
                height="4.6"
                rx="2.3"
                fill="#C9844C"
              />
              <path
                d="M13 18.3h20"
                stroke="#fff"
                strokeOpacity="0.6"
                strokeWidth="1"
                strokeLinecap="round"
              />
            </g>
          ))}
        </>
      )}
      {kind === "bonk" && (
        <>
          <rect
            x="1"
            y="17.5"
            width="9"
            height="5"
            rx="2.5"
            fill="#C9844C"
            stroke="#9C6232"
            {...EDGE}
          />
          <rect
            x="30"
            y="17.5"
            width="9"
            height="5"
            rx="2.5"
            fill="#C9844C"
            stroke="#9C6232"
            {...EDGE}
          />
          <Soft
            d="M14 12h12a8 8 0 0 1 0 16H14a8 8 0 0 1 0-16z"
            fill="#F7DAB0"
            edge="#B98552"
            id={id}
          />
          <ellipse
            cx="14"
            cy="15.5"
            rx="3"
            ry="1.3"
            fill="#fff"
            opacity="0.8"
          />
          <Face x={20} y={19.5} id={id} happy />
        </>
      )}
      {kind === "tea" && (
        <>
          <ellipse
            cx="20"
            cy="34"
            rx="15"
            ry="3.4"
            fill="#F1E2D0"
            stroke="#B9967A"
            {...EDGE}
          />
          <path
            d="M30 19a5 5 0 0 1 0 9"
            stroke="#C9A88A"
            strokeWidth="2.4"
            fill="none"
            strokeLinecap="round"
          />
          <Soft
            d="M7 16h24v7a12 12 0 0 1-24 0z"
            fill="#FFF6EC"
            edge="#B9967A"
            id={id}
          />
          <path d="M7.3 19h23.4" stroke="#FFB8CB" strokeWidth="2.6" />
          <Face x={19} y={24} id={id} happy />
          <g className="reaction__steam" fill="#fff" opacity="0.9">
            <circle cx="14" cy="10" r="2.2" />
            <circle cx="19" cy="7" r="2.8" />
            <circle cx="24.5" cy="10" r="2" />
          </g>
        </>
      )}
      {kind === "study" && (
        <>
          <Soft
            d="M4 12q8-3 16 1q8-4 16-1v20q-8-3-16 1q-8-4-16-1z"
            fill="#FFF6EC"
            edge="#B9967A"
            id={id}
          />
          <path
            d="M20 13v20"
            stroke="#B9967A"
            strokeOpacity="0.55"
            strokeWidth="1.2"
          />
          <path
            d="M27 11v9l2.4-1.8 2.4 1.8v-9.6"
            fill="#FFB8CB"
            stroke="#D9668A"
            {...EDGE}
          />
          <Face x={12} y={21} id={id} />
        </>
      )}
    </g>
  );
}

/** Where each sticker lands on the pet, in the pet's 120 by 100 drawing. */
const PLACE: Record<Reaction, { at: string; motion: string }> = {
  heart: { at: "translate(38 4) scale(1.1)", motion: "reaction__rise" },
  poke: { at: "translate(70 16) scale(0.95)", motion: "reaction__jab" },
  bonk: { at: "translate(34 -16) scale(1.3)", motion: "reaction__swing" },
  tea: { at: "translate(86 58) scale(0.9)", motion: "reaction__pop" },
  study: { at: "translate(84 56) scale(0.95)", motion: "reaction__pop" },
};

/** A friend's reaction on your peep, drawn in the dumpling's own style. */
export function ReactionArt({ kind }: { kind: Reaction }) {
  const place = PLACE[kind];
  return (
    <svg
      className={`reaction reaction--${kind}`}
      viewBox="0 0 120 100"
      aria-hidden="true"
    >
      <g transform={place.at}>
        <g className={place.motion}>
          <Sticker kind={kind} />
        </g>
      </g>
      {kind === "heart" && (
        <g
          className="reaction__rise reaction__rise--late"
          fill="#FFB8CB"
          opacity="0.9"
        >
          <path transform="translate(22 30) scale(0.32)" d={HEART} />
          <path transform="translate(88 24) scale(0.26)" d={HEART} />
        </g>
      )}
      {kind === "bonk" && (
        <g
          className="reaction__stars"
          fill="#FFD66B"
          stroke="#E0A93A"
          strokeWidth="0.8"
          strokeLinejoin="round"
        >
          <path d="M30 26l2 5 5 1-5 2-2 5-2-5-5-2 5-1z" />
          <path d="M90 22l2 4 4 1-4 2-2 4-2-4-4-2 4-1z" />
        </g>
      )}
    </svg>
  );
}
