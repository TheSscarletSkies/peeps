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
  week: Week;
  todosDoneThisWeek: number;
  /** The next few calendar events, soonest first. */
  upcoming: CalendarEvent[];
  chat: ChatMessage[];
  /** True while the agent is answering. */
  chatting: boolean;
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
