import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { demoSnapshot } from "./demo";
import type {
  Decision,
  Delivery,
  Draft,
  NewProduct,
  Notch,
  Note,
  Reminders,
  Snapshot,
  Todo,
  TodoInput,
} from "./types";

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

export interface HooksStatus {
  installed: boolean;
  settingsPath: string;
  command: string;
}

const demoHooks: HooksStatus = {
  installed: false,
  settingsPath: "~/.claude/settings.json",
  command: "peeps-hook",
};

export function hooksStatus(): Promise<HooksStatus> {
  return inApp()
    ? invoke<HooksStatus>("hooks_status")
    : Promise.resolve(demoHooks);
}

export function installHooks(): Promise<HooksStatus> {
  return inApp()
    ? invoke<HooksStatus>("install_hooks")
    : Promise.resolve({ ...demoHooks, installed: true });
}

export function uninstallHooks(): Promise<HooksStatus> {
  return inApp()
    ? invoke<HooksStatus>("uninstall_hooks")
    : Promise.resolve(demoHooks);
}

export function addProduct(product: NewProduct): Promise<string> {
  return inApp()
    ? invoke<string>("add_product", { product })
    : Promise.resolve(product.name.toLowerCase());
}

export function removeProduct(productId: string): Promise<void> {
  return inApp()
    ? invoke("remove_product", { productId }).then(() => undefined)
    : Promise.resolve();
}

/** Asks for a folder with the system picker. Resolves to null when cancelled. */
export async function pickFolder(): Promise<string | null> {
  if (!inApp()) return "~/code/my-app";
  const { open } = await import("@tauri-apps/plugin-dialog");
  const chosen = await open({ directory: true, multiple: false });
  return typeof chosen === "string" ? chosen : null;
}

export function addTodo(input: TodoInput): Promise<Todo | null> {
  return inApp() ? invoke<Todo>("add_todo", { input }) : Promise.resolve(null);
}

export function setTodoDone(id: number, done: boolean): Promise<void> {
  return inApp()
    ? invoke("set_todo_done", { id, done }).then(() => undefined)
    : Promise.resolve();
}

export function deleteTodo(id: number): Promise<void> {
  return inApp()
    ? invoke("delete_todo", { id }).then(() => undefined)
    : Promise.resolve();
}

export function writeDraft(kind: string, topic: string): Promise<Draft> {
  if (inApp()) return invoke<Draft>("write_draft", { kind, topic });
  return Promise.reject(
    new Error("Drafts are written by your agent in the desktop app."),
  );
}

export function deleteDraft(id: number): Promise<void> {
  return inApp()
    ? invoke("delete_draft", { id }).then(() => undefined)
    : Promise.resolve();
}

export function openHome(): Promise<void> {
  if (!inApp()) {
    window.open("?view=home", "_blank");
    return Promise.resolve();
  }
  return invoke("open_home").then(() => undefined);
}

export function setTraySize(width: number, height: number): Promise<void> {
  if (inApp()) {
    return invoke("set_tray_size", { width, height }).then(() => undefined);
  }
  // The browser preview sizes the page the way the app sizes its window.
  const root = document.getElementById("root");
  if (root) {
    Object.assign(root.style, {
      width: `${width}px`,
      height: `${height}px`,
      margin: "0 auto",
    });
  }
  return Promise.resolve();
}

/** The browser preview pretends to be a MacBook with a notch. */
export function notch(): Promise<Notch> {
  return inApp()
    ? invoke<Notch>("notch")
    : Promise.resolve({ width: 190, height: 34 });
}

export function editTodo(id: number, input: TodoInput): Promise<void> {
  return inApp()
    ? invoke("edit_todo", { id, input }).then(() => undefined)
    : Promise.resolve();
}

/** Saves a PNG to Downloads in the app, or downloads it in the browser preview. */
export async function saveImage(name: string, blob: Blob): Promise<string> {
  if (inApp()) {
    const data = Array.from(new Uint8Array(await blob.arrayBuffer()));
    return invoke<string>("save_image", { name, data });
  }
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${name}.png`;
  link.click();
  URL.revokeObjectURL(link.href);
  return `${name}.png`;
}

export function addCalendar(
  name: string,
  link: string,
  remindMinutes: number | null,
): Promise<void> {
  return inApp()
    ? invoke("add_calendar", { name, link, remindMinutes }).then(
        () => undefined,
      )
    : Promise.resolve();
}

export function removeCalendar(name: string): Promise<void> {
  return inApp()
    ? invoke("remove_calendar", { name }).then(() => undefined)
    : Promise.resolve();
}

export function setReminders(reminders: Reminders): Promise<void> {
  return inApp()
    ? invoke("set_reminders", { ...reminders }).then(() => undefined)
    : Promise.resolve();
}
