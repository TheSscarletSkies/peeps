import { useEffect, useRef, useState } from "react";

import { ReactionArt } from "../friends/ReactionArt";
import type { Mood, PetKind, Reaction } from "../lib/types";
import type { BunWear } from "../pets/Bun";
import { Dumpling, type Expression } from "../pets/Dumpling";
import { useDropHover } from "./drops";
import { onFed, onPat, onReactionShown } from "./events";
import { poke } from "./pokes";
import { seasonalAccessory, type Accessory } from "./season";

const DIZZY_MS = 3000;
const LOVE_MS = 1600;
const SQUISH_MS = 620;
const REACTION_MS = 2200;
const GRUMPY_MS = 3000;
const HOLD_MS = 600;
const HUG_MS = 900;

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
  glasses?: boolean;
  wear?: BunWear;
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
  glasses = false,
  wear = null,
}: Props) {
  const [saying, setSaying] = useState<string | null>(null);
  const eager = useDropHover(dropId ?? id);
  const [dizzy, setDizzy] = useState(false);
  const [love, setLove] = useState(false);
  const [squish, setSquish] = useState(false);
  const [giggle, setGiggle] = useState(false);
  const [grumpy, setGrumpy] = useState(false);
  const pokes = useRef<number[]>([]);
  const [reaction, setReaction] = useState<Reaction | null>(null);
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
    // The click that ends a long press is part of the hug, not a poke.
    if (hugged.current) {
      hugged.current = false;
      return;
    }
    const result = poke(pokes.current, Date.now());
    pokes.current = result.history;
    setSquish(true);
    later(() => setSquish(false), SQUISH_MS);
    if (result.level === "grumpy") {
      setDizzy(false);
      setLove(false);
      setGrumpy(true);
      later(() => setGrumpy(false), GRUMPY_MS);
      if (chatty) say("hmph!");
    } else if (result.level === "dizzy") {
      setDizzy(true);
      setLove(false);
      later(() => setDizzy(false), DIZZY_MS);
      if (chatty) say("whoa…");
    } else if (result.level === "giggle") {
      setGiggle(true);
      later(() => setGiggle(false), LOVE_MS);
      if (chatty) say("hehe, stop!");
    } else if (!dizzy && !grumpy) {
      setLove(true);
      later(() => setLove(false), LOVE_MS);
      if (chatty)
        say(PATTED[Math.floor(Math.random() * PATTED.length)] ?? "hi!");
    }
  };

  // Holding the pet down is a hug.
  const hugged = useRef(false);
  const holding = useRef(0);
  const onHoldStart = () => {
    window.clearTimeout(holding.current);
    holding.current = window.setTimeout(() => {
      hugged.current = true;
      setGrumpy(false);
      setDizzy(false);
      setLove(true);
      setSquish(true);
      later(() => setSquish(false), HUG_MS);
      later(() => setLove(false), HUG_MS + LOVE_MS);
      if (chatty) say("hugs!");
    }, HOLD_MS);
    const stop = () => {
      window.clearTimeout(holding.current);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
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

  useEffect(
    () =>
      onReactionShown((petId, kind) => {
        if (petId !== (dropId ?? id)) return;
        setReaction(kind);
        setSquish(true);
        later(() => setSquish(false), SQUISH_MS);
        later(() => setReaction(null), REACTION_MS);
      }),
    [id, dropId],
  );

  const reacting: Expression | undefined =
    reaction === "bonk"
      ? "dizzy"
      : reaction === "poke"
        ? "wave"
        : reaction
          ? "love"
          : undefined;

  const expression: Expression | undefined = reacting
    ? reacting
    : giggle
      ? "celebrate"
      : eager
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
      onPointerDown={onHoldStart}
      data-grumpy={grumpy || undefined}
      title={chatty ? "Pat me" : undefined}
    >
      {reaction && <ReactionArt key={reaction} kind={reaction} />}
      {saying && (
        <span className="pet-say" aria-hidden="true">
          {saying}
        </span>
      )}
      <Dumpling
        seed={id}
        kind={kind}
        color={color}
        mood={grumpy ? "steaming" : mood}
        heat={heat}
        size={size}
        expression={expression}
        accessory={accessoryForToday()}
        glasses={glasses}
        wear={wear}
        motion={motion || undefined}
      />
    </span>
  );
}
