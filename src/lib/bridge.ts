import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { demoSnapshot } from "./demo";
import type {
  ChatMessage,
  Decision,
  Delivery,
  Draft,
  Email,
  EmailDraft,
  Joined,
  LedgerEntry,
  MailProvider,
  NewProduct,
  NewSchedule,
  Notch,
  ProductNumbers,
  Note,
  Reminders,
  Snapshot,
  Todo,
  TodoInput,
} from "./types";

export const inApp = (): boolean => "__TAURI_INTERNALS__" in window;

export function loadSnapshot(): Promise<Snapshot> {
  return inApp() ? invoke<Snapshot>("snapshot") : Promise.resolve(preview);
}

// The preview has no app behind it; logging numbers updates this copy so the cards respond.
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
  if (inApp())
    return invoke("add_schedule", { schedule }).then(() => undefined);
  const added = {
    id: (demoId += 1),
    kind: schedule.kind,
    topic: schedule.topic,
    repeat: schedule.repeat,
    time: `${schedule.time}:00`,
    nextAt: new Date(`${schedule.start}T${schedule.time}`).toISOString(),
  };
  updatePreview((snapshot) => ({
    ...snapshot,
    helper: {
      ...snapshot.helper,
      schedules: [...snapshot.helper.schedules, added],
    },
    teammates: snapshot.teammates.map((teammate) =>
      schedule.kind === "teammate" && teammate.scope === schedule.topic
        ? { ...teammate, schedule: added }
        : teammate,
    ),
  }));
  return Promise.resolve();
}

export function deleteSchedule(id: number): Promise<void> {
  if (inApp()) return invoke("delete_schedule", { id }).then(() => undefined);
  updatePreview((snapshot) => ({
    ...snapshot,
    helper: {
      ...snapshot.helper,
      schedules: snapshot.helper.schedules.filter((item) => item.id !== id),
    },
    teammates: snapshot.teammates.map((teammate) =>
      teammate.schedule?.id === id ? { ...teammate, schedule: null } : teammate,
    ),
  }));
  return Promise.resolve();
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

export interface NewMailAccount {
  address: string;
  provider: MailProvider;
  name: string;
  login: string;
  password: string;
}

/** Signs in once to check the app password, then keeps it in the keychain. */
export function addMailAccount(account: NewMailAccount): Promise<void> {
  return inApp()
    ? invoke("add_mail_account", { ...account }).then(() => undefined)
    : Promise.resolve();
}

export function removeMailAccount(address: string): Promise<void> {
  return inApp()
    ? invoke("remove_mail_account", { address }).then(() => undefined)
    : Promise.resolve();
}

/** Holds a hand-written email for sending; nothing goes out until `sendEmail`. */
export function composeEmail(draft: EmailDraft): Promise<Email | null> {
  return inApp()
    ? invoke<Email>("compose_email", { draft })
    : Promise.resolve(null);
}

export function sendEmail(
  id: number,
  draft: EmailDraft,
): Promise<Email | null> {
  return inApp()
    ? invoke<Email>("send_email", { id, draft })
    : Promise.resolve(null);
}

export function discardEmail(id: number): Promise<void> {
  return inApp()
    ? invoke("discard_email", { id }).then(() => undefined)
    : Promise.resolve();
}

function addToPreview(entry: LedgerEntry) {
  updatePreview((snapshot) => ({
    ...snapshot,
    numbers: {
      ...snapshot.numbers,
      products: snapshot.numbers.products.map((numbers) =>
        numbers.productId === entry.product
          ? { ...numbers, ...withEntry(numbers, entry) }
          : numbers,
      ),
    },
  }));
}

function withEntry(
  numbers: ProductNumbers,
  entry: LedgerEntry,
): Pick<ProductNumbers, "week" | "recent"> {
  const week = { ...numbers.week };
  if (entry.kind === "payment" && entry.amountCents !== null) {
    const currency = entry.currency ?? "USD";
    week.revenue = {
      ...week.revenue,
      [currency]: (week.revenue[currency] ?? 0) + entry.amountCents,
    };
    week.payments += 1;
  } else {
    week.posts = {
      ...week.posts,
      [entry.channel]: (week.posts[entry.channel] ?? 0) + 1,
    };
    week.lastPostAt = entry.at;
  }
  return { week, recent: [entry, ...numbers.recent].slice(0, 8) };
}

function previewEntry(
  product: string,
  patch: Pick<
    LedgerEntry,
    "kind" | "amountCents" | "currency" | "channel" | "note"
  >,
): LedgerEntry {
  return {
    uid: `preview-${(demoId += 1)}`,
    product,
    at: new Date().toISOString(),
    ...patch,
  };
}

/** A payment from outside PayPal, like a bank transfer. `amount` is as typed, like "49.50". */
export function logPayment(
  product: string,
  amount: string,
  currency: string,
  note: string,
): Promise<LedgerEntry> {
  if (inApp())
    return invoke<LedgerEntry>("log_payment", {
      product,
      amount,
      currency,
      note,
    });
  const cents = Math.round(Number(amount) * 100);
  if (!(cents > 0))
    return Promise.reject(new Error(`\`${amount}\` isn't an amount`));
  const entry = previewEntry(product, {
    kind: "payment",
    amountCents: cents,
    currency: currency.toUpperCase(),
    channel: "manual",
    note,
  });
  addToPreview(entry);
  return Promise.resolve(entry);
}

export function logPost(
  product: string,
  channel: string,
  note: string,
): Promise<LedgerEntry> {
  if (inApp())
    return invoke<LedgerEntry>("log_post", { product, channel, note });
  const entry = previewEntry(product, {
    kind: "post",
    amountCents: null,
    currency: null,
    channel,
    note,
  });
  addToPreview(entry);
  return Promise.resolve(entry);
}

export function removeEntry(uid: string): Promise<void> {
  if (inApp()) return invoke("remove_entry", { uid }).then(() => undefined);
  updatePreview((snapshot) => ({
    ...snapshot,
    numbers: {
      ...snapshot.numbers,
      products: snapshot.numbers.products.map((numbers) => ({
        ...numbers,
        recent: numbers.recent.filter((entry) => entry.uid !== uid),
      })),
    },
  }));
  return Promise.resolve();
}

/** Checks the PayPal app's keys before keeping them in the keychain. */
export function connectPaypal(
  product: string,
  clientId: string,
  secret: string,
  sandbox: boolean,
): Promise<void> {
  return inApp()
    ? invoke("connect_paypal", { product, clientId, secret, sandbox }).then(
        () => undefined,
      )
    : Promise.resolve();
}

export function disconnectPaypal(): Promise<void> {
  return inApp()
    ? invoke("disconnect_paypal").then(() => undefined)
    : Promise.resolve();
}

export function setYoutubeKey(key: string | null): Promise<void> {
  return inApp()
    ? invoke("set_youtube_key", { key }).then(() => undefined)
    : Promise.resolve();
}

export function setYoutubeChannel(
  product: string,
  channel: string | null,
): Promise<void> {
  return inApp()
    ? invoke("set_youtube_channel", { product, channel }).then(() => undefined)
    : Promise.resolve();
}

export function refreshNumbers(): Promise<void> {
  return inApp()
    ? invoke("refresh_numbers").then(() => undefined)
    : Promise.resolve();
}

const previewPlaybooks = new Map<string, string>();

/** Adds a teammate from a role; its rhythm starts on this computer. Returns its id. */
export function addTeammate(
  product: string,
  role: string,
  name: string,
): Promise<string> {
  if (inApp()) return invoke<string>("add_teammate", { product, role, name });
  const start = preview.roles.find((candidate) => candidate.id === role);
  if (!start) return Promise.reject(new Error(`unknown role ${role}`));
  const display = name.trim() || start.name;
  const id = display.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  updatePreview((snapshot) => ({
    ...snapshot,
    teammates: [
      ...snapshot.teammates,
      {
        productId: product,
        id,
        name: display,
        role,
        title: start.title,
        scope: `${product}/${id}`,
        schedule: {
          id: (demoId += 1),
          kind: "teammate",
          topic: `${product}/${id}`,
          repeat: start.repeat,
          time: `${start.time}:00`,
          nextAt: new Date(Date.now() + 86_400_000).toISOString(),
        },
        messages: [],
        chatting: false,
      },
    ],
  }));
  return Promise.resolve(id);
}

export function removeTeammate(product: string, id: string): Promise<void> {
  if (inApp())
    return invoke("remove_teammate", { product, id }).then(() => undefined);
  updatePreview((snapshot) => ({
    ...snapshot,
    teammates: snapshot.teammates.filter(
      (teammate) => !(teammate.productId === product && teammate.id === id),
    ),
  }));
  return Promise.resolve();
}

export function readPlaybook(
  product: string,
  id: string,
  fallback: string,
): Promise<string> {
  return inApp()
    ? invoke<string>("read_playbook", { product, id })
    : Promise.resolve(previewPlaybooks.get(`${product}/${id}`) ?? fallback);
}

export function writePlaybook(
  product: string,
  id: string,
  text: string,
): Promise<void> {
  if (inApp())
    return invoke("write_playbook", { product, id, text }).then(
      () => undefined,
    );
  previewPlaybooks.set(`${product}/${id}`, text);
  return Promise.resolve();
}

/** Starts a shift now; resolves once its report is in. */
export function runTeammate(product: string, id: string): Promise<void> {
  return inApp()
    ? invoke("run_teammate", { product, id }).then(() => undefined)
    : Promise.resolve();
}

// The preview has no briefs to read, so it suggests from what each sample product is.
const PREVIEW_SUGGESTIONS: Record<string, string[]> = {
  funderly: ["sales", "growth"],
  "enigma-archives": ["showrunner", "growth"],
  "kaiveni-hiya": ["launch", "growth"],
};

/** Role ids peeps suggests for a product, best first, leaving out roles it already has. */
export function suggestTeam(product: string): Promise<string[]> {
  if (inApp()) return invoke<string[]>("suggest_team", { product });
  const taken = preview.teammates
    .filter((teammate) => teammate.productId === product)
    .map((teammate) => teammate.role);
  return Promise.resolve(
    (PREVIEW_SUGGESTIONS[product] ?? ["growth", "analyst"]).filter(
      (role) => !taken.includes(role),
    ),
  );
}
