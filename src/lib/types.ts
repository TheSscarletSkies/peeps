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
export type Repeat = "never" | "daily" | "weekdays" | "weekly" | "monthly";

/** What someone typed. Tags ride along in the title as `#tag`. */
export interface TodoInput {
  title: string;
  due: string | null;
  time: string | null;
  repeat: Repeat;
  /** Minutes before the due time; null for no reminder. */
  remindMinutes: number | null;
}

export interface Todo {
  id: number;
  title: string;
  tags: string[];
  due: string | null;
  time: string | null;
  repeat: Repeat;
  remindMinutes: number | null;
  streak: number;
  createdAt: string;
  doneAt: string | null;
}

export interface OpenTodo extends Todo {
  dueState: DueState;
  liveStreak: number;
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
}

export interface Snapshot {
  pets: Pet[];
  notes: Note[];
  tips: Tip[];
  helper: Helper;
  configError: string | null;
}

export interface Notch {
  /** Zero when the screen has no camera notch. */
  width: number;
  height: number;
}
