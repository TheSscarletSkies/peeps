import type { Focus, Friends, Helper } from "../lib/types";
import { LivePet } from "../life/LivePet";
import { moodWith } from "../focus/clock";
import { Dumpling } from "../pets/Dumpling";
import { DeskScene, MAX_SEATS } from "./DeskScene";
import { friendLook } from "./look";

/** Your peep on its steamer, or, while friends are focusing, everyone around one low table. */
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
    .slice(0, MAX_SEATS - 1);
  const mine = (size: number, seated = false) => (
    <LivePet
      seated={seated}
      dropId="helper"
      kind={helper.kind}
      color={helper.color}
      mood={moodWith(helper.mood, focus)}
      heat={0}
      size={size}
      chatty
      glasses={focus?.phase === "focus" || studying.length > 0}
    />
  );

  if (studying.length > 0)
    return (
      <div className="hero__table">
        <DeskScene
          seats={[
            {
              key: "you",
              name: you,
              pet: (size: number) => mine(size, true),
            },
            ...studying.map((friend) => {
              const look = friendLook(friend.code);
              return {
                key: friend.code,
                name: friend.name,
                pet: (size: number) => (
                  <Dumpling
                    seated
                    kind={look.kind}
                    seed={friend.code}
                    color={look.color}
                    mood="working"
                    heat={0}
                    size={size}
                    glasses
                    wear={look.wear}
                  />
                ),
              };
            }),
          ]}
        />
      </div>
    );

  return (
    <div className="hero__steamer" style={{ width: 200 }}>
      <div className="hero__pets">{mine(96)}</div>
      <div className="hero__basket" />
    </div>
  );
}
