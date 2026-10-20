import { describe, expect, it } from "vitest";

import type { Role, Teammate } from "../lib/types";
import { firstShift, kindFor, lastWord, openRoles } from "./team";

const role = (id: string): Role => ({
  id,
  name: id,
  title: id,
  summary: "",
  repeat: "weekly",
  time: "09:00",
  playbook: "",
});

const sana: Teammate = {
  productId: "funderly",
  id: "sana",
  name: "Sana",
  role: "sales",
  title: "Sales co-chair",
  scope: "funderly/sana",
  schedule: null,
  messages: [
    { id: 1, from: "you", text: "Run your shift", at: "" },
    { id: 2, from: "helper", text: "**Done**: 3 welcomes\nmore", at: "" },
  ],
  chatting: false,
};

describe("team", () => {
  it("starts today when the time is still ahead, otherwise tomorrow", () => {
    expect(firstShift("09:00", new Date(2026, 9, 20, 8, 30))).toBe(
      "2026-10-20",
    );
    expect(firstShift("09:00", new Date(2026, 9, 20, 9, 0))).toBe("2026-10-21");
    expect(firstShift("09:00", new Date(2026, 9, 31, 22, 0))).toBe(
      "2026-11-01",
    );
  });

  it("suggests roles the product doesn't have yet, blank last", () => {
    const roles = [role("sales"), role("custom"), role("growth")];
    expect(openRoles(roles, [sana]).map((r) => r.id)).toEqual([
      "growth",
      "sales",
      "custom",
    ]);
  });

  it("gives each role a steady dumpling", () => {
    expect(kindFor("sales")).toBe(kindFor("sales"));
    expect(["bao", "gyoza", "wonton"]).toContain(kindFor("analyst"));
  });

  it("shows the first line of the latest report", () => {
    expect(lastWord(sana)).toBe("Done: 3 welcomes");
    expect(lastWord({ ...sana, messages: [] })).toBeNull();
  });
});
