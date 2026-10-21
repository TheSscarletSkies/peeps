import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { floatTray } from "../lib/bridge";
import type { Snapshot } from "../lib/types";
import {
  boxFor,
  clampSpot,
  FLOAT_PET,
  defaultSpot,
  openRect,
  PANEL,
  type Area,
  type Spot,
} from "../life/float";
import { usePrefs } from "../life/prefs";
import {
  ALL,
  CardBody,
  FRIEND,
  HELPER,
  NUDGE,
  Roster,
  type Reminder,
  type Resident,
} from "./shared";
import { useCloseOnLeave, useHeight } from "./useCard";
import { giveFiles, useFileDrop } from "../life/drops";
import { announceFed, announcePat } from "../life/events";

const KEY = "peeps.float";
const DRAG_THRESHOLD = 4;

function screenArea(): Area {
  const screen = window.screen as Screen & {
    availLeft?: number;
    availTop?: number;
  };
  return {
    left: screen.availLeft ?? 0,
    top: screen.availTop ?? 0,
    width: screen.availWidth,
    height: screen.availHeight,
  };
}

function savedSpot(area: Area, box: number): Spot {
  try {
    const value = JSON.parse(
      localStorage.getItem(KEY) ?? "null",
    ) as Spot | null;
    if (value && Number.isFinite(value.x) && Number.isFinite(value.y)) {
      return clampSpot(value, area, box);
    }
  } catch {
    // A missing or broken spot just means the default one.
  }
  return defaultSpot(area, box);
}

function saveSpot(spot: Spot) {
  try {
    localStorage.setItem(KEY, JSON.stringify(spot));
  } catch {
    // Without storage the pet returns to its default spot next time.
  }
}

/**
 * For screens without a notch: the companion floats wherever it was dropped.
 * A click pats it; a double click, a right click or the little bubble opens its card beside it.
 */
export function FloatTray({
  snapshot,
  residents,
  reminder,
}: {
  snapshot: Snapshot;
  residents: Resident[];
  reminder: Reminder;
}) {
  const [area] = useState(screenArea);
  const [prefs, setPrefs] = usePrefs();
  const box = boxFor(prefs.size);
  const [spot, setSpot] = useState(() => savedSpot(area, box));
  const [openId, setOpenId] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const grab = useRef<{
    x: number;
    y: number;
    from: Spot;
    moved: boolean;
  } | null>(null);
  const frame = useRef(0);
  const open = openId !== null;
  const panelHeight = useHeight(panel, open);
  useCloseOnLeave(() => setOpenId((now) => (now === NUDGE ? now : null)));
  // A reminder opens beside the pet on its own; it goes away with Done or Later.
  useEffect(() => {
    if (reminder.nudge) setOpenId(NUDGE);
    else setOpenId((now) => (now === NUDGE ? null : now));
  }, [reminder.nudge]);
  useFileDrop((id, paths) => {
    giveFiles(id, paths);
    announceFed(id);
    setOpenId(id);
  });

  const helper = residents.find((resident) => resident.id === HELPER);
  const company = residents.filter((resident) =>
    resident.id.startsWith(FRIEND),
  );
  const waiting = residents.filter((resident) => resident.urgent).length;
  const rect = openRect(spot, panelHeight, area, box);
  const toggleCard = () => setOpenId((now) => (now === null ? HELPER : null));

  // Opening or closing moves and resizes the window, and the window and the page can't change
  // in the same frame. Hiding the pet until the window is in place avoids a frame where it jumps.
  const [settled, setSettled] = useState(true);
  const wasOpen = useRef(open);
  useLayoutEffect(() => {
    if (wasOpen.current !== open) setSettled(false);
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    const show = () => requestAnimationFrame(() => setSettled(true));
    if (open && panelHeight > 0) {
      void floatTray(rect.x, rect.y, rect.width, rect.height).then(show);
    } else if (!open) {
      const kept = clampSpot(spot, area, box);
      setSpot(kept);
      void floatTray(kept.x, kept.y, box, box).then(show);
    }
    // Moving while dragging is handled frame by frame below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, panelHeight, box]);

  const move = (next: Spot) => {
    setSpot(next);
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      void floatTray(next.x, next.y, box, box);
    });
  };

  const side = open ? rect.side : "right";

  return (
    <div
      className="float"
      data-side={side}
      data-settling={settled ? undefined : true}
    >
      <button
        className="float__pet"
        data-drop={HELPER}
        style={{ top: open ? rect.petTop : 0, width: box, height: box }}
        data-waiting={waiting > 0 || undefined}
        aria-label={
          waiting > 0
            ? `${snapshot.helper.name}: ${waiting} need${waiting === 1 ? "s" : ""} you`
            : snapshot.helper.name
        }
        aria-expanded={open}
        onPointerDown={(event) => {
          grab.current = {
            x: event.screenX,
            y: event.screenY,
            from: spot,
            moved: false,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const current = grab.current;
          if (!current) return;
          const dx = event.screenX - current.x;
          const dy = event.screenY - current.y;
          if (!current.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
          if (!current.moved) setOpenId(null);
          current.moved = true;
          move(
            clampSpot(
              { x: current.from.x + dx, y: current.from.y + dy },
              area,
              box,
            ),
          );
        }}
        onPointerUp={() => {
          const current = grab.current;
          grab.current = null;
          if (current?.moved) saveSpot(spot);
          // Capturing the pointer for dragging keeps the click from the pet, so pass the pat on.
          else if (current) announcePat(HELPER);
        }}
        onDoubleClick={toggleCard}
        onContextMenu={(event) => {
          event.preventDefault();
          toggleCard();
        }}
        onClick={(event) => {
          // Keyboard users have no pat; Enter opens the card.
          if (event.detail === 0) toggleCard();
        }}
      >
        {helper?.pet(FLOAT_PET[prefs.size])}
        {waiting > 0 && <span className="float__badge">{waiting}</span>}
      </button>
      {!open && company.length > 0 && (
        <button
          className="float__friends"
          aria-label={`Focusing too: ${company.map((r) => r.name).join(", ")}`}
          title={`Focusing too: ${company.map((r) => r.name).join(", ")}`}
          onClick={() => setOpenId(company[0]?.id ?? HELPER)}
        >
          {company.map((resident) => (
            <span key={resident.id}>{resident.pet(22)}</span>
          ))}
        </button>
      )}
      {!open && (
        <button
          className="float__open"
          aria-label={`Talk to ${snapshot.helper.name}`}
          title="Open"
          onClick={toggleCard}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h7A1.5 1.5 0 0 1 12 3.5v5A1.5 1.5 0 0 1 10.5 10H6l-3 2.5V10h0A1.5 1.5 0 0 1 2 8.5z" />
          </svg>
        </button>
      )}

      {open && (
        <div
          ref={panel}
          className="float__panel"
          style={{
            width: PANEL,
            maxHeight: area.height - 16,
            ["--pet" as string]: snapshot.helper.color,
          }}
        >
          <button
            className="card__close"
            aria-label="Close"
            title="Close"
            onClick={() => setOpenId(null)}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </button>
          <div
            className="float__pets"
            role="tablist"
            aria-label="Card"
            data-hidden={openId === NUDGE || undefined}
          >
            <button
              role="tab"
              aria-selected={openId === HELPER}
              className="float__chip"
              onClick={() => setOpenId(HELPER)}
            >
              {helper?.pet(30)}
              <span>{snapshot.helper.name}</span>
            </button>
            <button
              role="tab"
              aria-selected={openId === ALL}
              className="float__chip float__chip--all"
              onClick={() => setOpenId(ALL)}
              aria-label="Size and place"
            >
              ⋯
            </button>
          </div>
          <CardBody
            openId={openId}
            snapshot={snapshot}
            reminder={reminder}
            roster={
              <Roster
                size={prefs.size}
                place={prefs.place}
                onSize={(next) => setPrefs({ ...prefs, size: next })}
                onPlace={(next) => setPrefs({ ...prefs, place: next })}
              />
            }
          />
        </div>
      )}
    </div>
  );
}
