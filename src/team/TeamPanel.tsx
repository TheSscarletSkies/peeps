import { useEffect, useState } from "react";

import { Conversation } from "../helper/Chat";
import { scheduleLabel } from "../helper/when";
import {
  addSchedule,
  addTeammate,
  deleteSchedule,
  readPlaybook,
  removeTeammate,
  runTeammate,
  writePlaybook,
} from "../lib/bridge";
import type { Helper, Pet, Role, Teammate } from "../lib/types";
import { Dumpling } from "../pets/Dumpling";
import { firstShift, kindFor, lastWord, openRoles } from "./team";

interface Props {
  pet: Pet;
  team: Teammate[];
  roles: Role[];
  helper: Helper;
  onTyping: (typing: boolean) => void;
}

/** A product's team: who is on it, what each last reported, and room to add someone. */
export function TeamPanel({ pet, team, roles, helper, onTyping }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(team.length === 0);
  const opened = team.find((teammate) => teammate.id === open);

  if (opened)
    return (
      <TeammateView
        pet={pet}
        teammate={opened}
        role={roles.find((role) => role.id === opened.role)}
        helper={helper}
        onTyping={onTyping}
        onBack={() => setOpen(null)}
      />
    );

  return (
    <div className="team">
      {team.length > 0 && (
        <ul className="team__list" aria-label={`${pet.name} team`}>
          {team.map((teammate) => (
            <li key={teammate.id}>
              <button
                className="team__member"
                onClick={() => setOpen(teammate.id)}
              >
                <Dumpling
                  kind={kindFor(teammate.role)}
                  color={pet.color}
                  mood={teammate.chatting ? "working" : "chill"}
                  heat={0}
                  size={34}
                  seed={teammate.scope}
                />
                <span className="team__who">
                  <strong>{teammate.name}</strong>
                  <span>
                    {teammate.title} ·{" "}
                    {teammate.chatting
                      ? "working now"
                      : teammate.schedule
                        ? scheduleLabel(teammate.schedule)
                        : "paused"}
                  </span>
                  {lastWord(teammate) && (
                    <span className="team__last">{lastWord(teammate)}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <AddTeammate
          pet={pet}
          roles={openRoles(roles, team)}
          onDone={(id) => {
            setAdding(false);
            if (id) setOpen(id);
          }}
          canCancel={team.length > 0}
        />
      ) : (
        <button className="button" onClick={() => setAdding(true)}>
          Add a teammate
        </button>
      )}
    </div>
  );
}

function AddTeammate({
  pet,
  roles,
  canCancel,
  onDone,
}: {
  pet: Pet;
  roles: Role[];
  canCancel: boolean;
  onDone: (id: string | null) => void;
}) {
  const [role, setRole] = useState(roles[0]?.id ?? "custom");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const chosen = roles.find((candidate) => candidate.id === role);

  const add = async () => {
    try {
      onDone(await addTeammate(pet.id, role, name));
    } catch (reason) {
      setError(String(reason));
    }
  };

  return (
    <form
      className="team__add"
      aria-label={`Add a teammate to ${pet.name}`}
      onSubmit={(event) => {
        event.preventDefault();
        void add();
      }}
    >
      <p className="setup__hint">
        Teammates work on a rhythm through your own Claude, from a playbook you
        can edit. They draft and suggest; nothing goes out without you.
      </p>
      <div className="team__roles" role="radiogroup" aria-label="Role">
        {roles.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            role="radio"
            aria-checked={role === candidate.id}
            className="team__role"
            onClick={() => setRole(candidate.id)}
          >
            <strong>{candidate.title}</strong>
            <span>{candidate.summary}</span>
          </button>
        ))}
      </div>
      <div className="feed">
        <label className="visually-hidden" htmlFor={`teammate-name-${pet.id}`}>
          Name
        </label>
        <input
          id={`teammate-name-${pet.id}`}
          value={name}
          placeholder={chosen ? `Name (or ${chosen.name})` : "Name"}
          onChange={(event) => setName(event.target.value)}
        />
        <button className="button button--primary" type="submit">
          Add {name.trim() || chosen?.name || "teammate"}
        </button>
      </div>
      {canCancel && (
        <button
          type="button"
          className="tray__link"
          onClick={() => onDone(null)}
        >
          Cancel
        </button>
      )}
      {error && <p className="tray__error">{error}</p>}
    </form>
  );
}

function TeammateView({
  pet,
  teammate,
  role,
  helper,
  onTyping,
  onBack,
}: {
  pet: Pet;
  teammate: Teammate;
  role: Role | undefined;
  helper: Helper;
  onTyping: (typing: boolean) => void;
  onBack: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const run = async () => {
    setStatus(`${teammate.name} is on it. The report lands here.`);
    try {
      await runTeammate(pet.id, teammate.id);
    } catch (reason) {
      setStatus(String(reason));
    }
  };

  const toggleRhythm = async () => {
    try {
      if (teammate.schedule) {
        await deleteSchedule(teammate.schedule.id);
        return;
      }
      const time = role?.time ?? "09:00";
      await addSchedule({
        kind: "teammate",
        topic: teammate.scope,
        repeat: role?.repeat ?? "weekly",
        start: firstShift(time, new Date()),
        time,
      });
    } catch (reason) {
      setStatus(String(reason));
    }
  };

  const remove = async () => {
    await removeTeammate(pet.id, teammate.id);
    onBack();
  };

  return (
    <div className="team">
      <div className="team__bar">
        <button className="tray__link" onClick={onBack}>
          ← Team
        </button>
        <span className="team__rhythm">
          {teammate.schedule ? scheduleLabel(teammate.schedule) : "Paused"}
        </span>
        <button
          className={teammate.schedule ? "chip chip--on" : "chip"}
          role="switch"
          aria-checked={Boolean(teammate.schedule)}
          aria-label={`${teammate.name} works on a rhythm`}
          onClick={() => void toggleRhythm()}
        >
          {teammate.schedule ? "On" : "Off"}
        </button>
      </div>
      <div className="team__actions">
        <button
          className="button button--small"
          disabled={teammate.chatting}
          onClick={() => void run()}
        >
          {teammate.chatting ? "Working…" : "Run a shift now"}
        </button>
        <button
          className="button button--small"
          aria-expanded={editing}
          onClick={() => setEditing(!editing)}
        >
          Playbook
        </button>
        <button className="button button--small" onClick={() => void remove()}>
          Remove
        </button>
      </div>
      {status && <p className="panel__status">{status}</p>}
      {editing ? (
        <Playbook
          pet={pet}
          teammate={teammate}
          fallback={role?.playbook ?? ""}
          onTyping={onTyping}
        />
      ) : (
        <Conversation
          scope={teammate.scope}
          name={teammate.name}
          kind={kindFor(teammate.role)}
          color={pet.color}
          seed={teammate.scope}
          messages={teammate.messages}
          chatting={teammate.chatting}
          permission={null}
          starters={[
            "Run your shift now",
            "What do you need from me?",
            "What would you change in your playbook?",
          ]}
          intro={`${teammate.name} is ${pet.name}'s ${teammate.title.toLowerCase()}. Shift reports land here, and you can talk to ${teammate.name} any time.`}
          agent={helper}
          onTyping={onTyping}
        />
      )}
    </div>
  );
}

function Playbook({
  pet,
  teammate,
  fallback,
  onTyping,
}: {
  pet: Pet;
  teammate: Teammate;
  fallback: string;
  onTyping: (typing: boolean) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void readPlaybook(pet.id, teammate.id, fallback).then((playbook) => {
      if (live) setText(playbook);
    });
    return () => {
      live = false;
    };
  }, [pet.id, teammate.id, fallback]);

  if (text === null) return <p className="setup__hint">Opening…</p>;

  return (
    <div className="brief">
      <p className="setup__hint">
        What {teammate.name} owns, what to do each shift, and the rules. Written
        in plain words; {teammate.name} follows it every time.
      </p>
      <label className="visually-hidden" htmlFor={`playbook-${teammate.scope}`}>
        {teammate.name} playbook
      </label>
      <textarea
        id={`playbook-${teammate.scope}`}
        className="brief__text"
        value={text}
        spellCheck
        onChange={(event) => {
          setText(event.target.value);
          setSaved(false);
        }}
        onFocus={() => onTyping(true)}
        onBlur={() => onTyping(false)}
      />
      <div className="todo-form__actions">
        <button
          className="button button--primary"
          disabled={saved}
          onClick={() =>
            void writePlaybook(pet.id, teammate.id, text)
              .then(() => setSaved(true))
              .catch((reason) => setError(String(reason)))
          }
        >
          {saved ? "Saved" : "Save playbook"}
        </button>
      </div>
      {error && <p className="tray__error">{error}</p>}
    </div>
  );
}
