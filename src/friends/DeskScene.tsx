import type { ReactNode } from "react";

import { Sticker, type StickerKind } from "./ReactionArt";

export interface Seat {
  key: string;
  name: string;
  /** The pet, drawn at the size it is given. */
  pet: (size: number) => ReactNode;
}

interface Spot {
  /** Centre of the pet's bottom edge, in percent of the scene. */
  x: number;
  y: number;
  front: boolean;
}

/** Where people sit as more join: the far side fills first, then the near side, like friends at a low table. */
const LAYOUTS: Spot[][] = [
  [{ x: 50, y: 49, front: false }],
  [
    { x: 32, y: 51, front: false },
    { x: 68, y: 51, front: false },
  ],
  [
    { x: 20, y: 55, front: false },
    { x: 50, y: 47, front: false },
    { x: 80, y: 55, front: false },
  ],
  [
    { x: 30, y: 49, front: false },
    { x: 70, y: 49, front: false },
    { x: 22, y: 99, front: true },
    { x: 78, y: 99, front: true },
  ],
  [
    { x: 18, y: 55, front: false },
    { x: 50, y: 47, front: false },
    { x: 82, y: 55, front: false },
    { x: 28, y: 99, front: true },
    { x: 72, y: 99, front: true },
  ],
  [
    { x: 18, y: 55, front: false },
    { x: 50, y: 47, front: false },
    { x: 82, y: 55, front: false },
    { x: 17, y: 97, front: true },
    { x: 50, y: 100, front: true },
    { x: 83, y: 97, front: true },
  ],
];

export const MAX_SEATS = LAYOUTS.length;
/** Every cushion the same oat, so the peeps are what you notice. */
const CUSHIONS = ["#EFE1CB"];
/** What each person is busy with: a book held up, a laptop, a notebook. */
const BUSY: StickerKind[] = [
  "study",
  "laptop",
  "study",
  "laptop",
  "study",
  "study",
];

/** How big the scene is for this many people, so the window can fit it. */
export function deskSize(seats: number): { width: number; height: number } {
  const width = seats <= 1 ? 170 : seats <= 3 ? 240 : 300;
  return { width, height: Math.round(width * 0.85) };
}

/** Everyone in a session together, around one low round table, each on a cushion with a name tag. */
export function DeskScene({ seats }: { seats: Seat[] }) {
  const shown = seats.slice(0, MAX_SEATS);
  const layout = LAYOUTS[shown.length - 1] ?? LAYOUTS[0] ?? [];
  const { width, height } = deskSize(shown.length);
  const pet = Math.round(width * (shown.length <= 2 ? 0.4 : 0.31));

  const person = (seat: Seat, index: number) => {
    const spot = layout[index];
    if (!spot) return null;
    return (
      <div
        key={seat.key}
        className="desk__person"
        data-front={spot.front || undefined}
        style={{ left: `${spot.x}%`, top: `${spot.y}%`, width: pet }}
      >
        <span
          className="desk__cushion"
          style={{ background: CUSHIONS[index % CUSHIONS.length] }}
        />
        <span className="desk__pet">{seat.pet(pet)}</span>
        <svg
          className="desk__holding"
          viewBox="0 0 40 40"
          aria-hidden="true"
          style={{ width: pet * 0.42, height: pet * 0.42 }}
        >
          <Sticker kind={BUSY[index % BUSY.length] ?? "study"} />
        </svg>
        {spot.front && <span className="desk__tag">{seat.name}</span>}
      </div>
    );
  };

  // The far side's name tags lie on the table, so they're drawn after it.
  const tag = (seat: Seat, index: number) => {
    const spot = layout[index];
    if (!spot || spot.front) return null;
    return (
      <span
        key={seat.key}
        className="desk__tag desk__tag--far"
        style={{ left: `${spot.x}%`, top: `${spot.y - 3}%` }}
      >
        {seat.name}
      </span>
    );
  };

  return (
    <div
      className="desk"
      style={{ width, height }}
      aria-label={`At the table: ${shown.map((seat) => seat.name).join(", ")}`}
    >
      {shown.map((seat, index) =>
        layout[index]?.front ? null : person(seat, index),
      )}
      <svg className="desk__table" viewBox="0 0 200 120" aria-hidden="true">
        <rect
          x="40"
          y="70"
          width="12"
          height="34"
          rx="4"
          fill="#D2A276"
          stroke="#4A2614"
          strokeWidth="2"
        />
        <rect
          x="148"
          y="70"
          width="12"
          height="34"
          rx="4"
          fill="#D2A276"
          stroke="#4A2614"
          strokeWidth="2"
        />
        <ellipse
          cx="100"
          cy="68"
          rx="92"
          ry="34"
          fill="#D2A276"
          stroke="#4A2614"
          strokeWidth="2.2"
        />
        <ellipse
          cx="100"
          cy="62"
          rx="92"
          ry="34"
          fill="#E8C091"
          stroke="#4A2614"
          strokeWidth="2.2"
        />
        <ellipse
          cx="100"
          cy="62"
          rx="70"
          ry="22"
          fill="#EECDA3"
          opacity="0.55"
        />
        {/* The middle of the table: papers, a book stack, a pencil cup and sticky notes. */}
        <g stroke="#4A2614" strokeWidth="1.4" strokeLinejoin="round">
          <path d="M58 52l24-6 6 14-24 6z" fill="#FFFDF7" />
          <path d="M120 66l22 4-3 12-22-4z" fill="#FFFDF7" />
          <rect x="86" y="54" width="30" height="8" rx="2" fill="#F2CFCC" />
          <rect x="88" y="47" width="27" height="8" rx="2" fill="#E9DCC7" />
          <rect x="90" y="41" width="22" height="7" rx="2" fill="#D9C3A2" />
          <path d="M124 44h12l-1.5 14h-9z" fill="#F8DEE3" />
          <path
            d="M126 44l-2-9M130 44l1-11M133 44l3-8"
            stroke="#4A2614"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path
            d="M126 44l-2-9M130 44l1-11M133 44l3-8"
            stroke="#F2D894"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <rect
            x="70"
            y="68"
            width="11"
            height="9"
            rx="1.5"
            fill="#F3E6C4"
            transform="rotate(-8 75 72)"
          />
          <rect
            x="146"
            y="54"
            width="10"
            height="8"
            rx="1.5"
            fill="#EFE6D6"
            transform="rotate(10 151 58)"
          />
        </g>
        <g
          stroke="#4A2614"
          strokeOpacity="0.35"
          strokeWidth="1"
          strokeLinecap="round"
        >
          <path d="M63 54l15-4M64 58l13-3.5M123 70l14 2.6M122 74l10 1.8" />
        </g>
      </svg>
      {shown.map(tag)}
      {shown.map((seat, index) =>
        layout[index]?.front ? person(seat, index) : null,
      )}
      <svg className="desk__sparkles" viewBox="0 0 100 100" aria-hidden="true">
        <path
          d="M14 10l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z"
          fill="#F2D894"
        />
        <path
          d="M88 18l1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2z"
          fill="#F2D894"
        />
        <path
          d="M62 4l3 4M68 2l1 5M74 4l-2 4"
          stroke="#F2D894"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
