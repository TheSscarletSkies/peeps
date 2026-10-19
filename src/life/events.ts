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
