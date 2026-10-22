import { useEffect, useRef, useState, type ReactNode } from "react";

import { soft } from "../pets/tint";

export interface Seat {
  key: string;
  name: string;
  /** The pet's own colour, for its hands on the table. */
  color: string;
  /** The pet at this size, seated: no arms of its own, the table draws its hands. */
  pet: (size: number) => ReactNode;
}

const INK = "#5A3522";

/** The table's top, in percent of the scene: x of its width, y of its height. */
const TOP = { cx: 50, cy: 60.6, rx: 38.6, ry: 16.8 };

/** Where the far edge of the table is at this x. */
function farEdge(x: number): number {
  const t = (x - TOP.cx) / TOP.rx;
  return TOP.cy - TOP.ry * Math.sqrt(Math.max(0, 1 - t * t));
}

type Thing = "book" | "laptop" | "notebook" | "mug";

interface Spot {
  /** Centre of the pet's bottom edge. */
  x: number;
  y: number;
  front: boolean;
  /** What is in front of them on the table, and where. */
  thing: Thing;
  tx: number;
  ty: number;
}

function far(x: number, thing: Thing): Spot {
  const edge = farEdge(x);
  // Sitting up behind the far edge, their things just in front of them, below their faces.
  return { x, y: edge + 4, front: false, thing, tx: x, ty: edge + 11 };
}

function near(x: number, thing: Thing): Spot {
  // Leaning on the near edge, their things on the table right beside them.
  const side = x < 50 ? 1 : -1;
  return {
    x,
    y: x === 50 ? 94 : 88,
    front: true,
    thing,
    tx: x === 50 ? 63 : x + side * 12,
    ty: x === 50 ? TOP.cy + 9 : TOP.cy + 8,
  };
}

/** Where people sit as more join: the far side fills first, then the near side. */
const LAYOUTS: Spot[][] = [
  [far(50, "book")],
  [far(33, "book"), far(67, "laptop")],
  [far(22, "book"), far(50, "laptop"), far(78, "book")],
  [far(30, "book"), far(70, "laptop"), near(15, "notebook"), near(85, "mug")],
  [
    far(22, "book"),
    far(50, "laptop"),
    far(78, "book"),
    near(16, "notebook"),
    near(84, "mug"),
  ],
  [
    far(22, "book"),
    far(50, "laptop"),
    far(78, "book"),
    near(15, "notebook"),
    near(50, "book"),
    near(85, "mug"),
  ],
];

export const MAX_SEATS = LAYOUTS.length;
/** How big the scene is for this many people, so the window can fit it. */
export function deskSize(seats: number): { width: number; height: number } {
  const width = seats <= 1 ? 180 : seats <= 3 ? 240 : 300;
  return { width, height: Math.round(width * 0.85) };
}

const ARRIVAL_MS = 4000;

/** Who just sat down, so their name shows by itself for a moment. */
function useArrivals(keys: string[]): (key: string) => boolean {
  const since = useRef(new Map<string, number>());
  const [, redraw] = useState(0);
  const joined = keys.join(",");
  useEffect(() => {
    const now = Date.now();
    let added = false;
    for (const key of joined.split(",").filter(Boolean)) {
      if (!since.current.has(key)) {
        since.current.set(key, now);
        added = true;
      }
    }
    if (!added) return;
    redraw((n) => n + 1);
    // Left running on purpose: redrawing a table that has gone is harmless, and cancelling it
    // here would leave a name showing for good if the effect runs twice.
    window.setTimeout(() => redraw((n) => n + 1), ARRIVAL_MS + 50);
  }, [joined]);
  return (key) => Date.now() - (since.current.get(key) ?? 0) < ARRIVAL_MS;
}

const LINE = {
  stroke: INK,
  strokeWidth: 1.4,
  strokeLinejoin: "round" as const,
};

/** Plain things on the table, in paper and kraft tones; no faces, so only the peeps are characters. */
function ThingArt({ thing, cover }: { thing: Thing; cover: string }) {
  switch (thing) {
    case "book":
      return (
        <>
          <path d="M3 13l17 3 17-3v17l-17 4-17-4z" fill={cover} {...LINE} />
          <path d="M5 11l15 3v18l-15-3z" fill="#FFFBF4" {...LINE} />
          <path d="M35 11l-15 3v18l15-3z" fill="#FFFBF4" {...LINE} />
          <path
            d="M8 16l9 1.6M8 20l9 1.6M8 24l7 1.2M23 17.6l9-1.6M23 21.6l9-1.6"
            stroke={INK}
            strokeOpacity={0.3}
            strokeWidth={1}
            strokeLinecap="round"
          />
        </>
      );
    case "laptop":
      // Seen from across the table: the back of the lid, with a little bun on it.
      return (
        <>
          <path d="M6 8h28l2 20H4z" fill="#ECE4D8" {...LINE} />
          <path d="M2 28h36v4H2z" fill="#DDD2C2" {...LINE} />
          <path
            d="M20 15c-1 0-1.6.6-2 1.4-2.4.6-4 2.2-4 4.4 0 2 2.6 3 6 3s6-1 6-3c0-2.2-1.6-3.8-4-4.4-.4-.8-1-1.4-2-1.4z"
            fill="#FFF7EC"
            stroke={INK}
            strokeWidth={0.9}
          />
        </>
      );
    case "notebook":
      return (
        <>
          <rect
            x="7"
            y="8"
            width="26"
            height="26"
            rx="2.5"
            fill="#FFFBF4"
            {...LINE}
          />
          <path
            d="M12 15h16M12 20h16M12 25h11"
            stroke={INK}
            strokeOpacity={0.3}
            strokeWidth={1}
            strokeLinecap="round"
          />
          <path
            d="M7 12h-3M7 17h-3M7 22h-3M7 27h-3"
            stroke={INK}
            strokeWidth={1.4}
            strokeLinecap="round"
          />
          <path d="M26 30l7-9 2 1.5-7 9-2.6 1z" fill="#F2D894" {...LINE} />
        </>
      );
    case "mug":
      return (
        <>
          <path
            d="M10 14h18v14a6 6 0 0 1-6 6h-6a6 6 0 0 1-6-6z"
            fill="#FFFBF4"
            {...LINE}
          />
          <path d="M28 18a4.5 4.5 0 0 1 0 9" fill="none" {...LINE} />
          <path d="M14 18h10" stroke="#F2CFCC" strokeWidth={2.4} />
          <path
            d="M16 10c-1.6-2 1.6-3 0-5M22 10c-1.6-2 1.6-3 0-5"
            fill="none"
            stroke={INK}
            strokeOpacity={0.35}
            strokeWidth={1.2}
            strokeLinecap="round"
          />
        </>
      );
  }
}

const COVERS = ["#F2CFCC", "#E3D3BA", "#D9E2CD"];

/** Everyone in a session together around one low round table; hover a peep to see who it is. */
export function DeskScene({ seats }: { seats: Seat[] }) {
  const shown = seats.slice(0, MAX_SEATS);
  const layout = LAYOUTS[shown.length - 1] ?? LAYOUTS[0] ?? [];
  const { width, height } = deskSize(shown.length);
  const arriving = useArrivals(shown.map((seat) => seat.key));
  const pet = Math.round(width * (shown.length <= 2 ? 0.38 : 0.3));
  const thing = Math.round(pet * 0.5);
  const hand = Math.max(7, Math.round(pet * 0.15));

  const person = (seat: Seat, index: number) => {
    const spot = layout[index];
    if (!spot) return null;
    return (
      <div
        key={seat.key}
        className="desk__person"
        data-arriving={arriving(seat.key) || undefined}
        style={{ left: `${spot.x}%`, top: `${spot.y}%`, width: pet }}
      >
        {spot.front && <span className="desk__cushion" />}
        <span className="desk__pet">{seat.pet(pet)}</span>
        <span className="desk__label">{seat.name}</span>
      </div>
    );
  };

  // Their things on the table, held between two small hands in the pet's own colour.
  const holding = (seat: Seat, index: number) => {
    const spot = layout[index];
    if (!spot) return null;
    const handStyle = {
      width: hand,
      height: hand * 0.8,
      background: soft(seat.color),
    };
    // Hands hold the sides of what they're working on, overlapping its edges.
    const reach = -hand * 0.45;
    return (
      <div
        key={seat.key}
        className="desk__holding"
        style={{ left: `${spot.tx}%`, top: `${spot.ty}%` }}
      >
        <svg
          viewBox="0 0 40 40"
          aria-hidden="true"
          style={{ width: thing, height: thing }}
        >
          <ThingArt
            thing={spot.thing}
            cover={COVERS[index % COVERS.length] ?? "#F2CFCC"}
          />
        </svg>
        <span className="desk__hand" style={{ ...handStyle, left: reach }} />
        <span className="desk__hand" style={{ ...handStyle, right: reach }} />
      </div>
    );
  };

  return (
    <div
      className="desk"
      style={{ width, height }}
      aria-label={`At the table: ${shown.map((seat) => seat.name).join(", ")}`}
    >
      <div className="desk__scene" style={{ height }}>
        {shown.map((seat, index) =>
          layout[index]?.front ? null : person(seat, index),
        )}
        <svg className="desk__table" viewBox="0 0 200 120" aria-hidden="true">
          <g stroke={INK} strokeWidth="2.2" strokeLinejoin="round">
            <rect x="40" y="70" width="12" height="34" rx="4" fill="#D2A276" />
            <rect x="148" y="70" width="12" height="34" rx="4" fill="#D2A276" />
            <ellipse cx="100" cy="68" rx="92" ry="34" fill="#D2A276" />
            <ellipse cx="100" cy="62" rx="92" ry="34" fill="#E8C091" />
          </g>
          <ellipse
            cx="100"
            cy="62"
            rx="70"
            ry="22"
            fill="#EECDA3"
            opacity="0.6"
          />
          {/* The middle: papers, a book stack, a pencil cup, a mug and a little plant. */}
          <g stroke={INK} strokeWidth="1.3" strokeLinejoin="round">
            <path d="M52 56l26-6 7 15-26 6z" fill="#FFFBF4" />
            <path d="M118 68l25 4-3 13-25-4z" fill="#FFFBF4" />
            <rect x="80" y="55" width="32" height="8" rx="2" fill="#F2CFCC" />
            <rect x="82" y="48" width="29" height="8" rx="2" fill="#E3D3BA" />
            <rect x="85" y="41" width="23" height="8" rx="2" fill="#D9E2CD" />
            <path d="M121 43h12l-1.5 14h-9z" fill="#F2CFCC" />
            <path
              d="M138 50h14v10a4 4 0 0 1-4 4h-6a4 4 0 0 1-4-4z"
              fill="#FFFBF4"
            />
            <path d="M152 53a3 3 0 0 1 0 6" fill="none" />
            <rect
              x="66"
              y="69"
              width="11"
              height="9"
              rx="1.5"
              fill="#F6EAB6"
              transform="rotate(-8 71 73)"
            />
            <path d="M101 66h12l-1.6 10h-8.8z" fill="#E6B59A" />
          </g>
          <g stroke={INK} strokeWidth="2.4" strokeLinecap="round">
            <path d="M123 43l-2-9M127 43l1-11M130 43l3-8" />
          </g>
          <g stroke="#F2D894" strokeWidth="1.1" strokeLinecap="round">
            <path d="M123 43l-2-9M127 43l1-11M130 43l3-8" />
          </g>
          <g
            fill="#B9CFA8"
            stroke={INK}
            strokeWidth="1.1"
            strokeLinejoin="round"
          >
            <path d="M107 66c-6-1-9-6-7-11 5 1 8 5 7 11z" />
            <path d="M107 66c5-2 8-7 5-12-5 2-7 7-5 12z" />
          </g>
          <g
            stroke={INK}
            strokeOpacity="0.3"
            strokeWidth="1"
            strokeLinecap="round"
          >
            <path d="M57 58l17-4M58 62l15-3.5M122 72l15 2.6M121 76l11 1.8" />
          </g>
        </svg>
        {shown.map(holding)}
        {shown.map((seat, index) =>
          layout[index]?.front ? person(seat, index) : null,
        )}
      </div>
    </div>
  );
}
