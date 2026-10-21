import { useEffect, useState } from "react";

import {
  addProduct,
  addProductPath,
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
  "#FFF3E3",
  "#FFE6D5",
  "#FFDDE4",
  "#E8DDFB",
  "#DCEBFF",
  "#DDF5E7",
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
    <section className="setup" aria-label="Products">
      <p className="setup__intro">
        Products are optional. Add the projects you build with Claude Code and
        each gets a pet that shows when its agent is working, stuck or waiting
        on you. Your helper works either way.
      </p>

      <div className="setup__step">
        <span className="setup__title">1. Let peeps hear Claude Code</span>
        <span className="setup__hint">
          So pets know when an agent starts, finishes or asks for permission.
        </span>
        {hooks && !hooks.agent && (
          <div className="setup__row">
            <span className="tray__error">
              Claude Code isn't on this computer, or peeps can't see it. Install
              it from claude.com/claude-code, open a terminal and run{" "}
              <code>claude</code> once, then check again.
            </span>
            <button
              className="button"
              onClick={() => run(async () => setHooks(await hooksStatus()))}
            >
              Check again
            </button>
          </div>
        )}
        {hooks?.installed ? (
          <div className="setup__row">
            <span className="setup__ok">
              {hooks.agent
                ? "Connected"
                : "Listening, but Claude Code is missing"}
            </span>
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
        <span className="setup__title">2. Add a product</span>
        <span className="setup__hint">
          Pick the folder you open in Claude Code. Agents working there belong
          to its pet.
        </span>
        <ul className="setup__products">
          {snapshot.pets.map((pet) => (
            <li key={pet.id}>
              <Dumpling
                kind={pet.kind}
                seed={pet.id}
                color={pet.color}
                mood="chill"
                heat={0}
                size={28}
              />
              <span>{pet.name}</span>
              <button
                className="button button--small"
                title="On a second computer, point this pet at the project's folder here"
                onClick={async () => {
                  const folder = await pickFolder();
                  if (folder) await run(() => addProductPath(pet.id, folder));
                }}
              >
                + This computer's folder
              </button>
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
      {snapshot.pets.length > 0 && (
        <div className="todo-form__actions">
          <button className="button" onClick={onDone}>
            Done
          </button>
        </div>
      )}
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
  const [color, setColor] = useState(COLORS[0] ?? "#FFF3E3");

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
          data-chosen={path ? "" : undefined}
          title={path ?? undefined}
          onClick={async () => setPath((await pickFolder()) ?? path)}
        >
          {path ? folderName(path) : "Choose folder"}
        </button>
        <div className="setup__choices">
          <div role="radiogroup" aria-label="Dumpling" className="setup__kinds">
            {(["bao", "gyoza", "wonton"] as const).map((option) => (
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
