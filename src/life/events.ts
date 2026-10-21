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
