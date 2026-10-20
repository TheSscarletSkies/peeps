import { describe, expect, it } from "vitest";

import { parseRich } from "./rich";

describe("parseRich", () => {
  it("reads bold, code and lists", () => {
    expect(
      parseRich("**Done**: 3 welcomes\n- run `npm test`\n2. call Tom"),
    ).toEqual([
      {
        kind: "line",
        spans: [{ text: "Done", bold: true }, { text: ": 3 welcomes" }],
      },
      {
        kind: "item",
        spans: [{ text: "run " }, { text: "npm test", code: true }],
      },
      { kind: "item", spans: [{ text: "call Tom" }] },
    ]);
  });

  it("leaves plain text and stray stars alone", () => {
    expect(parseRich("5 * 3 is 15")).toEqual([
      { kind: "line", spans: [{ text: "5 * 3 is 15" }] },
    ]);
    expect(parseRich("")).toEqual([{ kind: "line", spans: [] }]);
  });
});
