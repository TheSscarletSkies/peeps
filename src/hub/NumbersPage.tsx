import { useState } from "react";

import {
  connectPaypal,
  disconnectPaypal,
  refreshNumbers,
  removeEntry,
  setYoutubeChannel,
  setYoutubeKey,
} from "../lib/bridge";
import { Info } from "../lib/Info";
import { Select } from "../lib/Select";
import type { Snapshot } from "../lib/types";
import {
  channelLabel,
  formatMoney,
  postsLine,
  revenueLine,
} from "../numbers/format";

const PAYPAL_STEPS =
  "Sign in at developer.paypal.com with your PayPal business account → Apps & Credentials → Live → Create App (Merchant). Open the app, tick Transaction Search under Features, and copy the Client ID and Secret. PayPal lists payments a few hours after they happen.";
const YOUTUBE_STEPS =
  "At console.cloud.google.com create a project, enable “YouTube Data API v3”, then Credentials → Create credentials → API key. It's free for this. Your channel id is on youtube.com/account_advanced and starts with UC.";

/** Where each product's payments and posts come from, and what came in lately. */
export function NumbersPage({ snapshot }: { snapshot: Snapshot }) {
  const { numbers, pets } = snapshot;
  const [product, setProduct] = useState(
    numbers.paypal?.product ?? pets[0]?.id ?? "",
  );
  const [clientId, setClientId] = useState("");
  const [secret, setSecret] = useState("");
  const [sandbox, setSandbox] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [youtubeKey, setYoutubeKeyText] = useState("");
  const [channels, setChannels] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      numbers.products.map((n) => [n.productId, n.youtubeChannel ?? ""]),
    ),
  );
  const now = Date.now();
  const nameOf = (id: string) => pets.find((pet) => pet.id === id)?.name ?? id;

  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await action();
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy(null);
    }
  };

  if (pets.length === 0) {
    return (
      <div className="reminders">
        <section className="card">
          <p className="setup__hint">
            Add a product first; its payments and posts show up here and on its
            card.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="reminders">
      <section className="card">
        <div className="mail__head">
          <h2>This week</h2>
          <button
            className="button button--small"
            disabled={busy !== null}
            onClick={() => void run("refresh", refreshNumbers)}
          >
            {busy === "refresh" ? "Checking…" : "Check now"}
          </button>
        </div>
        {numbers.error && <p className="tray__error">{numbers.error}</p>}
        {numbers.products.map((product) => (
          <div key={product.productId} className="ledger">
            <div className="ledger__head">
              <strong>{nameOf(product.productId)}</strong>
              <span>
                {[
                  revenueLine(product.week) ?? "No payments",
                  postsLine(product.week, now) ?? "no posts",
                ].join(" · ")}
              </span>
            </div>
            {product.recent.length > 0 && (
              <ul
                className="calendars"
                aria-label={`${nameOf(product.productId)} entries`}
              >
                {product.recent.map((entry) => (
                  <li key={entry.uid}>
                    <span className="calendars__name">
                      {entry.amountCents !== null
                        ? formatMoney(
                            entry.amountCents,
                            entry.currency ?? "USD",
                          )
                        : channelLabel(entry.channel)}
                    </span>
                    <span className="calendars__state">
                      {[
                        entry.amountCents !== null
                          ? channelLabel(entry.channel)
                          : "",
                        entry.note,
                        new Date(entry.at).toLocaleDateString("en", {
                          day: "numeric",
                          month: "short",
                        }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <button
                      className="button button--small"
                      aria-label={`Remove ${entry.note || channelLabel(entry.channel)}`}
                      onClick={() =>
                        void run("remove", () => removeEntry(entry.uid))
                      }
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        <p className="setup__hint">
          Log a bank transfer or a TikTok or Instagram post from any product's
          card, or tell {snapshot.helper.name} “Funderly got $49 from Green
          Hope”.
        </p>
      </section>

      <section className="card">
        <h2>PayPal</h2>
        {numbers.paypal ? (
          <>
            <ul className="calendars">
              <li>
                <span className="calendars__name">
                  Payments go to {nameOf(numbers.paypal.product)}
                </span>
                <span
                  className="calendars__state"
                  data-error={!numbers.paypalReady || undefined}
                >
                  {numbers.paypalReady
                    ? numbers.paypal.sandbox
                      ? "Sandbox"
                      : "Connected"
                    : "Needs its keys on this computer"}
                </span>
                <button
                  className="button button--small"
                  onClick={() => void run("paypal", disconnectPaypal)}
                >
                  Disconnect
                </button>
              </li>
            </ul>
          </>
        ) : (
          <p className="setup__hint">
            Connect your PayPal business account and each payment shows up on a
            product's card, with a notification.
          </p>
        )}
        {(!numbers.paypal || !numbers.paypalReady) && (
          <form
            className="todo-form"
            onSubmit={(event) => {
              event.preventDefault();
              void run("paypal", async () => {
                await connectPaypal(product, clientId, secret, sandbox);
                setClientId("");
                setSecret("");
              });
            }}
          >
            <div className="rule">
              <span>Payments for</span>
              <label className="visually-hidden" htmlFor="paypal-product">
                Product
              </label>
              <Select
                id="paypal-product"
                value={product}
                onChange={setProduct}
                options={pets.map((pet) => ({
                  value: pet.id,
                  label: pet.name,
                }))}
              />
            </div>
            <label className="visually-hidden" htmlFor="paypal-client">
              Client ID
            </label>
            <input
              id="paypal-client"
              value={clientId}
              autoComplete="off"
              placeholder="Client ID"
              onChange={(event) => setClientId(event.target.value)}
            />
            <label className="visually-hidden" htmlFor="paypal-secret">
              Secret
            </label>
            <input
              id="paypal-secret"
              type="password"
              value={secret}
              autoComplete="off"
              placeholder="Secret"
              onChange={(event) => setSecret(event.target.value)}
            />
            <label className="mail__alias">
              <input
                type="checkbox"
                checked={sandbox}
                onChange={(event) => setSandbox(event.target.checked)}
              />
              These are sandbox keys, for testing
            </label>
            <div className="todo-form__actions">
              <Info label="Where the keys are kept">
                The keys stay in this computer's keychain, never in the config
                or the sync folder. peeps only reads transactions; it can't move
                money.
              </Info>
              <button
                className="button button--primary"
                type="submit"
                disabled={busy !== null || !clientId.trim() || !secret.trim()}
              >
                {busy === "paypal" ? "Checking…" : "Connect PayPal"}
              </button>
            </div>
          </form>
        )}
        <div className="providers">
          <details>
            <summary>Where are the PayPal keys?</summary>
            <p>{PAYPAL_STEPS}</p>
          </details>
        </div>
      </section>

      <section className="card">
        <h2>YouTube</h2>
        <form
          className="todo-form"
          onSubmit={(event) => {
            event.preventDefault();
            void run("youtube-key", async () => {
              await setYoutubeKey(youtubeKey);
              setYoutubeKeyText("");
            });
          }}
        >
          <div className="feed">
            <label className="visually-hidden" htmlFor="youtube-key">
              YouTube API key
            </label>
            <input
              id="youtube-key"
              type="password"
              value={youtubeKey}
              autoComplete="off"
              placeholder={
                numbers.youtubeReady
                  ? "API key saved on this computer"
                  : "YouTube API key"
              }
              onChange={(event) => setYoutubeKeyText(event.target.value)}
            />
            <button
              className="button"
              type="submit"
              disabled={busy !== null || !youtubeKey.trim()}
            >
              Save key
            </button>
          </div>
        </form>
        {pets.map((pet) => (
          <form
            key={pet.id}
            className="rule"
            onSubmit={(event) => {
              event.preventDefault();
              void run("youtube", () =>
                setYoutubeChannel(pet.id, channels[pet.id]?.trim() || null),
              );
            }}
          >
            <span>{pet.name}</span>
            <label className="visually-hidden" htmlFor={`youtube-${pet.id}`}>
              {pet.name} YouTube channel
            </label>
            <input
              id={`youtube-${pet.id}`}
              value={channels[pet.id] ?? ""}
              placeholder="Channel id or link (UC…)"
              onChange={(event) =>
                setChannels({ ...channels, [pet.id]: event.target.value })
              }
            />
            <button className="button button--small" type="submit">
              Save
            </button>
          </form>
        ))}
        <div className="providers">
          <details>
            <summary>Get a YouTube API key and channel id</summary>
            <p>{YOUTUBE_STEPS}</p>
          </details>
          <details>
            <summary>Why not TikTok and Instagram?</summary>
            <p>
              Their APIs only open to apps that pass a review and run a server,
              so peeps can't read them for you. Tap Posted on a product's card,
              or tell {snapshot.helper.name} “posted part 3 on TikTok”.
            </p>
          </details>
        </div>
      </section>
      {error && <p className="tray__error">{error}</p>}
    </div>
  );
}
