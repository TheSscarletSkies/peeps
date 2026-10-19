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

export type PetKind = "bao" | "gyoza";
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

export interface Snapshot {
  pets: Pet[];
  notes: Note[];
  tips: Tip[];
  configError: string | null;
}
