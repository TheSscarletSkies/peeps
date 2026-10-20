import { useState } from "react";

import { pickFolder, setSyncFolder } from "../lib/bridge";
import { Info } from "../lib/Info";
import type { Snapshot } from "../lib/types";

const DRIVES = [
  {
    name: "iCloud Drive",
    where:
      "On Mac it is in Finder's sidebar; on Windows install iCloud for Windows.",
  },
  {
    name: "OneDrive",
    where: "Built into Windows; on Mac install OneDrive from the App Store.",
  },
  { name: "Dropbox", where: "Install Dropbox on each computer." },
  {
    name: "Google Drive",
    where: "Install Google Drive for desktop on each computer.",
  },
];

const ago = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function since(iso: string, now: number): string {
  const minutes = Math.round((new Date(iso).getTime() - now) / 60_000);
  if (Math.abs(minutes) < 60) return ago.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 48) return ago.format(hours, "hour");
  return ago.format(Math.round(hours / 24), "day");
}

/** Keeps every computer in step through a folder the user already syncs. No account needed. */
export function DevicesPage({ snapshot }: { snapshot: Snapshot }) {
  const { sync } = snapshot;
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [folder, setFolder] = useState(sync.folder);
  const now = Date.now();
  const syncing = folder !== null;

  const choose = async () => {
    setError(null);
    const picked = await pickFolder();
    if (!picked) return;
    try {
      const joined = await setSyncFolder(picked);
      setFolder(picked);
      setNote(
        joined === "joined"
          ? "Found your other computer here, so I'm using its settings. This computer's old settings are saved as config.before-sync.toml."
          : "This computer's settings now live in that folder. Choose the same folder on your other computers.",
      );
    } catch (reason) {
      setError(String(reason));
    }
  };

  const stop = async () => {
    setError(null);
    try {
      await setSyncFolder(null);
      setFolder(null);
      setNote("Stopped syncing. Everything stays on this computer.");
    } catch (reason) {
      setError(String(reason));
    }
  };

  return (
    <div className="reminders">
      {!syncing ? (
        <section className="card">
          <h2>Use peeps on all your computers</h2>
          <p className="setup__hint">
            Pick a folder in a cloud drive you already use, then pick the same
            folder on your other computers. Your to-dos, habits, scheduled
            drafts, products and settings stay in step. No account, nothing to
            pay for.
          </p>
          <div className="drives">
            {DRIVES.map((drive) => (
              <div key={drive.name} className="drives__item">
                <strong>{drive.name}</strong>
                <span>{drive.where}</span>
              </div>
            ))}
          </div>
          <div className="todo-form__actions">
            <Info label="What stays on each computer">
              Calendar links and passwords stay in each computer's keychain, and
              chats stay with that computer's Claude. Add calendar links again
              on each computer.
            </Info>
            <button
              className="button button--primary"
              onClick={() => void choose()}
            >
              Choose a folder
            </button>
          </div>
        </section>
      ) : (
        <section className="card">
          <h2>Syncing</h2>
          <p className="devices__folder" title={folder ?? ""}>
            {folder}
          </p>
          <ul className="calendars" aria-label="Computers">
            <li>
              <span className="calendars__name">
                {sync.thisComputer || "This computer"}
              </span>
              <span className="calendars__state">
                This computer
                {sync.lastSynced
                  ? ` · synced ${since(sync.lastSynced, now)}`
                  : ""}
              </span>
            </li>
            {sync.computers.map((computer) => (
              <li key={computer.name}>
                <span className="calendars__name">{computer.name}</span>
                <span className="calendars__state">
                  Last seen {since(computer.seenAt, now)}
                </span>
              </li>
            ))}
          </ul>
          {sync.computers.length === 0 && (
            <p className="setup__hint">
              Choose this same folder in peeps on your other computer and it
              shows up here.
            </p>
          )}
          {sync.error && <p className="tray__error">{sync.error}</p>}
          <div className="todo-form__actions">
            <button className="button" onClick={() => void choose()}>
              Change folder
            </button>
            <button className="button" onClick={() => void stop()}>
              Stop syncing
            </button>
          </div>
        </section>
      )}
      {note && <p className="setup__hint">{note}</p>}
      {error && <p className="tray__error">{error}</p>}
    </div>
  );
}
