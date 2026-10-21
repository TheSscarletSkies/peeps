import { useEffect, useState } from "react";

import { readProfile, writeProfile } from "../lib/bridge";

/** The user's About me page: what every conversation in peeps knows about them. */
export function AboutMe() {
  const [text, setText] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void readProfile().then((profile) => {
      if (live) setText(profile);
    });
    return () => {
      live = false;
    };
  }, []);

  if (text === null) return null;

  return (
    <div className="brief">
      <p className="setup__hint">
        Who you are, what you're building and how you like things done. Your
        helper, every pet and every teammate read this. The helper adds to it
        when you tell it something worth remembering.
      </p>
      <label className="visually-hidden" htmlFor="about-me">
        About me
      </label>
      <textarea
        id="about-me"
        className="brief__text"
        value={text}
        spellCheck
        onChange={(event) => {
          setText(event.target.value);
          setSaved(false);
        }}
      />
      <div className="todo-form__actions">
        <button
          className="button button--primary"
          disabled={saved}
          onClick={() =>
            void writeProfile(text)
              .then(() => setSaved(true))
              .catch((reason) => setError(String(reason)))
          }
        >
          {saved ? "Saved" : "Save"}
        </button>
      </div>
      {error && <p className="tray__error">{error}</p>}
    </div>
  );
}
