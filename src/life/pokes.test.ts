import { describe, expect, it } from "vitest";

import { poke } from "./pokes";

describe("poke", () => {
  it("gets dizzy on the third quick poke", () => {
    let state = poke([], 0);
    expect(state.dizzy).toBe(false);
    state = poke(state.history, 400);
    expect(state.dizzy).toBe(false);
    state = poke(state.history, 800);
    expect(state.dizzy).toBe(true);
    expect(state.history).toEqual([]);
  });

  it("forgets slow pokes", () => {
    let state = poke([], 0);
    state = poke(state.history, 1000);
    state = poke(state.history, 2600);
    expect(state.dizzy).toBe(false);
    expect(state.history).toEqual([2600]);
  });
});
