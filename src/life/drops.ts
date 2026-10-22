import { useEffect, useState } from "react";

import { inApp } from "../lib/bridge";

/** The last part of a path, for showing a file without its folders. */
export function fileName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

/** How dropped files are handed to an agent: full paths, so it can open them. */
export function withFiles(text: string, paths: string[]): string {
  if (paths.length === 0) return text;
  const list = paths.map((path) => `- ${path}`).join("\n");
  return `${text.trim()}\n\nFiles:\n${list}`.trim();
}

/** What the helper is asked when a file is dropped on it with nothing typed: eat it, then get curious. */
export const EAT_PROMPT =
  "I just fed you this. Read it, tell me in one line what it is, then ask me two or three short questions about it.";

type Listener = () => void;

const waiting = new Map<string, string[]>();
const listeners = new Set<Listener>();
let hovered: string | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

/** Files dropped on a pet wait here until its card opens and picks them up. */
export function giveFiles(id: string, paths: string[]) {
  waiting.set(id, [...(waiting.get(id) ?? []), ...paths]);
  emit();
}

export function hasFiles(id: string): boolean {
  return (waiting.get(id)?.length ?? 0) > 0;
}

export function takeFiles(id: string): string[] {
  const paths = waiting.get(id) ?? [];
  waiting.delete(id);
  return paths;
}

function setHovered(id: string | null) {
  if (hovered === id) return;
  hovered = id;
  emit();
}

/** True while files are being dragged over this pet. */
export function useDropHover(id: string | undefined): boolean {
  const [over, setOver] = useState(false);
  useEffect(() => {
    const update = () => setOver(id !== undefined && hovered === id);
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, [id]);
  return over;
}

/** Calls back with files dropped on this card's pet, now and later. */
export function useGivenFiles(id: string, onFiles: (paths: string[]) => void) {
  useEffect(() => {
    const check = () => {
      const paths = takeFiles(id);
      if (paths.length > 0) onFiles(paths);
    };
    check();
    listeners.add(check);
    return () => {
      listeners.delete(check);
    };
    // The callback only appends to local state, so the first one is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
}

/** The pet under a point: any element marked with `data-drop`. */
function targetAt(x: number, y: number): string | null {
  return (
    document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-drop]")
      ?.dataset.drop ?? null
  );
}

/** Watches files dragged over the window and reports which pet they were dropped on. */
export function useFileDrop(onDrop: (id: string, paths: string[]) => void) {
  useEffect(() => {
    if (inApp()) {
      let stop: (() => void) | undefined;
      let cancelled = false;
      void import("@tauri-apps/api/webview").then(({ getCurrentWebview }) =>
        getCurrentWebview()
          .onDragDropEvent((event) => {
            const payload = event.payload;
            if (payload.type === "leave") {
              setHovered(null);
              return;
            }
            const scale = window.devicePixelRatio || 1;
            const id = targetAt(
              payload.position.x / scale,
              payload.position.y / scale,
            );
            if (payload.type === "drop") {
              setHovered(null);
              if (id && payload.paths.length > 0) onDrop(id, payload.paths);
            } else {
              setHovered(id);
            }
          })
          .then((unlisten) => {
            if (cancelled) unlisten();
            else stop = unlisten;
          }),
      );
      return () => {
        cancelled = true;
        stop?.();
      };
    }

    // The browser preview only knows file names, which is enough to try it out.
    const over = (event: DragEvent) => {
      event.preventDefault();
      setHovered(targetAt(event.clientX, event.clientY));
    };
    const drop = (event: DragEvent) => {
      event.preventDefault();
      const id = targetAt(event.clientX, event.clientY);
      setHovered(null);
      const names = Array.from(event.dataTransfer?.files ?? []).map(
        (file) => file.name,
      );
      if (id && names.length > 0) onDrop(id, names);
    };
    const leave = () => setHovered(null);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    window.addEventListener("dragleave", leave);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
      window.removeEventListener("dragleave", leave);
    };
    // Handlers are wired once; onDrop only opens a card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
