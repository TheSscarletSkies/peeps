import { useEffect, useRef, useState } from "react";

import { MOOD_LABEL } from "../hub/ProductCard";
import { floatTray, openHome } from "../lib/bridge";
import type { Snapshot } from "../lib/types";
import {
  BOX,
  clampSpot,
  defaultSpot,
  openRect,
  PANEL,
  type Area,
  type Spot,
} from "../life/float";
import { shown, toggleHidden, usePrefs } from "../life/prefs";
import { ALL, CardBody, HELPER, Roster, type Resident } from "./shared";
import { useCloseOnLeave, useHeight } from "./useCard";

const KEY = "peeps.float";
const DRAG_THRESHOLD = 4;
const PET = 56;

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

function savedSpot(area: Area): Spot {
  try {
    const value = JSON.parse(
      localStorage.getItem(KEY) ?? "null",
    ) as Spot | null;
    if (value && Number.isFinite(value.x) && Number.isFinite(value.y)) {
      return clampSpot(value, area);
    }
  } catch {
    // A missing or broken spot just means the default one.
  }
  return defaultSpot(area);
}

function saveSpot(spot: Spot) {
  try {
    localStorage.setItem(KEY, JSON.stringify(spot));
  } catch {
    // Without storage the pet returns to its default spot next time.
  }
}

/**
 * For screens without a notch: the helper floats wherever it was dropped, with a badge when pets need you.
 * A click opens your pets and the helper beside it, on whichever side has room.
 */
export function FloatTray({
  snapshot,
  residents,
}: {
  snapshot: Snapshot;
  residents: Resident[];
}) {
  const [area] = useState(screenArea);
  const [spot, setSpot] = useState(() => savedSpot(area));
  const [openId, setOpenId] = useState<string | null>(null);
  const [prefs, setPrefs] = usePrefs();
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
  useCloseOnLeave(() => setOpenId(null));

  const helper = residents.find((resident) => resident.id === HELPER);
  const products = residents.filter(
    (resident) =>
      resident.id !== HELPER && shown(resident.id, resident.urgent, prefs),
  );
  const waiting = residents.filter((resident) => resident.urgent).length;
  const rect = openRect(spot, panelHeight, area);

  useEffect(() => {
    if (open && panelHeight > 0) {
      void floatTray(rect.x, rect.y, rect.width, rect.height);
    } else if (!open) {
      void floatTray(spot.x, spot.y, BOX, BOX);
    }
    // Moving while dragging is handled frame by frame below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, panelHeight]);

  const move = (next: Spot) => {
    setSpot(next);
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      void floatTray(next.x, next.y, BOX, BOX);
    });
  };

  const pet = snapshot.pets.find((candidate) => candidate.id === openId);
  const side = open ? rect.side : "right";

  return (
    <div className="float" data-side={side}>
      <button
        className="float__pet"
        style={{ top: open ? rect.petTop : 0 }}
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
            clampSpot({ x: current.from.x + dx, y: current.from.y + dy }, area),
          );
        }}
        onPointerUp={() => {
          const current = grab.current;
          grab.current = null;
          if (current?.moved) {
            saveSpot(spot);
            return;
          }
          setOpenId((now) => (now === null ? HELPER : null));
        }}
        onClick={(event) => {
          if (event.detail === 0)
            setOpenId((now) => (now === null ? HELPER : null));
        }}
      >
        {helper?.pet(PET)}
        {waiting > 0 && <span className="float__badge">{waiting}</span>}
      </button>

      {open && (
        <div
          ref={panel}
          className="float__panel"
          style={{
            width: PANEL,
            maxHeight: area.height - 16,
            ["--pet" as string]: pet?.color ?? snapshot.helper.color,
          }}
        >
          {snapshot.pets.length === 0 ? (
            <button
              className="button button--primary"
              onClick={() => void openHome()}
            >
              Set up peeps
            </button>
          ) : (
            <div className="float__pets" role="tablist" aria-label="Your pets">
              {products.map((resident) => (
                <button
                  key={resident.id}
                  role="tab"
                  aria-selected={openId === resident.id}
                  className="float__chip"
                  data-urgent={resident.urgent || undefined}
                  onClick={() => setOpenId(resident.id)}
                  title={`${resident.name}: ${MOOD_LABEL[resident.mood]}`}
                >
                  {resident.pet(30)}
                  <span>{resident.name}</span>
                </button>
              ))}
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
                aria-label="All pets and settings"
              >
                ⋯
              </button>
            </div>
          )}
          <CardBody
            openId={openId}
            snapshot={snapshot}
            roster={
              <Roster
                residents={residents}
                waiting={waiting}
                hidden={prefs.hidden}
                size={prefs.size}
                place={prefs.place}
                onOpen={setOpenId}
                onToggle={(id) => setPrefs(toggleHidden(prefs, id))}
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
