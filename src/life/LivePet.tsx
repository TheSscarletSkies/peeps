import { useEffect, useRef, useState } from "react";

import type { Mood, PetKind } from "../lib/types";
import { Dumpling, type Expression } from "../pets/Dumpling";
import { onFed } from "./events";
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
}

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
}: Props) {
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
        if (fedId !== id) return;
        setLove(true);
        later(() => setLove(false), LOVE_MS);
      }),
    [id],
  );

  const onPoke = () => {
    const result = poke(pokes.current, Date.now());
    pokes.current = result.history;
    setSquish(true);
    later(() => setSquish(false), SQUISH_MS);
    if (result.dizzy) {
      setDizzy(true);
      setLove(false);
      later(() => setDizzy(false), DIZZY_MS);
    } else if (!dizzy) {
      setLove(true);
      later(() => setLove(false), LOVE_MS);
    }
  };

  const expression: Expression | undefined = dizzy
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
    <span className="live-pet" onClick={onPoke}>
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
