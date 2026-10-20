import { describe, expect, it } from "vitest";

import type { NumbersSummary } from "../lib/types";
import { channelLabel, formatMoney, postsLine, revenueLine } from "./format";

const empty: NumbersSummary = {
  revenue: {},
  payments: 0,
  posts: {},
  lastPostAt: null,
};

describe("numbers on a card", () => {
  it("shows money without needless cents", () => {
    expect(formatMoney(14700, "USD")).toBe("$147");
    expect(formatMoney(4950, "USD")).toBe("$49.50");
    expect(formatMoney(1500, "GBP")).toBe("£15");
  });

  it("sums revenue per currency, largest first", () => {
    expect(revenueLine(empty)).toBeNull();
    expect(
      revenueLine({ ...empty, revenue: { GBP: 1500, USD: 6900 }, payments: 3 }),
    ).toBe("$69 + £15 · 3 payments");
    expect(revenueLine({ ...empty, revenue: { USD: 4900 }, payments: 1 })).toBe(
      "$49 · 1 payment",
    );
  });

  it("counts posts and says when the last went out", () => {
    const now = new Date("2026-10-20T12:00:00Z").getTime();
    expect(postsLine(empty, now)).toBeNull();
    expect(
      postsLine(
        {
          ...empty,
          posts: { tiktok: 2, youtube: 1 },
          lastPostAt: "2026-10-18T12:00:00Z",
        },
        now,
      ),
    ).toBe("3 posts · last 2 days ago");
    expect(
      postsLine(
        { ...empty, posts: { x: 1 }, lastPostAt: "2026-10-20T09:00:00Z" },
        now,
      ),
    ).toBe("1 post · last 3 hours ago");
  });

  it("names channels", () => {
    expect(channelLabel("tiktok")).toBe("TikTok");
    expect(channelLabel("manual")).toBe("Logged");
    expect(channelLabel("mastodon")).toBe("mastodon");
  });
});
