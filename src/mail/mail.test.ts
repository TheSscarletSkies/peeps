import { describe, expect, it } from "vitest";

import type { Email, MailAccount } from "../lib/types";
import { blocker, daysAgo, draftOf, followUpPrompt } from "./mail";

const accounts: MailAccount[] = [
  {
    address: "hello@funderly.app",
    provider: "gmail",
    name: "",
    login: "",
    ready: true,
  },
  {
    address: "m@icloud.com",
    provider: "icloud",
    name: "",
    login: "",
    ready: false,
  },
];

const email: Email = {
  id: 1,
  from: "hello@funderly.app",
  to: "sara@brightfund.org",
  subject: "Welcome",
  body: "Hi",
  inReplyTo: null,
  status: "sent",
  messageId: "<a1@funderly.app>",
  createdAt: "2026-10-14T09:00:00Z",
  sentAt: "2026-10-14T09:00:00Z",
  repliedAt: null,
  error: null,
};

describe("blocker", () => {
  it("lets a complete email go", () => {
    expect(blocker(draftOf(email), accounts)).toBeNull();
    expect(
      blocker({ ...draftOf(email), to: "a@b.co; c@d.org" }, accounts),
    ).toBeNull();
  });

  it("says what is missing", () => {
    expect(blocker({ ...draftOf(email), from: "x@y.z" }, accounts)).toMatch(
      /Pick an account/,
    );
    expect(
      blocker({ ...draftOf(email), from: "m@icloud.com" }, accounts),
    ).toMatch(/app password for m@icloud.com/);
    expect(blocker({ ...draftOf(email), to: " " }, accounts)).toMatch(
      /Who is it to/,
    );
    expect(blocker({ ...draftOf(email), to: "sara" }, accounts)).toMatch(
      /“sara”/,
    );
    expect(blocker({ ...draftOf(email), subject: "" }, accounts)).toMatch(
      /subject/,
    );
  });
});

describe("followUpPrompt", () => {
  it("asks for a threaded draft, not a send", () => {
    const prompt = followUpPrompt(email);
    expect(prompt).toContain("sara@brightfund.org");
    expect(prompt).toContain("<a1@funderly.app>");
    expect(prompt).toContain("draft_email");
  });
});

describe("daysAgo", () => {
  it("reads naturally", () => {
    const now = new Date("2026-10-20T09:00:00Z").getTime();
    expect(daysAgo("2026-10-14T09:00:00Z", now)).toBe("6 days ago");
    expect(daysAgo("2026-10-19T09:00:00Z", now)).toBe("yesterday");
  });
});
