import type { Helper, Pet } from "../lib/types";

export interface RecapLine {
  id: string;
  name: string;
  kind: Pet["kind"];
  color: string;
  hours: number;
  tokens: number;
}

export interface Recap {
  range: string;
  hours: number;
  tokens: number;
  busiestDay: string | null;
  todosDone: number;
  drafts: number;
  lines: RecapLine[];
}

const DAY_MS = 86_400_000;
const shortDate = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
});

/** Hours to one decimal place, so a quiet week still reads as something. */
function hours(minutes: number): number {
  return Math.round(minutes / 6) / 10;
}

export function recap(helper: Helper, pets: Pet[], now: Date): Recap {
  const lines = helper.week.products.flatMap((entry) => {
    const pet = pets.find((candidate) => candidate.id === entry.productId);
    if (!pet) return [];
    return [
      {
        id: pet.id,
        name: pet.name,
        kind: pet.kind,
        color: pet.color,
        hours: hours(entry.activeMinutes),
        tokens: entry.tokens,
      },
    ];
  });
  const minutes = helper.week.products.reduce(
    (sum, entry) => sum + entry.activeMinutes,
    0,
  );
  const start = new Date(now.getTime() - 6 * DAY_MS);

  return {
    range: `${shortDate.format(start)} – ${shortDate.format(now)}`,
    hours: hours(minutes),
    tokens: helper.week.products.reduce((sum, entry) => sum + entry.tokens, 0),
    busiestDay: helper.week.busiestDay,
    todosDone: helper.todosDoneThisWeek,
    drafts: helper.draftsThisWeek,
    lines,
  };
}
