import { useId } from "react";

import type { Mood, PetKind } from "../lib/types";
import shapes from "./shapes.json";
import { flushed } from "./tint";

interface Props {
  kind: PetKind;
  color: string;
  mood: Mood;
  heat: number;
  size?: number;
}

interface Shape {
  body: string;
  creases: string;
  highlight: number[];
  fxOffset: number;
  /** How far the pet rises in the steamer so its face peeks over the rim. */
  napLift: number;
}

// The same shapes feed design/rive/generate.py, so Rive pets can replace these one for one.
const SHAPES: Record<PetKind, Shape> = shapes;
const EYE = "#3F2A20";

const stroke = {
  stroke: EYE,
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  fill: "none",
};

function Eyes({ mood }: { mood: Mood }) {
  switch (mood) {
    case "stalled":
      return <path d="M42 68q3 2.6 6 0M72 68q3 2.6 6 0" {...stroke} />;
    case "failing":
      return (
        <path
          d="M42.5 65.5l4.5 4.5M47 65.5l-4.5 4.5M73 65.5l4.5 4.5M77.5 65.5l-4.5 4.5"
          {...stroke}
        />
      );
    case "litterBox":
      return (
        <path
          d="M42.5 65.8l4.5 2.2-4.5 2.2M77.5 65.8l-4.5 2.2 4.5 2.2"
          {...stroke}
        />
      );
    default:
      return (
        <g className="dumpling__eyes">
          <circle cx="45" cy="68" r="2.7" fill={EYE} />
          <circle cx="75" cy="68" r="2.7" fill={EYE} />
        </g>
      );
  }
}

function Mouth({ mood }: { mood: Mood }) {
  switch (mood) {
    case "needsYou":
      return <ellipse cx="60" cy="71.5" rx="1.6" ry="2" fill={EYE} />;
    case "sweating":
      return <path d="M57.5 71.5h5" {...stroke} />;
    case "steaming":
    case "failing":
      return <path d="M55.5 72q1.1-1.4 2.2 0t2.2 0t2.2 0t2.2 0" {...stroke} />;
    case "litterBox":
      return <path d="M57 72.5q3-2.4 6 0" {...stroke} />;
    case "stalled":
      return null;
    case "hungry":
      return (
        <>
          <path d="M57 70h6q-.5 4.2-3 4.2t-3-4.2z" fill={EYE} />
          <path
            d="M58.3 73q1.7-1.2 3.4 0q-.8 1.2-1.7 1.2t-1.7-1.2z"
            fill="#FF9AAA"
          />
          <path
            d="M62.5 73.5v4"
            stroke="#A8DAF7"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </>
      );
    default:
      return <path d="M57.5 70.5q2.5 2.6 5 0" {...stroke} />;
  }
}

function Brows({ mood }: { mood: Mood }) {
  return mood === "sweating" || mood === "steaming" ? (
    <path d="M41.5 62l5 1.6M78.5 62l-5 1.6" {...stroke} />
  ) : null;
}

function Effects({ mood }: { mood: Mood }) {
  switch (mood) {
    case "needsYou":
      return (
        <g className="fx-ping">
          <circle cx="98" cy="24" r="8" fill="#FFE39A" />
          <path
            d="M98 19.5v5.5M98 28.2v.3"
            stroke={EYE}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        </g>
      );
    case "sweating":
      return (
        <>
          <path
            className="fx-drip"
            d="M24 46q-3 5 0 7q3-2 0-7z"
            fill="#BFE4FB"
          />
          <path
            className="fx-drip fx-late"
            d="M96 42q-3 5 0 7q3-2 0-7z"
            fill="#BFE4FB"
          />
        </>
      );
    case "steaming":
      return (
        <>
          <circle className="fx-steam" cx="48" cy="20" r="5" fill="#FBF8F4" />
          <circle
            className="fx-steam fx-late"
            cx="60"
            cy="16"
            r="6"
            fill="#FBF8F4"
          />
          <circle
            className="fx-steam fx-later"
            cx="72"
            cy="20"
            r="4"
            fill="#FBF8F4"
          />
        </>
      );
    case "stalled":
      return (
        <text
          className="fx-doze"
          x="90"
          y="40"
          fill="#DCCFF8"
          fontSize="12"
          fontWeight="800"
        >
          z
        </text>
      );
    case "litterBox":
      return (
        <path
          className="fx-stink"
          d="M30 32q-4-4 0-8t0-8M90 32q-4-4 0-8t0-8"
          stroke="#CDE3A8"
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
        />
      );
    case "failing":
      return (
        <g className="fx-orbit">
          <path
            d="M44 21l1.2 2.6 2.6 1.2-2.6 1.2L44 28.6l-1.2-2.6-2.6-1.2 2.6-1.2z"
            fill="#FFE39A"
          />
          <path d="M76 22l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="#FFFFFF" />
        </g>
      );
    default:
      return null;
  }
}

function PropBehind({ mood }: { mood: Mood }) {
  if (mood === "hungry") {
    return (
      <>
        <path
          d="M92 74l14-16M97 76l13-13"
          stroke="#C98A5E"
          strokeWidth={2.2}
          strokeLinecap="round"
        />
        <path d="M86 80h28c0 7-6 11-14 11s-14-4-14-11z" fill="#F6DCC8" />
      </>
    );
  }
  if (mood === "litterBox") {
    return <rect x="86" y="80" width="28" height="11" rx="5" fill="#E9E0D6" />;
  }
  return null;
}

/** A stalled pet naps in its bamboo steamer. */
function PropInFront({ mood }: { mood: Mood }) {
  if (mood !== "stalled") return null;
  return (
    <>
      <path d="M12 78h96v10c0 4-3.5 7-8 7H20c-4.5 0-8-3-8-7z" fill="#EFCB9F" />
      <path d="M12 85h96" stroke="#DDB283" strokeWidth={2} />
      <rect x="9" y="74" width="102" height="6" rx="3" fill="#F6DDBA" />
    </>
  );
}

/** A product's pet. Its face, pose and effects follow the mood; it flushes and blushes with token burn. */
export function Dumpling({ kind, color, mood, heat, size = 64 }: Props) {
  // useId contains colons, which break url(#…) references.
  const id = useId().replace(/:/g, "");
  const shape = SHAPES[kind];
  const [hx = 36, hy = 50, hr = -30] = shape.highlight;
  const blush = 1 + heat * 0.7;

  return (
    <svg
      className={`dumpling dumpling--${mood}`}
      width={size}
      height={(size * 100) / 120}
      viewBox="0 0 120 100"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`${id}shade`} cx="0.42" cy="0.32" r="0.8">
          <stop offset="0.5" stopColor="#B5785A" stopOpacity={0} />
          <stop offset="1" stopColor="#B5785A" stopOpacity={0.32} />
        </radialGradient>
        <radialGradient id={`${id}glow`} cx="0.34" cy="0.28" r="0.42">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity={0.7} />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${id}blush`}>
          <stop offset="0" stopColor="#FFA98F" stopOpacity={0.8} />
          <stop offset="1" stopColor="#FFA98F" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${id}shadow`}>
          <stop offset="0" stopColor="#000" stopOpacity={0.22} />
          <stop offset="1" stopColor="#000" stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="88" rx="40" ry="6" fill={`url(#${id}shadow)`} />
      <PropBehind mood={mood} />
      <g
        transform={
          mood === "stalled" ? `translate(0 ${-shape.napLift})` : undefined
        }
      >
        <g className="dumpling__body">
          <path d={shape.body} fill={flushed(color, heat)} />
          <path d={shape.body} fill={`url(#${id}shade)`} />
          <path d={shape.body} fill={`url(#${id}glow)`} />
          <ellipse
            cx={hx}
            cy={hy}
            rx="4.5"
            ry="2"
            fill="#FFFFFF"
            opacity={0.8}
            transform={`rotate(${hr} ${hx} ${hy})`}
          />
          <path
            d={shape.creases}
            stroke="#B5785A"
            strokeOpacity={0.28}
            strokeWidth={1.6}
            strokeLinecap="round"
            fill="none"
          />
          <ellipse
            cx="38"
            cy="73"
            rx={9 * blush}
            ry={5.5 * blush}
            fill={`url(#${id}blush)`}
          />
          <ellipse
            cx="82"
            cy="73"
            rx={9 * blush}
            ry={5.5 * blush}
            fill={`url(#${id}blush)`}
          />
          <Eyes mood={mood} />
          <Brows mood={mood} />
          <Mouth mood={mood} />
        </g>
      </g>
      <PropInFront mood={mood} />
      <g transform={`translate(0 ${shape.fxOffset})`}>
        <Effects mood={mood} />
      </g>
    </svg>
  );
}
