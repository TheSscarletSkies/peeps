import { addSchedule, deleteSchedule } from "../lib/bridge";
import type { Helper, Pet } from "../lib/types";

/** The next Monday, as YYYY-MM-DD in the user's time. */
export function nextMonday(from: Date): string {
  const day = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  day.setDate(day.getDate() + ((8 - day.getDay()) % 7 || 7));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

/** Turns a product's Monday review on or off. */
export function ReviewToggle({ pet, helper }: { pet: Pet; helper: Helper }) {
  const schedule = helper.schedules.find(
    (item) => item.kind === "review" && item.topic === pet.id,
  );
  const toggle = () =>
    schedule
      ? deleteSchedule(schedule.id)
      : addSchedule({
          kind: "review",
          topic: pet.id,
          repeat: "weekly",
          start: nextMonday(new Date()),
          time: "09:00",
        });

  return (
    <div className="review-toggle">
      <span>
        <strong>Weekly review</strong>
        {schedule
          ? "Mondays at 9: three moves for the week, added to your list."
          : "Off. Turn on for three moves every Monday."}
      </span>
      <button
        className={schedule ? "chip chip--on" : "chip"}
        role="switch"
        aria-checked={Boolean(schedule)}
        aria-label={`Weekly review for ${pet.name}`}
        onClick={() => void toggle()}
      >
        {schedule ? "On" : "Off"}
      </button>
    </div>
  );
}
