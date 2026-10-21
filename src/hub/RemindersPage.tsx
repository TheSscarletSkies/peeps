import { useEffect, useState } from "react";

import { REMINDERS } from "../helper/todoForm";
import { Upcoming } from "../helper/Upcoming";
import { addCalendar, removeCalendar, setReminders } from "../lib/bridge";
import { Info } from "../lib/Info";
import { Select } from "../lib/Select";
import type { ReminderRule, Snapshot } from "../lib/types";

const LEADS = REMINDERS.filter((option) => option.minutes !== null);

const PROVIDERS = [
  {
    name: "Google Calendar",
    steps:
      "Settings → pick the calendar under “Settings for my calendars” → Integrate calendar → copy “Secret address in iCal format”. Do this for your college account too.",
  },
  {
    name: "Outlook",
    steps:
      "Settings → Calendar → Shared calendars → Publish a calendar → choose the calendar and “Can view all details” → Publish → copy the ICS link.",
  },
  {
    name: "iCloud",
    steps:
      "In the Calendar app, Control-click the calendar → Share Calendar → tick Public Calendar → copy the link. Anyone with this link can see the calendar.",
  },
];

function LeadSelect({
  id,
  value,
  onChange,
  allowDefault,
}: {
  id: string;
  value: number | null;
  onChange: (minutes: number | null) => void;
  allowDefault?: boolean;
}) {
  return (
    <Select
      id={id}
      value={value === null ? "" : String(value)}
      onChange={(next) => onChange(next === "" ? null : Number(next))}
      options={[
        ...(allowDefault ? [{ value: "", label: "Default lead" }] : []),
        ...LEADS.map((option) => ({
          value: String(option.minutes),
          label: option.label,
        })),
      ]}
    />
  );
}

export function RemindersPage({ snapshot }: { snapshot: Snapshot }) {
  const { calendars, reminders } = snapshot;
  const [name, setName] = useState("");
  const [link, setLink] = useState("");
  const [lead, setLead] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rules, setRules] = useState<ReminderRule[]>(reminders.rules);
  const [fallback, setFallback] = useState(reminders.defaultMinutes);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setRules(reminders.rules);
    setFallback(reminders.defaultMinutes);
  }, [reminders]);

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      await addCalendar(name, link, lead);
      setName("");
      setLink("");
      setLead(null);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy(false);
    }
  };

  const save = async (next: ReminderRule[], minutes: number) => {
    setError(null);
    try {
      await setReminders({ defaultMinutes: minutes, rules: next });
      setSaved(true);
    } catch (reason) {
      setError(String(reason));
    }
  };

  const changeRule = (index: number, patch: Partial<ReminderRule>) => {
    setSaved(false);
    setRules(
      rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)),
    );
  };

  return (
    <div className="reminders">
      <section className="card">
        <h2>Coming up</h2>
        {snapshot.helper.upcoming.length === 0 ? (
          <p className="setup__hint">
            {calendars.length === 0
              ? "Add a calendar below and its events show up here."
              : "Nothing in the next day and a half."}
          </p>
        ) : (
          <Upcoming events={snapshot.helper.upcoming} limit={8} />
        )}
      </section>

      <section className="card">
        <h2>Calendars</h2>
        {calendars.length > 0 && (
          <ul className="calendars">
            {calendars.map((calendar) => (
              <li key={calendar.name}>
                <span className="calendars__name">{calendar.name}</span>
                <span
                  className="calendars__state"
                  data-error={Boolean(calendar.error) || undefined}
                >
                  {calendar.error ??
                    (calendar.loaded ? "Up to date" : "Loading…")}
                </span>
                <span className="calendars__lead">
                  {calendar.remindMinutes === null
                    ? "Default lead"
                    : (LEADS.find(
                        (option) => option.minutes === calendar.remindMinutes,
                      )?.label ?? `${calendar.remindMinutes} min before`)}
                </span>
                <button
                  className="button button--small"
                  onClick={() =>
                    void removeCalendar(calendar.name).catch((reason) =>
                      setError(String(reason)),
                    )
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="todo-form"
          onSubmit={(event) => {
            event.preventDefault();
            void add();
          }}
        >
          <div className="feed">
            <label className="visually-hidden" htmlFor="calendar-name">
              Calendar name
            </label>
            <input
              id="calendar-name"
              value={name}
              placeholder="Name, like College"
              onChange={(event) => setName(event.target.value)}
            />
            <label className="visually-hidden" htmlFor="calendar-lead">
              Remind before events
            </label>
            <LeadSelect
              id="calendar-lead"
              value={lead}
              onChange={setLead}
              allowDefault
            />
          </div>
          <label className="visually-hidden" htmlFor="calendar-link">
            Private calendar link
          </label>
          <input
            id="calendar-link"
            value={link}
            placeholder="Private iCal link (https://… or webcal://…)"
            onChange={(event) => setLink(event.target.value)}
          />
          <div className="todo-form__actions">
            <Info label="Where the link is kept">
              The link is kept in your keychain, never in the config file.
            </Info>
            <button
              className="button button--primary"
              type="submit"
              disabled={busy || !name.trim() || !link.trim()}
            >
              {busy ? "Checking…" : "Add calendar"}
            </button>
          </div>
        </form>
        <div className="providers">
          {PROVIDERS.map((provider) => (
            <details key={provider.name}>
              <summary>Where is the link in {provider.name}?</summary>
              <p>{provider.steps}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>When to remind</h2>
        <div className="rule">
          <span>Every event</span>
          <label className="visually-hidden" htmlFor="default-lead">
            Default lead
          </label>
          <LeadSelect
            id="default-lead"
            value={fallback}
            onChange={(minutes) => {
              setSaved(false);
              setFallback(minutes ?? 15);
            }}
          />
        </div>
        {rules.map((rule, index) => (
          <div className="rule" key={index}>
            <span>Titles with</span>
            <label className="visually-hidden" htmlFor={`rule-${index}`}>
              Words to match
            </label>
            <input
              id={`rule-${index}`}
              value={rule.contains}
              placeholder="class"
              onChange={(event) =>
                changeRule(index, { contains: event.target.value })
              }
            />
            <label className="visually-hidden" htmlFor={`rule-lead-${index}`}>
              Remind
            </label>
            <Select
              id={`rule-lead-${index}`}
              value={rule.mute ? "mute" : String(rule.minutes)}
              onChange={(next) =>
                changeRule(
                  index,
                  next === "mute"
                    ? { mute: true }
                    : { mute: false, minutes: Number(next) },
                )
              }
              options={[
                ...LEADS.map((option) => ({
                  value: String(option.minutes),
                  label: option.label,
                })),
                { value: "mute", label: "Never remind" },
              ]}
            />
            <button
              className="todos__remove"
              aria-label={`Remove rule for ${rule.contains || "new rule"}`}
              onClick={() => {
                setSaved(false);
                setRules(rules.filter((_, i) => i !== index));
              }}
            >
              ×
            </button>
          </div>
        ))}
        <div className="todo-form__actions">
          <button
            className="button"
            onClick={() => {
              setSaved(false);
              setRules([...rules, { contains: "", minutes: 30, mute: false }]);
            }}
          >
            Add a rule
          </button>
          <button
            className="button button--primary"
            onClick={() => void save(rules, fallback)}
          >
            {saved ? "Saved" : "Save"}
          </button>
        </div>
        <p className="setup__hint">
          The first rule that matches wins, then the calendar's own lead, then
          this default. All-day events, like exams, remind on the morning.
        </p>
      </section>

      {error && <p className="tray__error">{error}</p>}
    </div>
  );
}
