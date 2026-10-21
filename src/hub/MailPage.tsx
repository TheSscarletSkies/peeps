import { useState } from "react";

import {
  addMailAccount,
  removeMailAccount,
  sendChat,
  type NewMailAccount,
} from "../lib/bridge";
import { Info } from "../lib/Info";
import { Select } from "../lib/Select";
import type { MailProvider, Snapshot } from "../lib/types";
import { EmailCard } from "../mail/EmailCard";
import { daysAgo, followUpPrompt } from "../mail/mail";
import { Outbox } from "../mail/Outbox";

const PROVIDERS: { id: MailProvider; label: string; steps: string }[] = [
  {
    id: "gmail",
    label: "Gmail",
    steps:
      "Turn on 2-Step Verification for the account, then open myaccount.google.com/apppasswords, name it peeps and copy the 16-letter password. Do the same for your college account if it is a separate Gmail. If your school turned app passwords off, it can't be added.",
  },
  {
    id: "icloud",
    label: "iCloud",
    steps:
      "Go to account.apple.com → Sign-In and Security → App-Specific Passwords → add one called peeps and copy it.",
  },
];

const EMPTY: NewMailAccount = {
  address: "",
  provider: "gmail",
  name: "",
  login: "",
  password: "",
};

/** The user's mail accounts, emails waiting for approval, and who hasn't replied. */
export function MailPage({ snapshot }: { snapshot: Snapshot }) {
  const { mail, helper } = snapshot;
  const [form, setForm] = useState<NewMailAccount>(EMPTY);
  const [alias, setAlias] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asked, setAsked] = useState<number[]>([]);
  const [sentNote, setSentNote] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const now = Date.now();
  const set = (patch: Partial<NewMailAccount>) =>
    setForm({ ...form, ...patch });

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      await addMailAccount({ ...form, login: alias ? form.login : "" });
      setForm(EMPTY);
      setAlias(false);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy(false);
    }
  };

  const followUp = (id: number) => {
    const email = mail.awaiting.find((candidate) => candidate.id === id);
    if (!email) return;
    setAsked((ids) => [...ids, id]);
    void sendChat(followUpPrompt(email)).catch((reason) =>
      setError(String(reason)),
    );
  };

  return (
    <div className="reminders">
      {mail.accounts.length > 0 && (
        <section className="card">
          <h2>Waiting for you</h2>
          <Outbox
            mail={mail}
            emptyText={`Nothing to approve. Ask ${helper.name} to draft one, or write it below.`}
          />
        </section>
      )}

      {mail.accounts.length > 0 && (
        <section className="card">
          <div className="mail__head">
            <h2>Write an email</h2>
            {!composing && (
              <button className="button" onClick={() => setComposing(true)}>
                New email
              </button>
            )}
          </div>
          {sentNote && (
            <p className="outbox__note" role="status">
              {sentNote}
            </p>
          )}
          {composing && (
            <EmailCard
              email={null}
              accounts={mail.accounts}
              onDone={(_, draft) => {
                setSentNote(`Sent to ${draft.to}.`);
                setComposing(false);
              }}
            />
          )}
        </section>
      )}

      {mail.awaiting.length > 0 && (
        <section className="card">
          <h2>Waiting for a reply</h2>
          <ul className="calendars" aria-label="Waiting for a reply">
            {mail.awaiting.map((email) => (
              <li key={email.id}>
                <span className="calendars__name">{email.to}</span>
                <span className="calendars__state">
                  {email.subject}
                  {email.sentAt ? ` · sent ${daysAgo(email.sentAt, now)}` : ""}
                </span>
                <button
                  className="button button--small"
                  disabled={asked.includes(email.id)}
                  onClick={() => followUp(email.id)}
                >
                  {asked.includes(email.id) ? "Asked" : "Follow up"}
                </button>
              </li>
            ))}
          </ul>
          {asked.length > 0 && (
            <p className="setup__hint">
              {helper.name} is drafting it. It shows up above for you to read
              before it goes.
            </p>
          )}
        </section>
      )}

      <section className="card">
        <h2>Accounts</h2>
        {mail.accounts.length === 0 && (
          <p className="setup__hint">
            Add the accounts you send from. {helper.name} drafts, you read and
            press Send, and you hear when someone replies.
          </p>
        )}
        {mail.accounts.length > 0 && (
          <ul className="calendars" aria-label="Mail accounts">
            {mail.accounts.map((account) => (
              <li key={account.address}>
                <span className="calendars__name">{account.address}</span>
                <span
                  className="calendars__state"
                  data-error={!account.ready || undefined}
                >
                  {account.ready
                    ? account.name ||
                      (account.provider === "gmail" ? "Gmail" : "iCloud")
                    : "Needs its app password on this computer"}
                </span>
                {!account.ready && (
                  <button
                    className="button button--small"
                    onClick={() => {
                      setForm({
                        ...EMPTY,
                        address: account.address,
                        provider: account.provider,
                        name: account.name,
                        login: account.login,
                      });
                      setAlias(Boolean(account.login));
                    }}
                  >
                    Add password
                  </button>
                )}
                <button
                  className="button button--small"
                  onClick={() =>
                    void removeMailAccount(account.address).catch((reason) =>
                      setError(String(reason)),
                    )
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="todo-form"
          onSubmit={(event) => {
            event.preventDefault();
            void add();
          }}
        >
          <div className="feed">
            <label className="visually-hidden" htmlFor="mail-address">
              Email address
            </label>
            <input
              id="mail-address"
              type="email"
              value={form.address}
              placeholder="you@example.com"
              onChange={(event) => set({ address: event.target.value })}
            />
            <label className="visually-hidden" htmlFor="mail-provider">
              Provider
            </label>
            <Select
              id="mail-provider"
              value={form.provider}
              onChange={(next) => set({ provider: next as MailProvider })}
              options={PROVIDERS.map((provider) => ({
                value: provider.id,
                label: provider.label,
              }))}
            />
          </div>
          <label className="visually-hidden" htmlFor="mail-name">
            Name people see
          </label>
          <input
            id="mail-name"
            value={form.name}
            placeholder="Name people see, like Mariyam at Funderly"
            onChange={(event) => set({ name: event.target.value })}
          />
          <label className="mail__alias">
            <input
              type="checkbox"
              checked={alias}
              onChange={(event) => setAlias(event.target.checked)}
            />
            I send from this address inside another Gmail (“Send mail as”)
          </label>
          {alias && (
            <>
              <label className="visually-hidden" htmlFor="mail-login">
                Account it lives in
              </label>
              <input
                id="mail-login"
                type="email"
                value={form.login}
                placeholder={
                  form.provider === "gmail"
                    ? "The Gmail you sign in with"
                    : "Your @icloud.com address"
                }
                onChange={(event) => set({ login: event.target.value })}
              />
            </>
          )}
          <label className="visually-hidden" htmlFor="mail-password">
            App password
          </label>
          <input
            id="mail-password"
            type="password"
            autoComplete="off"
            value={form.password}
            placeholder="App password"
            onChange={(event) => set({ password: event.target.value })}
          />
          <div className="todo-form__actions">
            <Info label="About app passwords">
              An app password lets peeps send and check replies without your
              real password. It stays in this computer's keychain, never in the
              config or the sync folder. Outlook isn't supported yet: it needs a
              sign-in peeps can't do without a server.
            </Info>
            <button
              className="button button--primary"
              type="submit"
              disabled={
                busy ||
                !form.address.trim() ||
                !form.password.trim() ||
                (alias && !form.login.trim())
              }
            >
              {busy ? "Signing in…" : "Add account"}
            </button>
          </div>
        </form>
        <div className="providers">
          {PROVIDERS.map((provider) => (
            <details key={provider.id}>
              <summary>Make an app password for {provider.label}</summary>
              <p>{provider.steps}</p>
            </details>
          ))}
          <details>
            <summary>A work address added to your Gmail</summary>
            <p>
              If you open your personal Gmail and pick this address in the From
              box, it's a “Send mail as” address. Tick the box above, enter the
              Gmail you sign in to, and use that Gmail's app password. If the
              address has its own Google login, add it on its own.
            </p>
          </details>
        </div>
        {error && <p className="tray__error">{error}</p>}
      </section>
    </div>
  );
}
