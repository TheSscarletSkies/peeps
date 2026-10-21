import { useEffect, useRef, useState } from "react";

import {
  addProduct,
  addProductPath,
  hooksStatus,
  installClaude,
  installHooks,
  pickFolder,
  removeProduct,
  uninstallHooks,
  type HooksStatus,
} from "../lib/bridge";
import type { NewProduct, PetKind, Snapshot } from "../lib/types";
import { Dumpling } from "../pets/Dumpling";

const COLORS = [
  "#FFE7C9",
  "#FFD2BC",
  "#FFC9D6",
  "#DFCFFF",
  "#C9E0FF",
  "#C6EFD8",
];

interface Props {
  snapshot: Snapshot;
  onDone: () => void;
  onTyping: (typing: boolean) => void;
}

export function Setup({ snapshot, onDone, onTyping }: Props) {
  const [hooks, setHooks] = useState<HooksStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [installing, setInstalling] = useState(false);
  const [copied, setCopied] = useState(false);
  const missing = hooks !== null && hooks.agent === null;

  useEffect(() => {
    hooksStatus().then(setHooks, (reason) => setError(String(reason)));
  }, []);

  // While Claude Code is missing, keep looking, so the step turns Connected the moment the
  // installer finishes without anyone pressing anything.
  useEffect(() => {
    if (!missing) return;
    const timer = window.setInterval(() => {
      void hooksStatus().then(setHooks);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [missing]);

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
        {hooks && !hooks.agent ? (
          <div className="install">
            <p className="setup__hint">
              peeps works through Claude Code, which comes with your Claude
              account. It isn't on this computer yet.
            </p>
            <div className="setup__row">
              <span className="setup__hint">
                {installing
                  ? "A window opened: let it finish, sign in there, then come back. This turns Connected by itself."
                  : "One click opens a window that installs it, then asks you to sign in."}
              </span>
              <button
                className="button button--primary"
                onClick={() =>
                  void run(async () => {
                    await installClaude();
                    setInstalling(true);
                  })
                }
              >
                {installing ? "Open it again" : "Install Claude Code"}
              </button>
            </div>
            <details className="install__manual">
              <summary>Or paste this into a terminal yourself</summary>
              <div className="install__command">
                <code>{hooks.installCommand}</code>
                <button
                  className="button button--small"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(hooks.installCommand)
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
        ) : hooks?.installed ? (
          <div className="setup__row">
            <span className="setup__ok">Connected</span>
            <button
              className="tray__link"
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
              <ProductMenu
                name={pet.name}
                onFolder={async () => {
                  const folder = await pickFolder();
                  if (folder) await run(() => addProductPath(pet.id, folder));
                }}
                onRemove={() => run(() => removeProduct(pet.id))}
              />
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

/** A product's less common actions, out of the way until asked for. Removing asks first. */
function ProductMenu({
  name,
  onFolder,
  onRemove,
}: {
  name: string;
  onFolder: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const menu = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) {
        setOpen(false);
        setConfirming(false);
      }
    };
    window.addEventListener("pointerdown", away);
    return () => window.removeEventListener("pointerdown", away);
  }, [open]);

  return (
    <span className="row-menu" ref={menu}>
      <button
        className="row-menu__button"
        aria-label={`More for ${name}`}
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          setConfirming(false);
        }}
      >
        ⋯
      </button>
      {open && (
        <span className="row-menu__list" role="menu">
          {confirming ? (
            <>
              <span className="row-menu__ask">
                Remove {name}? Its pet goes; your project stays.
              </span>
              <button
                role="menuitem"
                className="row-menu__danger"
                onClick={() => {
                  setOpen(false);
                  onRemove();
                }}
              >
                Remove {name}
              </button>
              <button role="menuitem" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                role="menuitem"
                title="On a second computer, point this pet at the project's folder here"
                onClick={() => {
                  setOpen(false);
                  onFolder();
                }}
              >
                Add this computer's folder
              </button>
              <button
                role="menuitem"
                className="row-menu__danger"
                onClick={() => setConfirming(true)}
              >
                Remove…
              </button>
            </>
          )}
        </span>
      )}
    </span>
  );
}
