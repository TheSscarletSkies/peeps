import { useState } from "react";

import { announceFed } from "../life/events";
import type { MailView } from "../lib/types";
import { EmailCard } from "./EmailCard";

/**
 * Emails the helper drafted, waiting for the user. `limit` keeps the tray to one at a time;
 * the next appears once that one is sent or discarded.
 */
export function Outbox({
  mail,
  limit,
  emptyText,
}: {
  mail: MailView;
  limit?: number;
  emptyText?: string;
}) {
  // The preview never hears back from a real outbox, so handled emails are hidden here too.
  const [handled, setHandled] = useState<number[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const waiting = mail.outbox.filter((email) => !handled.includes(email.id));
  const shown = waiting.slice(0, limit ?? waiting.length);

  return (
    <div className="outbox">
      {note && (
        <p className="outbox__note" role="status">
          {note}
        </p>
      )}
      {shown.length === 0 && emptyText && !note && (
        <p className="setup__hint">{emptyText}</p>
      )}
      {limit !== undefined && waiting.length > limit && (
        <p className="outbox__count">1 of {waiting.length} waiting for you</p>
      )}
      {shown.map((email) => (
        <EmailCard
          key={email.id}
          email={email}
          accounts={mail.accounts}
          onDone={(outcome, draft) => {
            setHandled((ids) => [...ids, email.id]);
            if (outcome === "sent") announceFed("helper");
            setNote(
              outcome === "sent"
                ? `Sent to ${draft.to}. I'll tell you when they reply.`
                : "Discarded. Nothing was sent.",
            );
          }}
        />
      ))}
    </div>
  );
}
