import { useState } from "react";

import { tagStyle } from "../helper/HelperPanel";
import { setAreas } from "../lib/bridge";

/** The parts of life to-dos are grouped into. Each is a tag, so "#gym" lands under Gym. */
export function AreasEditor({ areas }: { areas: string[] }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const save = (next: string[]) => {
    setError(null);
    setAreas(next).catch((reason: unknown) => setError(String(reason)));
  };

  return (
    <div className="areas">
      <ul className="areas__list" aria-label="Your areas">
        {areas.map((area) => (
          <li key={area} className="chip area-chip" style={tagStyle(area)}>
            #{area}
            <button
              aria-label={`Remove ${area}`}
              title="Remove"
              onClick={() => save(areas.filter((a) => a !== area))}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <form
        className="feed"
        onSubmit={(event) => {
          event.preventDefault();
          if (!text.trim()) return;
          save([...areas, text]);
          setText("");
        }}
      >
        <label className="visually-hidden" htmlFor="new-area">
          New area
        </label>
        <input
          id="new-area"
          value={text}
          placeholder="Add an area, like gym or side project"
          onChange={(event) => setText(event.target.value)}
        />
        <button className="button" type="submit" disabled={!text.trim()}>
          Add
        </button>
      </form>
      {error && <p className="tray__error">{error}</p>}
    </div>
  );
}
