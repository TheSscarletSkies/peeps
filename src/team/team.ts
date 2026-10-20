import type { PetKind, Role, Teammate } from "../lib/types";

const KINDS: PetKind[] = ["gyoza", "wonton", "bao"];

/** Teammates get a different dumpling from their product's pet, steady for each role. */
export function kindFor(role: string): PetKind {
  const sum = [...role].reduce((total, c) => total + c.charCodeAt(0), 0);
  return KINDS[sum % KINDS.length] ?? "bao";
}

/** The first day a rhythm at `time` (HH:MM) can start: today if that time is still ahead. */
export function firstShift(time: string, now: Date): string {
  const [hours = 9, minutes = 0] = time.split(":").map(Number);
  const day = new Date(now);
  if (now.getHours() * 60 + now.getMinutes() >= hours * 60 + minutes)
    day.setDate(day.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

/** Roles to suggest first for a product: ones it doesn't have yet. */
export function openRoles(roles: Role[], team: Teammate[]): Role[] {
  const taken = new Set(team.map((teammate) => teammate.role));
  return [
    ...roles.filter((role) => !taken.has(role.id) && role.id !== "custom"),
    ...roles.filter((role) => taken.has(role.id) || role.id === "custom"),
  ];
}

/** The first line of the last thing a teammate said, for a list. */
export function lastWord(teammate: Teammate): string | null {
  const last = [...teammate.messages]
    .reverse()
    .find((message) => message.from !== "you");
  if (!last) return null;
  const line = last.text.split("\n").find((text) => text.trim()) ?? "";
  return line.replace(/\*\*/g, "").trim();
}
