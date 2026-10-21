import { setTodoDone } from "../lib/bridge";
import type { Helper, Nudge } from "../lib/types";
import { announceFed } from "../life/events";
import { LivePet } from "../life/LivePet";

/** The helper waving with a reminder in a speech bubble, ticked off or put off in one tap. */
export function NudgeCard({
  nudge,
  helper,
  onDone,
  onLater,
}: {
  nudge: Nudge;
  helper: Helper;
  onDone: () => void;
  onLater: () => void;
}) {
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
        <p className="nudge__title">{nudge.title}</p>
        {nudge.body && <p className="nudge__body">{nudge.body}</p>}
        <div className="nudge__actions">
          <button className="button button--small" onClick={onLater}>
            Later
          </button>
          <button
            className="button button--small button--primary"
            onClick={done}
          >
            {nudge.todoId !== null ? "Done" : "Got it"}
          </button>
        </div>
      </div>
    </section>
  );
}
