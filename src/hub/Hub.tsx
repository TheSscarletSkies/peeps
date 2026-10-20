import { useState, type ReactNode } from "react";

import { Todos, Tokens, Write } from "../helper/HelperPanel";
import { Chat } from "../helper/Chat";
import { Upcoming } from "../helper/Upcoming";
import { setTodoDone } from "../lib/bridge";
import { announceFed } from "../life/events";
import { Boundary } from "../lib/Boundary";
import type { Snapshot } from "../lib/types";
import { LivePet } from "../life/LivePet";
import { boop, setSoundEnabled, soundEnabled } from "../life/sound";
import { usePetEvents } from "../life/usePetEvents";
import { Dumpling } from "../pets/Dumpling";
import { Setup } from "../setup/Setup";
import { GettingStarted } from "./GettingStarted";
import { greeting } from "./greeting";
import {
  AskIcon,
  BellIcon,
  HomeIcon,
  MoonIcon,
  ProductsIcon,
  RecapIcon,
  SoundIcon,
  SunIcon,
  TodoIcon,
  TokensIcon,
  WriteIcon,
} from "./icons";
import { ProductCard } from "./ProductCard";
import { RecapPage } from "./RecapPage";
import { RemindersPage } from "./RemindersPage";
import { savedTheme, saveTheme, type Theme } from "./theme";
import "./hub.css";

type Page =
  | "home"
  | "ask"
  | "todo"
  | "reminders"
  | "write"
  | "tokens"
  | "recap"
  | "products";

const PAGES: { id: Page; label: string; icon: ReactNode }[] = [
  { id: "home", label: "Home", icon: <HomeIcon /> },
  { id: "ask", label: "Ask", icon: <AskIcon /> },
  { id: "todo", label: "To-do", icon: <TodoIcon /> },
  { id: "reminders", label: "Reminders", icon: <BellIcon /> },
  { id: "write", label: "Write", icon: <WriteIcon /> },
  { id: "tokens", label: "Tokens", icon: <TokensIcon /> },
  { id: "recap", label: "Recap", icon: <RecapIcon /> },
  { id: "products", label: "Products", icon: <ProductsIcon /> },
];

const URGENT = new Set([
  "needsYou",
  "failing",
  "steaming",
  "hungry",
  "litterBox",
]);
const noop = () => undefined;

export function Hub({ snapshot }: { snapshot: Snapshot }) {
  const [page, setPage] = useState<Page>("home");
  const [theme, setTheme] = useState<Theme>(savedTheme);
  const [sound, setSound] = useState(soundEnabled);
  const { helper } = snapshot;

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
      <aside className="hub__side">
        <div className="hub__brand">
          <Dumpling
            kind="bao"
            color="#FFF3E3"
            mood="chill"
            heat={0}
            size={30}
          />
          <span>peeps</span>
        </div>
        <nav aria-label="Sections">
          {PAGES.map((item) => (
            <button
              key={item.id}
              className={page === item.id ? "nav nav--on" : "nav"}
              aria-current={page === item.id ? "page" : undefined}
              onClick={() => setPage(item.id)}
            >
              {item.icon}
              {item.label}
              {item.id === "todo" && helper.todos.length > 0 && (
                <span className="nav__count">{helper.todos.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="hub__toggles">
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
            aria-label="Boop when a pet needs you"
            title={sound ? "Sound on" : "Sound off"}
          >
            <SoundIcon on={sound} />
          </button>
        </div>
        <p className="hub__status">
          <span className="hub__dot" aria-hidden="true" />
          Watching {snapshot.pets.length}{" "}
          {snapshot.pets.length === 1 ? "product" : "products"}
        </p>
      </aside>

      <main className="hub__main">
        <Boundary key={page}>
          {snapshot.configError && (
            <p className="hub__error">Config problem: {snapshot.configError}</p>
          )}
          {page === "home" && <HomePage snapshot={snapshot} onGo={setPage} />}
          {page === "todo" && (
            <Section title="To-do" lead="Deadlines, study blocks and chores.">
              <div className="card">
                <Todos helper={helper} onTyping={noop} />
              </div>
            </Section>
          )}
          {page === "ask" && (
            <Section
              title={`Ask ${helper.name}`}
              lead="Talks to your own Claude, with your connectors. Anything it wants to do, it asks first."
            >
              <div className="card ask">
                <Chat helper={helper} onTyping={noop} />
              </div>
            </Section>
          )}
          {page === "reminders" && (
            <Section
              title="Reminders"
              lead="Your calendars and when each kind of event should nudge you."
            >
              <RemindersPage snapshot={snapshot} />
            </Section>
          )}
          {page === "write" && (
            <Section
              title="Write"
              lead="Drafts in your voice, written by your own agent when you ask."
            >
              <div className="card">
                <Write helper={helper} onTyping={noop} />
              </div>
            </Section>
          )}
          {page === "tokens" && (
            <Section title="Tokens" lead="What each product used this week.">
              <div className="card">
                <Tokens
                  helper={helper}
                  pets={snapshot.pets}
                  tips={snapshot.tips}
                />
              </div>
            </Section>
          )}
          {page === "recap" && (
            <Section
              title="Recap"
              lead="Your week in one card, ready to share."
            >
              <RecapPage snapshot={snapshot} />
            </Section>
          )}
          {page === "products" && (
            <Section title="Products" lead="A pet for every project you build.">
              <Setup
                snapshot={snapshot}
                onDone={() => setPage("home")}
                onTyping={noop}
              />
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

function HomePage({
  snapshot,
  onGo,
}: {
  snapshot: Snapshot;
  onGo: (page: Page) => void;
}) {
  const { pets, helper } = snapshot;
  const { celebrating, arriving } = usePetEvents(pets);
  const urgent = pets.filter((pet) => URGENT.has(pet.mood));
  const today = helper.todos.filter(
    (todo) => todo.dueState === "overdue" || todo.dueState === "today",
  );
  const summary = [
    pets.length === 0
      ? "Add a product and it hatches as a pet."
      : urgent.length > 0
        ? `${urgent.map((pet) => pet.name).join(" and ")} ${urgent.length === 1 ? "needs" : "need"} you.`
        : "Everyone is fine.",
    today.length > 0
      ? `${today.length} ${today.length === 1 ? "thing is" : "things are"} due today.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <section className="hero">
        <div className="hero__text">
          <h1>{greeting(new Date().getHours())}</h1>
          <p>{summary}</p>
        </div>
        <div className="hero__steamer" aria-hidden="true">
          <div className="hero__pets">
            {pets.slice(0, 4).map((pet) => (
              <LivePet
                key={pet.id}
                id={pet.id}
                celebrating={celebrating.has(pet.id)}
                arriving={arriving.has(pet.id)}
                kind={pet.kind}
                color={pet.color}
                mood={pet.mood}
                heat={pet.heat}
                size={84}
              />
            ))}
            <LivePet
              dropId="helper"
              kind={helper.kind}
              color={helper.color}
              mood={helper.mood}
              heat={0}
              size={72}
            />
          </div>
          <div className="hero__basket" />
        </div>
      </section>

      <GettingStarted snapshot={snapshot} onGo={onGo} />

      <div className="home">
        <section className="home__pets" aria-label="Your products">
          {pets.map((pet) => (
            <ProductCard
              key={pet.id}
              pet={pet}
              celebrating={celebrating.has(pet.id)}
              arriving={arriving.has(pet.id)}
            />
          ))}
        </section>

        <aside className="home__side">
          {helper.upcoming.length > 0 && (
            <div className="card">
              <h2>Coming up</h2>
              <Upcoming events={helper.upcoming} limit={4} />
            </div>
          )}
          <div className="card">
            <h2>Today</h2>
            {helper.todos.length === 0 ? (
              <p className="setup__hint">Nothing on the list.</p>
            ) : (
              <ul className="today">
                {helper.todos.slice(0, 5).map((todo) => (
                  <li key={todo.id} data-due={todo.dueState}>
                    <input
                      type="checkbox"
                      aria-label={`Done: ${todo.title}`}
                      onChange={() => {
                        announceFed("helper");
                        void setTodoDone(todo.id, true);
                      }}
                    />
                    <span>{todo.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card">
            <h2>This week</h2>
            <Tokens helper={helper} pets={pets} tips={[]} />
          </div>
        </aside>
      </div>
    </>
  );
}
