/** Pokes this close together count as one burst. */
export const POKE_WINDOW_MS = 1500;
export const POKES_TO_DIZZY = 3;
/** Keep poking through a dizzy spell and the pet has had enough. */
export const SPREE_MS = 5000;
export const POKES_TO_GRUMPY = 7;

/** How a pet takes a poke, depending on how many came just before it. */
export type PokeLevel = "pat" | "giggle" | "dizzy" | "grumpy";

/** Records a poke and says how the pet reacts: a pat, a giggle, dizzy, then grumpy. */
export function poke(
  history: number[],
  now: number,
): { history: number[]; level: PokeLevel } {
  const spree = [...history.filter((at) => now - at < SPREE_MS), now];
  if (spree.length >= POKES_TO_GRUMPY) return { history: [], level: "grumpy" };
  const burst = spree.filter((at) => now - at < POKE_WINDOW_MS).length;
  const level =
    burst >= POKES_TO_DIZZY ? "dizzy" : burst === 2 ? "giggle" : "pat";
  return { history: spree, level };
}
