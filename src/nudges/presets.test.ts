import { describe, expect, it } from "vitest";

import { demoSnapshot } from "../lib/demo";
import type { OpenTodo } from "../lib/types";
import { ownReminders, presetTodo, PRESETS } from "./presets";

const base = demoSnapshot.helper.todos[0] as OpenTodo;

const todo = (patch: Partial<OpenTodo>): OpenTodo => ({ ...base, ...patch });

describe("nudge presets", () => {
  it("are repeating to-dos through the day, tagged #nudge", () => {
    for (const preset of PRESETS) {
      expect(preset.input.title).toContain("#nudge");
      expect(["hourly", "every2h", "every3h"]).toContain(preset.input.repeat);
      expect(preset.input.remindMinutes).toBe(0);
    }
  });

  it("finds the to-do a preset made, and keeps the user's own apart", () => {
    const water = todo({
      id: 90,
      title: "Drink water",
      tags: ["nudge"],
      repeat: "every2h",
    });
    const class6 = todo({
      id: 91,
      title: "Class",
      tags: [],
      repeat: "weekly",
      remindMinutes: 30,
    });
    const plain = todo({
      id: 92,
      title: "Buy milk",
      tags: [],
      repeat: "never",
      remindMinutes: null,
    });
    const water2 = PRESETS.find((p) => p.id === "water");
    if (!water2) throw new Error("no water preset");
    expect(presetTodo(water2, [plain, water])?.id).toBe(90);
    expect(ownReminders([water, class6, plain]).map((t) => t.id)).toEqual([91]);
  });
});
