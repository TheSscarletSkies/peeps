import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { demoSnapshot } from "./demo";
import type {
  ChatMessage,
  Decision,
  Delivery,
  Joined,
  NewProduct,
  Notch,
  Nudge,
  Note,
  Reminders,
  Snapshot,
  Todo,
  TodoInput,
  Reaction,
  ReactionEvent,
} from "./types";

export const inApp = (): boolean => "__TAURI_INTERNALS__" in window;

export function loadSnapshot(): Promise<Snapshot> {
  return inApp() ? invoke<Snapshot>("snapshot") : Promise.resolve(preview);
}

// The preview has no app behind it; changes go to this copy so the page responds.
let preview: Snapshot = demoSnapshot;
const previewHandlers = new Set<(snapshot: Snapshot) => void>();

function updatePreview(change: (snapshot: Snapshot) => Snapshot) {
  preview = change(preview);
  previewHandlers.forEach((handler) => handler(preview));
}

export function onSnapshot(
  handler: (snapshot: Snapshot) => void,
): Promise<() => void> {
  if (!inApp()) {
    previewHandlers.add(handler);
    return Promise.resolve(() => {
      previewHandlers.delete(handler);
    });
  }
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
  /** Where Claude Code was found; null when peeps can't see it on this computer. */
  agent: string | null;
  /** What to paste in a terminal to install Claude Code, if the button can't open one. */
  installCommand: string;
}

const demoHooks: HooksStatus = {
  installed: false,
  settingsPath: "~/.claude/settings.json",
  command: "peeps-hook",
  agent: "/usr/local/bin/claude",
  installCommand: "curl -fsSL https://claude.ai/install.sh | bash",
};

/** The preview shows a computer without Claude Code with `?claude=missing`. */
export function hooksStatus(): Promise<HooksStatus> {
  if (inApp()) return invoke<HooksStatus>("hooks_status");
  const missing =
    new URLSearchParams(window.location.search).get("claude") === "missing";
  return Promise.resolve(missing ? { ...demoHooks, agent: null } : demoHooks);
}

export function installHooks(): Promise<HooksStatus> {
  return inApp()
    ? invoke<HooksStatus>("install_hooks")
    : Promise.resolve({ ...demoHooks, installed: true });
}

/** Opens a terminal that installs Claude Code and then starts it, to sign in. */
export function installClaude(): Promise<void> {
  return inApp()
    ? invoke("install_claude").then(() => undefined)
    : Promise.resolve();
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
  if (inApp()) return invoke<Todo>("add_todo", { input });
  // The preview keeps the to-do so switches and lists respond.
  updatePreview((snapshot) => {
    const id = Math.max(0, ...snapshot.helper.todos.map((t) => t.id)) + 1;
    const tags = [...input.title.matchAll(/#([\p{L}\p{N}_-]+)/gu)].map(
      (match) => match[1] ?? "",
    );
    const todo = {
      id,
      title: input.title.replace(/\s*#[\p{L}\p{N}_-]+/gu, "").trim(),
      tags,
      due: input.due,
      time: input.time,
      repeat: input.repeat,
      remindMinutes: input.remindMinutes,
      until: input.until,
      streak: 0,
      liveStreak: 0,
      doneToday: false,
      createdAt: new Date().toISOString(),
      doneAt: null,
      dueState: "undated" as const,
    };
    return {
      ...snapshot,
      helper: { ...snapshot.helper, todos: [...snapshot.helper.todos, todo] },
    };
  });
  return Promise.resolve(null);
}

export function setTodoDone(id: number, done: boolean): Promise<void> {
  return inApp()
    ? invoke("set_todo_done", { id, done }).then(() => undefined)
    : Promise.resolve();
}

export function deleteTodo(id: number): Promise<void> {
  if (inApp()) return invoke("delete_todo", { id }).then(() => undefined);
  updatePreview((snapshot) => ({
    ...snapshot,
    helper: {
      ...snapshot.helper,
      todos: snapshot.helper.todos.filter((todo) => todo.id !== id),
    },
  }));
  return Promise.resolve();
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
export function sendChat(text: string): Promise<ChatMessage> {
  if (inApp()) return invoke<ChatMessage>("send_chat", { text });
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

export function newChat(): Promise<void> {
  return inApp() ? invoke("new_chat").then(() => undefined) : Promise.resolve();
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

let previewProfile =
  "# About me\n\n## Who I am\n\n\n## What I'm working on\n\n\n## How I like things done\n\n\n## Things to remember\n\n";

/** The user's About me page, which every conversation reads. */
export function readProfile(): Promise<string> {
  return inApp()
    ? invoke<string>("read_profile")
    : Promise.resolve(previewProfile);
}

export function writeProfile(text: string): Promise<void> {
  if (inApp()) return invoke("write_profile", { text }).then(() => undefined);
  previewProfile = text;
  updatePreview((snapshot) => ({
    ...snapshot,
    knowsYou: text
      .split("\n")
      .some((line) => line.trim() && !line.trim().startsWith("#")),
  }));
  return Promise.resolve();
}

/** Reminders as they come due. The preview fakes one with `?nudge=Drink water`. */
export function onNudge(handler: (nudge: Nudge) => void): Promise<() => void> {
  if (inApp()) return listen<Nudge>("nudge", (event) => handler(event.payload));
  const params = new URLSearchParams(window.location.search);
  const text = params.get("nudge");
  const timer = text
    ? window.setTimeout(
        () =>
          handler(
            params.get("action") === "chat"
              ? { title: text, body: "", todoId: null, action: "chat" }
              : { title: text, body: "Every 2 hours", todoId: 5 },
          ),
        600,
      )
    : 0;
  return Promise.resolve(() => window.clearTimeout(timer));
}

export function startFocus(
  minutes: number,
  task: string,
  area: string | null = null,
): Promise<void> {
  if (inApp())
    return invoke("start_focus", { minutes, task: task || null, area }).then(
      () => undefined,
    );
  const now = Date.now();
  updatePreview((snapshot) => ({
    ...snapshot,
    focus: {
      phase: "focus",
      startedAt: new Date(now).toISOString(),
      endsAt: new Date(now + minutes * 60_000).toISOString(),
      focusMinutes: minutes,
      task: task.trim() || null,
      area,
    },
  }));
  return Promise.resolve();
}

export function stopFocus(): Promise<void> {
  if (inApp()) return invoke("stop_focus").then(() => undefined);
  updatePreview((snapshot) => ({ ...snapshot, focus: null }));
  return Promise.resolve();
}

export function setOneThing(on: boolean): Promise<void> {
  if (inApp()) return invoke("set_one_thing", { on }).then(() => undefined);
  updatePreview((snapshot) => ({ ...snapshot, oneThing: on }));
  return Promise.resolve();
}

export function startFriends(name: string): Promise<void> {
  if (inApp()) return invoke("start_friends", { name }).then(() => undefined);
  updatePreview((snapshot) => ({
    ...snapshot,
    friends: {
      code: "7KQ2M-XH4PD",
      name,
      friends: snapshot.friends?.friends ?? [],
    },
  }));
  return Promise.resolve();
}

export function addFriend(code: string): Promise<void> {
  if (inApp()) return invoke("add_friend", { code }).then(() => undefined);
  const clean = code.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (clean.length !== 10)
    return Promise.reject(
      "That doesn't look like a peeps code. It's 10 letters and numbers.",
    );
  updatePreview((snapshot) =>
    snapshot.friends
      ? {
          ...snapshot,
          friends: {
            ...snapshot.friends,
            friends: [
              ...snapshot.friends.friends,
              {
                code: `${clean.slice(0, 5)}-${clean.slice(5)}`,
                name: "A friend",
                presence: "away",
                focusUntil: null,
                area: null,
              },
            ],
          },
        }
      : snapshot,
  );
  return Promise.resolve();
}

export function removeFriend(code: string): Promise<void> {
  if (inApp()) return invoke("remove_friend", { code }).then(() => undefined);
  updatePreview((snapshot) =>
    snapshot.friends
      ? {
          ...snapshot,
          friends: {
            ...snapshot.friends,
            friends: snapshot.friends.friends.filter((f) => f.code !== code),
          },
        }
      : snapshot,
  );
  return Promise.resolve();
}

export function react(code: string, reaction: Reaction): Promise<void> {
  return inApp()
    ? invoke("react", { code, reaction }).then(() => undefined)
    : Promise.resolve();
}

/** Hearts and bonks from friends. The preview fakes one with `?reaction=bonk`. */
export function onReaction(
  handler: (event: ReactionEvent) => void,
): Promise<() => void> {
  if (inApp())
    return listen<ReactionEvent>("reaction", (event) => handler(event.payload));
  const kind = new URLSearchParams(window.location.search).get("reaction");
  const timer =
    kind === "heart" ||
    kind === "poke" ||
    kind === "bonk" ||
    kind === "tea" ||
    kind === "study"
      ? window.setTimeout(
          () => handler({ from: "Sara", reaction: kind, line: "" }),
          600,
        )
      : 0;
  return Promise.resolve(() => window.clearTimeout(timer));
}

export function setAreas(areas: string[]): Promise<void> {
  if (inApp()) return invoke("set_areas", { areas }).then(() => undefined);
  const clean = [
    ...new Set(
      areas
        .map((area) =>
          area
            .trim()
            .replace(/^#/, "")
            .toLowerCase()
            .replace(/[^\p{L}\p{N}_-]/gu, ""),
        )
        .filter(Boolean),
    ),
  ].slice(0, 8);
  updatePreview((snapshot) => ({ ...snapshot, areas: clean }));
  return Promise.resolve();
}

/** Downloads the update on the Settings card and restarts into it. Only the app has updates. */
export function installUpdate(): Promise<void> {
  return inApp()
    ? invoke("install_update").then(() => undefined)
    : Promise.resolve();
}
