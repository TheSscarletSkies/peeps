import type { Mood, PetKind } from "../lib/types";
import { flushed } from "./tint";

interface Props {
  kind: PetKind;
  color: string;
  mood: Mood;
  heat: number;
  size?: number;
}

const INK = "#3B2616";

const BODY: Record<PetKind, string> = {
  bao: "M60 22c-4 0-7 3-8 6-3-2-7-1-9 1.5-2.5-1-5.5 0-6.5 3C22 37 12 47 12 60c0 17 20 27 48 27s48-10 48-27c0-13-10-23-24.5-27.5-1-3-4-4-6.5-3-2-2.5-6-3.5-9-1.5-1-3-4-6-8-6z",
  gyoza: "M12 72C16 40 104 40 108 72c-8 12-88 12-96 0z",
};

const PLEATS: Record<PetKind, string> = {
  bao: "M55 31q2 4 1.5 9M60 28v12M65 31q-2 4-1.5 9",
  gyoza: "M34 50q2-6 7-6M48 45q2-6 7-5M62 44q3-5 7-4M76 46q3-4 7-2",
};

function Face({ mood }: { mood: Mood }) {
  const stroke = {
    stroke: INK,
    strokeWidth: 2.4,
    strokeLinecap: "round" as const,
    fill: "none",
  };
  switch (mood) {
    case "failing":
      return (
        <>
          <path d="M45 62l6 6M51 62l-6 6M69 62l6 6M75 62l-6 6" {...stroke} />
          <path d="M52 76q2-2 4 0t4 0t4 0t4 0" {...stroke} />
        </>
      );
    case "stalled":
      return (
        <>
          <path d="M44 66q4 3 8 0M68 66q4 3 8 0" {...stroke} />
          <circle cx="60" cy="74" r="1.8" fill={INK} />
        </>
      );
    case "litterBox":
      return (
        <>
          <path d="M44 63l6 3-6 3M76 63l-6 3 6 3" {...stroke} />
          <path d="M53 76q7-4 14 0" {...stroke} />
        </>
      );
    case "steaming":
    case "sweating":
      return (
        <>
          <path d="M43 59l8 3M77 59l-8 3" {...stroke} />
          <circle cx="48" cy="67" r="3" fill={INK} />
          <circle cx="72" cy="67" r="3" fill={INK} />
          <path d="M55 75h10" {...stroke} />
        </>
      );
    case "needsYou":
    case "hungry":
      return (
        <>
          <circle cx="48" cy="65" r="4" fill={INK} />
          <circle cx="72" cy="65" r="4" fill={INK} />
          <circle cx="49.4" cy="63.6" r="1.4" fill="#fff" />
          <circle cx="73.4" cy="63.6" r="1.4" fill="#fff" />
          {mood === "needsYou" ? (
            <ellipse cx="60" cy="75" rx="2.6" ry="3.2" fill={INK} />
          ) : (
            <>
              <path d="M54 72q6 6 12 0" {...stroke} />
              <path
                d="M64 75v5"
                stroke="#7CC6F2"
                strokeWidth={2.6}
                strokeLinecap="round"
              />
            </>
          )}
        </>
      );
    case "working":
      return (
        <>
          <circle cx="51" cy="66" r="3.2" fill={INK} />
          <circle cx="75" cy="66" r="3.2" fill={INK} />
          <path d="M58 74q4 2 8 0" {...stroke} />
        </>
      );
    case "chill":
      return (
        <>
          <circle cx="48" cy="66" r="3.2" fill={INK} />
          <circle cx="72" cy="66" r="3.2" fill={INK} />
          <path d="M56 72q4 3.5 8 0" {...stroke} />
        </>
      );
  }
}

function Extras({ mood }: { mood: Mood }) {
  switch (mood) {
    case "needsYou":
      return (
        <g className="fx-ping">
          <circle cx="98" cy="20" r="10" fill="#FFD66B" />
          <path
            d="M98 14v7M98 25v.5"
            stroke="#1A1406"
            strokeWidth={3}
            strokeLinecap="round"
          />
        </g>
      );
    case "sweating":
      return (
        <>
          <path
            className="fx-drip"
            d="M22 44q-3 5 0 7q3-2 0-7z"
            fill="#8FD3FF"
          />
          <path
            className="fx-drip fx-late"
            d="M98 40q-3 5 0 7q3-2 0-7z"
            fill="#8FD3FF"
          />
        </>
      );
    case "steaming":
      return (
        <>
          <circle className="fx-steam" cx="46" cy="18" r="6" fill="#E9E6E0" />
          <circle
            className="fx-steam fx-late"
            cx="60"
            cy="14"
            r="7"
            fill="#E9E6E0"
          />
          <circle
            className="fx-steam fx-later"
            cx="74"
            cy="18"
            r="5"
            fill="#E9E6E0"
          />
        </>
      );
    case "stalled":
      return (
        <text
          className="fx-doze"
          x="92"
          y="30"
          fill="#C9B8F0"
          fontSize="14"
          fontWeight="800"
        >
          z
        </text>
      );
    case "litterBox":
      return (
        <>
          <path
            className="fx-stink"
            d="M30 30q-4-4 0-8t0-8"
            stroke="#A3C26B"
            strokeWidth={2.4}
            fill="none"
          />
          <path
            className="fx-stink fx-late"
            d="M90 30q-4-4 0-8t0-8"
            stroke="#A3C26B"
            strokeWidth={2.4}
            fill="none"
          />
        </>
      );
    case "failing":
      return (
        <g className="fx-orbit">
          <circle cx="44" cy="22" r="3" fill="#FFD66B" />
          <circle cx="76" cy="22" r="2.5" fill="#F4F2EE" />
        </g>
      );
    default:
      return null;
  }
}

/** A product's pet. Its face and effects follow the mood; its colour warms with token burn. */
export function Dumpling({ kind, color, mood, heat, size = 64 }: Props) {
  return (
    <svg
      className={`dumpling dumpling--${mood}`}
      width={size}
      height={(size * 100) / 120}
      viewBox="0 0 120 100"
      aria-hidden="true"
    >
      <Extras mood={mood} />
      <g className="dumpling__body">
        <path
          d={BODY[kind]}
          fill={flushed(color, heat)}
          stroke={INK}
          strokeWidth={2.6}
          strokeLinejoin="round"
        />
        <path
          d={PLEATS[kind]}
          stroke={INK}
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
        />
        <ellipse
          cx="38"
          cy="74"
          rx={6 + heat * 4}
          ry={3 + heat * 2}
          fill="#F27886"
          opacity={0.35 + heat * 0.5}
        />
        <ellipse
          cx="82"
          cy="74"
          rx={6 + heat * 4}
          ry={3 + heat * 2}
          fill="#F27886"
          opacity={0.35 + heat * 0.5}
        />
        <Face mood={mood} />
      </g>
    </svg>
  );
}
