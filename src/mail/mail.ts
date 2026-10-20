import type { Email, EmailDraft, MailAccount } from "../lib/types";

export function draftOf(email: Email): EmailDraft {
  return {
    from: email.from,
    to: email.to,
    subject: email.subject,
    body: email.body,
    inReplyTo: email.inReplyTo,
  };
}

/** Why Send is off, or null when the email can go. */
export function blocker(
  draft: EmailDraft,
  accounts: MailAccount[],
): string | null {
  const account = accounts.find(
    (candidate) => candidate.address === draft.from,
  );
  if (!account) return "Pick an account to send from.";
  if (!account.ready)
    return `Add the app password for ${account.address} on this computer, under Mail.`;
  const recipients = draft.to
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (recipients.length === 0) return "Who is it to?";
  const bad = recipients.find(
    (part) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(part),
  );
  if (bad) return `“${bad}” doesn't look like an email address.`;
  if (!draft.subject.trim()) return "Add a subject.";
  return null;
}

/** What the helper is asked when the user wants to nudge someone who hasn't replied. */
export function followUpPrompt(email: Email): string {
  return [
    `Draft a short, friendly follow-up to ${email.to} about “${email.subject}”, sent from ${email.from}.`,
    email.messageId
      ? `Reply in the same thread (in_reply_to ${email.messageId}).`
      : "",
    "Use draft_email so I can read it before it goes.",
  ]
    .filter(Boolean)
    .join(" ");
}

const ago = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function daysAgo(iso: string, now: number): string {
  const days = Math.round((new Date(iso).getTime() - now) / 86_400_000);
  return ago.format(days, "day");
}
