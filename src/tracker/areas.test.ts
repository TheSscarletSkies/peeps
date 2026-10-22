import { describe, expect, it } from "vitest";

import type { OpenTodo } from "../lib/types";
import { areaLabel, doing, groupByArea } from "./areas";

const todo = (id: number, tags: string[]) =>
  ({ id, title: `t${id}`, tags }) as unknown as OpenTodo;

describe("areas", () => {
  it("groups to-dos by their first area, the rest last", () => {
    const groups = groupByArea(
      [
        todo(1, ["study"]),
        todo(2, []),
        todo(3, ["habit", "work"]),
        todo(4, ["play", "study"]),
      ],
      ["work", "study", "play"],
    );
    expect(groups.map((g) => [g.area, g.todos.map((t) => t.id)])).toEqual([
      ["work", [3]],
      ["study", [1]],
      ["play", [4]],
      [null, [2]],
    ]);
  });

  it("names areas and what friends are doing", () => {
    expect(areaLabel("study")).toBe("Study");
    expect(areaLabel(null)).toBe("Everything else");
    expect(doing("study")).toBe("Studying");
    expect(doing(null)).toBe("Focusing");
  });
});
