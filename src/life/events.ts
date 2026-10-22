import type { Reaction } from "../lib/types";

const FED = "peeps:fed";

/** Lets the pet that was just fed a note show some love. */
export function announceFed(petId: string): void {
  window.dispatchEvent(new CustomEvent(FED, { detail: petId }));
}

export function onFed(handler: (petId: string) => void): () => void {
  const listener = (event: Event) =>
    handler((event as CustomEvent<string>).detail);
  window.addEventListener(FED, listener);
  return () => window.removeEventListener(FED, listener);
}

const PATTED = "peeps:patted";

/** A pat from somewhere the pet's own click can't hear, like the floating pet while it is held for dragging. */
export function announcePat(petId: string): void {
  window.dispatchEvent(new CustomEvent(PATTED, { detail: petId }));
}

export function onPat(handler: (petId: string) => void): () => void {
  const listener = (event: Event) =>
    handler((event as CustomEvent<string>).detail);
  window.addEventListener(PATTED, listener);
  return () => window.removeEventListener(PATTED, listener);
}

const REACTED = "peeps:reacted";

/** A friend's heart or bonk, for the pet to show. */
export function announceReaction(petId: string, reaction: Reaction): void {
  window.dispatchEvent(
    new CustomEvent(REACTED, { detail: { petId, reaction } }),
  );
}

export function onReactionShown(
  handler: (petId: string, reaction: Reaction) => void,
): () => void {
  const listener = (event: Event) => {
    const { petId, reaction } = (
      event as CustomEvent<{ petId: string; reaction: Reaction }>
    ).detail;
    handler(petId, reaction);
  };
  window.addEventListener(REACTED, listener);
  return () => window.removeEventListener(REACTED, listener);
}

const ASK = "peeps:ask";
const OPEN_CHAT = "peeps:open-chat";
// Kept until a chat is there to send it: the card holding the chat may still be opening.
let queued: string | null = null;

/** Opens the helper's chat and has it send a message, as when a nudge says "let's chat". */
export function announceAsk(text: string): void {
  queued = text;
  window.dispatchEvent(new CustomEvent(OPEN_CHAT));
  window.dispatchEvent(new CustomEvent(ASK, { detail: text }));
}

/** The message waiting for a chat to open, taken once. */
export function takeAsk(): string | null {
  const text = queued;
  queued = null;
  return text;
}

export function onAsk(handler: (text: string) => void): () => void {
  const listener = () => {
    const text = takeAsk();
    if (text) handler(text);
  };
  window.addEventListener(ASK, listener);
  return () => window.removeEventListener(ASK, listener);
}

export function onOpenChat(handler: () => void): () => void {
  window.addEventListener(OPEN_CHAT, handler);
  return () => window.removeEventListener(OPEN_CHAT, handler);
}
