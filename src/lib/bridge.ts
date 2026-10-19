import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { demoSnapshot } from "./demo";
import type { Decision, Delivery, Note, Snapshot } from "./types";

export const inApp = (): boolean => "__TAURI_INTERNALS__" in window;

export function loadSnapshot(): Promise<Snapshot> {
  return inApp() ? invoke<Snapshot>("snapshot") : Promise.resolve(demoSnapshot);
}

export function onSnapshot(
  handler: (snapshot: Snapshot) => void,
): Promise<() => void> {
  if (!inApp()) return Promise.resolve(() => undefined);
  return listen<Snapshot>("snapshot", (event) => handler(event.payload));
}

export function decide(
  requestId: number,
  decision: Decision,
): Promise<boolean> {
  return inApp()
    ? invoke<boolean>("decide", { requestId, decision })
    : Promise.resolve(true);
}

export function addNote(
  productId: string,
  text: string,
  delivery: Delivery,
): Promise<Note | null> {
  return inApp()
    ? invoke<Note>("add_note", { productId, text, delivery })
    : Promise.resolve(null);
}

export function setExpanded(expanded: boolean): Promise<void> {
  return inApp()
    ? invoke("set_expanded", { expanded }).then(() => undefined)
    : Promise.resolve();
}
