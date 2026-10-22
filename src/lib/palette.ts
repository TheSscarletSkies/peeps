/** The six pastels from the peeps and their cushions. Every tag, area and habit uses one. */
export const PASTELS = [
  "blush",
  "peach",
  "butter",
  "sage",
  "sky",
  "lilac",
] as const;
export type Pastel = (typeof PASTELS)[number];

/** Familiar areas get a colour that suits them; anything else gets one of the six, the same every time. */
const KNOWN: Record<string, Pastel> = {
  work: "sky",
  study: "sage",
  play: "peach",
  habit: "lilac",
  nudge: "butter",
};

export function pastelFor(tag: string): Pastel {
  const known = KNOWN[tag.toLowerCase()];
  if (known) return known;
  let hash = 0;
  for (const char of tag) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PASTELS[hash % PASTELS.length] ?? "blush";
}
