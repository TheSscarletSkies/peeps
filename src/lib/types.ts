export type Mood =
  | "needsYou"
  | "failing"
  | "steaming"
  | "hungry"
  | "litterBox"
  | "sweating"
  | "working"
  | "stalled"
  | "chill";

export type PetKind = "bao" | "gyoza" | "wonton";
export type Signal = "hungry" | "litter_box";
export type Delivery = "nextSession" | "nextStep";
export type Decision = "allow" | "deny";

export interface Need {
  checkId: string;
  signal: Signal;
  message: string;
}

export interface Permission {
  requestId: number;
  tool: string;
  summary: string;
}

export interface Pet {
  id: string;
  name: string;
  kind: PetKind;
  color: string;
  mood: Mood;
  heat: number;
  headline: string;
  needs: Need[];
  permission: Permission | null;
  liveSessions: number;
}

export interface Note {
  id: number;
  productId: string;
  text: string;
  delivery: Delivery;
  createdAt: string;
  deliveredAt: string | null;
}

export interface Tip {
  productId: string;
  text: string;
}

export interface NewProduct {
  name: string;
  path: string;
  kind: PetKind;
  color: string;
}

export type DueState = "overdue" | "today" | "soon" | "later" | "undated";
export type Repeat =
  | "never"
  | "daily"
  | "weekdays"
  | "weekly"
  | "monthly"
  | "hourly"
  | "every2h"
  | "every3h";

/** What someone typed. Tags ride along in the title as `#tag`. */
export interface TodoInput {
  title: string;
  due: string | null;
  time: string | null;
  repeat: Repeat;
  /** Minutes before the due time; null for no reminder. */
  remindMinutes: number | null;
  /** When nudges through the day stop. */
  until: string | null;
}

export interface Todo {
  id: number;
  title: string;
  tags: string[];
  due: string | null;
  time: string | null;
  repeat: Repeat;
  remindMinutes: number | null;
  until: string | null;
  streak: number;
  createdAt: string;
  doneAt: string | null;
}

export interface OpenTodo extends Todo {
  dueState: DueState;
  liveStreak: number;
  /** Ticked off today; a daily repeat stays ticked until tomorrow. */
  doneToday: boolean;
}

export interface Draft {
  id: number;
  kind: string;
  topic: string;
  text: string;
  createdAt: string;
}

export interface ProductWeek {
  productId: string;
  tokens: number;
  activeMinutes: number;
}

export interface Week {
  /** Busiest first. */
  products: ProductWeek[];
  busiestDay: string | null;
}

export interface Helper {
  name: string;
  kind: PetKind;
  color: string;
  mood: Mood;
  headline: string;
  todos: OpenTodo[];
  done: Todo[];
  drafts: Draft[];
  draftKinds: { id: string; label: string }[];
  drafting: boolean;
  week: Week;
  todosDoneThisWeek: number;
  draftsThisWeek: number;
  /** The next few calendar events, soonest first. */
  upcoming: CalendarEvent[];
  chat: ChatMessage[];
  /** True while the agent is answering. */
  chatting: boolean;
  schedules: Schedule[];
  /** The helper's own agent asking to use a tool. */
  permission: Permission | null;
  /** The model and effort the user picked; null means the agent's own default. */
  model: string | null;
  effort: string | null;
}

export interface ChatMessage {
  id: number;
  from: "you" | "helper";
  text: string;
  at: string;
}

export interface NewSchedule {
  kind: string;
  topic: string;
  repeat: Repeat;
  start: string;
  time: string;
}

export interface Schedule {
  id: number;
  kind: string;
  topic: string;
  repeat: Repeat;
  time: string;
  nextAt: string;
}

export interface CalendarEvent {
  key: string;
  calendar: string;
  title: string;
  location: string | null;
  start: string;
  end: string;
  allDay: boolean;
}

export interface CalendarStatus {
  name: string;
  remindMinutes: number | null;
  notify: boolean;
  loaded: boolean;
  error: string | null;
}

export interface ReminderRule {
  /** Matches titles containing this, ignoring case. */
  contains: string;
  minutes: number;
  mute: boolean;
}

export interface Reminders {
  defaultMinutes: number;
  rules: ReminderRule[];
}

export interface Snapshot {
  pets: Pet[];
  notes: Note[];
  tips: Tip[];
  helper: Helper;
  configError: string | null;
  calendars: CalendarStatus[];
  reminders: Reminders;
  sync: SyncStatus;
  productChats: ProductChat[];
  mail: MailView;
  numbers: NumbersView;
  teammates: Teammate[];
  roles: Role[];
  /** Whether the user has told peeps anything about themselves yet. */
  knowsYou: boolean;
  /** A focus session or its break, while one is going. */
  focus: Focus | null;
  /** Nudges after a lot of hopping between apps; only app names are seen. */
  oneThing: boolean;
  /** Null until the user picks a name and gets a code. */
  friends: Friends | null;
  /** The parts of life to-dos are grouped into, as tags: work, study, play… */
  areas: string[];
  /** The last week of every repeating to-do. */
  habits: HabitWeek[];
}

/** A starting point for a new teammate. */
export interface Role {
  id: string;
  name: string;
  title: string;
  summary: string;
  repeat: Repeat;
  time: string;
  playbook: string;
}

export interface Teammate {
  productId: string;
  id: string;
  name: string;
  role: string;
  title: string;
  /** Its conversation, which is also its shift schedule's topic. */
  scope: string;
  /** Its rhythm; none while it is off. */
  schedule: Schedule | null;
  messages: ChatMessage[];
  chatting: boolean;
}

export interface LedgerEntry {
  uid: string;
  product: string;
  kind: "payment" | "post";
  /** Minor units, so 4950 is 49.50. */
  amountCents: number | null;
  currency: string | null;
  /** manual, paypal, youtube, tiktok, instagram, linkedin, x or other. */
  channel: string;
  note: string;
  at: string;
}

export interface NumbersSummary {
  /** Cents per currency code. */
  revenue: Record<string, number>;
  payments: number;
  posts: Record<string, number>;
  lastPostAt: string | null;
}

export interface ProductNumbers {
  productId: string;
  youtubeChannel: string | null;
  /** The last seven days. */
  week: NumbersSummary;
  recent: LedgerEntry[];
}

export interface NumbersView {
  products: ProductNumbers[];
  paypal: { product: string; sandbox: boolean } | null;
  paypalReady: boolean;
  youtubeReady: boolean;
  lastChecked: string | null;
  error: string | null;
}

export type MailProvider = "gmail" | "icloud";

export interface MailAccount {
  address: string;
  provider: MailProvider;
  name: string;
  /** The mailbox that signs in when `address` is an alias of it; empty when it is the same. */
  login: string;
  /** False on a computer that synced the account but has no app password for it yet. */
  ready: boolean;
}

export interface Email {
  id: number;
  from: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo: string | null;
  status: "pending" | "sent" | "failed" | "discarded";
  messageId: string | null;
  createdAt: string;
  sentAt: string | null;
  repliedAt: string | null;
  error: string | null;
}

/** What goes out: the user's last edits to a draft. */
export interface EmailDraft {
  from: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string | null;
}

export interface MailView {
  accounts: MailAccount[];
  /** Drafts waiting for approval, and ones that failed to send. */
  outbox: Email[];
  /** Sent in the last 30 days with no reply yet. */
  awaiting: Email[];
}

/** A product pet's conversation with the user. */
export interface ProductChat {
  productId: string;
  messages: ChatMessage[];
  chatting: boolean;
}

export interface SyncStatus {
  /** The folder this computer syncs through, if any. */
  folder: string | null;
  thisComputer: string;
  lastSynced: string | null;
  /** Other computers seen in the folder, with when they last wrote. */
  computers: { name: string; seenAt: string }[];
  error: string | null;
}

/** Whether this computer brought its settings to the folder or found another's there. */
export type Joined = "started" | "joined";

export interface Notch {
  /** Zero when the screen has no camera notch. */
  width: number;
  height: number;
}

/** A reminder the pets say out loud when it comes due. */
export interface Nudge {
  title: string;
  body: string;
  /** The to-do it is about, so Done can tick it off. */
  todoId: number | null;
  /** "chat" when the nudge is an invitation to talk, like getting to know the user. */
  action?: "chat" | null;
}

export interface Focus {
  phase: "focus" | "break";
  startedAt: string;
  endsAt: string;
  focusMinutes: number;
  task: string | null;
  area: string | null;
}

export type Reaction = "heart" | "poke" | "bonk" | "tea" | "study";

export interface FriendView {
  code: string;
  name: string;
  presence: "focusing" | "around" | "away";
  focusUntil: string | null;
  area: string | null;
}

export interface Friends {
  code: string;
  name: string;
  friends: FriendView[];
}

export interface ReactionEvent {
  from: string;
  reaction: Reaction;
  line: string;
}

export interface HabitWeek {
  id: number;
  title: string;
  area: string | null;
  /** The last seven days, oldest first, ending today. */
  days: { date: string; done: boolean }[];
  streak: number;
}
