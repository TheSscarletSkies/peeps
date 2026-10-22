import type { HabitWeek } from "../lib/types";
import { tagStyle } from "../helper/HelperPanel";

const DAY = new Intl.DateTimeFormat("en", { weekday: "narrow" });

/** Every habit with a dot for each of the last seven days, so a streak can be seen at a glance. */
export function WeekCard({ habits }: { habits: HabitWeek[] }) {
  if (habits.length === 0)
    return (
      <p className="setup__hint">
        Habits show up here: anything that repeats, like “read 20 pages every
        day #study”.
      </p>
    );
  const days = habits[0]?.days ?? [];
  return (
    <table className="week" aria-label="This week">
      <thead>
        <tr>
          <th />
          {days.map((day) => (
            <th key={day.date} scope="col">
              {DAY.format(new Date(`${day.date}T12:00:00`))}
            </th>
          ))}
          <th scope="col" className="week__streak">
            <span className="visually-hidden">Streak</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {habits.map((habit) => (
          <tr
            key={habit.id}
            style={habit.area ? tagStyle(habit.area) : undefined}
          >
            <th scope="row">{habit.title}</th>
            {habit.days.map((day) => (
              <td key={day.date}>
                <span
                  className="week__dot"
                  data-done={day.done || undefined}
                  aria-label={
                    day.done ? `Done ${day.date}` : `Not done ${day.date}`
                  }
                />
              </td>
            ))}
            <td className="week__streak">
              {habit.streak > 1 ? `${habit.streak} in a row` : ""}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
