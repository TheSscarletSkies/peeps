import type { Wear } from "./Dumpling";

/**
 * The cream bun every peep is: pleats meeting at the top, a soft highlight and round paws.
 * Drawn around its own centre with the ground at y = 104, so the study table and the single
 * pet place the same drawing with one transform each.
 */
export const BUN = {
  body: "M-104 58Q-122 20-93-32Q-72-68-34-80Q-23-114-9-110Q4-128 19-109Q37-119 47-90Q101-70 111-13Q124 46 89 83Q66 102 0 104Q-66 102-90 85Q-101 76-104 58Z",
  highlight: "M-89 39Q-104 4-73-35",
  pleats: "M-24-85Q-37-66-43-46M0-109Q-12-80-9-49M20-100Q36-80 43-51",
  line: "#86553d",
  paw: "#fff7e4",
  blush: "#f6b5a4",
  ground: 104,
  top: -110,
};

/** A sprout on top marks your own peep at the study table. */
export type BunWear = Wear | "sprout" | null;

/** The dough's shading, one gradient per drawing since ids are document-wide. */
export function Dough({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1=".1" y1="0" x2=".8" y2="1">
      <stop stopColor="#fffdf0" />
      <stop offset=".72" stopColor="#fff5df" />
      <stop offset="1" stopColor="#f5dcb8" />
    </linearGradient>
  );
}

/** The bun itself, without a face: body, highlight and pleats. */
export function BunBody({ dough }: { dough: string }) {
  return (
    <>
      <path
        d={BUN.body}
        fill={`url(#${dough})`}
        stroke={BUN.line}
        strokeWidth="5.5"
        strokeLinejoin="round"
      />
      <path
        d={BUN.highlight}
        stroke="#fffefa"
        strokeWidth="11"
        opacity=".75"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={BUN.pleats}
        stroke="#c69274"
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
      />
    </>
  );
}

/** Thin round frames, one around each eye. */
export function BunGlasses({
  left,
  right,
  y,
  r,
}: {
  left: number;
  right: number;
  y: number;
  r: number;
}) {
  const line = { fill: "none", stroke: "#6a4636", strokeWidth: r * 0.2 };
  return (
    <g className="dumpling__glasses">
      <circle cx={left} cy={y} r={r} {...line} />
      <circle cx={right} cy={y} r={r} {...line} />
      <path
        d={`M${left + r} ${y - r * 0.15}q${(right - left - 2 * r) / 2} ${-r * 0.4} ${right - left - 2 * r} 0`}
        strokeLinecap="round"
        {...line}
      />
    </g>
  );
}

/** What a bun wears on its head. */
export function Worn({ wear }: { wear: BunWear }) {
  switch (wear) {
    case "bow":
      return (
        <g className="dumpling__wear" transform="translate(32 -110) rotate(17)">
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
        <g className="dumpling__wear">
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
        </g>
      );
    case "beanie":
      return (
        <g className="dumpling__wear">
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
        </g>
      );
    case "sprout":
      return (
        <g className="dumpling__wear">
          <path d="M0-105v-29" stroke="#6e976e" strokeWidth="5" />
          <path
            d="M0-124Q-27-155-42-134Q-36-109 0-124M0-124Q25-155 40-132Q36-110 0-124"
            fill="#86aa7a"
            stroke="#648961"
            strokeWidth="4"
          />
        </g>
      );
    default:
      return null;
  }
}
