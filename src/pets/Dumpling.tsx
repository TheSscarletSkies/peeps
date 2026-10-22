import { useId } from "react";

import type { Accessory } from "../life/season";
import type { Mood, PetKind } from "../lib/types";
import { BUN, BunBody, BunGlasses, Dough, Worn, type BunWear } from "./Bun";
import { limbsFor, type Hand, type Prop } from "./limbs";
import { BASE, variantFor } from "./variant";

interface Props {
  /** Kept for callers; every peep is now the same cream bun. */
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
  wear?: BunWear;
  /** Extra classes for one-off motions such as a squish or hatching. */
  motion?: string;
}

/** Dizzy after a poke spree, celebrating finished work, in love after a pat or a note. */
/** What a peep can be dressed in, besides glasses. */
export type Wear = "bow" | "headphones" | "beanie";

export type Expression = "dizzy" | "celebrate" | "love" | "eager" | "wave";
type Look = Mood | Expression;

/** The bun's drawing, scaled into this 120 × 100 box with its base on the ground line. */
const GROUND = 86;
const SCALE = 0.34;
const PLACE = `translate(60 ${GROUND - BUN.ground * SCALE}) scale(${SCALE})`;
/** Where a hat sits, and how far a napping pet rises so its face peeks over the steamer. */
const HAT_Y = GROUND + (BUN.top - BUN.ground) * SCALE;
const NAP_LIFT = 4;
/**
 * Below this size the pleats, shine and resting paws turn into specks, so a small peep is drawn
 * as one soft shape with a lighter outline and bigger eyes, and its hands float out only to gesture.
 */
const SIMPLE_BELOW = 90;
const SOFT_LINE = "#c9a084";

const EYE = "#3F2A20";

const stroke = {
  stroke: EYE,
  strokeWidth: 2.2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  fill: "none",
};

/** Where the eyes sit: close together, a little below the middle, like a steamed bun's face. */
const EL = 51;
const ER = 69;
const EY = 57;

/** One eye drawn around its own centre, so both sides share the drawing. */
function Eye({
  mood,
  x,
  right,
  scale,
}: {
  mood: Look;
  x: number;
  right: boolean;
  scale: number;
}) {
  // Small dot eyes; every expression shrinks with them.
  const at = `translate(${x} ${EY}) scale(${scale})`;
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

function Eyes({ mood, scale }: { mood: Look; scale: number }) {
  return (
    <g className="dumpling__eyes">
      <Eye mood={mood} x={EL} right={false} scale={scale} />
      <Eye mood={mood} x={ER} right scale={scale} />
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

/** Small mouths between the eyes: a little smile at rest, open and happy when pleased. */
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
      return <path d="M57.4 69q2.6 3.6 5.2 0" {...stroke} />;
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

interface Line {
  stroke: string;
  strokeWidth: number;
}

const LIMB_LINE: Line = { stroke: BUN.line, strokeWidth: 1.7 };
const SOFT_LIMB_LINE: Line = { stroke: SOFT_LINE, strokeWidth: 1.4 };

/** Round paws resting in front of the bun, as in the study table drawing. */
function Paws() {
  return (
    <g transform={PLACE}>
      <ellipse
        cx="-75"
        cy="81"
        rx="30"
        ry="20"
        fill={BUN.paw}
        stroke={BUN.line}
        strokeWidth="5"
      />
      <ellipse
        cx="77"
        cy="81"
        rx="29"
        ry="20"
        fill={BUN.paw}
        stroke={BUN.line}
        strokeWidth="5"
      />
    </g>
  );
}

/** Stubby feet that stay on the ground while the body hops, and step when the pet walks. */
function Feet({
  fill,
  idle,
  line,
}: {
  fill: string;
  idle: boolean;
  line: Line;
}) {
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
          {...line}
        />
      ))}
    </g>
  );
}

function HandShape({
  hand,
  fill,
  line,
}: {
  hand: Hand;
  fill: string;
  line: Line;
}) {
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
      {...line}
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
  // The bun has no neck, so the scarf wraps it just above the paws.
  return (
    <g transform="translate(0 -6)">
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
  mood,
  heat,
  size = 64,
  seed,
  expression,
  accessory,
  glasses = false,
  wear = null,
  motion,
}: Props) {
  const look: Look = expression ?? mood;
  // useId contains colons, which break url(#…) references.
  const id = useId().replace(/:/g, "");
  const build = seed ? variantFor(seed) : BASE;
  const blush = (1 + heat * 0.7) * build.blush;
  // Stretch from the base of the pet so it always sits on the ground.
  const stretch = `translate(60 ${GROUND}) scale(${build.width} ${build.height}) translate(-60 -${GROUND})`;
  const spread = 1 + build.eyeSpread / 40;
  const face = `${stretch} translate(60 0) scale(${spread} 1) translate(-60 0)`;
  const limbs = limbsFor(look);
  const simple = size < SIMPLE_BELOW;
  const limbLine = simple ? SOFT_LIMB_LINE : LIMB_LINE;
  const paw = simple ? "#fff8ee" : BUN.paw;
  const cheek = simple
    ? { x: 16, y: 64, rx: 6.5, ry: 3.8, opacity: 0.6 }
    : { x: 18, y: 62.5, rx: 5.8, ry: 3.4, opacity: 0.68 };

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
        <Dough id={`${id}dough`} />
        <radialGradient id={`${id}soft`} cx=".4" cy=".35" r=".75">
          <stop offset=".55" stopColor="#fffaf0" />
          <stop offset="1" stopColor="#f6e2c8" />
        </radialGradient>
        <radialGradient id={`${id}shadow`}>
          <stop offset="0" stopColor="#000" stopOpacity={0.22} />
          <stop offset="1" stopColor="#000" stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse
        className="dumpling__shadow"
        cx="60"
        cy="88"
        rx="40"
        ry="6"
        fill={`url(#${id}shadow)`}
      />
      <PropBehind mood={look} />
      {!limbs.napping && (
        <g transform={stretch}>
          <Feet fill={paw} idle={Boolean(limbs.hidden)} line={limbLine} />
        </g>
      )}
      <g
        transform={look === "stalled" ? `translate(0 ${-NAP_LIFT})` : undefined}
      >
        <g className="dumpling__body">
          <g transform={stretch}>
            <g transform={PLACE}>
              {simple ? (
                <path
                  d={BUN.body}
                  fill={`url(#${id}soft)`}
                  stroke={SOFT_LINE}
                  strokeWidth="7"
                  strokeLinejoin="round"
                />
              ) : (
                <BunBody dough={`${id}dough`} />
              )}
            </g>
          </g>
          <g transform={face}>
            {[60 - cheek.x, 60 + cheek.x].map((cx) => (
              <ellipse
                key={cx}
                cx={cx}
                cy={cheek.y}
                rx={cheek.rx * blush}
                ry={cheek.ry * blush}
                fill={BUN.blush}
                opacity={cheek.opacity}
              />
            ))}
            <Eyes mood={look} scale={simple ? 0.9 : 0.75} />
            {glasses && (
              <BunGlasses left={EL} right={ER} y={EY} r={simple ? 6 : 5.4} />
            )}
            <Brows mood={look} />
            {/* Mouths were drawn around y = 70; this sits them just under the eyes, a little smaller. */}
            <g
              transform={`translate(60 ${EY + 7}) scale(0.8) translate(-60 -70)`}
            >
              <Mouth mood={look} />
            </g>
          </g>
          <g transform={stretch}>
            {limbs.hidden ? (
              !limbs.napping && !simple && <Paws />
            ) : (
              <>
                {limbs.prop && <Held prop={limbs.prop} right={limbs.right} />}
                <HandShape hand={limbs.left} fill={paw} line={limbLine} />
                <HandShape hand={limbs.right} fill={paw} line={limbLine} />
              </>
            )}
            {wear && (
              <g transform={PLACE}>
                <Worn wear={wear} />
              </g>
            )}
            {accessory && !wear && (
              <Outfit accessory={accessory} hatY={HAT_Y} />
            )}
          </g>
        </g>
      </g>
      <PropInFront mood={look} />
      {/* Steam rises from above the top knot rather than over it. */}
      <g transform={look === "steaming" ? "translate(0 -8)" : undefined}>
        <Effects mood={look} />
      </g>
    </svg>
  );
}
