/** Pokes this close together count towards making a pet dizzy. */
export const POKE_WINDOW_MS = 1500;
export const POKES_TO_DIZZY = 3;

/** Records a poke and reports whether the pet just got dizzy. */
export function poke(
  history: number[],
  now: number,
): { history: number[]; dizzy: boolean } {
  const recent = [...history.filter((at) => now - at < POKE_WINDOW_MS), now];
  if (recent.length >= POKES_TO_DIZZY) return { history: [], dizzy: true };
  return { history: recent, dizzy: false };
}
