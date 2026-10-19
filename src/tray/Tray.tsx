import { useEffect, useRef, useState, type ReactNode } from "react";

import { HelperPanel } from "../helper/HelperPanel";
import { MOOD_LABEL } from "../hub/ProductCard";
import { notch as loadNotch, openHome, setTraySize } from "../lib/bridge";
import type { Mood, Notch, Snapshot } from "../lib/types";
import { LivePet } from "../life/LivePet";
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
  type PetSize,
} from "../life/roam";
import { usePetEvents } from "../life/usePetEvents";
import { PetPanel } from "./PetPanel";

const URGENT: Mood[] = [
  "needsYou",
  "failing",
  "steaming",
  "hungry",
  "litterBox",
];
const HELPER = "helper";
const ALL = "all";
const CARD_WIDTH = 400;
const SIZE_LABEL: Record<PetSize, string> = {
  small: "S",
  medium: "M",
  large: "L",
};

interface Resident {
  id: string;
  name: string;
  mood: Mood;
  urgent: boolean;
  pet: (size: number) => ReactNode;
}

export function Tray({ snapshot }: { snapshot: Snapshot }) {
  const [notch, setNotch] = useState<Notch | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [cardHeight, setCardHeight] = useState(0);
  const [prefs, setPrefs] = usePrefs();
  const card = useRef<HTMLDivElement>(null);

  const { pets, helper } = snapshot;
  const { celebrating, arriving } = usePetEvents(pets, true);

  const residents: Resident[] = [
    ...pets.map((resident) => ({
      id: resident.id,
      name: resident.name,
      mood: resident.mood,
      urgent: URGENT.includes(resident.mood),
      pet: (size: number) => (
        <LivePet
          id={resident.id}
          celebrating={celebrating.has(resident.id)}
          arriving={arriving.has(resident.id)}
          kind={resident.kind}
          color={resident.color}
          mood={resident.mood}
          heat={resident.heat}
          size={size}
        />
      ),
    })),
    {
      id: HELPER,
      name: helper.name,
      mood: helper.mood,
      urgent: URGENT.includes(helper.mood),
      pet: (size: number) => (
        <LivePet
          kind={helper.kind}
          color={helper.color}
          mood={helper.mood}
          heat={0}
          size={size}
        />
      ),
    },
  ];
  const visible = residents.filter((resident) =>
    shown(resident.id, resident.urgent, prefs),
  );
  const waiting = residents.filter((resident) => resident.urgent).length;

  const size = PET_SIZES[prefs.size];
  const strip = layout(visible.length, notch ?? { width: 0, height: 0 }, size);
  const pet = pets.find((candidate) => candidate.id === openId);
  const open = openId === HELPER || openId === ALL || pet !== undefined;

  useEffect(() => {
    void loadNotch().then(setNotch);
  }, []);

  useEffect(() => {
    const close = () => setOpenId(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("blur", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("blur", close);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    const element = card.current;
    if (!element) return;
    const observer = new ResizeObserver(() =>
      setCardHeight(Math.ceil(element.getBoundingClientRect().height)),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [open]);

  useEffect(() => {
    if (!notch) return;
    if (open && cardHeight > 0) {
      void setTraySize(
        Math.max(strip.width, CARD_WIDTH),
        strip.height + cardHeight,
      );
    } else if (!open) {
      void setTraySize(strip.width, strip.height);
    }
  }, [notch, open, cardHeight, strip.width, strip.height]);

  const toggle = (id: string) =>
    setOpenId((current) => (current === id ? null : id));

  // Pets take their spots once the notch is measured, so they never start squeezed.
  if (!notch) return null;

  return (
    <div
      className={open ? "notch notch--open" : "notch"}
      style={{ ["--strip" as string]: `${strip.height}px` }}
    >
      <div className="notch__strip" style={{ width: strip.width }}>
        {pets.length === 0 ? (
          <button className="notch__setup" onClick={() => void openHome()}>
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

      {open && (
        <div
          ref={card}
          className="notch__card"
          style={{ ["--pet" as string]: pet?.color ?? helper.color }}
        >
          {openId === ALL ? (
            <Roster
              residents={residents}
              waiting={waiting}
              hidden={prefs.hidden}
              size={prefs.size}
              onOpen={setOpenId}
              onToggle={(id) => setPrefs(toggleHidden(prefs, id))}
              onSize={(next) => setPrefs({ ...prefs, size: next })}
            />
          ) : pet ? (
            <>
              <div className="notch__head">
                <span className="mood" data-mood={pet.mood}>
                  {MOOD_LABEL[pet.mood]}
                </span>
              </div>
              <PetPanel key={pet.id} pet={pet} onTyping={noop} />
            </>
          ) : (
            <HelperPanel
              helper={helper}
              pets={pets}
              tips={snapshot.tips}
              onTyping={noop}
            />
          )}
          <button className="tray__link" onClick={() => void openHome()}>
            Open peeps
          </button>
          {snapshot.configError && (
            <p className="tray__error">
              Config problem: {snapshot.configError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const noop = () => undefined;

/** Starting spots evenly spaced along each wing, so pets never begin stacked. */
function spread(index: number, total: number, laneCount: number): number {
  const rank = Math.floor(index / laneCount);
  const inLane = Math.ceil((total - (index % laneCount)) / laneCount);
  return inLane > 1 ? rank / (inLane - 1) : 0.5;
}

function AllIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <circle cx="3" cy="3" r="2" />
      <circle cx="9" cy="3" r="2" />
      <circle cx="3" cy="9" r="2" />
      <circle cx="9" cy="9" r="2" />
    </svg>
  );
}

interface RosterProps {
  residents: Resident[];
  waiting: number;
  hidden: string[];
  size: PetSize;
  onOpen: (id: string) => void;
  onToggle: (id: string) => void;
  onSize: (size: PetSize) => void;
}

/** Every pet in one place, including the hidden ones, with who shows in the notch and how big. */
function Roster({
  residents,
  waiting,
  hidden,
  size,
  onOpen,
  onToggle,
  onSize,
}: RosterProps) {
  return (
    <section className="panel" aria-label="All pets">
      <header className="panel__head">
        <span className="panel__name">Your pets</span>
        <span className="panel__headline">
          {waiting > 0
            ? `${waiting} ${waiting === 1 ? "needs" : "need"} you`
            : "Everyone is fine"}
        </span>
      </header>
      <ul className="roster">
        {residents.map((resident) => {
          const isHidden = hidden.includes(resident.id);
          return (
            <li key={resident.id} data-urgent={resident.urgent || undefined}>
              <button
                className="roster__pet"
                onClick={() => onOpen(resident.id)}
              >
                {resident.pet(30)}
                <span className="roster__name">{resident.name}</span>
                <span className="mood" data-mood={resident.mood}>
                  {MOOD_LABEL[resident.mood]}
                </span>
              </button>
              <button
                className="button button--small"
                aria-pressed={!isHidden}
                aria-label={`${isHidden ? "Show" : "Hide"} ${resident.name}`}
                onClick={() => onToggle(resident.id)}
              >
                {isHidden ? "Show" : "Hide"}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="setup__hint">
        Hidden pets still come out when they need you.
      </p>
      <div className="roster__size">
        <span>Size</span>
        <div className="segmented" role="radiogroup" aria-label="Pet size">
          {(Object.keys(SIZE_LABEL) as PetSize[]).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={size === option}
              aria-label={option}
              className={size === option ? "segmented__on" : undefined}
              onClick={() => onSize(option)}
            >
              {SIZE_LABEL[option]}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
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
