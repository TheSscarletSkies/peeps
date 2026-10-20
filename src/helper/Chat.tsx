import { useEffect, useRef, useState } from "react";

import { decide, newChat, sendChat } from "../lib/bridge";
import type { ChatMessage, Helper } from "../lib/types";
import { Attachments } from "../life/Attachments";
import { useGivenFiles, withFiles } from "../life/drops";
import { Dumpling } from "../pets/Dumpling";

const STARTERS = [
  "What's on today?",
  "Plan my week around classes",
  "Draft a reply to Funderly sign-ups",
];

/** Talks to the user's own agent through the helper. Tool requests come back here for a yes or no. */
export function Chat({
  helper,
  onTyping,
}: {
  helper: Helper;
  onTyping: (typing: boolean) => void;
}) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState<ChatMessage[]>([]);
  const [waiting, setWaiting] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  useGivenFiles("helper", (paths) =>
    setFiles((now) => [...now, ...paths.filter((path) => !now.includes(path))]),
  );
  const list = useRef<HTMLOListElement>(null);
  const permission = helper.permission;

  // The app echoes messages back in its snapshot; local copies only bridge the gap.
  useEffect(() => setPending([]), [helper.chat.length]);

  const messages = [...helper.chat, ...pending];
  const thinking = waiting || helper.chatting;

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [messages.length, thinking]);

  const send = async (message: string) => {
    const trimmed = withFiles(message, files);
    if (!trimmed || thinking) return;
    setText("");
    setFiles([]);
    setWaiting(true);
    setPending((now) => [
      ...now,
      {
        id: -Date.now(),
        from: "you",
        text: trimmed,
        at: new Date().toISOString(),
      },
    ]);
    try {
      const reply = await sendChat(trimmed);
      setPending((now) => [...now, reply]);
    } catch (error) {
      setPending((now) => [
        ...now,
        {
          id: -Date.now(),
          from: "helper",
          text: String(error),
          at: new Date().toISOString(),
        },
      ]);
    } finally {
      setWaiting(false);
    }
  };

  return (
    <div className="chat">
      {messages.length === 0 ? (
        <div className="chat__empty">
          <p className="setup__hint">
            Ask anything. I use your own Claude, with your connectors, and check
            with you before doing anything that leaves your computer.
          </p>
          <div className="chat__starters">
            {STARTERS.map((starter) => (
              <button
                key={starter}
                className="chip"
                onClick={() => void send(starter)}
              >
                {starter}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <ol className="chat__list" ref={list} aria-live="polite">
          {messages.map((message) => (
            <li
              key={message.id}
              className="chat__message"
              data-from={message.from}
            >
              {message.from === "helper" && (
                <Dumpling
                  kind={helper.kind}
                  color={helper.color}
                  mood="chill"
                  heat={0}
                  size={26}
                />
              )}
              <p>{message.text}</p>
            </li>
          ))}
          {thinking && (
            <li className="chat__message" data-from="helper">
              <Dumpling
                kind={helper.kind}
                color={helper.color}
                mood="working"
                heat={0}
                size={26}
              />
              <p className="chat__dots" aria-label="Thinking">
                <span />
                <span />
                <span />
              </p>
            </li>
          )}
        </ol>
      )}

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

      <form
        className="chat__compose"
        onSubmit={(event) => {
          event.preventDefault();
          void send(text);
        }}
      >
        <label className="visually-hidden" htmlFor="chat-text">
          Message {helper.name}
        </label>
        <textarea
          id="chat-text"
          rows={1}
          value={text}
          placeholder={`Ask ${helper.name}…`}
          onChange={(event) => setText(event.target.value)}
          onFocus={() => onTyping(true)}
          onBlur={() => onTyping(false)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send(text);
            }
          }}
        />
        <button
          className="button button--primary"
          type="submit"
          disabled={(!text.trim() && files.length === 0) || thinking}
        >
          Send
        </button>
      </form>
      <Attachments
        paths={files}
        onRemove={(path) => setFiles((now) => now.filter((p) => p !== path))}
      />
      {messages.length > 0 && (
        <button
          className="tray__link chat__new"
          onClick={() => {
            setPending([]);
            void newChat();
          }}
        >
          New chat
        </button>
      )}
    </div>
  );
}
