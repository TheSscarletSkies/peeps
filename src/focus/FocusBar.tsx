import { useEffect, useState } from "react";

import { startFocus, stopFocus } from "../lib/bridge";
import type { Focus } from "../lib/types";
import { left, LENGTHS, progress } from "./clock";

/** Start a focus session, or watch the one going: the pet works with you, then calls a break. */
export function FocusBar({ focus }: { focus: Focus | null }) {
  const [minutes, setMinutes] = useState(25);
  const [task, setTask] = useState("");
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!focus) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [focus]);

  if (focus) {
    const resting = focus.phase === "break";
    return (
      <section
        className="focus"
        data-phase={focus.phase}
        aria-label={resting ? "Break" : "Focus session"}
      >
        <span className="focus__ring" aria-hidden="true">
          <svg viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15" />
            <circle
              cx="18"
              cy="18"
              r="15"
              pathLength={100}
              strokeDasharray={`${progress(focus, now) * 100} 100`}
            />
          </svg>
        </span>
        <span className="focus__text">
          <strong role="timer">{left(focus, now)}</strong>
          <span>
            {resting
              ? "Break: stand up, stretch, look far away"
              : focus.task
                ? `Focusing on ${focus.task}`
                : "Focusing"}
          </span>
        </span>
        <button
          className="button button--small"
          onClick={() => void stopFocus()}
        >
          {resting ? "Skip break" : "Stop"}
        </button>
      </section>
    );
  }

  return (
    <form
      className="focus"
      aria-label="Focus"
      onSubmit={(event) => {
        event.preventDefault();
        void startFocus(minutes, task).then(() => setTask(""));
      }}
    >
      <label className="visually-hidden" htmlFor="focus-task">
        What are you focusing on?
      </label>
      <input
        id="focus-task"
        value={task}
        placeholder="One thing to focus on (optional)"
        onChange={(event) => setTask(event.target.value)}
      />
      <div className="segmented" role="radiogroup" aria-label="Minutes">
        {LENGTHS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={minutes === option}
            className={minutes === option ? "segmented__on" : undefined}
            onClick={() => setMinutes(option)}
          >
            {option}
          </button>
        ))}
      </div>
      <button className="button button--primary" type="submit">
        Focus
      </button>
    </form>
  );
}
