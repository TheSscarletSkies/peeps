import type { Focus, Friends, Helper, PeepWear } from "../lib/types";
import { LivePet } from "../life/LivePet";
import { moodWith } from "../focus/clock";
import { DeskScene, MAX_SEATS } from "./DeskScene";
import { friendLook, worn } from "./look";

/** Your peep on its steamer, or, while friends are focusing, everyone around one low table. */
export function StudyTable({
  helper,
  focus,
  friends,
  you,
  wear,
}: {
  helper: Helper;
  focus: Focus | null;
  friends: Friends | null;
  you: string;
  wear: PeepWear;
}) {
  const studying = (friends?.friends ?? [])
    .filter((friend) => friend.presence === "focusing")
    .slice(0, MAX_SEATS - 1);
  const mine = (size: number) => (
    <LivePet
      dropId="helper"
      kind={helper.kind}
      color={helper.color}
      mood={moodWith(helper.mood, focus)}
      heat={0}
      size={size}
      wear={worn(wear)}
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
              wear: worn(wear),
              petId: "helper",
              pattable: true,
            },
            ...studying.map((friend) => ({
              key: friend.code,
              name: friend.name,
              wear: friendLook(friend.code, friend.wear).wear,
            })),
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
