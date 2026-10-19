import { useState, type ReactNode } from "react";

import { Todos, Tokens, Write } from "../helper/HelperPanel";
import { setTodoDone } from "../lib/bridge";
import type { Snapshot } from "../lib/types";
import { Dumpling } from "../pets/Dumpling";
import { Setup } from "../setup/Setup";
import { greeting } from "./greeting";
import {
  HomeIcon,
  ProductsIcon,
  TodoIcon,
  TokensIcon,
  WriteIcon,
} from "./icons";
import { ProductCard } from "./ProductCard";
import "./hub.css";

type Page = "home" | "todo" | "write" | "tokens" | "products";

const PAGES: { id: Page; label: string; icon: ReactNode }[] = [
  { id: "home", label: "Home", icon: <HomeIcon /> },
  { id: "todo", label: "To-do", icon: <TodoIcon /> },
  { id: "write", label: "Write", icon: <WriteIcon /> },
  { id: "tokens", label: "Tokens", icon: <TokensIcon /> },
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
  const [page, setPage] = useState<Page>(
    snapshot.pets.length === 0 ? "products" : "home",
  );
  const { helper } = snapshot;

  return (
    <div className="hub">
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
        <p className="hub__status">
          <span className="hub__dot" aria-hidden="true" />
          Watching {snapshot.pets.length}{" "}
          {snapshot.pets.length === 1 ? "product" : "products"}
        </p>
      </aside>

      <main className="hub__main">
        {snapshot.configError && (
          <p className="hub__error">Config problem: {snapshot.configError}</p>
        )}
        {page === "home" && <HomePage snapshot={snapshot} />}
        {page === "todo" && (
          <Section title="To-do" lead="Deadlines, study blocks and chores.">
            <div className="card">
              <Todos helper={helper} onTyping={noop} />
            </div>
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
        {page === "products" && (
          <Section title="Products" lead="Each product gets a pet.">
            <Setup
              snapshot={snapshot}
              onDone={() => setPage("home")}
              onTyping={noop}
            />
          </Section>
        )}
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

function HomePage({ snapshot }: { snapshot: Snapshot }) {
  const { pets, helper } = snapshot;
  const urgent = pets.filter((pet) => URGENT.has(pet.mood));
  const today = helper.todos.filter(
    (todo) => todo.dueState === "overdue" || todo.dueState === "today",
  );
  const summary = [
    urgent.length > 0
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
              <Dumpling
                key={pet.id}
                kind={pet.kind}
                color={pet.color}
                mood={pet.mood}
                heat={pet.heat}
                seed={pet.id}
                size={84}
              />
            ))}
            <Dumpling
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

      <div className="home">
        <section className="home__pets" aria-label="Your products">
          {pets.map((pet) => (
            <ProductCard key={pet.id} pet={pet} />
          ))}
        </section>

        <aside className="home__side">
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
                      onChange={() => void setTodoDone(todo.id, true)}
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
