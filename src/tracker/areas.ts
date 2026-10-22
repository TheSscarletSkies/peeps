import type { OpenTodo } from "../lib/types";

export interface AreaGroup {
  /** The area's tag, or null for to-dos in none of them. */
  area: string | null;
  todos: OpenTodo[];
}

/** To-dos under their first area tag, in the user's order of areas, with the rest last. */
export function groupByArea(todos: OpenTodo[], areas: string[]): AreaGroup[] {
  const areaOf = (todo: OpenTodo) =>
    todo.tags.find((tag) => areas.includes(tag)) ?? null;
  const groups: AreaGroup[] = [...areas, null].map((area) => ({
    area,
    todos: todos.filter((todo) => areaOf(todo) === area),
  }));
  return groups.filter((group) => group.todos.length > 0);
}

/** "Work", "Study": an area's tag as a heading. */
export function areaLabel(area: string | null): string {
  if (!area) return "Everything else";
  return area.charAt(0).toUpperCase() + area.slice(1);
}

/** What a friend focusing in an area is doing, in a word. */
export function doing(area: string | null | undefined): string {
  if (area === "study") return "Studying";
  if (area === "work") return "Working";
  return area ? `Focusing on ${area}` : "Focusing";
}
