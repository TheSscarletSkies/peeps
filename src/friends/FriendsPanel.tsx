import { useEffect, useState } from "react";

import { addFriend, react, removeFriend, startFriends } from "../lib/bridge";
import type { FriendView, Friends, Reaction } from "../lib/types";
import { Dumpling } from "../pets/Dumpling";
import { friendLook, presenceLine } from "./look";
import { Sticker } from "./ReactionArt";

const REACTIONS: { id: Reaction; label: string }[] = [
  { id: "heart", label: "Send a heart" },
  { id: "poke", label: "Poke with chopsticks" },
  { id: "bonk", label: "Bonk with a rolling pin" },
  { id: "study", label: "Save them a seat to study" },
  { id: "tea", label: "Tea break?" },
];

/** Your code, your friends' peeps and what they are up to, and something to send each. */
export function FriendsPanel({
  friends,
  helperName,
}: {
  friends: Friends | null;
  helperName: string;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const run = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
    } catch (reason) {
      setError(String(reason));
    }
  };

  if (!friends) {
    return (
      <form
        className="helper-tab friends"
        onSubmit={(event) => {
          event.preventDefault();
          void run(() => startFriends(name));
        }}
      >
        <p className="setup__hint">
          Connect with friends using a code. You'll see when they're focusing,
          and you can send each other hearts, pokes and bonks. Only your name
          and whether you're focusing are shared.
        </p>
        <label className="visually-hidden" htmlFor="friends-name">
          Your name
        </label>
        <div className="feed">
          <input
            id="friends-name"
            value={name}
            placeholder="What should friends see you as?"
            onChange={(event) => setName(event.target.value)}
          />
          <button
            className="button button--primary"
            type="submit"
            disabled={!name.trim()}
          >
            Get my code
          </button>
        </div>
        {error && <p className="tray__error">{error}</p>}
      </form>
    );
  }

  const send = (friend: FriendView, reaction: (typeof REACTIONS)[number]) =>
    void run(async () => {
      await react(friend.code, reaction.id);
      setSent(`Sent to ${friend.name}`);
      window.setTimeout(() => setSent(null), 2000);
    });

  return (
    <div className="helper-tab friends">
      <div className="friends__code">
        <span>
          <strong>Your code</strong>
          Send it to a friend; they add it on their peeps.
        </span>
        <code>{friends.code}</code>
        <button
          className="button button--small"
          onClick={() =>
            void navigator.clipboard
              .writeText(friends.code)
              .then(() => setCopied(true))
          }
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {friends.friends.length === 0 ? (
        <p className="setup__hint">
          No friends yet. When one adds your code, they show up here, and{" "}
          {helperName} tells you.
        </p>
      ) : (
        <ul className="friends__list" aria-label="Friends">
          {friends.friends.map((friend) => {
            const look = friendLook(friend.code);
            return (
              <li key={friend.code} data-presence={friend.presence}>
                <Dumpling
                  kind={look.kind}
                  seed={friend.code}
                  color={look.color}
                  mood={
                    friend.presence === "focusing"
                      ? "working"
                      : friend.presence === "away"
                        ? "stalled"
                        : "chill"
                  }
                  heat={0}
                  size={36}
                />
                <span className="friends__who">
                  <strong>{friend.name}</strong>
                  {presenceLine(friend.presence, friend.focusUntil, now)}
                </span>
                <span className="friends__send">
                  {REACTIONS.map((reaction) => (
                    <button
                      key={reaction.id}
                      className="friends__react"
                      aria-label={`${reaction.label} to ${friend.name}`}
                      title={reaction.label}
                      onClick={() => send(friend, reaction)}
                    >
                      <svg viewBox="0 0 40 40" aria-hidden="true">
                        <Sticker kind={reaction.id} />
                      </svg>
                    </button>
                  ))}
                  <button
                    className="friends__react friends__remove"
                    aria-label={`Remove ${friend.name}`}
                    title="Remove"
                    onClick={() => void run(() => removeFriend(friend.code))}
                  >
                    <svg viewBox="0 0 20 20" aria-hidden="true">
                      <path d="M6 6l8 8M14 6l-8 8" strokeWidth="1.6" />
                    </svg>
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {sent && (
        <p className="setup__ok" role="status">
          {sent}
        </p>
      )}

      <form
        className="feed"
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            await addFriend(code);
            setCode("");
          });
        }}
      >
        <label className="visually-hidden" htmlFor="friend-code">
          Friend's code
        </label>
        <input
          id="friend-code"
          value={code}
          placeholder="A friend's code, like 7KQ2M-XH4PD"
          onChange={(event) => setCode(event.target.value)}
        />
        <button className="button" type="submit" disabled={!code.trim()}>
          Add
        </button>
      </form>
      {error && <p className="tray__error">{error}</p>}
    </div>
  );
}
