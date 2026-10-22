import type { CalendarEvent } from "../lib/types";

const clock = new Intl.DateTimeFormat("en", {
  hour: "numeric",
  minute: "2-digit",
});
const weekday = new Intl.DateTimeFormat("en", { weekday: "short" });

function dayOffset(date: Date, now: Date): number {
  const start = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((start(date) - start(now)) / 86_400_000);
}

/** "6:00 PM", "Tomorrow 11:00 AM", "All day", "Wed 9:00 AM". */
export function eventTime(event: CalendarEvent, now: Date): string {
  const start = new Date(event.start);
  const offset = dayOffset(start, now);
  const day =
    offset <= 0 ? "" : offset === 1 ? "Tomorrow" : weekday.format(start);
  const time = event.allDay ? "All day" : clock.format(start);
  return [day, time].filter(Boolean).join(" ");
}

/** "now", "in 25 min", "in 2 h", or nothing once it is further out. */
export function eventCountdown(event: CalendarEvent, now: Date): string | null {
  if (event.allDay) return null;
  const start = new Date(event.start).getTime();
  const end = new Date(event.end).getTime();
  const minutes = Math.round((start - now.getTime()) / 60_000);
  if (start <= now.getTime() && end > now.getTime()) return "now";
  if (minutes > 0 && minutes < 60) return `in ${minutes} min`;
  if (minutes >= 60 && minutes < 6 * 60)
    return `in ${Math.round(minutes / 60)} h`;
  return null;
}
