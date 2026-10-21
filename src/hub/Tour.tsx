import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { Helper } from "../lib/types";
import { Dumpling } from "../pets/Dumpling";

export interface TourStep {
  /** The `data-tour` mark of the element to point at; none for a welcome in the middle. */
  target?: string;
  /** The page to show while this step is up. */
  page?: string;
  title: string;
  text: string;
}

export const STEPS: TourStep[] = [
  {
    title: "Hi, I'm your peep",
    text: "I keep you on top of your day. Click me for a pat; double-click or right-click me on your desktop to talk.",
  },
  {
    target: "today",
    page: "today",
    title: "Today",
    text: "Your list and what's coming up. Tick something off and I get a snack.",
  },
  {
    target: "chat",
    page: "chat",
    title: "Chat",
    text: "“What's on today?” or “remind me to call mum at 6”. I use your own Claude and remember what you tell me about you.",
  },
  {
    target: "nudges",
    page: "nudges",
    title: "Nudges",
    text: "Stretch, drink water, rest your eyes. Switch them on and I'll pop up when it's time.",
  },
  {
    target: "settings",
    page: "settings",
    title: "Make me yours",
    text: "Make me smaller or bigger, keep me at the top of the screen or anywhere, and add your calendars.",
  },
  {
    target: "toggles",
    title: "Light, dark and sound",
    text: "Replay this tour from the ? any time.",
  },
];

const KEY = "peeps.tour";

export function tourSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === "done";
  } catch {
    return true;
  }
}

function markSeen() {
  try {
    localStorage.setItem(KEY, "done");
  } catch {
    // Without storage the tour may show again next time.
  }
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const GAP = 14;
const BUBBLE = 300;

/** A step-by-step walk through the window, one tooltip at a time. */
export function Tour({
  helper,
  onPage,
  onClose,
}: {
  helper: Helper;
  onPage: (page: string) => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [height, setHeight] = useState(220);
  const card = useRef<HTMLDivElement>(null);
  const step = STEPS[index] ?? STEPS[0];
  const last = index === STEPS.length - 1;

  useEffect(() => {
    if (step?.page) onPage(step.page);
  }, [step, onPage]);

  useLayoutEffect(() => {
    const measure = () => {
      const element = step?.target
        ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
        : null;
      const rect = element?.getBoundingClientRect();
      setBox(
        rect
          ? {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            }
          : null,
      );
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [step]);

  useLayoutEffect(() => {
    if (card.current) setHeight(card.current.offsetHeight);
  }, [index, box]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") setIndex((now) => Math.max(0, now - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const finish = () => {
    markSeen();
    onPage("today");
    onClose();
  };
  const next = () => (last ? finish() : setIndex((now) => now + 1));

  // Beside the target when there is room, otherwise above it; centred for the welcome. Either
  // way it stays inside the window, so targets near the bottom don't push it out of sight.
  const fit = (top: number) =>
    Math.max(16, Math.min(top, window.innerHeight - height - 16));
  const bubble = box
    ? box.left + box.width + GAP + BUBBLE < window.innerWidth
      ? { top: fit(box.top - 8), left: box.left + box.width + GAP }
      : { top: fit(box.top - height - GAP), left: Math.max(16, box.left) }
    : null;

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="Tour">
      {box ? (
        <div
          className="tour__spot"
          style={{
            top: box.top - 4,
            left: box.left - 4,
            width: box.width + 8,
            height: box.height + 8,
          }}
        />
      ) : (
        <div className="tour__shade" />
      )}
      <div
        ref={card}
        className={
          bubble ? "tour__bubble" : "tour__bubble tour__bubble--centre"
        }
        style={
          bubble
            ? { top: bubble.top, left: bubble.left, width: BUBBLE }
            : { width: BUBBLE }
        }
      >
        <div className="tour__head">
          <Dumpling
            kind={helper.kind}
            color={helper.color}
            mood="chill"
            expression={index === 0 || last ? "love" : undefined}
            heat={0}
            size={36}
          />
          <strong>{step?.title}</strong>
        </div>
        <p>{step?.text}</p>
        <div className="tour__foot">
          <span
            className="tour__dots"
            aria-label={`Step ${index + 1} of ${STEPS.length}`}
          >
            {STEPS.map((_, i) => (
              <span key={i} data-on={i === index || undefined} />
            ))}
          </span>
          {!last && (
            <button className="tray__link" onClick={finish}>
              Skip
            </button>
          )}
          {index > 0 && (
            <button
              className="button button--small"
              onClick={() => setIndex(index - 1)}
            >
              Back
            </button>
          )}
          <button
            className="button button--small button--primary"
            onClick={next}
          >
            {index === 0 ? "Show me" : last ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
