import { describe, expect, it } from "vitest";

import { poke, type PokeLevel } from "./pokes";

function run(times: number[]): PokeLevel[] {
  let history: number[] = [];
  return times.map((at) => {
    const result = poke(history, at);
    history = result.history;
    return result.level;
  });
}

describe("poke", () => {
  it("goes from a pat to a giggle to dizzy", () => {
    expect(run([0, 400, 800])).toEqual(["pat", "giggle", "dizzy"]);
  });

  it("gets grumpy when the poking doesn't stop", () => {
    expect(run([0, 300, 600, 900, 1200, 1500, 1800])).toEqual([
      "pat",
      "giggle",
      "dizzy",
      "dizzy",
      "dizzy",
      "dizzy",
      "grumpy",
    ]);
    // After a sulk it starts over.
    expect(run([0, 300, 600, 900, 1200, 1500, 1800, 9000])[7]).toBe("pat");
  });

  it("slow pokes are just pats", () => {
    expect(run([0, 2000, 4000])).toEqual(["pat", "pat", "pat"]);
  });
});
