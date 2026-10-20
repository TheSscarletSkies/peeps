import { useState } from "react";

import { Attachments } from "../life/Attachments";
import { useGivenFiles, withFiles } from "../life/drops";
import { announceFed } from "../life/events";
import { addNote, decide } from "../lib/bridge";
import type {
  Delivery,
  Helper,
  Pet,
  ProductChat,
  ProductNumbers,
  Role,
  Teammate,
} from "../lib/types";
import { TeamPanel } from "../team/TeamPanel";
import { NumbersStrip } from "../numbers/NumbersStrip";
import { Conversation } from "../helper/Chat";
import { BriefEditor } from "./BriefEditor";
import { ReviewToggle } from "./ReviewToggle";

interface Props {
  pet: Pet;
  /** The pet's conversation, when it has one. */
  chat?: ProductChat;
  /** Holds the model and effort the agent uses. */
  helper: Helper;
  numbers?: ProductNumbers;
  team?: Teammate[];
  roles?: Role[];
  onTyping: (typing: boolean) => void;
}

type Tab = "note" | "ask" | "team" | "brief";

const STARTERS = [
  "What should I focus on this week?",
  "Where are we losing people?",
  "Plan the next three posts",
];

export function PetPanel({
  pet,
  chat,
  helper,
  numbers,
  team = [],
  roles = [],
  onTyping,
}: Props) {
  const [tab, setTab] = useState<Tab>("note");
  const [text, setText] = useState("");
  const [delivery, setDelivery] = useState<Delivery>("nextSession");
  const [status, setStatus] = useState<string | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  useGivenFiles(pet.id, (paths) => {
    setTab("note");
    setFiles((now) => [...now, ...paths.filter((path) => !now.includes(path))]);
  });

  const permission = pet.permission;
  const ready = text.trim() !== "" || files.length > 0;

  const feed = async () => {
    if (!ready) return;
    try {
      await addNote(pet.id, withFiles(text, files), delivery);
      announceFed(pet.id);
      setText("");
      setFiles([]);
      setStatus(
        delivery === "nextSession"
          ? `${pet.name} reads this when its next session starts.`
          : `${pet.name} reads this after its next step.`,
      );
    } catch (error) {
      setStatus(String(error));
    }
  };

  return (
    <section className="panel" aria-label={pet.name}>
      <header className="panel__head">
        <span className="panel__name">{pet.name}</span>
        <span className="panel__headline">{pet.headline}</span>
      </header>
      <NumbersStrip productId={pet.id} name={pet.name} numbers={numbers} />

      {permission && (
        <div className="panel__permission">
          <code>{permission.summary}</code>
          <div className="panel__actions">
            <button
              className="button button--primary"
              onClick={() => decide(permission.requestId, "allow")}
            >
              Allow
            </button>
            <button
              className="button"
              onClick={() => decide(permission.requestId, "deny")}
            >
              Deny
            </button>
          </div>
        </div>
      )}

      {pet.needs.length > 0 && (
        <ul className="panel__needs">
          {pet.needs.map((need) => (
            <li key={need.checkId} data-signal={need.signal}>
              {need.message}
            </li>
          ))}
        </ul>
      )}

      <div className="tabs" role="tablist" aria-label={pet.name}>
        {(
          [
            ["note", "Note"],
            ["ask", "Ask"],
            ["team", team.length > 0 ? `Team ${team.length}` : "Team"],
            ["brief", "Brief"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "chip chip--on" : "chip"}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "note" && (
        <>
          <form
            className="feed"
            onSubmit={(event) => {
              event.preventDefault();
              void feed();
            }}
          >
            <label className="visually-hidden" htmlFor={`note-${pet.id}`}>
              Note for {pet.name}
            </label>
            <input
              id={`note-${pet.id}`}
              value={text}
              placeholder={
                files.length > 0
                  ? "What should it do with these?"
                  : `Leave ${pet.name} a note`
              }
              onChange={(event) => setText(event.target.value)}
              onFocus={() => onTyping(true)}
              onBlur={() => onTyping(false)}
            />
            <select
              aria-label="When to deliver"
              value={delivery}
              onChange={(event) => setDelivery(event.target.value as Delivery)}
            >
              <option value="nextSession">Next session</option>
              <option value="nextStep">Next step</option>
            </select>
            <button
              className="button button--primary"
              type="submit"
              disabled={!ready}
            >
              Feed
            </button>
          </form>
          <Attachments
            paths={files}
            onRemove={(path) =>
              setFiles((now) => now.filter((p) => p !== path))
            }
          />
          {status && <p className="panel__status">{status}</p>}
        </>
      )}
      {tab === "ask" && <ReviewToggle pet={pet} helper={helper} />}
      {tab === "ask" && (
        <Conversation
          scope={pet.id}
          name={pet.name}
          kind={pet.kind}
          color={pet.color}
          seed={pet.id}
          messages={chat?.messages ?? []}
          chatting={chat?.chatting ?? false}
          permission={null}
          starters={STARTERS}
          intro={`Think it through with ${pet.name}. It knows the brief and how things are going, can read the project, and turns what you agree on into to-dos.`}
          agent={helper}
          onTyping={onTyping}
        />
      )}
      {tab === "team" && (
        <TeamPanel
          pet={pet}
          team={team}
          roles={roles}
          helper={helper}
          onTyping={onTyping}
        />
      )}
      {tab === "brief" && <BriefEditor pet={pet} onTyping={onTyping} />}
    </section>
  );
}
