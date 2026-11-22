import { useEffect, useState } from "react";

import {
  checkClaude,
  hooksStatus,
  installClaude,
  setChatAgent,
  signInClaude,
  type ChatAgent,
  type HooksStatus,
} from "../lib/bridge";

type Check =
  { state: "checking" } | { state: "ok" } | { state: "failed"; why: string };

// One real check per launch: reopening Settings shouldn't spend a message each time.
let lastCheck: Check | null = null;

const CLAUDE = {
  id: "claude",
  name: "Claude",
  program: "Claude Code",
  uses: "Uses your Claude account through Claude Code. It needs a paid plan (Pro or higher).",
} as const;

const SERVICES: {
  id: ChatAgent;
  name: string;
  program: string;
  uses: string;
}[] = [
  {
    id: "claude",
    name: "Claude",
    program: "Claude Code",
    uses: "Uses your Claude account through Claude Code. It needs a paid plan (Pro or higher).",
  },
  {
    id: "codex",
    name: "ChatGPT",
    program: "Codex",
    uses: "Uses your ChatGPT account through Codex. Free accounts work, with a usage limit.",
  },
];

/** Chat runs on the user's own Claude or ChatGPT; this picks one, checks it answers, or installs it. */
export function ClaudeStatus() {
  const [status, setStatus] = useState<HooksStatus | null>(null);
  const [installing, setInstalling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missing = status !== null && status.agent === null;
  const [check, setCheck] = useState<Check | null>(lastCheck);
  const service =
    SERVICES.find((option) => option.id === status?.chat) ?? CLAUDE;

  const runCheck = () => {
    setCheck((lastCheck = { state: "checking" }));
    checkClaude().then(
      () => setCheck((lastCheck = { state: "ok" })),
      (reason: unknown) =>
        setCheck((lastCheck = { state: "failed", why: String(reason) })),
    );
  };

  const refresh = () =>
    hooksStatus().then(setStatus, (reason) => setError(String(reason)));

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (status && !missing && !lastCheck) runCheck();
  }, [status, missing]);

  // Keep looking while it is missing, so this turns Connected the moment the installer finishes.
  useEffect(() => {
    if (!missing) return;
    const timer = window.setInterval(() => void refresh(), 4000);
    return () => window.clearInterval(timer);
  }, [missing]);

  const choose = (id: ChatAgent) => {
    if (id === status?.chat) return;
    setError(null);
    setInstalling(false);
    lastCheck = null;
    setCheck(null);
    setChatAgent(id).then(refresh, (reason: unknown) =>
      setError(String(reason)),
    );
  };

  return (
    <section className="card claude">
      <div className="setup__row">
        <h2>Chat with</h2>
        {status?.chat !== "other" && (
          <div className="segmented" role="radiogroup" aria-label="Chat with">
            {SERVICES.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={service.id === option.id}
                className={
                  service.id === option.id ? "segmented__on" : undefined
                }
                onClick={() => choose(option.id)}
              >
                {option.name}
              </button>
            ))}
          </div>
        )}
      </div>
      {!status ? null : !missing ? (
        <>
          <div className="setup__row">
            <span className="setup__hint">{service.uses}</span>
            {check?.state === "ok" && (
              <span className="setup__ok">Connected</span>
            )}
            {check?.state === "checking" && (
              <span className="setup__hint">Checking…</span>
            )}
            {check?.state === "failed" && (
              <span className="claude__off">Not answering</span>
            )}
          </div>
          {check?.state === "failed" && (
            <p className="tray__error" role="alert">
              {check.why}
            </p>
          )}
          <div className="claude__actions">
            <button
              className="button button--small"
              disabled={check?.state === "checking"}
              onClick={runCheck}
            >
              Check again
            </button>
            <button
              className="button button--small"
              onClick={() =>
                void signInClaude().then(
                  () =>
                    setCheck({
                      state: "failed",
                      why:
                        service.id === "codex"
                          ? "A terminal opened: sign in with your ChatGPT account there, then press Check again."
                          : "A terminal opened: type /login there, sign in, then press Check again.",
                    }),
                  (reason: unknown) => setError(String(reason)),
                )
              }
            >
              Sign in again
            </button>
          </div>
        </>
      ) : (
        <div className="install">
          <div className="setup__row">
            <span className="setup__hint">
              {installing
                ? "A window opened: let it finish, sign in there, then come back. This turns Connected by itself."
                : `${service.uses} One click installs ${service.program}.`}
            </span>
            <button
              className="button button--primary"
              onClick={() =>
                void installClaude().then(
                  () => setInstalling(true),
                  (reason) => setError(String(reason)),
                )
              }
            >
              {installing ? "Open it again" : `Install ${service.program}`}
            </button>
          </div>
          {service.id === "codex" && (
            <p className="setup__hint">
              Codex installs with npm, which comes with Node.js. If the window
              says npm isn't found, install Node.js from nodejs.org first.
            </p>
          )}
          <details className="install__manual">
            <summary>Or paste this into a terminal yourself</summary>
            <div className="install__command">
              <code>{status.installCommand}</code>
              <button
                className="button button--small"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(status.installCommand)
                    .then(() => setCopied(true))
                }
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="setup__hint">
              On Windows, paste it into PowerShell (not Command Prompt). Then
              open a new window and run{" "}
              <code>{service.id === "codex" ? "codex login" : "claude"}</code>{" "}
              once to sign in.
            </p>
          </details>
        </div>
      )}
      {service.id === "claude" && (
        <p className="setup__hint">
          No paid Claude plan? Pick ChatGPT: it works with a free ChatGPT
          account.
        </p>
      )}
      {error && <p className="tray__error">{error}</p>}
    </section>
  );
}
