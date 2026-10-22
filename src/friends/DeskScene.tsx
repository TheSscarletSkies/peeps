import { useEffect, useId, useRef, useState } from "react";

import type { Reaction } from "../lib/types";
import { announcePat, onFed, onPat, onReactionShown } from "../life/events";
import type { Wear } from "../pets/Dumpling";

/** A sprout on top marks your own peep; friends wear what their code picked for them. */
export type TableWear = Wear | "sprout" | null;

export interface Seat {
  key: string;
  name: string;
  wear: TableWear;
  /** Your own peep: it answers to being fed, patted and sent reactions, as it does off the table. */
  petId?: string;
  /** Whether a click on it is a pat; off where something around the table already handles clicks. */
  pattable?: boolean;
}

const SAID: Record<Reaction, string> = {
  heart: "♥",
  poke: "hey!",
  bonk: "ow!",
  tea: "tea time!",
  study: "let's study!",
};
const PATTED = ["hehe!", "hi!", "boop!", "♥"];
const MOMENT_MS = 1600;

/** What your peep is saying for a moment after a snack, a pat or a friend's reaction. */
function useMoment(
  petId: string | undefined,
): { text: string; n: number } | null {
  const [moment, setMoment] = useState<{ text: string; n: number } | null>(
    null,
  );
  useEffect(() => {
    if (!petId) return;
    let timer = 0;
    const show = (text: string) => {
      window.clearTimeout(timer);
      setMoment((last) => ({ text, n: (last?.n ?? 0) + 1 }));
      timer = window.setTimeout(() => setMoment(null), MOMENT_MS);
    };
    const off = [
      onFed((id) => id === petId && show("yum, thanks!")),
      onPat(
        (id) =>
          id === petId &&
          show(PATTED[Math.floor(Math.random() * PATTED.length)] ?? "hi!"),
      ),
      onReactionShown((id, kind) => id === petId && show(SAID[kind])),
    ];
    return () => {
      off.forEach((stop) => stop());
      window.clearTimeout(timer);
    };
  }, [petId]);
  return moment;
}

type Doing = "laptop" | "pencil" | "book" | "rest";
type Row = "back" | "front";

interface Slot {
  x: number;
  y: number;
  scale: number;
  row: Row;
  doing: Doing;
}

// Places on one 1200 × 690 drawing. The back row sits behind the table with their faces above it;
// the front row sits on cushions in front of it.
const BACK_LEFT: Slot = {
  x: 232,
  y: 262,
  scale: 0.99,
  row: "back",
  doing: "laptop",
};
const BACK_MIDDLE: Slot = {
  x: 590,
  y: 140,
  scale: 1.02,
  row: "back",
  doing: "laptop",
};
const BACK_RIGHT: Slot = {
  x: 961,
  y: 258,
  scale: 0.99,
  row: "back",
  doing: "laptop",
};
const SIDE_LEFT: Slot = {
  x: 136,
  y: 461,
  scale: 0.98,
  row: "front",
  doing: "pencil",
};
const FRONT_LEFT: Slot = {
  x: 377,
  y: 534,
  scale: 0.82,
  row: "front",
  doing: "book",
};
const FRONT_RIGHT: Slot = {
  x: 823,
  y: 535,
  scale: 0.82,
  row: "front",
  doing: "rest",
};
const SIDE_RIGHT: Slot = {
  x: 1024,
  y: 465,
  scale: 0.89,
  row: "front",
  doing: "rest",
};

/** Where people sit as more join, kept balanced left to right. */
const LAYOUTS: Slot[][] = [
  [BACK_MIDDLE],
  [BACK_LEFT, BACK_RIGHT],
  [BACK_LEFT, BACK_MIDDLE, BACK_RIGHT],
  [BACK_LEFT, BACK_RIGHT, FRONT_LEFT, FRONT_RIGHT],
  [BACK_LEFT, BACK_MIDDLE, BACK_RIGHT, FRONT_LEFT, FRONT_RIGHT],
  [BACK_LEFT, BACK_RIGHT, SIDE_LEFT, FRONT_LEFT, FRONT_RIGHT, SIDE_RIGHT],
  [
    BACK_LEFT,
    BACK_MIDDLE,
    BACK_RIGHT,
    SIDE_LEFT,
    FRONT_LEFT,
    FRONT_RIGHT,
    SIDE_RIGHT,
  ],
];

export const MAX_SEATS = LAYOUTS.length;

// Room above the drawing for the middle peep's name tag.
const VIEW = { top: -70, width: 1200, height: 760 };

/** How big the scene is for this many people, so the window can fit it. */
export function deskSize(seats: number): { width: number; height: number } {
  const width = seats <= 3 ? 340 : 400;
  return { width, height: Math.round((width * VIEW.height) / VIEW.width) };
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

const OUTLINE = "#86553d";

function Worn({ wear }: { wear: TableWear }) {
  switch (wear) {
    case "bow":
      return (
        <g transform="translate(32 -110) rotate(17)">
          <path
            d="M0 0Q-32-29-35-2Q-27 22 0 6Q28 26 38-3Q35-28 0 0Z"
            fill="#efb6bd"
            stroke="#93634f"
            strokeWidth="5"
          />
          <circle
            cx="0"
            cy="3"
            r="8"
            fill="#f6cfd0"
            stroke="#93634f"
            strokeWidth="3"
          />
        </g>
      );
    case "headphones":
      return (
        <>
          <path
            d="M-88-9V-44Q-90-114 3-117Q91-114 91-43V-9"
            fill="none"
            stroke="#806c61"
            strokeWidth="13"
          />
          <rect
            x="-102"
            y="-28"
            width="24"
            height="54"
            rx="12"
            fill="#9baba4"
            stroke="#77665c"
            strokeWidth="5"
          />
          <rect
            x="79"
            y="-28"
            width="24"
            height="54"
            rx="12"
            fill="#9baba4"
            stroke="#77665c"
            strokeWidth="5"
          />
        </>
      );
    case "beanie":
      return (
        <>
          <path
            d="M-93-36Q-96-119-1-125Q95-119 94-36Z"
            fill="#e6d7b6"
            stroke="#947961"
            strokeWidth="5"
          />
          <path
            d="M-91-45Q0-54 93-45V-24Q0-36-91-24Z"
            fill="#efe1c8"
            stroke="#947961"
            strokeWidth="4"
          />
          <path
            d="M-45-100v42M-20-114v54M8-114v54M37-101v47"
            stroke="#c7ad8e"
            strokeWidth="3"
          />
          <circle
            cx="0"
            cy="-127"
            r="12"
            fill="#efdfc0"
            stroke="#947961"
            strokeWidth="4"
          />
        </>
      );
    case "sprout":
      return (
        <>
          <path d="M0-105v-29" stroke="#6e976e" strokeWidth="5" />
          <path
            d="M0-124Q-27-155-42-134Q-36-109 0-124M0-124Q25-155 40-132Q36-110 0-124"
            fill="#86aa7a"
            stroke="#648961"
            strokeWidth="4"
          />
        </>
      );
    default:
      return null;
  }
}

function Doing({ doing }: { doing: Doing }) {
  switch (doing) {
    case "book":
      return (
        <g>
          <path
            d="M-75 66Q-31 41 0 64Q38 42 79 62V117Q33 99 0 118Q-37 99-75 116Z"
            fill="#7a92a3"
            stroke="#785c50"
            strokeWidth="5"
          />
          <path
            d="M0 64v54M-60 74h44m-44 15h40M14 74h43M14 89h40"
            stroke="#f6ebd7"
            strokeWidth="3"
            fill="none"
          />
        </g>
      );
    case "pencil":
      return (
        <g className="bun__arm">
          <path
            d="M55 68Q89 57 94 33"
            stroke="#6f4635"
            strokeWidth="9"
            fill="none"
          />
          <path d="M87 38l-13-56" stroke="#de9d84" strokeWidth="11" />
          <path d="M74-18l-2-13l12 11" fill="#f1c785" />
        </g>
      );
    default:
      return null;
  }
}

/** One cream bun: pleats meeting at the top, a soft highlight, dot eyes and round paws. */
function Bun({
  seat,
  slot,
  dough,
  arriving,
}: {
  seat: Seat;
  slot: Slot;
  dough: string;
  arriving: boolean;
}) {
  const label = seat.name.length * 21 + 56;
  const moment = useMoment(seat.petId);
  const pat = seat.pattable && seat.petId ? seat.petId : null;
  return (
    <g
      className="bun"
      data-arriving={arriving || undefined}
      data-moment={moment ? moment.n : undefined}
      onClick={pat ? () => announcePat(pat) : undefined}
      transform={`translate(${slot.x} ${slot.y}) scale(${slot.scale})`}
    >
      <g className="bun__body">
        <path
          d="M-104 58Q-122 20-93-32Q-72-68-34-80Q-23-114-9-110Q4-128 19-109Q37-119 47-90Q101-70 111-13Q124 46 89 83Q66 102 0 104Q-66 102-90 85Q-101 76-104 58Z"
          fill={`url(#${dough})`}
          stroke={OUTLINE}
          strokeWidth="5.5"
          strokeLinejoin="round"
        />
        <path
          d="M-89 39Q-104 4-73-35"
          stroke="#fffefa"
          strokeWidth="11"
          opacity=".75"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M-24-85Q-37-66-43-46M0-109Q-12-80-9-49M20-100Q36-80 43-51"
          stroke="#c69274"
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
        />
        <ellipse
          cx="-51"
          cy="35"
          rx="17"
          ry="10"
          fill="#f6b5a4"
          opacity=".68"
        />
        <ellipse cx="55" cy="35" rx="17" ry="10" fill="#f6b5a4" opacity=".68" />
        <g className="bun__eyes">
          <ellipse cx="-25" cy="17" rx="7" ry="9" fill="#563b30" />
          <ellipse cx="31" cy="17" rx="7" ry="9" fill="#563b30" />
          <circle cx="-27" cy="14" r="2" fill="#fff8eb" />
          <circle cx="29" cy="14" r="2" fill="#fff8eb" />
        </g>
        <path
          d="M-7 38q9 13 18 0"
          fill="none"
          stroke="#805344"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <Worn wear={seat.wear} />
        <ellipse
          cx="-75"
          cy="81"
          rx="30"
          ry="20"
          fill="#fff7e4"
          stroke={OUTLINE}
          strokeWidth="5"
        />
        <ellipse
          cx="77"
          cy="81"
          rx="29"
          ry="20"
          fill="#fff7e4"
          stroke={OUTLINE}
          strokeWidth="5"
        />
        <Doing doing={slot.doing} />
      </g>
      {moment && (
        <g className="bun__say" key={moment.n}>
          <path
            d="M70-118c-10-16-34-6-24 12l24 22 24-22c10-18-14-28-24-12z"
            fill="#f2a5a8"
            stroke={OUTLINE}
            strokeWidth="4"
          />
          <rect
            x={-(moment.text.length * 19 + 50) / 2}
            y="-232"
            width={moment.text.length * 19 + 50}
            height="56"
            rx="20"
          />
          <text x="0" y="-192" textAnchor="middle">
            {moment.text}
          </text>
        </g>
      )}
      <g className="desk__label">
        <rect x={-label / 2} y="-212" width={label} height="56" rx="28" />
        <text x="0" y="-172" textAnchor="middle">
          {seat.name}
        </text>
      </g>
    </g>
  );
}

/** Everyone in a session together around one low round table; hover a peep to see who it is. */
export function DeskScene({ seats }: { seats: Seat[] }) {
  const shown = seats.slice(0, MAX_SEATS);
  const layout = LAYOUTS[shown.length - 1] ?? LAYOUTS[0] ?? [];
  const { width, height } = deskSize(shown.length);
  const arriving = useArrivals(shown.map((seat) => seat.key));
  // Gradient ids are document-wide, and the hub and the tray can each show a table.
  const id = useId().replace(/:/g, "");
  const dough = `${id}dough`;
  const wood = `${id}wood`;
  const cup = `${id}cup`;
  const blur = `${id}blur`;
  const gingham = `${id}gingham`;
  const cushions = ["#f7d398", "#b7bd8a", "#f2c886", "#efd6bd"];

  const row = (which: Row) =>
    shown.map((seat, index) => {
      const slot = layout[index];
      if (!slot || slot.row !== which) return null;
      return (
        <Bun
          key={seat.key}
          seat={seat}
          slot={slot}
          dough={dough}
          arriving={arriving(seat.key)}
        />
      );
    });

  return (
    <div className="desk" style={{ width, height }}>
      <svg
        viewBox={`0 ${VIEW.top} ${VIEW.width} ${VIEW.height}`}
        role="img"
        aria-label={`At the table: ${shown.map((seat) => seat.name).join(", ")}`}
      >
        <defs>
          <linearGradient id={dough} x1=".1" y1="0" x2=".8" y2="1">
            <stop stopColor="#fffdf0" />
            <stop offset=".72" stopColor="#fff5df" />
            <stop offset="1" stopColor="#f5dcb8" />
          </linearGradient>
          <linearGradient id={wood} x1="0" y1="0" x2=".8" y2="1">
            <stop stopColor="#f9d7a5" />
            <stop offset="1" stopColor="#d99360" />
          </linearGradient>
          <linearGradient id={cup} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#ffcfc0" />
            <stop offset="1" stopColor="#e9a49b" />
          </linearGradient>
          <filter id={blur} x="-30%" y="-40%" width="160%" height="200%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
          <pattern
            id={gingham}
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <rect width="24" height="24" fill="#f8e0ce" />
            <path d="M0 0h12v24H0z" fill="#f2c8b2" opacity=".33" />
            <path d="M0 0h24v12H0z" fill="#f2c8b2" opacity=".35" />
          </pattern>
        </defs>
        <ellipse
          cx="601"
          cy="570"
          rx="500"
          ry="78"
          fill="#c6a17d"
          opacity=".12"
          filter={`url(#${blur})`}
        />
        {/* A cushion under each seat that is taken. */}
        <g stroke="#ba8a65" strokeWidth="3">
          {layout.map((slot, index) => {
            const fill =
              index === 0
                ? `url(#${gingham})`
                : cushions[index % cushions.length];
            // The back row's cushions peek out at the table's sides; the front row's sit under them.
            const back = slot.row === "back";
            const out =
              Math.abs(slot.x - 600) < 60 ? 0 : Math.sign(slot.x - 600) * 60;
            return (
              <ellipse
                key={`${slot.x}-${slot.y}`}
                cx={back ? slot.x + out : slot.x}
                cy={back ? slot.y + 120 : slot.y + 56}
                rx={back ? 124 : 150 * slot.scale}
                ry={back ? 80 : 72 * slot.scale}
                fill={fill}
              />
            );
          })}
        </g>
        {row("back")}
        <g>
          <path
            d="M338 458V551 Q338 577 365 580L385 578V487 M818 475V555Q818 576 848 570L867 474"
            fill="#b8734b"
            stroke="#8e573b"
            strokeWidth="7"
          />
          <ellipse
            cx="599"
            cy="445"
            rx="422"
            ry="186"
            fill="#aa6844"
            stroke="#855036"
            strokeWidth="7"
          />
          <ellipse
            cx="599"
            cy="422"
            rx="420"
            ry="174"
            fill={`url(#${wood})`}
            stroke="#9a603e"
            strokeWidth="7"
          />
          <ellipse
            cx="598"
            cy="408"
            rx="393"
            ry="151"
            fill="none"
            stroke="#ffedcd"
            opacity=".5"
            strokeWidth="4"
          />
          <path
            d="M270 440q70 -28 142 -9M743 348q114 -14 180 20"
            fill="none"
            stroke="#b97750"
            strokeWidth="3"
            opacity=".28"
          />
        </g>
        <g strokeLinejoin="round" strokeLinecap="round">
          <g transform="translate(334 386) rotate(-12)">
            <path
              d="M-80-40Q-42-52 0-28Q40-52 79-40V57Q39 42 0 59Q-39 43-80 57Z"
              fill="#fff9eb"
              stroke="#aa7857"
              strokeWidth="4"
            />
            <path
              d="M0-28V59M-65-17h44m-44 14h40m-40 15h44m-44 15h29M16-17h45M16-3h40M16 12h42M16 27h30"
              stroke="#dfc5a5"
              strokeWidth="3"
              fill="none"
            />
          </g>
          <g transform="translate(795 395) rotate(9)">
            <rect
              x="-79"
              y="-51"
              width="163"
              height="109"
              rx="7"
              fill="#f9f4e6"
              stroke="#aa775b"
              strokeWidth="5"
            />
            <path
              d="M-59-27h103M-59-7h88M-59 13h100M-59 33h69"
              stroke="#d6bba1"
              strokeWidth="4"
            />
          </g>
          <g transform="translate(444 350) rotate(-9)">
            <rect
              x="-68"
              y="11"
              width="137"
              height="26"
              rx="5"
              fill="#e7aaa4"
              stroke="#a86e56"
              strokeWidth="4"
            />
            <rect
              x="-58"
              y="-14"
              width="137"
              height="26"
              rx="5"
              fill="#a1b293"
              stroke="#7d8e77"
              strokeWidth="4"
            />
            <path d="M-49-5h114M-58 22h112" stroke="#fff7dc" strokeWidth="5" />
          </g>
          <g transform="translate(479 286) rotate(-9)">
            <path
              d="M-83 44L-79-48Q-78-59-67-59H62Q74-59 73-48L70 44Z"
              fill="#a1a6aa"
              stroke="#665d5d"
              strokeWidth="5"
            />
            <path
              d="M-85 43H88l15 18H-102Z"
              fill="#c9c4bd"
              stroke="#665d5d"
              strokeWidth="5"
            />
            <path
              d="M-14-3q10-14 20 0q16 13-10 25q-27-12-10-25"
              fill="#ede6da"
              opacity=".8"
            />
          </g>
          <g transform="translate(739 299) rotate(8)">
            <path
              d="M-84 42V-41Q-84-55-70-55H69Q83-55 83-41V42Z"
              fill="#99949a"
              stroke="#65545a"
              strokeWidth="5"
            />
            <path
              d="M-98 44H97L111 61H-108Z"
              fill="#c6bdba"
              stroke="#65545a"
              strokeWidth="5"
            />
            <path d="M-10-10q9-12 19 0q10 11-10 20q-20-9-9-20" fill="#eee6d9" />
          </g>
          <g transform="translate(586 340)">
            <ellipse
              cx="0"
              cy="57"
              rx="49"
              ry="13"
              fill="#ac684c"
              opacity=".25"
            />
            <path
              d="M-30 0Q-27-27 0-28Q27-27 30 0V40Q30 55 0 56Q-30 55-30 40Z"
              fill="#e6a765"
              stroke="#956044"
              strokeWidth="5"
            />
            <path d="M-17 2Q-15-12 0-13Q15-12 17 2V32H-17Z" fill="#fff1b9" />
            <circle cx="0" cy="10" r="12" fill="#ffe4a4" />
            <path
              d="M-12-30V-42H12V-30"
              stroke="#956044"
              strokeWidth="5"
              fill="none"
            />
          </g>
          <g transform="translate(649 399)">
            <path
              d="M-25-7h54l-6 49q-23 13-42-1z"
              fill="#d7b1a2"
              stroke="#9d7a62"
              strokeWidth="4"
            />
            <path d="M1-8V-85" stroke="#6e916d" strokeWidth="5" />
            <path
              d="M0-51q-42-58-65-13q0 27 65 13M4-40q48-60 66-20q-1 31-66 20M1-67q-29-43 3-56q34 20-3 56"
              fill="#86a77c"
              stroke="#6e8a64"
              strokeWidth="4"
            />
          </g>
          <g transform="translate(875 441)">
            <path
              d="M-27-30h60V27Q31 38 3 38Q-25 38-27 27Z"
              fill={`url(#${cup})`}
              stroke="#ad795b"
              strokeWidth="5"
            />
            <path
              d="M33-15q38-8 35 17q-5 21-36 12"
              fill="none"
              stroke="#ad795b"
              strokeWidth="7"
            />
            <ellipse
              cx="3"
              cy="-30"
              rx="30"
              ry="7"
              fill="#a86d50"
              stroke="#ad795b"
              strokeWidth="4"
            />
            <path
              className="desk__steam"
              d="M-4-44q-16-13 0-28"
              fill="none"
              stroke="#d0aa94"
              strokeWidth="4"
            />
            <path
              className="desk__steam"
              d="M12-44q-15-16 0-31"
              fill="none"
              stroke="#d0aa94"
              strokeWidth="4"
            />
          </g>
          <g transform="translate(582 477)">
            <ellipse
              rx="92"
              ry="30"
              fill="#fffdf2"
              stroke="#c69d77"
              strokeWidth="4"
            />
            <g fill="#fff0d5" stroke="#bf9473" strokeWidth="3">
              <path d="M-61 2Q-61-21-37-35Q-28-48-18-31Q10-15 0 6Z" />
              <path d="M-13 3Q-10-19 12-33Q27-49 37-28Q56-5 46 9Z" />
            </g>
            <path
              d="M-42-25l7 16m-1-19l11 16M15-24l7 15m0-21l13 17"
              fill="none"
              stroke="#c9a081"
              strokeWidth="2"
            />
          </g>
          <g transform="translate(459 495)">
            <rect
              x="-34"
              y="-14"
              width="68"
              height="49"
              rx="7"
              fill="#f9cf81"
              stroke="#d8a66d"
              strokeWidth="3"
            />
            <rect x="-28" y="-7" width="56" height="37" rx="4" fill="#ffe2a5" />
          </g>
        </g>
        {row("front")}
      </svg>
    </div>
  );
}
