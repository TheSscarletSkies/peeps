import { useEffect, useRef, useState } from "react";

import { HelperPanel } from "../helper/HelperPanel";
import { MOOD_LABEL } from "../hub/ProductCard";
import { hooksStatus, openHome, setExpanded } from "../lib/bridge";
import type { Mood, Snapshot } from "../lib/types";
import { Dumpling } from "../pets/Dumpling";
import { Setup } from "../setup/Setup";
import { PetPanel } from "./PetPanel";

const URGENT: Mood[] = [
  "needsYou",
  "failing",
  "steaming",
  "hungry",
  "litterBox",
];
const COLLAPSE_DELAY_MS = 600;

type View = "pets" | "helper";

export function Tray({ snapshot }: { snapshot: Snapshot }) {
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [view, setView] = useState<View>("pets");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [setup, setSetup] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);

  const { pets, helper } = snapshot;
  const urgent = pets.filter((pet) => URGENT.includes(pet.mood));
  const selected =
    pets.find((pet) => pet.id === selectedId) ?? urgent[0] ?? pets[0];
  const others = pets.filter((pet) => pet.id !== selected?.id);

  useEffect(() => {
    void setExpanded(open);
  }, [open]);

  useEffect(() => {
    hooksStatus().then((status) => {
      if (!status.installed) setSetup(true);
    });
  }, []);

  const showSetup = setup || pets.length === 0;

  const enter = () => {
    window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const leave = () => {
    if (typing) return;
    closeTimer.current = window.setTimeout(
      () => setOpen(false),
      COLLAPSE_DELAY_MS,
    );
  };

  const tab = (id: View, label: string) => {
    const on = view === id && !showSetup;
    return (
      <button
        role="tab"
        aria-selected={on}
        className={on ? "chip chip--on" : "chip"}
        onClick={() => {
          setView(id);
          setSetup(false);
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      className={open ? "tray tray--open" : "tray"}
      onMouseEnter={enter}
      onMouseLeave={leave}
    >
      {!open && (
        <div className="tray__peek">
          {pets.map((pet) => (
            <Dumpling
              key={pet.id}
              seed={pet.id}
              kind={pet.kind}
              color={pet.color}
              mood={pet.mood}
              heat={pet.heat}
              size={30}
            />
          ))}
          {pets.length > 0 && (
            <Dumpling
              kind={helper.kind}
              color={helper.color}
              mood={helper.mood}
              heat={0}
              size={30}
            />
          )}
          {pets.length === 0 && (
            <span className="tray__count">Set up peeps</span>
          )}
          {urgent.length > 0 && (
            <span className="tray__count">{urgent.length} need you</span>
          )}
        </div>
      )}

      {open && (
        <>
          <div className="tray__bar">
            <div className="tray__tabs" role="tablist" aria-label="Notch">
              {tab("pets", "Pets")}
              {tab("helper", helper.name)}
            </div>
            <button className="tray__link" onClick={() => void openHome()}>
              Open peeps
            </button>
          </div>

          {snapshot.configError && (
            <p className="tray__error">
              Config problem: {snapshot.configError}
            </p>
          )}

          {showSetup && (
            <Setup
              snapshot={snapshot}
              onDone={() => setSetup(false)}
              onTyping={setTyping}
            />
          )}

          {!showSetup && view === "helper" && (
            <div
              className="focus"
              style={{ ["--pet" as string]: helper.color }}
            >
              <HelperPanel
                helper={helper}
                pets={pets}
                tips={snapshot.tips}
                onTyping={setTyping}
              />
            </div>
          )}

          {!showSetup && view === "pets" && selected && (
            <div className="tray__pets">
              <div
                className="focus focus--pet"
                style={{ ["--pet" as string]: selected.color }}
              >
                <div className="focus__pet">
                  <Dumpling
                    seed={selected.id}
                    kind={selected.kind}
                    color={selected.color}
                    mood={selected.mood}
                    heat={selected.heat}
                    size={88}
                  />
                  <span className="focus__mood">
                    {MOOD_LABEL[selected.mood]}
                  </span>
                </div>
                <PetPanel
                  key={selected.id}
                  pet={selected}
                  onTyping={setTyping}
                />
              </div>
              {others.length > 0 && (
                <div className="pills">
                  {others.map((pet) => (
                    <button
                      key={pet.id}
                      className="pill"
                      data-urgent={URGENT.includes(pet.mood) || undefined}
                      style={{ ["--pet" as string]: pet.color }}
                      onClick={() => setSelectedId(pet.id)}
                      aria-label={`${pet.name}: ${pet.headline}`}
                    >
                      <Dumpling
                        seed={pet.id}
                        kind={pet.kind}
                        color={pet.color}
                        mood={pet.mood}
                        heat={pet.heat}
                        size={34}
                      />
                      <span className="pill__text">
                        <span className="pill__name">{pet.name}</span>
                        <span className="pill__mood">
                          {MOOD_LABEL[pet.mood]}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
