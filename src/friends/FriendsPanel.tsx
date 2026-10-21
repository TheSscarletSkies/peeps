import { useEffect, useState } from "react";

import { addFriend, react, removeFriend, startFriends } from "../lib/bridge";
import type { FriendView, Friends, Reaction } from "../lib/types";
import { Dumpling } from "../pets/Dumpling";
import { friendLook, presenceLine } from "./look";

const REACTIONS: { id: Reaction; label: string; icon: JSX.Element }[] = [
  {
    id: "heart",
    label: "Send a steamy heart",
    icon: (
      <path d="M10 6.5c-1.6-1.6-4.3-.7-3.9 1.4.3 1.8 3.9 3.9 3.9 3.9s3.6-2.1 3.9-3.9c.4-2.1-2.3-3-3.9-1.4z" />
    ),
  },
  {
    id: "poke",
    label: "Poke with chopsticks",
    icon: <path d="M15 3L6 12M17 5l-9 9" strokeWidth="1.6" fill="none" />,
  },
  {
    id: "bonk",
    label: "Bonk with a rolling pin",
    icon: (
      <>
        <rect x="5" y="7" width="10" height="5" rx="2.5" />
        <path d="M2.5 9.5h2.5M15 9.5h2.5" strokeWidth="1.6" />
      </>
    ),
  },
  {
    id: "study",
    label: "Save them a seat to study",
    icon: (
      <>
        <path d="M3 5.5l7 2 7-2v9l-7 2-7-2z" />
        <path d="M10 7.5v9" strokeWidth="1.2" stroke="var(--surface)" />
      </>
    ),
  },
  {
    id: "tea",
    label: "Tea break?",
    icon: (
      <>
        <path d="M5 8h9v2a4.5 4.5 0 0 1-9 0z" />
        <path d="M14 9a2 2 0 0 1 0 3" strokeWidth="1.4" fill="none" />
        <path
          d="M7.5 6.5c-.6-.8.6-1.2 0-2M10.5 6.5c-.6-.8.6-1.2 0-2"
          strokeWidth="1.2"
          fill="none"
        />
      </>
    ),
  },
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
                      <svg viewBox="0 0 20 20" aria-hidden="true">
                        {reaction.icon}
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
