import { describe, expect, it } from "vitest";

import { updateCard } from "./update";

const ready = { version: "0.2.0", installing: false, error: null };

describe("update card", () => {
  it("offers a restart once the app has found a new version", () => {
    expect(updateCard(ready, true)).toEqual({
      title: "peeps 0.2.0 is ready",
      action: "Restart to update",
      busy: false,
      error: null,
    });
  });

  it("stays hidden when up to date or in the browser preview", () => {
    expect(updateCard(null, true)).toBeNull();
    expect(updateCard(ready, false)).toBeNull();
  });

  it("shows progress and a failed attempt", () => {
    expect(updateCard({ ...ready, installing: true }, true)).toMatchObject({
      action: "Updating…",
      busy: true,
    });
    expect(
      updateCard({ ...ready, error: "download stopped" }, true)?.error,
    ).toBe("download stopped");
  });
});
