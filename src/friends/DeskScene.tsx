import type { ReactNode } from "react";

import { Sticker, type StickerKind } from "./ReactionArt";

export interface Seat {
  key: string;
  name: string;
  /** The pet, drawn at the size it is given, glasses on. */
  pet: (size: number) => ReactNode;
}

/** What sits in front of each seat, so the table looks busy: a laptop, a book, a cup of tea. */
const ITEMS: StickerKind[] = ["laptop", "study", "tea"];
const PET = 52;
const SEAT = 50;

/** Width of the scene for this many seats, so the window can be sized to fit. */
export function deskWidth(seats: number): number {
  return seats * SEAT + 28;
}

export const DESK_HEIGHT = 92;

/** Everyone in a session together, side by side behind one little table, each with a name tag. */
export function DeskScene({ seats }: { seats: Seat[] }) {
  return (
    <div
      className="desk"
      style={{ width: deskWidth(seats.length), height: DESK_HEIGHT }}
      aria-label={`At the table: ${seats.map((seat) => seat.name).join(", ")}`}
    >
      <div className="desk__seats">
        {seats.map((seat) => (
          <span key={seat.key} className="desk__seat" style={{ width: SEAT }}>
            {seat.pet(PET)}
          </span>
        ))}
      </div>
      <div className="desk__table" aria-hidden="true" />
      <div className="desk__front" aria-hidden="true">
        {seats.map((seat, index) => (
          <span key={seat.key} className="desk__place" style={{ width: SEAT }}>
            <svg className="desk__item" viewBox="0 0 40 40">
              <Sticker kind={ITEMS[index % ITEMS.length] ?? "study"} />
            </svg>
            <span className="desk__tag">{seat.name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
