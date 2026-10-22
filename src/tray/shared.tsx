import type { ReactNode } from "react";

import { moodWith } from "../focus/clock";
import { friendLook } from "../friends/look";
import { Dumpling } from "../pets/Dumpling";
import { HelperPanel } from "../helper/HelperPanel";
import { openHome } from "../lib/bridge";
import type { Mood, Nudge, ReactionEvent, Snapshot } from "../lib/types";
import { LivePet } from "../life/LivePet";
import type { Place } from "../life/prefs";
import type { PetSize } from "../life/roam";
import { NudgeCard } from "./NudgeCard";

export const URGENT: Mood[] = [
  "needsYou",
  "failing",
  "steaming",
  "hungry",
  "litterBox",
];
export const MOOD_LABEL: Record<Mood, string> = {
  needsYou: "Needs you",
  failing: "Failing",
  steaming: "Steaming",
  hungry: "Hungry",
  litterBox: "Litter box",
  sweating: "Sweating",
  working: "Working",
  stalled: "Napping",
  chill: "Chill",
};
export const HELPER = "helper";
/** Friends' peeps go by `friend:` and their code. */
export const FRIEND = "friend:";
export const ALL = "all";
/** The card a reminder opens, with the helper saying it. */
export const NUDGE = "nudge";

export interface Reminder {
  nudge: Nudge | null;
  dismiss: () => void;
  later: (minutes: number) => void;
  /** A friend's heart or bonk just now. */
  reaction?: ReactionEvent | null;
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
  color: string;
  /** The pet at any size; seated at the study table it leaves its arms to the table. */
  pet: (size: number, seated?: boolean) => ReactNode;
}

/** The one companion, able to draw itself at any size. Project pets stay out of the way. */
export function residentsOf(snapshot: Snapshot, waving = false): Resident[] {
  const { helper } = snapshot;
  const mood = moodWith(helper.mood, snapshot.focus);
  return [
    {
      id: HELPER,
      name: helper.name,
      mood,
      // It interrupts for a permission or a reminder, never for its own to-dos.
      urgent: helper.mood === "needsYou" || waving,
      color: helper.color,
      pet: (size: number, seated = false) => (
        <LivePet
          seated={seated}
          dropId={HELPER}
          waving={waving}
          kind={helper.kind}
          color={helper.color}
          mood={mood}
          glasses={snapshot.focus?.phase === "focus"}
          heat={0}
          size={size}
        />
      ),
    },
    // Friends who are focusing right now keep you company.
    ...(snapshot.friends?.friends ?? [])
      .filter((friend) => friend.presence === "focusing")
      .slice(0, 3)
      .map((friend) => {
        const look = friendLook(friend.code);
        return {
          id: `${FRIEND}${friend.code}`,
          name: friend.name,
          mood: "working" as Mood,
          urgent: false,
          color: look.color,
          pet: (size: number, seated = false) => (
            <Dumpling
              seated={seated}
              kind={look.kind}
              seed={friend.code}
              color={look.color}
              mood="working"
              heat={0}
              size={size}
              glasses
              wear={look.wear}
            />
          ),
        };
      }),
  ];
}

const noop = () => undefined;

/** What a dropped-down card shows: a reminder, the settings, or the companion. */
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
  if (openId === NUDGE && reminder?.nudge)
    return (
      <NudgeCard
        nudge={reminder.nudge}
        helper={snapshot.helper}
        onDone={reminder.dismiss}
        onLater={reminder.later}
        onClose={reminder.dismiss}
      />
    );
  return (
    <>
      {openId === ALL ? (
        roster
      ) : (
        <HelperPanel
          key={openId.startsWith(FRIEND) ? "friends" : "helper"}
          initialTab={openId.startsWith(FRIEND) ? "friends" : "chat"}
          helper={snapshot.helper}
          focus={snapshot.focus}
          oneThing={snapshot.oneThing}
          friends={snapshot.friends}
          areas={snapshot.areas}
          reaction={reminder?.reaction}
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
  size: PetSize;
  place: Place;
  onSize: (size: PetSize) => void;
  onPlace: (place: Place) => void;
}

/** How big the companion is and where it lives. */
export function Roster({ size, place, onSize, onPlace }: RosterProps) {
  return (
    <section className="panel" aria-label="Size and place">
      <header className="panel__head">
        <span className="panel__name">Size and place</span>
      </header>
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
