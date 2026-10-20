import { describe, expect, it } from "vitest";

import { fileName, giveFiles, takeFiles, withFiles } from "./drops";

describe("file drops", () => {
  it("names files without their folders", () => {
    expect(fileName("/Users/m/Downloads/pitch.pdf")).toBe("pitch.pdf");
    expect(fileName("C:\\Users\\m\\Desktop\\logo.png")).toBe("logo.png");
  });

  it("hands paths to the agent under the message", () => {
    expect(withFiles("Summarise this", ["/a/b.pdf", "/c.txt"])).toBe(
      "Summarise this\n\nFiles:\n- /a/b.pdf\n- /c.txt",
    );
    expect(withFiles("", ["/a.pdf"])).toBe("Files:\n- /a.pdf");
    expect(withFiles("hi", [])).toBe("hi");
  });

  it("keeps dropped files until the card picks them up, once", () => {
    giveFiles("funderly", ["/a.pdf"]);
    giveFiles("funderly", ["/b.pdf"]);
    expect(takeFiles("funderly")).toEqual(["/a.pdf", "/b.pdf"]);
    expect(takeFiles("funderly")).toEqual([]);
  });
});
