import type { ReactNode } from "react";

import { HelperPanel } from "../helper/HelperPanel";
import { MOOD_LABEL } from "../hub/ProductCard";
import { openHome } from "../lib/bridge";
import type { Mood, Nudge, Snapshot } from "../lib/types";
import { LivePet } from "../life/LivePet";
import type { Place } from "../life/prefs";
import type { PetSize } from "../life/roam";
import { NudgeCard } from "./NudgeCard";
import { PetPanel } from "./PetPanel";

export const URGENT: Mood[] = [
  "needsYou",
  "failing",
  "steaming",
  "hungry",
  "litterBox",
];
export const HELPER = "helper";
export const ALL = "all";
/** The card a reminder opens, with the helper saying it. */
export const NUDGE = "nudge";

export interface Reminder {
  nudge: Nudge | null;
  dismiss: () => void;
  later: () => void;
}
const SIZE_LABEL: Record<PetSize, string> = {
  small: "S",
  medium: "M",
  large: "L",
};
const PLACES: { id: Place; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "notch", label: "Top" },
  { id: "float", label: "Anywhere" },
];

export interface Resident {
  id: string;
  name: string;
  mood: Mood;
  urgent: boolean;
  pet: (size: number) => ReactNode;
}

/** Every pet the user has, helper last, each able to draw itself at any size. */
export function residentsOf(
  snapshot: Snapshot,
  celebrating: Set<string>,
  arriving: Set<string>,
  waving = false,
): Resident[] {
  const { pets, helper, mail } = snapshot;
  const emails = mail.outbox.length;
  return [
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
      // The helper interrupts for a permission, an event about to start or an email to approve,
      // never for its own to-dos.
      urgent: helper.mood === "needsYou" || emails > 0 || waving,
      pet: (size: number) => (
        <LivePet
          dropId={HELPER}
          waving={waving}
          kind={helper.kind}
          color={helper.color}
          mood={helper.mood}
          heat={0}
          size={size}
        />
      ),
    },
  ];
}

const noop = () => undefined;

/** What a dropped-down card shows: a pet, the helper, or every pet. */
export function CardBody({
  openId,
  snapshot,
  roster,
  reminder,
}: {
  openId: string;
  snapshot: Snapshot;
  roster: ReactNode;
  reminder?: Reminder;
}) {
  const pet = snapshot.pets.find((candidate) => candidate.id === openId);
  if (openId === NUDGE && reminder?.nudge)
    return (
      <NudgeCard
        nudge={reminder.nudge}
        helper={snapshot.helper}
        onDone={reminder.dismiss}
        onLater={reminder.later}
      />
    );
  return (
    <>
      {openId === ALL ? (
        roster
      ) : pet ? (
        <>
          <div className="notch__head">
            <span className="mood" data-mood={pet.mood}>
              {MOOD_LABEL[pet.mood]}
            </span>
          </div>
          <PetPanel
            key={pet.id}
            pet={pet}
            chat={snapshot.productChats.find(
              (chat) => chat.productId === pet.id,
            )}
            helper={snapshot.helper}
            numbers={snapshot.numbers.products.find(
              (numbers) => numbers.productId === pet.id,
            )}
            team={snapshot.teammates.filter(
              (teammate) => teammate.productId === pet.id,
            )}
            roles={snapshot.roles}
            onTyping={noop}
          />
        </>
      ) : (
        <HelperPanel
          helper={snapshot.helper}
          pets={snapshot.pets}
          tips={snapshot.tips}
          mail={snapshot.mail}
          knowsYou={snapshot.knowsYou}
          onTyping={noop}
        />
      )}
      <button className="tray__link" onClick={() => void openHome()}>
        Open peeps
      </button>
      {snapshot.configError && (
        <p className="tray__error">Config problem: {snapshot.configError}</p>
      )}
    </>
  );
}

export function AllIcon() {
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
  place: Place;
  onOpen: (id: string) => void;
  onToggle: (id: string) => void;
  onSize: (size: PetSize) => void;
  onPlace: (place: Place) => void;
}

/** Every pet in one place, including the hidden ones, with who shows in the notch and how big. */
export function Roster({
  residents,
  waiting,
  hidden,
  size,
  place,
  onOpen,
  onToggle,
  onSize,
  onPlace,
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
      <div className="roster__size">
        <span>Live</span>
        <div
          className="segmented"
          role="radiogroup"
          aria-label="Where pets live"
        >
          {PLACES.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={place === option.id}
              className={place === option.id ? "segmented__on" : undefined}
              onClick={() => onPlace(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
