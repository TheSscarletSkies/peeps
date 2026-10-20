import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { demoSnapshot } from "./demo";
import type {
  ChatMessage,
  Decision,
  Delivery,
  Draft,
  Joined,
  NewProduct,
  NewSchedule,
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

/** Moves the floating pet's window; the browser preview moves the page content instead. */
export function floatTray(
  x: number,
  y: number,
  width: number,
  height: number,
): Promise<void> {
  if (inApp()) {
    return invoke("float_tray", { x, y, width, height }).then(() => undefined);
  }
  const root = document.getElementById("root");
  if (root) {
    Object.assign(root.style, {
      position: "fixed",
      left: `${x}px`,
      top: `${y}px`,
      width: `${width}px`,
      height: `${height}px`,
      margin: "0",
    });
  }
  return Promise.resolve();
}

/** The browser preview pretends to be a MacBook with a notch, or a plain screen with `?notch=none`. */
export function notch(): Promise<Notch> {
  return inApp()
    ? invoke<Notch>("notch")
    : Promise.resolve(
        new URLSearchParams(window.location.search).get("notch") === "none"
          ? { width: 0, height: 0 }
          : { width: 190, height: 34 },
      );
}

export function editTodo(id: number, input: TodoInput): Promise<void> {
  return inApp()
    ? invoke("edit_todo", { id, input }).then(() => undefined)
    : Promise.resolve();
}

/** Letters, digits and single dashes, like the app's own file names. */
export function safeName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "peeps";
}

/** Saves a PNG to Downloads in the app, or downloads it in the browser preview. */
export async function saveImage(name: string, blob: Blob): Promise<string> {
  if (inApp()) {
    const data = Array.from(new Uint8Array(await blob.arrayBuffer()));
    return invoke<string>("save_image", { name, data });
  }
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${safeName(name)}.png`;
  document.body.append(link);
  link.click();
  link.remove();
  // The browser reads the file after this returns, so the link has to outlive the click.
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  return link.download;
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

let demoId = 1000;

/** Sends a message to the helper. The browser preview answers with a stand-in reply. */
export function sendChat(text: string, scope = "helper"): Promise<ChatMessage> {
  if (inApp()) return invoke<ChatMessage>("send_chat", { text, scope });
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve({
          id: (demoId += 1),
          from: "helper",
          text: `In the app I'd ask your agent about “${text}”.`,
          at: new Date().toISOString(),
        }),
      900,
    ),
  );
}

export function newChat(scope = "helper"): Promise<void> {
  return inApp()
    ? invoke("new_chat", { scope }).then(() => undefined)
    : Promise.resolve();
}

const demoBriefs = new Map<string, string>();

/** A product's brief in Markdown. The browser preview keeps edits in memory. */
export function readBrief(productId: string, name: string): Promise<string> {
  if (inApp()) return invoke<string>("read_brief", { productId });
  return Promise.resolve(
    demoBriefs.get(productId) ??
      `# ${name}\n\n## Goal\n\n## Audience\n\n## Voice\n\n## Numbers\n\n## Links\n\n## Decisions\n`,
  );
}

export function writeBrief(productId: string, text: string): Promise<void> {
  if (inApp()) {
    return invoke("write_brief", { productId, text }).then(() => undefined);
  }
  demoBriefs.set(productId, text);
  return Promise.resolve();
}

export function addSchedule(schedule: NewSchedule): Promise<void> {
  return inApp()
    ? invoke("add_schedule", { schedule }).then(() => undefined)
    : Promise.resolve();
}

export function deleteSchedule(id: number): Promise<void> {
  return inApp()
    ? invoke("delete_schedule", { id }).then(() => undefined)
    : Promise.resolve();
}

export function setHelperAgent(
  model: string | null,
  effort: string | null,
): Promise<void> {
  return inApp()
    ? invoke("set_helper_agent", { model, effort }).then(() => undefined)
    : Promise.resolve();
}

/** Starts syncing through a folder, or stops with `null`. */
export function setSyncFolder(folder: string | null): Promise<Joined | null> {
  return inApp()
    ? invoke<Joined | null>("set_sync_folder", { folder })
    : Promise.resolve(folder ? "started" : null);
}

export function addProductPath(productId: string, path: string): Promise<void> {
  return inApp()
    ? invoke("add_product_path", { productId, path }).then(() => undefined)
    : Promise.resolve();
}
