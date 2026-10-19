import { useEffect, useRef, useState } from "react";

import { hooksStatus, setExpanded } from "../lib/bridge";
import type { Mood, Snapshot } from "../lib/types";
import { HelperPanel } from "../helper/HelperPanel";
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
const HELPER_ID = "__helper";

export function Tray({ snapshot }: { snapshot: Snapshot }) {
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [setup, setSetup] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);

  const pets = snapshot.pets;
  const helper = snapshot.helper;
  const urgent = pets.filter((pet) => URGENT.includes(pet.mood));
  const helperSelected = selectedId === HELPER_ID;
  const selected = helperSelected
    ? undefined
    : (pets.find((pet) => pet.id === selectedId) ?? urgent[0] ?? pets[0]);

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
          {snapshot.configError && (
            <p className="tray__error">
              Config problem: {snapshot.configError}
            </p>
          )}
          {showSetup ? (
            <Setup
              snapshot={snapshot}
              onDone={() => setSetup(false)}
              onTyping={setTyping}
            />
          ) : (
            <>
              <div className="steamer">
                {pets.map((pet) => (
                  <button
                    key={pet.id}
                    className={
                      pet.id === selected?.id
                        ? "steamer__pet steamer__pet--selected"
                        : "steamer__pet"
                    }
                    onClick={() => setSelectedId(pet.id)}
                    aria-label={`${pet.name}: ${pet.headline}`}
                  >
                    <Dumpling
                      kind={pet.kind}
                      color={pet.color}
                      mood={pet.mood}
                      heat={pet.heat}
                    />
                    <span className="steamer__name">{pet.name}</span>
                  </button>
                ))}
                <span className="steamer__divider" aria-hidden="true" />
                <button
                  className={
                    helperSelected
                      ? "steamer__pet steamer__pet--selected"
                      : "steamer__pet"
                  }
                  onClick={() => setSelectedId(HELPER_ID)}
                  aria-label={`${helper.name}: ${helper.headline}`}
                >
                  <Dumpling
                    kind={helper.kind}
                    color={helper.color}
                    mood={helper.mood}
                    heat={0}
                  />
                  <span className="steamer__name">{helper.name}</span>
                </button>
              </div>
              {helperSelected && (
                <HelperPanel
                  helper={helper}
                  pets={pets}
                  tips={snapshot.tips}
                  onTyping={setTyping}
                />
              )}
              {selected && (
                <PetPanel
                  key={selected.id}
                  pet={selected}
                  onTyping={setTyping}
                />
              )}
              <button className="tray__settings" onClick={() => setSetup(true)}>
                Settings
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
