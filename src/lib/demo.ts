import type { Snapshot } from "./types";

/** Shown when the interface runs in a plain browser, for development and screenshots. */
export const demoSnapshot: Snapshot = {
  pets: [
    {
      id: "funderly",
      name: "Funderly",
      kind: "bao",
      color: "#FFF3E3",
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
      color: "#E8DDFB",
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
      kind: "wonton",
      color: "#FFE6D5",
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
  helper: {
    name: "Helper",
    kind: "bao",
    color: "#DDF5E7",
    mood: "needsYou",
    headline: "1 to-do overdue",
    todos: [
      {
        id: 1,
        title: "Reply to Funderly sign-ups",
        kind: "task",
        due: "2026-10-17",
        createdAt: "2026-10-12T09:00:00Z",
        doneAt: null,
        dueState: "overdue",
      },
      {
        id: 2,
        title: "LinkedIn post about peeps",
        kind: "task",
        due: "2026-10-19",
        createdAt: "2026-10-15T09:00:00Z",
        doneAt: null,
        dueState: "today",
      },
      {
        id: 3,
        title: "Read chapter 4",
        kind: "study",
        due: "2026-10-21",
        createdAt: "2026-10-15T09:00:00Z",
        doneAt: null,
        dueState: "soon",
      },
    ],
    done: [],
    drafts: [],
    draftKinds: [
      { id: "linkedin", label: "LinkedIn post" },
      { id: "x", label: "post for X" },
    ],
    drafting: false,
    week: [
      { productId: "funderly", tokens: 412000 },
      { productId: "kaiveni-hiya", tokens: 268000 },
      { productId: "enigma-archives", tokens: 54000 },
    ],
  },
  configError: null,
};
