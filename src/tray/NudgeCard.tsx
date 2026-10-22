import { useState } from "react";

import { Sticker } from "../friends/ReactionArt";
import { setTodoDone } from "../lib/bridge";
import type { Helper, Nudge } from "../lib/types";
import { GET_TO_KNOW } from "../helper/Chat";
import { announceAsk, announceFed } from "../life/events";
import { LivePet } from "../life/LivePet";
import { LATER, stickerFor, withoutEmoji } from "./nudgeArt";

/** The helper waving with a reminder in a speech bubble: done, put off for a while, or closed. */
export function NudgeCard({
  nudge,
  helper,
  onDone,
  onLater,
  onClose,
}: {
  nudge: Nudge;
  helper: Helper;
  onDone: () => void;
  onLater: (minutes: number) => void;
  onClose: () => void;
}) {
  const [choosing, setChoosing] = useState(false);
  const chat = () => {
    onDone();
    announceAsk(GET_TO_KNOW);
  };
  const done = () => {
    if (nudge.todoId !== null) {
      void setTodoDone(nudge.todoId, true);
      announceFed("helper");
    }
    onDone();
  };

  return (
    <section className="nudge" aria-label="Reminder" role="alert">
      <LivePet
        dropId="helper"
        kind={helper.kind}
        color={helper.color}
        mood="chill"
        heat={0}
        size={64}
        waving
      />
      <div className="nudge__bubble">
        <button
          className="nudge__close"
          aria-label="Close reminder"
          title="Close"
          onClick={onClose}
        >
          <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2 2l8 8M10 2l-8 8" />
          </svg>
        </button>
        <div className="nudge__head">
          <svg className="nudge__art" viewBox="0 0 40 40" aria-hidden="true">
            <Sticker kind={stickerFor(nudge.title)} />
          </svg>
          <p className="nudge__title">{withoutEmoji(nudge.title)}</p>
        </div>
        {nudge.body && (
          <p className="nudge__body">{withoutEmoji(nudge.body)}</p>
        )}
        <div className="nudge__actions">
          {choosing ? (
            <span
              className="nudge__later"
              role="group"
              aria-label="Remind me in"
            >
              {LATER.map((option) => (
                <button
                  key={option.minutes}
                  className="button button--small"
                  onClick={() => onLater(option.minutes)}
                >
                  {option.label}
                </button>
              ))}
            </span>
          ) : (
            <button
              className="button button--small"
              onClick={() => setChoosing(true)}
            >
              Later
            </button>
          )}
          {!choosing && (
            <button
              className="button button--small button--primary"
              onClick={nudge.action === "chat" ? chat : done}
            >
              {nudge.action === "chat" ? "Let's chat" : null}
              {nudge.action === "chat"
                ? null
                : nudge.todoId !== null
                  ? "Done"
                  : "Got it"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
