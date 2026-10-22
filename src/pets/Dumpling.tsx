import { useId } from "react";

import type { Accessory } from "../life/season";
import type { Mood, PetKind } from "../lib/types";
import { limbsFor, type Hand, type Prop } from "./limbs";
import shapes from "./shapes.json";
import { edge, flushed, mix, soft } from "./tint";
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
  /** Round reading glasses, worn while studying or working together. */
  glasses?: boolean;
  /** Something the user dressed their peep in. */
  wear?: Wear | null;
  /** Sitting at a table: its own arms, feet and props are left off, the table draws its hands. */
  seated?: boolean;
  /** Extra classes for one-off motions such as a squish or hatching. */
  motion?: string;
}

/** Dizzy after a poke spree, celebrating finished work, in love after a pat or a note. */
/** What a peep can be dressed in, besides glasses. */
export type Wear = "bow" | "headphones" | "beanie";

export type Expression = "dizzy" | "celebrate" | "love" | "eager" | "wave";
type Look = Mood | Expression;

interface Shape {
  body: string;
  creases: string;
  highlight: number[];
  /** Taller than the drawing, for shapes drawn squat. */
  tall: number;
  /** Moves the face down (or up) to sit where the shape is roundest. */
  faceY: number;
  /** A part drawn in its own colour on top, like an onigiri's seaweed. */
  decor?: string;
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
  strokeWidth: 2.2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  fill: "none",
};

/** Where the eyes sit: wide apart and a little below the middle, like a steamed bun's face. */
const EL = 42;
const ER = 78;
const EY = 63;

/** One eye drawn around its own centre, so both sides share the drawing. */
function Eye({ mood, x, right }: { mood: Look; x: number; right: boolean }) {
  const at = `translate(${x} ${EY})`;
  switch (mood) {
    case "stalled":
      return <path transform={at} d="M-3.6 -.4q3.6 3 7.2 0" {...stroke} />;
    case "celebrate":
      return <path transform={at} d="M-3.6 1.6q3.6-4.4 7.2 0" {...stroke} />;
    case "failing":
      return <path transform={at} d="M-3.6 1.4q3.6-3 7.2 0" {...stroke} />;
    case "litterBox":
      return (
        <path
          transform={at}
          d={right ? "M2.6-2.6l-4.4 2.6 4.4 2.6" : "M-2.6-2.6l4.4 2.6-4.4 2.6"}
          {...stroke}
        />
      );
    case "dizzy":
      return (
        <path
          transform={at}
          d="M-3 0a3 3 0 1 0 3-3a1.8 1.8 0 1 0 1.8 1.8"
          {...stroke}
        />
      );
    case "love":
      return (
        <path
          transform={at}
          d="M0 4.6l-4.6-4.4c-2.4-2.4.8-6 3.4-3.8l1.2 1 1.2-1c2.6-2.2 5.8 1.4 3.4 3.8z"
          fill="#FF7F95"
        />
      );
    case "eager":
      return (
        <g transform={at}>
          <ellipse rx="3.9" ry="4.4" fill={EYE} />
          <circle cx="-1.3" cy="-1.7" r="1.5" fill="#FFFFFF" />
          <circle cx="1.4" cy="1.6" r=".7" fill="#FFFFFF" />
        </g>
      );
    default:
      return (
        <g transform={at}>
          <ellipse rx="3.5" ry="4.2" fill={EYE} />
          <circle cx="-1.1" cy="-1.6" r="1.2" fill="#FFFFFF" />
        </g>
      );
  }
}

function Eyes({ mood }: { mood: Look }) {
  return (
    <g className="dumpling__eyes">
      <Eye mood={mood} x={EL} right={false} />
      <Eye mood={mood} x={ER} right />
      {mood === "failing" && (
        <>
          <path
            d={`M${EL + 1} ${EY + 3}q-1 6 .5 12M${ER - 1} ${EY + 3}q1 6-.5 12`}
            stroke="#A8DAF7"
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
            opacity={0.9}
          />
          <g className="fx-tear">
            <circle cx={EL + 1} cy={EY + 16} r="2.6" fill="#9FD3F5" />
          </g>
          <g className="fx-tear fx-late">
            <circle cx={ER - 1} cy={EY + 16} r="2.6" fill="#9FD3F5" />
          </g>
        </>
      )}
    </g>
  );
}

const OUTLINE = {
  stroke: "#4A2614",
  strokeWidth: 1.8,
  strokeLinejoin: "round" as const,
};

/** A bow, headphones or a beanie, drawn in the same sticker style as the pet. */
function Dressed({ wear, top }: { wear: Wear; top: number }) {
  switch (wear) {
    case "bow":
      return (
        <g
          className="dumpling__wear"
          transform={`translate(77 ${top + 8}) rotate(18)`}
        >
          <path d="M0 0L-11-6.5q-3 6.5 0 13z" fill="#F8C6D1" {...OUTLINE} />
          <path d="M0 0L11-6.5q3 6.5 0 13z" fill="#F8C6D1" {...OUTLINE} />
          <circle r="3.4" fill="#F2A9BA" {...OUTLINE} />
        </g>
      );
    case "beanie":
      return (
        <g className="dumpling__wear">
          <path
            d={`M33 ${top + 16}Q33 ${top - 8} 60 ${top - 8}Q87 ${top - 8} 87 ${top + 16}z`}
            fill="#EADFCB"
            {...OUTLINE}
          />
          <path
            d={`M44 ${top - 2}v14M52 ${top - 6}v18M60 ${top - 7}v19M68 ${top - 6}v18M76 ${top - 2}v14`}
            stroke="#4A2614"
            strokeOpacity={0.25}
            strokeWidth={1.4}
            strokeLinecap="round"
          />
          <rect
            x="30"
            y={top + 12}
            width="60"
            height="9"
            rx="4.5"
            fill="#DCCDB3"
            {...OUTLINE}
          />
          <circle cx="60" cy={top - 9} r="5" fill="#FFF8EF" {...OUTLINE} />
        </g>
      );
    case "headphones":
      return (
        <g className="dumpling__wear">
          <path
            d={`M21 58Q21 ${top - 4} 60 ${top - 4}Q99 ${top - 4} 99 58`}
            fill="none"
            stroke="#4A2614"
            strokeWidth={5.6}
            strokeLinecap="round"
          />
          <path
            d={`M21 58Q21 ${top - 4} 60 ${top - 4}Q99 ${top - 4} 99 58`}
            fill="none"
            stroke="#E6DED2"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <rect
            x="12"
            y="52"
            width="12"
            height="18"
            rx="6"
            fill="#D6CAB8"
            {...OUTLINE}
          />
          <rect
            x="96"
            y="52"
            width="12"
            height="18"
            rx="6"
            fill="#D6CAB8"
            {...OUTLINE}
          />
        </g>
      );
  }
}

/** Round frames over the eyes, clear lenses so the eyes read as they are. */
function Glasses() {
  const lens = {
    r: 7,
    fill: "none",
    stroke: "#4A2E22",
    strokeWidth: 1.3,
  };
  return (
    <g className="dumpling__glasses">
      <circle cx={EL} cy={EY} {...lens} />
      <circle cx={ER} cy={EY} {...lens} />
      <path
        d={`M${EL + 7} ${EY - 1}q${(ER - EL - 14) / 2} -3.4 ${ER - EL - 14} 0`}
        fill="none"
        stroke="#4A2E22"
        strokeWidth={1.3}
        strokeLinecap="round"
      />
    </g>
  );
}

/** Small mouths between the eyes: a :3 at rest, open and happy when pleased. */
function Mouth({ mood }: { mood: Look }) {
  const happy = (
    <>
      <path d="M56.6 68.6h6.8q-.6 4.6-3.4 4.6t-3.4-4.6z" fill={EYE} />
      <path d="M58 71.8q2-1.3 4 0q-.9 1.2-2 1.2t-2-1.2z" fill="#FF8FA3" />
    </>
  );
  switch (mood) {
    case "needsYou":
      return <ellipse cx="60" cy="70.4" rx="1.8" ry="2.2" fill={EYE} />;
    case "sweating":
      return <path d="M57.4 70.4h5.2" {...stroke} />;
    case "failing":
      return <path d="M56.6 72q3.4-2.6 6.8 0" {...stroke} />;
    case "steaming":
    case "dizzy":
      return (
        <path d="M55.4 70.6q1.15-1.4 2.3 0t2.3 0t2.3 0t2.3 0" {...stroke} />
      );
    case "litterBox":
      return <path d="M57 71.4q3-2.4 6 0" {...stroke} />;
    case "stalled":
      return (
        <ellipse cx="60" cy="70.6" rx="1.4" ry="1.1" fill={EYE} opacity={0.7} />
      );
    case "hungry":
      return (
        <>
          {happy}
          <path
            d="M62.8 72.4v4"
            stroke="#A8DAF7"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </>
      );
    case "eager":
      return (
        <>
          <ellipse cx="60" cy="71.4" rx="3.6" ry="4.2" fill={EYE} />
          <ellipse cx="60" cy="73.6" rx="2.4" ry="1.6" fill="#FF8FA3" />
        </>
      );
    case "celebrate":
    case "love":
    case "wave":
      return happy;
    default:
      return <path d="M56.4 69q1.8 2.4 3.6 0q1.8 2.4 3.6 0" {...stroke} />;
  }
}

function Brows({ mood }: { mood: Look }) {
  return mood === "sweating" || mood === "steaming" ? (
    <path
      d={`M${EL - 4} ${EY - 7}l5 1.6M${ER + 4} ${EY - 7}l-5 1.6`}
      {...stroke}
    />
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

const LIMB_LINE = {
  stroke: "#4A2614",
  strokeOpacity: 0.85,
  strokeWidth: 1.6,
};

/** Stubby feet that stay on the ground while the body hops, and step when the pet walks. */
function Feet({ fill, idle }: { fill: string; idle: boolean }) {
  return (
    <g className={`dumpling__feet${idle ? " dumpling__feet--idle" : ""}`}>
      {[46, 74].map((cx, index) => (
        <ellipse
          key={cx}
          className={`dumpling__foot${index ? " dumpling__foot--late" : ""}`}
          cx={cx}
          cy={86.5}
          rx={7}
          ry={3.6}
          fill={fill}
          {...LIMB_LINE}
        />
      ))}
    </g>
  );
}

function HandShape({ hand, fill }: { hand: Hand; fill: string }) {
  // Gestures swing from where the arm would meet the body, nearer the middle and lower down.
  const pivotX = hand.x + (hand.x < 60 ? 8 : -8);
  return (
    <ellipse
      className={`limb${hand.motion ? ` ${hand.motion}` : ""}`}
      style={{ transformOrigin: `${pivotX}px ${hand.y + 10}px` }}
      cx={hand.x}
      cy={hand.y}
      rx={5.6}
      ry={4.8}
      fill={fill}
      {...LIMB_LINE}
    />
  );
}

/** What a pet holds: a pencil while working, a sign when things broke, a heart. */
function Held({ prop, right }: { prop: Prop; right: Hand }) {
  switch (prop) {
    case "pencil":
      return (
        // The motion and the placement sit on separate groups: a transform origin would also
        // shift the placement.
        <g
          className={right.motion}
          style={{ transformOrigin: `${right.x}px ${right.y}px` }}
        >
          <g transform={`translate(${right.x} ${right.y}) rotate(35)`}>
            <rect x={-2} y={-14} width={4} height={15} rx={1} fill="#FFD66B" />
            <rect x={-2} y={-16} width={4} height={3} rx={1} fill="#FF9AAA" />
            <path d="M-2 1l2 4.5 2-4.5z" fill="#F6DCC8" />
            <path d="M-0.7 4l0.7 1.5 0.7-1.5z" fill={EYE} />
          </g>
        </g>
      );
    case "sign":
      return (
        <g>
          <rect
            x={42}
            y={77}
            width={36}
            height={15}
            rx={3}
            fill="#FFF6E8"
            {...LIMB_LINE}
          />
          <text
            x={60}
            y={87.6}
            textAnchor="middle"
            fontSize={7.5}
            fontWeight={800}
            fontFamily="inherit"
            fill={EYE}
          >
            help
          </text>
        </g>
      );
    case "heart":
      return (
        <path
          className="limb-heart"
          d="M60 89l-5.2-5c-2.8-2.8.9-6.8 3.9-4.4l1.3 1.1 1.3-1.1c3-2.4 6.7 1.6 3.9 4.4z"
          fill="#FF7F95"
        />
      );
  }
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
  glasses = false,
  wear = null,
  seated = false,
  motion,
}: Props) {
  const look: Look = expression ?? mood;
  // useId contains colons, which break url(#…) references.
  const id = useId().replace(/:/g, "");
  const shape = SHAPES[kind];
  const build = seed ? variantFor(seed) : BASE;
  const blush = (1 + heat * 0.7) * build.blush;
  // Stretch from the base of the pet so it always sits on the ground.
  const stretch = `translate(60 86) scale(${build.width} ${build.height * shape.tall}) translate(-60 -86)`;
  // One warm brown outline for every pet, barely touched by its colour, so a table of peeps
  // reads as one set rather than a rainbow of edges.
  const line = mix(edge(color), "#5A3522", 0.88);
  const spread = 1 + build.eyeSpread / 30;
  const face = `${stretch} translate(60 ${shape.faceY}) scale(${spread} 1) translate(-60 0)`;
  const skin = soft(flushed(color, heat));
  const limbs = limbsFor(look, kind);

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
        <linearGradient id={`${id}shade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.72" stopColor="#C99470" stopOpacity={0} />
          <stop offset="1" stopColor="#C99470" stopOpacity={0.2} />
        </linearGradient>
        <clipPath id={`${id}clip`}>
          <path d={shape.body} />
        </clipPath>
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
      {!seated && <PropBehind mood={look} />}
      {!limbs.napping && !seated && (
        <g transform={stretch}>
          <Feet fill={skin} idle={Boolean(limbs.hidden)} />
        </g>
      )}
      <g
        transform={
          look === "stalled" ? `translate(0 ${-shape.napLift})` : undefined
        }
      >
        <g className="dumpling__body">
          <g transform={stretch}>
            <path d={shape.body} fill={skin} />
            {/* A flat sticker finish: only a soft warm band where the bun meets the plate. */}
            <path d={shape.body} fill={`url(#${id}shade)`} />
            {shape.decor && (
              <path
                d={shape.decor}
                fill="#6E8670"
                clipPath={`url(#${id}clip)`}
              />
            )}
            {/* Pleats gathered at the top, like a real bun, in the same brown as the outline. */}
            <path
              d={shape.creases}
              stroke={line}
              strokeOpacity={0.5}
              strokeWidth={1.3}
              strokeLinecap="round"
              fill="none"
            />
            {/* A firm, warm brown outline, the sticker look, drawn last so it stays crisp. */}
            <path
              d={shape.body}
              fill="none"
              stroke={line}
              strokeWidth={2.1}
              strokeLinejoin="round"
            />
          </g>
          <g transform={face}>
            <ellipse
              cx={EL - 4}
              cy={EY + 6}
              rx={5.4 * blush}
              ry={3.3 * blush}
              fill="#F7A3A0"
              opacity={0.7}
            />
            <ellipse
              cx={ER + 4}
              cy={EY + 6}
              rx={5.4 * blush}
              ry={3.3 * blush}
              fill="#F7A3A0"
              opacity={0.7}
            />
            <Eyes mood={look} />
            {glasses && <Glasses />}
            <Brows mood={look} />
            {/* Mouths were drawn for eyes 3 lower; moving the group keeps every expression in step. */}
            <g transform={`translate(0 ${EY - 66})`}>
              <Mouth mood={look} />
            </g>
          </g>
          {!limbs.hidden && !seated && (
            <g transform={stretch}>
              {limbs.prop && <Held prop={limbs.prop} right={limbs.right} />}
              {/* A shade deeper than the body, so a hand reads even when it overlaps it. */}
              <HandShape
                hand={limbs.left}
                fill={mix(skin, edge(color), 0.16)}
              />
              <HandShape
                hand={limbs.right}
                fill={mix(skin, edge(color), 0.16)}
              />
            </g>
          )}
          {wear && <Dressed wear={wear} top={shape.hatY} />}
          {accessory && !wear && (
            <Outfit accessory={accessory} hatY={shape.hatY} />
          )}
        </g>
      </g>
      {!seated && <PropInFront mood={look} />}
      <g transform={`translate(0 ${shape.fxOffset})`}>
        <Effects mood={look} />
      </g>
    </svg>
  );
}
