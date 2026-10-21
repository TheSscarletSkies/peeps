import { useState } from "react";

import { logPayment, logPost } from "../lib/bridge";
import type { ProductNumbers } from "../lib/types";
import { announceFed } from "../life/events";
import { POST_CHANNELS, postsLine, revenueLine } from "./format";

type Open = "none" | "payment" | "post";

/** A product's week in two lines, with one tap to log a payment or a post. */
export function NumbersStrip({
  productId,
  name,
  numbers,
  logging = false,
}: {
  productId: string;
  name: string;
  numbers: ProductNumbers | undefined;
  /** Shows the hand-logging buttons; teammates log through connectors, so cards leave them out. */
  logging?: boolean;
}) {
  const [open, setOpen] = useState<Open>("none");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const week = numbers?.week;
  const revenue = week ? revenueLine(week) : null;
  const posts = week ? postsLine(week, Date.now()) : null;
  const key = `numbers-${productId}`;

  const done = (message: string) => {
    announceFed(productId);
    setFlash(message);
    setOpen("none");
    setError(null);
  };

  const savePayment = async () => {
    try {
      await logPayment(productId, amount, currency, note);
      setAmount("");
      setNote("");
      done("Payment logged");
    } catch (reason) {
      setError(String(reason));
    }
  };

  const savePost = async (channel: string, label: string) => {
    try {
      await logPost(productId, channel, "");
      done(`${label} post logged`);
    } catch (reason) {
      setError(String(reason));
    }
  };

  const toggle = (next: Open) => {
    setFlash(null);
    setError(null);
    setOpen(open === next ? "none" : next);
  };

  return (
    <div className="numbers" aria-label={`${name} this week`}>
      <div className="numbers__lines">
        {!revenue && !posts ? (
          <span data-empty>Nothing logged this week</span>
        ) : (
          <>
            <span data-empty={!revenue || undefined}>
              {revenue ?? "No payments"}
            </span>
            <span data-empty={!posts || undefined}>{posts ?? "No posts"}</span>
          </>
        )}
      </div>
      {logging && (
        <div className="numbers__actions">
          <button
            type="button"
            className="chip"
            aria-expanded={open === "payment"}
            onClick={() => toggle("payment")}
          >
            + Payment
          </button>
          <button
            type="button"
            className="chip"
            aria-expanded={open === "post"}
            onClick={() => toggle("post")}
          >
            Posted
          </button>
          {flash && (
            <span className="numbers__flash" role="status">
              {flash}
            </span>
          )}
        </div>
      )}
      {open === "payment" && (
        <form
          className="numbers__form"
          onSubmit={(event) => {
            event.preventDefault();
            void savePayment();
          }}
        >
          <label className="visually-hidden" htmlFor={`${key}-amount`}>
            Amount
          </label>
          <input
            id={`${key}-amount`}
            inputMode="decimal"
            value={amount}
            placeholder="49.00"
            autoFocus
            onChange={(event) => setAmount(event.target.value)}
          />
          <label className="visually-hidden" htmlFor={`${key}-currency`}>
            Currency
          </label>
          <input
            id={`${key}-currency`}
            className="numbers__currency"
            value={currency}
            maxLength={3}
            onChange={(event) => setCurrency(event.target.value.toUpperCase())}
          />
          <label className="visually-hidden" htmlFor={`${key}-note`}>
            From
          </label>
          <input
            id={`${key}-note`}
            value={note}
            placeholder="From, or what for"
            onChange={(event) => setNote(event.target.value)}
          />
          <button
            className="button button--primary"
            type="submit"
            disabled={!amount.trim()}
          >
            Log
          </button>
        </form>
      )}
      {open === "post" && (
        <div className="numbers__channels" role="group" aria-label="Posted on">
          {POST_CHANNELS.map((channel) => (
            <button
              key={channel.id}
              type="button"
              className="chip"
              onClick={() => void savePost(channel.id, channel.label)}
            >
              {channel.label}
            </button>
          ))}
        </div>
      )}
      {error && <p className="tray__error">{error}</p>}
    </div>
  );
}
