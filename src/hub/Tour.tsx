import { useEffect, useLayoutEffect, useState } from "react";

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
    title: "Hi, I'm your helper",
    text: "Let me show you around. It takes half a minute.",
  },
  {
    target: "ask",
    page: "ask",
    title: "Ask me anything",
    text: "“What's on today?”, “draft a reply to Sara”, or “remind me to drink water every 2 hours”. I use your own Claude.",
  },
  {
    target: "todo",
    page: "todo",
    title: "Your list",
    text: "Add #tags, dates and repeats. Habits keep a streak, and I nudge you when things are due.",
  },
  {
    target: "reminders",
    page: "reminders",
    title: "Never miss a class",
    text: "Paste your calendar links and choose how early I should remind you, like 30 minutes before anything called class.",
  },
  {
    target: "mail",
    page: "mail",
    title: "Email, with your OK",
    text: "Add Gmail or iCloud with an app password. I draft, you edit and press Send, and I tell you who hasn't replied.",
  },
  {
    target: "numbers",
    page: "numbers",
    title: "Money and posts",
    text: "PayPal payments and YouTube uploads show up on each product's card. Log a bank transfer or a TikTok post with one tap.",
  },
  {
    target: "write",
    page: "write",
    title: "Posts in your voice",
    text: "I draft LinkedIn or X posts now, or on a schedule, like every Monday at 9.",
  },
  {
    target: "products",
    page: "products",
    title: "Pets for your projects",
    text: "Optional. Add the projects you build with Claude Code and each one hatches as a pet that tells you when it needs you.",
  },
  {
    target: "devices",
    page: "devices",
    title: "On all your computers",
    text: "Pick a folder in iCloud Drive, OneDrive, Dropbox or Google Drive and your Mac and PC stay in step. No account needed.",
  },
  {
    target: "toggles",
    title: "Make it yours",
    text: "Light or dark, and a soft boop when a pet needs you. You can replay this tour from the ? any time.",
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
    onPage("home");
    onClose();
  };
  const next = () => (last ? finish() : setIndex((now) => now + 1));

  // Beside the target when there is room, otherwise above it; centred for the welcome.
  const bubble = box
    ? box.left + box.width + GAP + BUBBLE < window.innerWidth
      ? { top: Math.max(16, box.top - 8), left: box.left + box.width + GAP }
      : { top: Math.max(16, box.top - 190), left: Math.max(16, box.left) }
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
