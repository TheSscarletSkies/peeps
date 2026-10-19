import type { CalendarEvent } from "../lib/types";
import { eventCountdown, eventTime } from "./when";

export function Upcoming({
  events,
  limit,
  now = new Date(),
}: {
  events: CalendarEvent[];
  limit: number;
  now?: Date;
}) {
  const shown = events.slice(0, limit);
  if (shown.length === 0) return null;
  return (
    <ul className="upcoming" aria-label="Coming up">
      {shown.map((event) => {
        const countdown = eventCountdown(event, now);
        return (
          <li key={event.key} data-soon={countdown !== null || undefined}>
            <span className="upcoming__time">{eventTime(event, now)}</span>
            <span className="upcoming__what">
              <span className="upcoming__title">{event.title}</span>
              <span className="upcoming__where">
                {[event.calendar, event.location].filter(Boolean).join(" · ")}
              </span>
            </span>
            {countdown && (
              <span className="upcoming__countdown">{countdown}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
