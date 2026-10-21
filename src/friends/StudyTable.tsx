import type { Focus, Friends, Helper } from "../lib/types";
import { LivePet } from "../life/LivePet";
import { moodWith } from "../focus/clock";
import { Dumpling } from "../pets/Dumpling";
import { friendLook } from "./look";

const SEATS = 5;

/** Your peep at the table, and a seat for every friend focusing right now, each with a name tag. */
export function StudyTable({
  helper,
  focus,
  friends,
  you,
}: {
  helper: Helper;
  focus: Focus | null;
  friends: Friends | null;
  you: string;
}) {
  const studying = (friends?.friends ?? [])
    .filter((friend) => friend.presence === "focusing")
    .slice(0, SEATS - 1);
  const seats = studying.length + 1;

  return (
    <div
      className="hero__steamer"
      style={{ width: Math.min(460, 150 + seats * 70) }}
      aria-label={
        studying.length > 0
          ? `At the table: you, ${studying.map((f) => f.name).join(", ")}`
          : undefined
      }
    >
      <div className="hero__pets">
        <span className="seat">
          <LivePet
            dropId="helper"
            kind={helper.kind}
            color={helper.color}
            mood={moodWith(helper.mood, focus)}
            heat={0}
            size={studying.length > 0 ? 80 : 96}
            chatty
          />
          {studying.length > 0 && <span className="seat__tag">{you}</span>}
        </span>
        {studying.map((friend) => {
          const look = friendLook(friend.code);
          return (
            <span key={friend.code} className="seat seat--friend">
              <Dumpling
                kind={look.kind}
                seed={friend.code}
                color={look.color}
                mood="working"
                heat={0}
                size={64}
              />
              <span className="seat__tag">{friend.name}</span>
            </span>
          );
        })}
      </div>
      <div className="hero__basket" />
    </div>
  );
}
