import { useState } from "react";

import { setHelperAgent } from "../lib/bridge";
import type { Helper } from "../lib/types";
import { Dumpling } from "../pets/Dumpling";

export const MODELS = [
  { id: "haiku", name: "Haiku", note: "Quick and light" },
  { id: "sonnet", name: "Sonnet", note: "Balanced, and a good default" },
  { id: "opus", name: "Opus", note: "Deepest thinking" },
];

export const EFFORTS = [
  { id: "low", name: "Low" },
  { id: "medium", name: "Medium" },
  { id: "high", name: "High" },
];

const ASKED = "peeps.agentAsked";

export function wasAsked(): boolean {
  try {
    return localStorage.getItem(ASKED) === "yes";
  } catch {
    return false;
  }
}

function remember() {
  try {
    localStorage.setItem(ASKED, "yes");
  } catch {
    // Without storage the helper simply asks again next time.
  }
}

/** "Sonnet · Medium", or what the agent does on its own when nothing is picked. */
export function agentLabel(helper: Helper): string {
  const model =
    MODELS.find((option) => option.id === helper.model)?.name ?? helper.model;
  const effort = EFFORTS.find((option) => option.id === helper.effort)?.name;
  if (!model && !effort) return "Your Claude defaults";
  return [model ?? "Default model", effort && `${effort} effort`]
    .filter(Boolean)
    .join(" · ");
}

/** Lets the user choose how the helper's agent thinks. Asked once, changeable any time. */
export function AgentPicker({
  helper,
  onDone,
}: {
  helper: Helper;
  onDone: () => void;
}) {
  const [model, setModel] = useState(helper.model ?? "sonnet");
  const [effort, setEffort] = useState(helper.effort ?? "medium");
  const [error, setError] = useState<string | null>(null);

  const save = async (picked: string | null, level: string | null) => {
    try {
      await setHelperAgent(picked, level);
      remember();
      onDone();
    } catch (reason) {
      setError(String(reason));
    }
  };

  const chosen = MODELS.find((option) => option.id === model) ?? MODELS[1];
  const level = EFFORTS.find((option) => option.id === effort);

  return (
    <section className="agent-picker" aria-label="Choose a model">
      <header className="agent-picker__head">
        <Dumpling
          kind={helper.kind}
          color={helper.color}
          mood="chill"
          heat={0}
          size={28}
        />
        <div>
          <p className="agent-picker__title">Which Claude should I use?</p>
          <p className="agent-picker__sub">You can change this any time.</p>
        </div>
      </header>

      <div className="agent-picker__row">
        <span id="model-label">Model</span>
        <div
          className="segmented"
          role="radiogroup"
          aria-labelledby="model-label"
        >
          {MODELS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={model === option.id}
              className={model === option.id ? "segmented__on" : undefined}
              onClick={() => setModel(option.id)}
            >
              {option.name}
            </button>
          ))}
        </div>
      </div>
      <div className="agent-picker__row">
        <span id="effort-label">Effort</span>
        <div
          className="segmented"
          role="radiogroup"
          aria-labelledby="effort-label"
        >
          {EFFORTS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={effort === option.id}
              className={effort === option.id ? "segmented__on" : undefined}
              onClick={() => setEffort(option.id)}
            >
              {option.name}
            </button>
          ))}
        </div>
      </div>
      <p className="agent-picker__note">
        {chosen?.note}. Higher effort thinks longer and uses more of your plan.
      </p>

      <button
        className="button button--primary agent-picker__use"
        onClick={() => void save(model, effort)}
      >
        Use {chosen?.name} · {level?.name}
      </button>
      <button className="tray__link" onClick={() => void save(null, null)}>
        Use my Claude defaults instead
      </button>
      {error && <p className="tray__error">{error}</p>}
    </section>
  );
}
