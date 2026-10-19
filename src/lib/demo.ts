import type { Snapshot } from "./types";

/** Shown when the interface runs in a plain browser, for development and screenshots. */
export const demoSnapshot: Snapshot = {
  pets: [
    {
      id: "funderly",
      name: "Funderly",
      kind: "bao",
      color: "#F6E3B4",
      mood: "needsYou",
      heat: 0.35,
      headline: "Waiting for your OK: git push origin main",
      needs: [
        {
          checkId: "unanswered-signups",
          signal: "hungry",
          message: "7 sign-ups have waited a week",
        },
      ],
      permission: {
        requestId: 1,
        tool: "Bash",
        summary: "git push origin main",
      },
      liveSessions: 1,
    },
    {
      id: "enigma-archives",
      name: "Enigma Archives",
      kind: "gyoza",
      color: "#C9B8F0",
      mood: "hungry",
      heat: 0,
      headline: "No new episode in 4 days",
      needs: [
        {
          checkId: "posting-cadence",
          signal: "hungry",
          message: "No new episode in 4 days",
        },
      ],
      permission: null,
      liveSessions: 0,
    },
    {
      id: "kaiveni-hiya",
      name: "Kaiveni Hiya",
      kind: "bao",
      color: "#9EE6B8",
      mood: "sweating",
      heat: 0.8,
      headline: "Working for 42 min",
      needs: [],
      permission: null,
      liveSessions: 1,
    },
  ],
  notes: [],
  tips: [
    {
      productId: "kaiveni-hiya",
      text: "CLAUDE.md is about 9k tokens and loads every session. Trimming it saves tokens on every run.",
    },
  ],
  configError: null,
};
