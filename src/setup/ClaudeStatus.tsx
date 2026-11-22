import { useEffect, useState } from "react";

import {
  checkClaude,
  hooksStatus,
  installClaude,
  signInClaude,
  type HooksStatus,
} from "../lib/bridge";

type Check =
  { state: "checking" } | { state: "ok" } | { state: "failed"; why: string };

// One real check per launch: reopening Settings shouldn't spend a message each time.
let lastCheck: Check | null = null;

/** Chat runs on the user's own Claude Code; this checks it answers, or installs it in one click. */
export function ClaudeStatus() {
  const [status, setStatus] = useState<HooksStatus | null>(null);
  const [installing, setInstalling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missing = status !== null && status.agent === null;
  const [check, setCheck] = useState<Check | null>(lastCheck);
  const runCheck = () => {
    setCheck((lastCheck = { state: "checking" }));
    checkClaude().then(
      () => setCheck((lastCheck = { state: "ok" })),
      (reason: unknown) =>
        setCheck((lastCheck = { state: "failed", why: String(reason) })),
    );
  };

  useEffect(() => {
    if (status && !missing && !lastCheck) runCheck();
  }, [status, missing]);

  useEffect(() => {
    hooksStatus().then(setStatus, (reason) => setError(String(reason)));
  }, []);

  // Keep looking while it is missing, so this turns Connected the moment the installer finishes.
  useEffect(() => {
    if (!missing) return;
    const timer = window.setInterval(() => {
      void hooksStatus().then(setStatus);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [missing]);

  return (
    <section className="card claude">
      <h2>Claude</h2>
      {!status ? null : !missing ? (
        <>
          <div className="setup__row">
            <span className="setup__hint">
              Chat uses your own Claude account, through Claude Code.
            </span>
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
                      why: "A terminal opened: type /login there, sign in, then press Check again.",
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
                : "Chat needs Claude Code, which comes with your Claude account. One click installs it."}
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
              {installing ? "Open it again" : "Install Claude Code"}
            </button>
          </div>
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
              open a new window and run <code>claude</code> once to sign in.
            </p>
          </details>
        </div>
      )}
      {error && <p className="tray__error">{error}</p>}
    </section>
  );
}
