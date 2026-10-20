import { useId } from "react";

import type { Accessory } from "../life/season";
import type { Mood, PetKind } from "../lib/types";
import shapes from "./shapes.json";
import { flushed } from "./tint";
import { BASE, variantFor } from "./variant";

interface Props {
  kind: PetKind;
  color: string;
  mood: Mood;
  heat: number;
  size?: number;
  /** Gives the pet its own build. Use the product id so it never changes. */
  seed?: string;
  /** A short-lived look that wins over the mood. */
  expression?: Expression;
  accessory?: Accessory | null;
  /** Extra classes for one-off motions such as a squish or hatching. */
  motion?: string;
}

/** Dizzy after a poke spree, celebrating finished work, in love after a pat or a note. */
export type Expression = "dizzy" | "celebrate" | "love" | "eager";
type Look = Mood | Expression;

interface Shape {
  body: string;
  creases: string;
  highlight: number[];
  fxOffset: number;
  /** How far the pet rises in the steamer so its face peeks over the rim. */
  napLift: number;
  /** Where a hat sits on top of the shape. */
  hatY: number;
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

function Eyes({ mood }: { mood: Look }) {
  switch (mood) {
    case "stalled":
      return <path d="M42 68q3 2.6 6 0M72 68q3 2.6 6 0" {...stroke} />;
    case "failing":
      return (
        <>
          <path d="M41.5 69.5q3.5-2.6 7 0M71.5 69.5q3.5-2.6 7 0" {...stroke} />
          <path
            d="M43 72.5q-1 6 .5 12M77 72.5q1 6-.5 12"
            stroke="#A8DAF7"
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
            opacity={0.9}
          />
          <g className="fx-tear">
            <path
              d="M43.6 80c-2.7 3.75-3.45 5.55-3.45 6.75a3.45 3.45 0 0 0 6.9 0c0-1.2-1-3-3.45-6.75z"
              fill="#9FD3F5"
            />
            <circle
              cx="42.4"
              cy="86.15"
              r="0.825"
              fill="#FFFFFF"
              opacity="0.85"
            />
          </g>
          <g className="fx-tear fx-late">
            <path
              d="M76.4 80c-2.7 3.75-3.45 5.55-3.45 6.75a3.45 3.45 0 0 0 6.9 0c0-1.2-1-3-3.45-6.75z"
              fill="#9FD3F5"
            />
            <circle
              cx="75.2"
              cy="86.15"
              r="0.825"
              fill="#FFFFFF"
              opacity="0.85"
            />
          </g>
        </>
      );
    case "dizzy":
      return (
        <path
          d="M45 68m-3 0a3 3 0 1 0 3-3a1.8 1.8 0 1 0 1.8 1.8M75 68m-3 0a3 3 0 1 0 3-3a1.8 1.8 0 1 0 1.8 1.8"
          {...stroke}
        />
      );
    case "celebrate":
      return <path d="M42 69q3-3.4 6 0M72 69q3-3.4 6 0" {...stroke} />;
    case "eager":
      return (
        <>
          <circle cx="45" cy="67.5" r="3.4" fill={EYE} />
          <circle cx="75" cy="67.5" r="3.4" fill={EYE} />
        </>
      );
    case "love":
      return (
        <path
          d="M45 73l-4.6-4.4c-2.4-2.4.8-6 3.4-3.8l1.2 1 1.2-1c2.6-2.2 5.8 1.4 3.4 3.8zM75 73l-4.6-4.4c-2.4-2.4.8-6 3.4-3.8l1.2 1 1.2-1c2.6-2.2 5.8 1.4 3.4 3.8z"
          fill="#FF7F95"
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

function Mouth({ mood }: { mood: Look }) {
  switch (mood) {
    case "needsYou":
      return <ellipse cx="60" cy="71.5" rx="1.6" ry="2" fill={EYE} />;
    case "sweating":
      return <path d="M57.5 71.5h5" {...stroke} />;
    case "failing":
      return <path d="M56.5 73.5q3.5-2.6 7 0" {...stroke} />;
    case "steaming":
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
    case "dizzy":
      return <path d="M55.5 72q1.1-1.4 2.2 0t2.2 0t2.2 0t2.2 0" {...stroke} />;
    case "eager":
      return (
        <>
          <ellipse cx="60" cy="73.5" rx="4" ry="4.6" fill={EYE} />
          <ellipse cx="60" cy="76" rx="2.6" ry="1.7" fill="#FF9AAA" />
        </>
      );
    case "celebrate":
    case "love":
      return (
        <>
          <path d="M57 70h6q-.5 4.2-3 4.2t-3-4.2z" fill={EYE} />
          <path
            d="M58.3 73q1.7-1.2 3.4 0q-.8 1.2-1.7 1.2t-1.7-1.2z"
            fill="#FF9AAA"
          />
        </>
      );
    default:
      return <path d="M57.5 70.5q2.5 2.6 5 0" {...stroke} />;
  }
}

function Brows({ mood }: { mood: Look }) {
  return mood === "sweating" || mood === "steaming" ? (
    <path d="M41.5 62l5 1.6M78.5 62l-5 1.6" {...stroke} />
  ) : null;
}

function Effects({ mood }: { mood: Look }) {
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
          <g className="fx-drip">
            <path
              d="M19 38c-3.6 5-4.6 7.4-4.6 9a4.6 4.6 0 0 0 9.2 0c0-1.6-1-4-4.6-9z"
              fill="#9FD3F5"
            />
            <circle cx="17.4" cy="46.2" r="1.1" fill="#FFFFFF" opacity="0.85" />
          </g>
          <g className="fx-drip fx-late">
            <path
              d="M99 34c-4.14 5.75-5.29 8.51-5.29 10.35a5.29 5.29 0 0 0 10.58 0c0-1.84-1-4.6-5.29-10.35z"
              fill="#9FD3F5"
            />
            <circle
              cx="97.16"
              cy="43.43"
              r="1.265"
              fill="#FFFFFF"
              opacity="0.85"
            />
          </g>
          <g className="fx-drip fx-later">
            <path
              d="M90 22c-2.88 4-3.68 5.92-3.68 7.2a3.68 3.68 0 0 0 7.36 0c0-1.28-1-3.2-3.68-7.2z"
              fill="#9FD3F5"
            />
            <circle
              cx="88.72"
              cy="28.56"
              r="0.88"
              fill="#FFFFFF"
              opacity="0.85"
            />
          </g>
        </>
      );
    case "steaming":
      return (
        <>
          <g className="fx-steam" fill="#FFFFFF">
            <circle cx="44" cy="22" r="4.5" />
            <circle cx="48.5" cy="19.3" r="3.6" />
            <circle cx="39.95" cy="19.75" r="3.06" />
          </g>
          <g className="fx-steam fx-late" fill="#FFFFFF">
            <circle cx="62" cy="16" r="5.5" />
            <circle cx="67.5" cy="12.7" r="4.4" />
            <circle cx="57.05" cy="13.25" r="3.74" />
          </g>
          <g className="fx-steam fx-later" fill="#FFFFFF">
            <circle cx="80" cy="22" r="4.25" />
            <circle cx="84.25" cy="19.45" r="3.4" />
            <circle cx="76.175" cy="19.875" r="2.89" />
          </g>
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
    case "dizzy":
      return (
        <g className="fx-orbit fx-orbit--fast">
          <path
            d="M44 21l1.2 2.6 2.6 1.2-2.6 1.2L44 28.6l-1.2-2.6-2.6-1.2 2.6-1.2z"
            fill="#FFE39A"
          />
          <path d="M76 22l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="#FFFFFF" />
        </g>
      );
    case "celebrate":
      return (
        <>
          <path
            className="fx-sparkle"
            d="M24 20q1.44 5.52 6.24 6.24q-4.8 0.72-6.24 6.24q-1.44-5.52-6.24-6.24q4.8-0.72 6.24-6.24z"
            fill="#FFE39A"
          />
          <path
            className="fx-sparkle fx-late"
            d="M96 12q1.2 4.6 5.2 5.2q-4 0.6-5.2 5.2q-1.2-4.6-5.2-5.2q4-0.6 5.2-5.2z"
            fill="#BFDDFF"
          />
          <path
            className="fx-sparkle fx-later"
            d="M60 2q1.02 3.91 4.42 4.42q-3.4 0.51-4.42 4.42q-1.02-3.91-4.42-4.42q3.4-0.51 4.42-4.42z"
            fill="#FFC2CC"
          />
        </>
      );
    case "love":
      return (
        <>
          <path
            className="fx-heart"
            d="M26 31l-6-5.8c-3.2-3.2 1-7.8 4.4-5l1.6 1.3 1.6-1.3c3.4-2.8 7.6 1.8 4.4 5z"
            fill="#FF8FA3"
          />
          <path
            className="fx-heart fx-late"
            d="M94 21.65l-5.1-4.93c-2.72-2.72 0.85-6.63 3.74-4.25l1.36 1.105 1.36-1.105c2.89-2.38 6.46 1.53 3.74 4.25z"
            fill="#FFB3C1"
          />
          <path
            className="fx-heart fx-later"
            d="M60 8.3l-4.2-4.06c-2.24-2.24 0.7-5.46 3.08-3.5l1.12 0.91 1.12-0.91c2.38-1.96 5.32 1.26 3.08 3.5z"
            fill="#FF7F95"
          />
        </>
      );
    default:
      return null;
  }
}

function PropBehind({ mood }: { mood: Look }) {
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
function PropInFront({ mood }: { mood: Look }) {
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
function Outfit({ accessory, hatY }: { accessory: Accessory; hatY: number }) {
  if (accessory === "witchHat") {
    return (
      <g transform={`translate(0 ${hatY - 30})`}>
        <path d="M49 30L61 6q2-2 3 1l6 23z" fill="#4B3A6B" />
        <path d="M51 25.5h17" stroke="#C9A6FF" strokeWidth={2.4} />
        <ellipse cx="60" cy="30" rx="19" ry="3.6" fill="#3E3058" />
      </g>
    );
  }
  return (
    <g>
      <path d="M24 77q36 11 72 0v6q-36 11-72 0z" fill="#FF8FA0" />
      <path
        d="M24 80q36 11 72 0"
        stroke="#FFC2CC"
        strokeWidth={1.4}
        fill="none"
      />
      <path d="M78 84l5 11 6-2-4-11z" fill="#FF8FA0" />
    </g>
  );
}

export function Dumpling({
  kind,
  color,
  mood,
  heat,
  size = 64,
  seed,
  expression,
  accessory,
  motion,
}: Props) {
  const look: Look = expression ?? mood;
  // useId contains colons, which break url(#…) references.
  const id = useId().replace(/:/g, "");
  const shape = SHAPES[kind];
  const [hx = 36, hy = 50, hr = -30] = shape.highlight;
  const build = seed ? variantFor(seed) : BASE;
  const blush = (1 + heat * 0.7) * build.blush;
  // Stretch from the base of the pet so it always sits on the ground.
  const stretch = `translate(60 86) scale(${build.width} ${build.height}) translate(-60 -86)`;
  const spread = 1 + build.eyeSpread / 30;
  const face = `${stretch} translate(60 0) scale(${spread} 1) translate(-60 0)`;

  return (
    <svg
      className={`dumpling dumpling--${look}${motion ? ` ${motion}` : ""}`}
      style={{ ["--idle-delay" as string]: `${build.idleDelay}s` }}
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
      <PropBehind mood={look} />
      <g
        transform={
          look === "stalled" ? `translate(0 ${-shape.napLift})` : undefined
        }
      >
        <g className="dumpling__body">
          <g transform={stretch}>
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
          </g>
          <g transform={face}>
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
            <Eyes mood={look} />
            <Brows mood={look} />
            <Mouth mood={look} />
          </g>
          {accessory && <Outfit accessory={accessory} hatY={shape.hatY} />}
        </g>
      </g>
      <PropInFront mood={look} />
      <g transform={`translate(0 ${shape.fxOffset})`}>
        <Effects mood={look} />
      </g>
    </svg>
  );
}
