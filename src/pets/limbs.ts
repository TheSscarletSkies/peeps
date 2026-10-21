import type { Mood, PetKind } from "../lib/types";
import type { Expression } from "./Dumpling";

export type Look = Mood | Expression;

/** Something small a pet holds in front of itself. */
export type Prop = "pencil" | "sign" | "heart";

export interface Hand {
  x: number;
  y: number;
  /** A CSS class that moves this hand, such as a wave. */
  motion?: string;
}

export interface Limbs {
  left: Hand;
  right: Hand;
  prop?: Prop;
  /** Hands come out only for a gesture; a pet at rest is just a dumpling. */
  hidden?: boolean;
  /** In the steamer there are no feet either, even while it is carried. */
  napping?: boolean;
}

/** Where each shape's sides are at hand height, in the 120 by 100 drawing. */
const SIDE: Record<PetKind, number> = { bao: 19, gyoza: 17, wonton: 19 };

const mirror = (hand: Hand): Hand => ({ ...hand, x: 120 - hand.x });

/**
 * Hands for a mood or a passing expression: waving for attention, arms up to celebrate or catch,
 * a pencil while working. At rest they stay tucked away, so the pet reads cleanly at a glance.
 */
export function limbsFor(look: Look, kind: PetKind): Limbs {
  const rest: Hand = { x: SIDE[kind], y: 74 };
  const both = (left: Hand, prop?: Prop): Limbs => ({
    left,
    right: mirror(left),
    prop,
  });
  switch (look) {
    case "stalled":
      return { ...both(rest), hidden: true, napping: true };
    case "needsYou":
      return {
        left: rest,
        right: { x: 100, y: 55, motion: "limb-wave" },
      };
    case "celebrate":
      return both({ x: 22, y: 44, motion: "limb-cheer" });
    case "eager":
      // Reaching up for the file being dragged over it.
      return both({ x: 25, y: 46, motion: "limb-reach" });
    case "dizzy":
      return both({ x: 11, y: 64, motion: "limb-flail" });
    case "steaming":
      return both({ x: SIDE[kind] - 1, y: 64, motion: "limb-shake" });
    case "love":
      return both({ x: 52, y: 82 }, "heart");
    case "failing":
      return both({ x: 46, y: 84 }, "sign");
    case "working":
      return {
        left: rest,
        right: { x: 80, y: 80, motion: "limb-scribble" },
        prop: "pencil",
      };
    case "hungry":
      return { left: rest, right: { x: 95, y: 78 } };
    default:
      return { ...both(rest), hidden: true };
  }
}
