import { useEffect, useState } from "react";

import { addTeammate, suggestTeam } from "../lib/bridge";
import type { Pet, Role } from "../lib/types";

/** Loads the roles peeps suggests for a product; empty while loading or when none fit. */
export function useSuggestion(productId: string, size: number): string[] {
  const [roles, setRoles] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    void suggestTeam(productId)
      .then((suggested) => {
        if (live) setRoles(suggested);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
    // The team's size changing is what makes a new suggestion worth fetching.
  }, [productId, size]);
  return roles;
}

/** The suggested team for one product, pre-ticked, added with one tap. */
export function SuggestedTeam({
  pet,
  suggestion,
  roles,
  onPickOwn,
}: {
  pet: Pet;
  suggestion: string[];
  roles: Role[];
  onPickOwn: () => void;
}) {
  const [picked, setPicked] = useState<string[]>(suggestion);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = suggestion
    .map((id) => roles.find((role) => role.id === id))
    .filter((role): role is Role => role !== undefined);

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      for (const role of picked) await addTeammate(pet.id, role, "");
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="team__suggest"
      aria-label={`Suggested team for ${pet.name}`}
    >
      <p className="setup__hint">
        Suggested for {pet.name}, from its brief, checks and numbers. They work
        through your own Claude and only draft; you approve everything.
      </p>
      <ul className="team__picks">
        {chosen.map((role) => (
          <li key={role.id}>
            <label>
              <input
                type="checkbox"
                checked={picked.includes(role.id)}
                onChange={(event) =>
                  setPicked(
                    event.target.checked
                      ? [...picked, role.id]
                      : picked.filter((id) => id !== role.id),
                  )
                }
              />
              <span>
                <strong>
                  {role.name}, {role.title.toLowerCase()}
                </strong>
                <span>{role.summary}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="todo-form__actions">
        <button type="button" className="tray__link" onClick={onPickOwn}>
          Pick roles myself
        </button>
        <button
          type="button"
          className="button button--primary"
          disabled={busy || picked.length === 0}
          onClick={() => void add()}
        >
          {busy
            ? "Adding…"
            : picked.length === 1
              ? "Add 1 teammate"
              : `Add ${picked.length} teammates`}
        </button>
      </div>
      {error && <p className="tray__error">{error}</p>}
    </div>
  );
}
