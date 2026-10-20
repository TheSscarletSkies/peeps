import { useState } from "react";

import { setHelperAgent } from "../lib/bridge";
import type { Helper } from "../lib/types";

export const MODELS = [
  { id: "haiku", name: "Haiku", note: "Quick and light" },
  { id: "sonnet", name: "Sonnet", note: "Balanced, a good default" },
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

  return (
    <section className="agent-picker" aria-label="Choose a model">
      <p className="agent-picker__title">Which Claude should I use?</p>
      <div
        className="agent-picker__models"
        role="radiogroup"
        aria-label="Model"
      >
        {MODELS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={model === option.id}
            className="agent-picker__model"
            onClick={() => setModel(option.id)}
          >
            <strong>{option.name}</strong>
            <span>{option.note}</span>
          </button>
        ))}
      </div>
      <div className="roster__size">
        <span>Effort</span>
        <div className="segmented" role="radiogroup" aria-label="Effort">
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
      <p className="setup__hint">
        Higher effort thinks longer and uses more of your plan. Drafts use the
        same choice.
      </p>
      <div className="todo-form__actions">
        <button className="button" onClick={() => void save(null, null)}>
          Use my Claude defaults
        </button>
        <button
          className="button button--primary"
          onClick={() => void save(model, effort)}
        >
          Use {MODELS.find((option) => option.id === model)?.name}
        </button>
      </div>
      {error && <p className="tray__error">{error}</p>}
    </section>
  );
}
