import { useEffect, useRef, useState, type ReactNode } from "react";

import { HelperPanel } from "../helper/HelperPanel";
import { MOOD_LABEL } from "../hub/ProductCard";
import { notch as loadNotch, openHome, setTraySize } from "../lib/bridge";
import type { Mood, Notch, Snapshot } from "../lib/types";
import { LivePet } from "../life/LivePet";
import {
  laneFor,
  lanes,
  PET_SIZE,
  spot,
  stripWidth,
  walkMs,
  type Lane,
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
const CARD_WIDTH = 400;
/** Screens without a notch still get a small pill at the top. */
const PILL_HEIGHT = 32;

export function Tray({ snapshot }: { snapshot: Snapshot }) {
  const [notch, setNotch] = useState<Notch | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [cardHeight, setCardHeight] = useState(0);
  const card = useRef<HTMLDivElement>(null);

  const { pets, helper } = snapshot;
  const { celebrating, arriving } = usePetEvents(pets, true);
  const height = notch?.height || PILL_HEIGHT;
  const notchWidth = notch?.width ?? 0;
  const width = stripWidth(pets.length + 1, notchWidth);
  const open = openId === HELPER || pets.some((pet) => pet.id === openId);
  const pet = pets.find((candidate) => candidate.id === openId);
  const paths = lanes(width, notchWidth);

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
      void setTraySize(Math.max(width, CARD_WIDTH), height + cardHeight);
    } else if (!open) {
      void setTraySize(width, height);
    }
  }, [notch, open, cardHeight, width, height]);

  const toggle = (id: string) =>
    setOpenId((current) => (current === id ? null : id));

  const residents = [
    ...pets.map((resident) => ({
      id: resident.id,
      label: `${resident.name}: ${MOOD_LABEL[resident.mood]}`,
      still: URGENT.includes(resident.mood),
      pet: (
        <LivePet
          id={resident.id}
          celebrating={celebrating.has(resident.id)}
          arriving={arriving.has(resident.id)}
          kind={resident.kind}
          color={resident.color}
          mood={resident.mood}
          heat={resident.heat}
          size={PET_SIZE}
        />
      ),
    })),
    {
      id: HELPER,
      label: helper.name,
      still: false,
      pet: (
        <LivePet
          kind={helper.kind}
          color={helper.color}
          mood={helper.mood}
          heat={0}
          size={PET_SIZE}
        />
      ),
    },
  ];

  // Pets take their spots once the notch is measured, so they never start squeezed.
  if (!notch) return null;

  return (
    <div
      className={open ? "notch notch--open" : "notch"}
      style={{ ["--strip" as string]: `${height}px` }}
    >
      <div className="notch__strip" style={{ width }}>
        {pets.length === 0 ? (
          <button className="notch__setup" onClick={() => void openHome()}>
            Set up peeps
          </button>
        ) : (
          residents.map((resident, index) => (
            <Roamer
              key={resident.id}
              lane={paths[laneFor(index, paths.length)] ?? paths[0]}
              start={spread(index, residents.length, paths.length)}
              still={resident.still}
              label={resident.label}
              selected={openId === resident.id}
              onSelect={() => toggle(resident.id)}
            >
              {resident.pet}
            </Roamer>
          ))
        )}
      </div>

      {open && (
        <div
          ref={card}
          className="notch__card"
          style={{
            ["--pet" as string]: pet?.color ?? helper.color,
          }}
        >
          {pet ? (
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

interface RoamerProps {
  lane: Lane;
  start: number;
  still: boolean;
  label: string;
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}

/** Wanders its lane: a pause, a waddle to a new spot, another pause. Pets that need you stay put. */
function Roamer({
  lane,
  start,
  still,
  label,
  selected,
  onSelect,
  children,
}: RoamerProps) {
  const { start: from, end: to } = lane;
  const [move, setMove] = useState(() => ({
    x: spot(lane, start),
    ms: 0,
    walking: false,
  }));

  useEffect(() => {
    if (still) return;
    const wait = move.walking ? move.ms : 2500 + Math.random() * 6000;
    const timer = window.setTimeout(() => {
      if (move.walking) {
        setMove({ ...move, walking: false });
        return;
      }
      const x = spot({ start: from, end: to }, Math.random());
      setMove({ x, ms: walkMs(move.x, x), walking: true });
    }, wait);
    return () => window.clearTimeout(timer);
  }, [move, still, from, to]);

  const x = Math.min(Math.max(move.x, from), Math.max(from, to));

  return (
    <button
      className={[
        "roamer",
        move.walking && "roamer--walking",
        selected && "roamer--selected",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        transform: `translateX(${x}px)`,
        transitionDuration: `${move.ms}ms`,
      }}
      aria-label={label}
      aria-pressed={selected}
      onClick={onSelect}
    >
      {children}
    </button>
  );
}
