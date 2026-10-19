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

export type TodoKind = "task" | "study";
export type DueState = "overdue" | "today" | "soon" | "later" | "undated";

export interface Todo {
  id: number;
  title: string;
  kind: TodoKind;
  due: string | null;
  createdAt: string;
  doneAt: string | null;
}

export interface OpenTodo extends Todo {
  dueState: DueState;
}

export interface Draft {
  id: number;
  kind: string;
  topic: string;
  text: string;
  createdAt: string;
}

export interface ProductTokens {
  productId: string;
  tokens: number;
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
  week: ProductTokens[];
}

export interface Snapshot {
  pets: Pet[];
  notes: Note[];
  tips: Tip[];
  helper: Helper;
  configError: string | null;
}
