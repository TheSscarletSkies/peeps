import type { StickerKind } from "../friends/ReactionArt";

/** Emoji typed into a reminder are replaced by peeps' own drawings, so every nudge looks the same. */
export function withoutEmoji(text: string): string {
  return text
    .replace(
      /\p{Extended_Pictographic}|\u{FE0F}|\u{200D}|\u{20E3}|\p{Emoji_Modifier}/gu,
      "",
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

const MATCHES: [RegExp, StickerKind][] = [
  [/water|drink|hydrat|💧|🥤/iu, "water"],
  [/break|tea|coffee|rest|relax|☕|🍵/iu, "tea"],
  [/read|study|class|exam|homework|book|focus|📚|📖/iu, "study"],
  [/call|mum|mom|dad|friend|love|❤|💕/iu, "heart"],
];

/** The little drawing that goes with a reminder, picked from its words (or the emoji it had). */
export function stickerFor(text: string): StickerKind {
  return MATCHES.find(([pattern]) => pattern.test(text))?.[1] ?? "bell";
}

/** When Later brings a reminder back. */
export const LATER: { minutes: number; label: string }[] = [
  { minutes: 10, label: "10 min" },
  { minutes: 30, label: "30 min" },
  { minutes: 60, label: "1 hour" },
];
