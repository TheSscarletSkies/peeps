import type { NumbersSummary } from "../lib/types";

export const POST_CHANNELS: { id: string; label: string }[] = [
  { id: "tiktok", label: "TikTok" },
  { id: "instagram", label: "Instagram" },
  { id: "youtube", label: "YouTube" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "x", label: "X" },
];

const CHANNEL_LABEL: Record<string, string> = {
  ...Object.fromEntries(POST_CHANNELS.map((c) => [c.id, c.label])),
  paypal: "PayPal",
  manual: "Logged",
  other: "Other",
};

export function channelLabel(channel: string): string {
  return CHANNEL_LABEL[channel] ?? channel;
}

export function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      // Whole amounts read faster on a card; cents only when there are some.
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toFixed(2)}`;
  }
}

/** "$147 · 3 payments", or null when nothing came in. */
export function revenueLine(week: NumbersSummary): string | null {
  if (week.payments === 0) return null;
  const totals = Object.entries(week.revenue)
    .sort(([, a], [, b]) => b - a)
    .map(([currency, cents]) => formatMoney(cents, currency))
    .join(" + ");
  return `${totals} · ${week.payments} ${week.payments === 1 ? "payment" : "payments"}`;
}

const ago = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "3 posts · last yesterday", or null when nothing went out. */
export function postsLine(week: NumbersSummary, now: number): string | null {
  const count = Object.values(week.posts).reduce((sum, n) => sum + n, 0);
  if (count === 0) return null;
  const head = `${count} ${count === 1 ? "post" : "posts"}`;
  if (!week.lastPostAt) return head;
  const hours = (new Date(week.lastPostAt).getTime() - now) / 3_600_000;
  const when =
    hours > -1
      ? "just now"
      : hours > -24
        ? ago.format(Math.round(hours), "hour")
        : ago.format(Math.round(hours / 24), "day");
  return `${head} · last ${when}`;
}
