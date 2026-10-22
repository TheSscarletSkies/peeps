import { describe, expect, it } from "vitest";

import { PASTELS, pastelFor } from "./palette";

describe("tag colours", () => {
  it("keeps familiar areas recognisable and every tag in the family", () => {
    expect(pastelFor("work")).toBe("sky");
    expect(pastelFor("Study")).toBe("sage");
    expect(pastelFor("funderly")).toBe(pastelFor("funderly"));
    for (const tag of ["gym", "bills", "side-project", "x"])
      expect(PASTELS).toContain(pastelFor(tag));
  });
});
