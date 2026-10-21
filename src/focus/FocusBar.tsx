import { useEffect, useState } from "react";

import { startFocus, stopFocus } from "../lib/bridge";
import type { Focus, Friends } from "../lib/types";
import { left, LENGTHS, progress } from "./clock";

/** Start a focus session, or watch the one going: the pet works with you, then calls a break. */
export function FocusBar({
  focus,
  friends,
}: {
  focus: Focus | null;
  friends: Friends | null;
}) {
  const [minutes, setMinutes] = useState(25);
  const [task, setTask] = useState("");
  const [now, setNow] = useState(Date.now);

  const ticking =
    focus !== null ||
    (friends?.friends ?? []).some((friend) => friend.presence === "focusing");
  useEffect(() => {
    if (!ticking) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [ticking]);

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
                ? focus.task.startsWith("with ")
                  ? `Focusing ${focus.task}`
                  : `Focusing on ${focus.task}`
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

  // Joining ends with the friend, so the table breaks together.
  const studying = (friends?.friends ?? []).filter(
    (friend) => friend.presence === "focusing" && friend.focusUntil,
  );

  return (
    <>
      {studying.map((friend) => (
        <div key={friend.code} className="focus focus--join">
          <span className="focus__text">
            <strong>{friend.name} is studying</strong>
            <span>
              {left(
                {
                  phase: "focus",
                  startedAt: new Date(now).toISOString(),
                  endsAt: friend.focusUntil ?? "",
                  focusMinutes: 0,
                  task: null,
                },
                now,
              )}{" "}
              left. Pull up a chair?
            </span>
          </span>
          <button
            className="button button--primary"
            onClick={() =>
              void startFocus(
                Math.max(
                  1,
                  Math.round(
                    (Date.parse(friend.focusUntil ?? "") - Date.now()) / 60_000,
                  ),
                ),
                `with ${friend.name}`,
              )
            }
          >
            Join {friend.name}
          </button>
        </div>
      ))}
      <FocusForm
        minutes={minutes}
        setMinutes={setMinutes}
        task={task}
        setTask={setTask}
      />
    </>
  );
}

function FocusForm({
  minutes,
  setMinutes,
  task,
  setTask,
}: {
  minutes: number;
  setMinutes: (minutes: number) => void;
  task: string;
  setTask: (task: string) => void;
}) {
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
