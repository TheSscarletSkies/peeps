import { useEffect, useState } from "react";

import { addTeammate, suggestTeam } from "../lib/bridge";
import type { Snapshot } from "../lib/types";
import { TeamPanel } from "../team/TeamPanel";

const noop = () => undefined;

/** Every product's team on one page, with one tap to staff the empty ones. */
export function TeamPage({ snapshot }: { snapshot: Snapshot }) {
  const { pets, teammates, roles } = snapshot;
  const empty = pets.filter(
    (pet) => !teammates.some((teammate) => teammate.productId === pet.id),
  );
  const emptyKey = empty.map((pet) => pet.id).join();
  const [suggested, setSuggested] = useState<[string, string[]][]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const ids = emptyKey ? emptyKey.split(",") : [];
    void Promise.all(
      ids.map(async (id) => [id, await suggestTeam(id)] as [string, string[]]),
    )
      .then((pairs) => {
        if (live) setSuggested(pairs.filter(([, picks]) => picks.length > 0));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [emptyKey]);

  const addAll = async () => {
    setBusy(true);
    setError(null);
    try {
      for (const [product, picks] of suggested)
        for (const role of picks) await addTeammate(product, role, "");
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy(false);
    }
  };

  if (pets.length === 0)
    return (
      <div className="reminders">
        <section className="card">
          <p className="setup__hint">
            Add a product first, then give it a sales co-chair, a showrunner or
            whoever it needs.
          </p>
        </section>
      </div>
    );

  const titleOf = (id: string) =>
    roles.find((role) => role.id === id)?.title ?? id;

  return (
    <div className="reminders">
      {suggested.length > 1 && (
        <section className="card" aria-label="Suggested teams">
          <h2>Suggested teams</h2>
          <ul className="calendars">
            {suggested.map(([product, picks]) => (
              <li key={product}>
                <span className="calendars__name">
                  {pets.find((pet) => pet.id === product)?.name}
                </span>
                <span className="calendars__state">
                  {picks.map(titleOf).join(" and ")}
                </span>
              </li>
            ))}
          </ul>
          <div className="todo-form__actions">
            <button
              className="button button--primary"
              disabled={busy}
              onClick={() => void addAll()}
            >
              {busy ? "Adding…" : "Add all suggested"}
            </button>
          </div>
          {error && <p className="tray__error">{error}</p>}
        </section>
      )}
      {pets.map((pet) => (
        <section
          key={pet.id}
          className="card"
          aria-label={`${pet.name} team section`}
        >
          <h2>{pet.name}</h2>
          <TeamPanel
            pet={pet}
            team={teammates.filter((teammate) => teammate.productId === pet.id)}
            roles={roles}
            helper={snapshot.helper}
            onTyping={noop}
          />
        </section>
      ))}
    </div>
  );
}
