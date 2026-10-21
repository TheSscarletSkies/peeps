import { useState } from "react";

import { composeEmail, discardEmail, sendEmail } from "../lib/bridge";
import { Select } from "../lib/Select";
import type { Email, EmailDraft, MailAccount } from "../lib/types";
import { blocker, draftOf } from "./mail";

interface Props {
  /** Null for a new email the user writes themselves. */
  email: Email | null;
  accounts: MailAccount[];
  onDone: (outcome: "sent" | "discarded", draft: EmailDraft) => void;
}

const BLANK: Omit<EmailDraft, "from"> = { to: "", subject: "", body: "" };

/** One email, every part editable, that only goes out when the user presses Send. */
export function EmailCard({ email, accounts, onDone }: Props) {
  const [draft, setDraft] = useState<EmailDraft>(() =>
    email
      ? draftOf(email)
      : { ...BLANK, from: accounts.find((a) => a.ready)?.address ?? "" },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(email?.error ?? null);
  // A new email is kept once, so trying again after a failure doesn't make a second copy.
  const [held, setHeld] = useState<number | null>(email?.id ?? null);
  const key = email ? `email-${email.id}` : "email-new";
  const why = blocker(draft, accounts);
  const set = (patch: Partial<EmailDraft>) => setDraft({ ...draft, ...patch });

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      let id = held;
      if (id === null) {
        id = (await composeEmail(draft))?.id ?? null;
        setHeld(id);
      }
      const sent = id === null ? null : await sendEmail(id, draft);
      if (sent && sent.status === "failed") {
        setError(sent.error ?? "It didn't go out.");
        return;
      }
      onDone("sent", draft);
      if (!email) {
        setDraft({ ...BLANK, from: draft.from });
        setHeld(null);
      }
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    if (email) await discardEmail(email.id);
    onDone("discarded", draft);
  };

  return (
    <form
      className="email"
      aria-label={email ? `Email to ${email.to}` : "New email"}
      onSubmit={(event) => {
        event.preventDefault();
        if (!why) void send();
      }}
    >
      <div className="email__line">
        <label htmlFor={`${key}-from`}>From</label>
        <Select
          id={`${key}-from`}
          value={draft.from}
          onChange={(next) => set({ from: next })}
          options={[
            ...(accounts.some((a) => a.address === draft.from)
              ? []
              : [{ value: draft.from, label: draft.from || "Choose…" }]),
            ...accounts.map((account) => ({
              value: account.address,
              label: account.name
                ? `${account.name} <${account.address}>`
                : account.address,
            })),
          ]}
        />
      </div>
      <div className="email__line">
        <label htmlFor={`${key}-to`}>To</label>
        <input
          id={`${key}-to`}
          value={draft.to}
          placeholder="name@example.com"
          onChange={(event) => set({ to: event.target.value })}
        />
      </div>
      <div className="email__line">
        <label htmlFor={`${key}-subject`}>Subject</label>
        <input
          id={`${key}-subject`}
          value={draft.subject}
          onChange={(event) => set({ subject: event.target.value })}
        />
      </div>
      <label className="visually-hidden" htmlFor={`${key}-body`}>
        Message
      </label>
      <textarea
        id={`${key}-body`}
        rows={Math.min(14, Math.max(6, draft.body.split("\n").length + 1))}
        value={draft.body}
        placeholder="Write your message"
        onChange={(event) => set({ body: event.target.value })}
      />
      {error && <p className="tray__error">Couldn't send: {error}</p>}
      {why && (draft.to || draft.subject || email) && (
        <p className="setup__hint">{why}</p>
      )}
      <div className="todo-form__actions">
        {email && (
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => void discard()}
          >
            Discard
          </button>
        )}
        <button
          type="submit"
          className="button button--primary"
          disabled={busy || why !== null}
        >
          {busy
            ? "Sending…"
            : email?.status === "failed"
              ? "Try again"
              : "Send"}
        </button>
      </div>
    </form>
  );
}
