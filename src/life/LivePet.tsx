import { useEffect, useRef, useState } from "react";

import type { Mood, PetKind } from "../lib/types";
import { Dumpling, type Expression } from "../pets/Dumpling";
import { useDropHover } from "./drops";
import { onFed, onPat } from "./events";
import { poke } from "./pokes";
import { seasonalAccessory, type Accessory } from "./season";

const DIZZY_MS = 3000;
const LOVE_MS = 1600;
const SQUISH_MS = 320;

interface Props {
  id?: string;
  kind: PetKind;
  color: string;
  mood: Mood;
  heat: number;
  size?: number;
  celebrating?: boolean;
  arriving?: boolean;
  /** Which drop target this pet answers to, when it is not its own id. */
  dropId?: string;
  /** Waving to get attention, as when it has a reminder to say. */
  waving?: boolean;
  /** Says something in a little bubble when patted or fed; only where there is room above it. */
  chatty?: boolean;
}

const PATTED = ["hehe!", "hi!", "boop!", "that tickles", "again!", "♥"];
const SAY_MS = 1500;

/** `?season=scarf` or `?season=witchHat` previews an outfit out of season. */
function accessoryForToday(): Accessory | null {
  const forced = new URLSearchParams(window.location.search).get("season");
  if (forced === "scarf" || forced === "witchHat") return forced;
  return seasonalAccessory(new Date());
}

/** A pet that reacts: a pat gets a heart, a poke spree makes it dizzy, a note makes it happy. */
export function LivePet({
  id,
  kind,
  color,
  mood,
  heat,
  size,
  celebrating = false,
  arriving = false,
  dropId,
  waving = false,
  chatty = false,
}: Props) {
  const [saying, setSaying] = useState<string | null>(null);
  const eager = useDropHover(dropId ?? id);
  const [dizzy, setDizzy] = useState(false);
  const [love, setLove] = useState(false);
  const [squish, setSquish] = useState(false);
  const pokes = useRef<number[]>([]);
  const timers = useRef<number[]>([]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  useEffect(
    () =>
      onFed((fedId) => {
        if (fedId !== (dropId ?? id)) return;
        setSquish(true);
        later(() => setSquish(false), SQUISH_MS);
        setLove(true);
        later(() => setLove(false), LOVE_MS);
        if (chatty) say("yum, thanks!");
      }),
    // `say` only sets state; listing it would re-subscribe on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, dropId, chatty],
  );

  const say = (text: string) => {
    setSaying(text);
    later(() => setSaying(null), SAY_MS);
  };

  const onPoke = () => {
    const result = poke(pokes.current, Date.now());
    pokes.current = result.history;
    setSquish(true);
    later(() => setSquish(false), SQUISH_MS);
    if (result.dizzy) {
      setDizzy(true);
      setLove(false);
      later(() => setDizzy(false), DIZZY_MS);
      if (chatty) say("whoa…");
    } else if (!dizzy) {
      setLove(true);
      later(() => setLove(false), LOVE_MS);
      if (chatty)
        say(PATTED[Math.floor(Math.random() * PATTED.length)] ?? "hi!");
    }
  };

  const poked = useRef(onPoke);
  poked.current = onPoke;
  useEffect(
    () =>
      onPat((patId) => {
        if (patId === (dropId ?? id)) poked.current();
      }),
    [id, dropId],
  );

  const expression: Expression | undefined = eager
    ? "eager"
    : waving
      ? "wave"
      : dizzy
        ? "dizzy"
        : celebrating
          ? "celebrate"
          : love
            ? "love"
            : undefined;

  const motion = [squish && "motion-squish", arriving && "motion-hatch"]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className="live-pet"
      onClick={onPoke}
      title={chatty ? "Pat me" : undefined}
    >
      {saying && (
        <span className="pet-say" aria-hidden="true">
          {saying}
        </span>
      )}
      <Dumpling
        seed={id}
        kind={kind}
        color={color}
        mood={mood}
        heat={heat}
        size={size}
        expression={expression}
        accessory={accessoryForToday()}
        motion={motion || undefined}
      />
    </span>
  );
}
