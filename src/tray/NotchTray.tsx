import { useEffect, useRef, useState, type ReactNode } from "react";

import { MOOD_LABEL } from "../hub/ProductCard";
import { openHome, setTraySize } from "../lib/bridge";
import type { Notch, Snapshot } from "../lib/types";
import { shown, toggleHidden, usePrefs } from "../life/prefs";
import {
  ICON,
  landing,
  laneFor,
  layout,
  PET_SIZES,
  spot,
  walkMs,
  type Lane,
} from "../life/roam";
import { ALL, AllIcon, CardBody, Roster, type Resident } from "./shared";
import { useCloseOnLeave, useHeight } from "./useCard";

const CARD_WIDTH = 400;

/** Pets wander the menu bar beside the camera; a card drops down from the notch. */
export function NotchTray({
  snapshot,
  notch,
  residents,
}: {
  snapshot: Snapshot;
  notch: Notch;
  residents: Resident[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [prefs, setPrefs] = usePrefs();
  const card = useRef<HTMLDivElement>(null);
  const open = openId !== null;
  const cardHeight = useHeight(card, open);
  useCloseOnLeave(() => setOpenId(null));

  const visible = residents.filter((resident) =>
    shown(resident.id, resident.urgent, prefs),
  );
  const waiting = residents.filter((resident) => resident.urgent).length;
  const size = PET_SIZES[prefs.size];
  const strip = layout(visible.length, notch, size);
  const pet = snapshot.pets.find((candidate) => candidate.id === openId);

  useEffect(() => {
    if (open && cardHeight > 0) {
      void setTraySize(
        Math.max(strip.width, CARD_WIDTH),
        strip.height + cardHeight,
      );
    } else if (!open) {
      void setTraySize(strip.width, strip.height);
    }
  }, [open, cardHeight, strip.width, strip.height]);

  const toggle = (id: string) =>
    setOpenId((current) => (current === id ? null : id));

  return (
    <div
      className={open ? "notch notch--open" : "notch"}
      style={{ ["--strip" as string]: `${strip.height}px` }}
    >
      <div className="notch__strip" style={{ width: strip.width }}>
        {snapshot.pets.length === 0 ? (
          <button className="notch__setup" onClick={() => void openHome()}>
            {residents[residents.length - 1]?.pet(22)}
            Set up peeps
          </button>
        ) : (
          <>
            {visible.map((resident, index) => (
              <Roamer
                key={resident.id}
                lanes={strip.lanes}
                lane={laneFor(index, strip.lanes.length)}
                start={spread(index, visible.length, strip.lanes.length)}
                width={strip.width}
                size={size}
                still={resident.urgent}
                label={`${resident.name}: ${MOOD_LABEL[resident.mood]}`}
                selected={openId === resident.id}
                onSelect={() => toggle(resident.id)}
              >
                {resident.pet(size)}
              </Roamer>
            ))}
            <button
              className="notch__all"
              data-nudge={waiting > 0 || undefined}
              style={{ left: strip.iconX, width: ICON, height: ICON }}
              aria-label={
                waiting > 0
                  ? `All pets, ${waiting} need${waiting === 1 ? "s" : ""} you`
                  : "All pets"
              }
              aria-pressed={openId === ALL}
              onClick={() => toggle(ALL)}
            >
              <AllIcon />
            </button>
          </>
        )}
      </div>

      {openId !== null && (
        <div
          ref={card}
          className="notch__card"
          style={{ ["--pet" as string]: pet?.color ?? snapshot.helper.color }}
        >
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

/** Starting spots evenly spaced along each wing, so pets never begin stacked. */
function spread(index: number, total: number, laneCount: number): number {
  const rank = Math.floor(index / laneCount);
  const inLane = Math.ceil((total - (index % laneCount)) / laneCount);
  return inLane > 1 ? rank / (inLane - 1) : 0.5;
}

interface RoamerProps {
  lanes: Lane[];
  lane: number;
  start: number;
  width: number;
  size: number;
  still: boolean;
  label: string;
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}

/** A drop gets a longer rest, so a pet stays where it was put for a while. */
const REST_AFTER_DROP_MS = 20000;
const DRAG_THRESHOLD = 3;

/**
 * Wanders its lane: a pause, a waddle to a new spot, another pause. Pets that need you stay put.
 * Drag one to move it, even across the notch.
 */
function Roamer({
  lanes,
  lane: defaultLane,
  start,
  width,
  size,
  still,
  label,
  selected,
  onSelect,
  children,
}: RoamerProps) {
  const [laneIndex, setLaneIndex] = useState(defaultLane);
  const lane = lanes[laneIndex] ?? lanes[0] ?? { start: 0, end: 0 };
  const { start: from, end: to } = lane;
  const [move, setMove] = useState(() => ({
    x: spot(lane, start),
    ms: 0,
    walking: false,
    rest: 0,
  }));
  const [held, setHeld] = useState<number | null>(null);
  const grab = useRef<{ offset: number; left: number; moved: boolean } | null>(
    null,
  );

  useEffect(() => {
    if (still || held !== null) return;
    const wait = move.walking
      ? move.ms
      : move.rest || 2500 + Math.random() * 6000;
    const timer = window.setTimeout(() => {
      if (move.walking) {
        setMove({ ...move, walking: false, rest: 0 });
        return;
      }
      const x = spot({ start: from, end: to }, Math.random());
      setMove({ x, ms: walkMs(move.x, x), walking: true, rest: 0 });
    }, wait);
    return () => window.clearTimeout(timer);
  }, [move, still, held, from, to]);

  const resting = Math.min(Math.max(move.x, from), Math.max(from, to));
  const x = held ?? resting;

  return (
    <button
      className={[
        "roamer",
        move.walking && held === null && "roamer--walking",
        held !== null && "roamer--held",
        selected && "roamer--selected",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        transform: `translateX(${x}px)`,
        transitionDuration: held === null ? `${move.ms}ms` : "0ms",
      }}
      aria-label={label}
      aria-pressed={selected}
      onPointerDown={(event) => {
        const left =
          event.currentTarget.parentElement?.getBoundingClientRect().left ?? 0;
        grab.current = {
          offset: event.clientX - left - resting,
          left,
          moved: false,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const current = grab.current;
        if (!current) return;
        const next = event.clientX - current.left - current.offset;
        if (!current.moved && Math.abs(next - resting) < DRAG_THRESHOLD) return;
        current.moved = true;
        setHeld(Math.min(Math.max(next, 0), width - size));
      }}
      onPointerUp={() => {
        const current = grab.current;
        grab.current = null;
        if (!current?.moved || held === null) {
          setHeld(null);
          onSelect();
          return;
        }
        const drop = landing(lanes, held);
        setLaneIndex(drop.lane);
        setMove({
          x: drop.x,
          ms: 180,
          walking: false,
          rest: REST_AFTER_DROP_MS,
        });
        setHeld(null);
      }}
      onPointerCancel={() => {
        grab.current = null;
        setHeld(null);
      }}
      onClick={(event) => {
        // Pointer clicks are handled on release; this is the keyboard path.
        if (event.detail === 0) onSelect();
      }}
    >
      {children}
    </button>
  );
}
