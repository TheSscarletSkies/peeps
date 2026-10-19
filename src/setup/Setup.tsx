import { useEffect, useState } from "react";

import {
  addProduct,
  hooksStatus,
  installHooks,
  pickFolder,
  removeProduct,
  uninstallHooks,
  type HooksStatus,
} from "../lib/bridge";
import type { NewProduct, PetKind, Snapshot } from "../lib/types";
import { Dumpling } from "../pets/Dumpling";

const COLORS = [
  "#F6E3B4",
  "#FFD66B",
  "#FF9C9C",
  "#C9B8F0",
  "#9CC9FF",
  "#9EE6B8",
];

interface Props {
  snapshot: Snapshot;
  onDone: () => void;
  onTyping: (typing: boolean) => void;
}

export function Setup({ snapshot, onDone, onTyping }: Props) {
  const [hooks, setHooks] = useState<HooksStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    hooksStatus().then(setHooks, (reason) => setError(String(reason)));
  }, []);

  const run = async (action: () => Promise<unknown>): Promise<boolean> => {
    setError(null);
    try {
      await action();
      return true;
    } catch (reason) {
      setError(String(reason));
      return false;
    }
  };

  return (
    <section className="setup" aria-label="Set up peeps">
      <header className="setup__head">
        <span className="panel__name">Set up peeps</span>
        <button className="button" onClick={onDone}>
          Done
        </button>
      </header>

      <div className="setup__step">
        <span className="setup__title">Connect Claude Code</span>
        {hooks?.installed ? (
          <div className="setup__row">
            <span className="setup__ok">Connected</span>
            <button
              className="button"
              onClick={() => run(async () => setHooks(await uninstallHooks()))}
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div className="setup__row">
            <span className="setup__hint">
              Adds peeps to {hooks?.settingsPath ?? "~/.claude/settings.json"}.
              Your other settings stay as they are.
            </span>
            <button
              className="button button--primary"
              disabled={!hooks}
              onClick={() => run(async () => setHooks(await installHooks()))}
            >
              Connect
            </button>
          </div>
        )}
      </div>

      <div className="setup__step">
        <span className="setup__title">Your products</span>
        {snapshot.pets.length === 0 && (
          <span className="setup__hint">
            Each product gets a pet. Agents working in its folder belong to it.
          </span>
        )}
        <ul className="setup__products">
          {snapshot.pets.map((pet) => (
            <li key={pet.id}>
              <Dumpling
                kind={pet.kind}
                color={pet.color}
                mood="chill"
                heat={0}
                size={28}
              />
              <span>{pet.name}</span>
              <button
                className="button button--small"
                onClick={() => run(() => removeProduct(pet.id))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <AddProduct
          onAdd={(product) => run(() => addProduct(product))}
          onTyping={onTyping}
        />
      </div>

      {error && <p className="tray__error">{error}</p>}
    </section>
  );
}

interface AddProductProps {
  /** Resolves to whether the product was added. */
  onAdd: (product: NewProduct) => Promise<boolean>;
  onTyping: (typing: boolean) => void;
}

function AddProduct({ onAdd, onTyping }: AddProductProps) {
  const [name, setName] = useState("");
  const [path, setPath] = useState<string | null>(null);
  const [kind, setKind] = useState<PetKind>("bao");
  const [color, setColor] = useState(COLORS[0] ?? "#F6E3B4");

  const ready = name.trim() !== "" && path !== null;

  const submit = async () => {
    if (!ready) return;
    if (await onAdd({ name, path, kind, color })) {
      setName("");
      setPath(null);
    }
  };

  return (
    <form
      className="setup__add"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="setup__preview">
        <Dumpling kind={kind} color={color} mood="chill" heat={0} size={56} />
      </div>
      <div className="setup__fields">
        <label className="visually-hidden" htmlFor="product-name">
          Product name
        </label>
        <input
          id="product-name"
          value={name}
          placeholder="Product name"
          onChange={(event) => setName(event.target.value)}
          onFocus={() => onTyping(true)}
          onBlur={() => onTyping(false)}
        />
        <button
          type="button"
          className="button setup__folder"
          title={path ?? undefined}
          onClick={async () => setPath((await pickFolder()) ?? path)}
        >
          {path ? folderName(path) : "Choose folder"}
        </button>
        <div className="setup__choices">
          <div role="radiogroup" aria-label="Dumpling" className="setup__kinds">
            {(["bao", "gyoza"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={kind === option}
                className={kind === option ? "chip chip--on" : "chip"}
                onClick={() => setKind(option)}
              >
                {option}
              </button>
            ))}
          </div>
          <div role="radiogroup" aria-label="Colour" className="setup__colors">
            {COLORS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={color === option}
                aria-label={option}
                className={color === option ? "swatch swatch--on" : "swatch"}
                style={{ background: option }}
                onClick={() => setColor(option)}
              />
            ))}
          </div>
        </div>
      </div>
      <button
        className="button button--primary"
        type="submit"
        disabled={!ready}
      >
        Add
      </button>
    </form>
  );
}

function folderName(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}
