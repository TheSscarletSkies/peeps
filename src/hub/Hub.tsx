import { useCallback, useState, type ReactNode } from "react";

import { FocusBar } from "../focus/FocusBar";
import { FriendsPanel } from "../friends/FriendsPanel";
import { StudyTable } from "../friends/StudyTable";
import { AreasEditor } from "../tracker/AreasEditor";
import { WeekCard } from "../tracker/WeekCard";
import { useReactions } from "../friends/useReactions";
import { Todos } from "../helper/HelperPanel";
import { AboutMe } from "../helper/AboutMe";
import { Chat } from "../helper/Chat";
import { Upcoming } from "../helper/Upcoming";
import { Boundary } from "../lib/Boundary";
import type { Snapshot } from "../lib/types";
import { usePrefs } from "../life/prefs";
import { boop, setSoundEnabled, soundEnabled } from "../life/sound";
import { Nudges } from "../nudges/Nudges";
import { ClaudeStatus } from "../setup/ClaudeStatus";
import { Roster } from "../tray/shared";
import { GettingStarted } from "./GettingStarted";
import { greeting } from "./greeting";
import {
  AskIcon,
  BellIcon,
  HomeIcon,
  MoonIcon,
  FriendsIcon,
  SettingsIcon,
  SoundIcon,
  SunIcon,
} from "./icons";
import { DevicesPage } from "./DevicesPage";
import { RemindersPage } from "./RemindersPage";
import { savedTheme, saveTheme, type Theme } from "./theme";
import { Tour, tourSeen } from "./Tour";
import logo from "../assets/logo.png";
import "./hub.css";

type Page = "today" | "chat" | "nudges" | "friends" | "settings";

const PAGES: { id: Page; label: string; icon: ReactNode }[] = [
  { id: "today", label: "Today", icon: <HomeIcon /> },
  { id: "chat", label: "Chat", icon: <AskIcon /> },
  { id: "nudges", label: "Nudges", icon: <BellIcon /> },
  { id: "friends", label: "Friends", icon: <FriendsIcon /> },
  { id: "settings", label: "Settings", icon: <SettingsIcon /> },
];

const noop = () => undefined;

export function Hub({ snapshot }: { snapshot: Snapshot }) {
  const [page, setPage] = useState<Page>("today");
  const [theme, setTheme] = useState<Theme>(savedTheme);
  const [sound, setSound] = useState(soundEnabled);
  const [touring, setTouring] = useState(() => !tourSeen());
  const [prefs, setPrefs] = usePrefs();
  const goTo = useCallback((next: string) => setPage(next as Page), []);
  const { helper } = snapshot;
  useReactions();

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    saveTheme(next);
    setTheme(next);
  };
  const toggleSound = () => {
    setSoundEnabled(!sound);
    setSound(!sound);
    if (!sound) boop();
  };

  return (
    <div className="hub" data-theme={theme}>
      {touring && (
        <Tour helper={helper} onPage={goTo} onClose={() => setTouring(false)} />
      )}
      <aside className="hub__side">
        <div className="hub__brand">
          <img className="hub__logo" src={logo} alt="" width={34} height={34} />
          <span>peeps</span>
        </div>
        <nav aria-label="Sections">
          {PAGES.map((item) => (
            <button
              key={item.id}
              className={page === item.id ? "nav nav--on" : "nav"}
              data-tour={item.id}
              aria-current={page === item.id ? "page" : undefined}
              onClick={() => setPage(item.id)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        <div className="hub__toggles" data-tour="toggles">
          <button
            className="toggle-icon"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Use light theme" : "Use dark theme"}
            title={theme === "dark" ? "Light theme" : "Dark theme"}
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
          <button
            className="toggle-icon"
            onClick={toggleSound}
            aria-pressed={sound}
            aria-label="Boop when a reminder comes"
            title={sound ? "Sound on" : "Sound off"}
          >
            <SoundIcon on={sound} />
          </button>
          <button
            className="toggle-icon"
            onClick={() => setTouring(true)}
            aria-label="Take the tour"
            title="Take the tour"
          >
            ?
          </button>
        </div>
      </aside>

      <main className="hub__main">
        <Boundary key={page}>
          {snapshot.configError && (
            <p className="hub__error">Config problem: {snapshot.configError}</p>
          )}
          {page === "today" && <TodayPage snapshot={snapshot} onGo={setPage} />}
          {page === "chat" && (
            <Section
              title={`Chat with ${helper.name}`}
              lead="Talks to your own Claude and remembers what you tell it about you. Drop a file on it and it reads it."
            >
              <div className="card ask">
                <Chat
                  helper={helper}
                  knowsYou={snapshot.knowsYou}
                  onTyping={noop}
                />
              </div>
            </Section>
          )}
          {page === "nudges" && (
            <Section
              title="Nudges"
              lead={`Little reminders through the day. ${helper.name} pops up and says it, like a friend would.`}
            >
              <div className="card">
                <Nudges
                  helper={helper}
                  oneThing={snapshot.oneThing}
                  onAdd={() => setPage("today")}
                />
              </div>
            </Section>
          )}
          {page === "friends" && (
            <Section
              title="Friends"
              lead="See when friends are focusing, and send them a little something."
            >
              <div className="card">
                <FriendsPanel
                  friends={snapshot.friends}
                  helperName={helper.name}
                />
              </div>
            </Section>
          )}
          {page === "settings" && (
            <Section
              title="Settings"
              lead={`How big ${helper.name} is, where it lives, and what it can see.`}
            >
              <div className="reminders">
                <section className="card">
                  <Roster
                    size={prefs.size}
                    place={prefs.place}
                    onSize={(next) => setPrefs({ ...prefs, size: next })}
                    onPlace={(next) => setPrefs({ ...prefs, place: next })}
                  />
                </section>
                <ClaudeStatus />
              </div>
              <section className="card">
                <h2>Your areas</h2>
                <p className="setup__hint">
                  Today groups your list by these. Tag a to-do with one, or tell{" "}
                  {helper.name} “add gym on Thursday #play”.
                </p>
                <AreasEditor areas={snapshot.areas} />
              </section>
              <section className="card about-me">
                <h2>What {helper.name} knows about you</h2>
                <p className="setup__hint">
                  Filled in as you chat. Change anything here.
                </p>
                <AboutMe />
              </section>
              <RemindersPage snapshot={snapshot} />
              <h2 className="section__sub">Your computers</h2>
              <DevicesPage snapshot={snapshot} />
            </Section>
          )}
        </Boundary>
      </main>
    </div>
  );
}

function Section({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <section className="section">
      <header className="section__head">
        <h1>{title}</h1>
        <p>{lead}</p>
      </header>
      {children}
    </section>
  );
}

function TodayPage({
  snapshot,
  onGo,
}: {
  snapshot: Snapshot;
  onGo: (page: Page) => void;
}) {
  const { helper } = snapshot;
  const due = helper.todos.filter(
    (todo) =>
      !todo.tags.includes("nudge") &&
      (todo.dueState === "overdue" || todo.dueState === "today"),
  );
  const summary =
    due.length > 0
      ? `${due.length} ${due.length === 1 ? "thing is" : "things are"} due today. Tick one off and ${helper.name} gets a snack.`
      : `Nothing due. Give ${helper.name} a pat.`;

  return (
    <>
      <section className="hero">
        <div className="hero__text">
          <h1>{greeting(new Date().getHours())}</h1>
          <p>{summary}</p>
        </div>
        <StudyTable
          helper={helper}
          focus={snapshot.focus}
          friends={snapshot.friends}
          you={snapshot.friends?.name || "You"}
        />
      </section>

      <FocusBar
        focus={snapshot.focus}
        friends={snapshot.friends}
        areas={snapshot.areas}
      />

      <GettingStarted snapshot={snapshot} onGo={onGo} />

      <div className="home">
        <section className="card" aria-label="Your list">
          <h2>Today</h2>
          <Todos helper={helper} areas={snapshot.areas} onTyping={noop} />
        </section>
        <aside className="home__side">
          <div className="card">
            <h2>This week</h2>
            <WeekCard habits={snapshot.habits} />
          </div>
          {helper.upcoming.length > 0 && (
            <div className="card">
              <h2>Coming up</h2>
              <Upcoming events={helper.upcoming} limit={4} />
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
