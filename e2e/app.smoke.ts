// Opens the built app through tauri-driver and checks the hub renders. The Playwright tests run
// against the Vite preview with demo data, so only this one goes through the real Rust backend:
// a hang in `snapshot` once left the window black while every other test passed.
//
// Usage: node e2e/app.smoke.ts [path to the built app]

import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const application = resolve(process.argv[2] ?? "target/debug/peeps-desktop");
const driverUrl = "http://127.0.0.1:4444";
const renderTimeout = 60_000;
// A command that blocks the app's main thread also blocks the webview, so WebDriver requests
// hang rather than fail; each one gets a deadline of its own.
const requestTimeout = 10_000;
const screenshot = "test-results/app-smoke.png";
// W3C WebDriver's key for an element reference in responses.
const element = "element-6066-11e4-a52e-4f735466cecf";

const home = mkdtempSync(join(tmpdir(), "peeps-smoke-"));
// The app's data, and the webview's storage, go to a scratch directory so a run on a
// developer's machine never reads or writes their real peeps.
const env = {
  ...process.env,
  PEEPS_HOME: join(home, "peeps"),
  XDG_CONFIG_HOME: join(home, "config"),
  XDG_DATA_HOME: join(home, "data"),
  XDG_CACHE_HOME: join(home, "cache"),
};
// In its own process group so the WebKit helper processes, which outlive the app, go down with it.
const driver = spawn(process.env.TAURI_DRIVER ?? "tauri-driver", [], {
  env,
  stdio: "inherit",
  detached: true,
});
const driverExited = new Promise<void>((done) =>
  driver.once("exit", () => done()),
);
let sessionId: string | undefined;

type Reply = { value: unknown };

async function call(
  method: string,
  path: string,
  body?: unknown,
  timeout = requestTimeout,
) {
  let reply: Reply;
  let response: Response;
  try {
    response = await fetch(`${driverUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
    reply = (await response.json()) as Reply;
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new Error(
        `no reply to ${method} ${path} within ${timeout / 1000}s, so the app is probably hung`,
      );
    }
    throw error;
  }
  if (!response.ok) {
    throw new Error(
      `${method} ${path} failed: ${response.status} ${JSON.stringify(reply.value)}`,
    );
  }
  return reply.value;
}

const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function waitFor<T>(
  what: string,
  timeout: number,
  check: () => Promise<T | undefined>,
): Promise<T> {
  const deadline = Date.now() + timeout;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const found = await check();
      if (found !== undefined) return found;
    } catch (error) {
      lastError = error;
    }
    await pause(250);
  }
  const reason = lastError instanceof Error ? `: ${lastError.message}` : "";
  throw new Error(
    `timed out after ${timeout / 1000}s waiting for ${what}${reason}`,
  );
}

const session = (path: string) => `/session/${sessionId}${path}`;

async function switchToHome() {
  const handles = (await call("GET", session("/window/handles"))) as string[];
  for (const handle of handles) {
    await call("POST", session("/window"), { handle });
    const url = (await call("GET", session("/url"))) as string;
    if (url.includes("view=home")) return handle;
  }
  return undefined;
}

async function homeButton() {
  const found = (await call("POST", session("/elements"), {
    using: "xpath",
    value: "//nav[@aria-label='Sections']//button[normalize-space()='Home']",
  })) as Record<string, string>[];
  const id = found[0]?.[element];
  if (id === undefined) return undefined;
  const shown = await call("GET", session(`/element/${id}/displayed`));
  return shown === true ? id : undefined;
}

function stopDriver() {
  if (driver.pid === undefined) return;
  try {
    process.kill(-driver.pid, "SIGTERM");
  } catch {
    // Everything in the group has already gone.
  }
}

// Interrupting the run would otherwise leave the app and its driver running.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopDriver();
    process.exit(1);
  });
}

async function smoke() {
  await Promise.race([
    waitFor("tauri-driver to start", 10_000, async () =>
      (await fetch(`${driverUrl}/status`)).ok ? true : undefined,
    ),
    driverExited.then(() => {
      throw new Error(
        "tauri-driver exited on start; is another one already using port 4444?",
      );
    }),
  ]);
  const created = (await call(
    "POST",
    "/session",
    { capabilities: { alwaysMatch: { "tauri:options": { application } } } },
    renderTimeout,
  )) as { sessionId: string };
  sessionId = created.sessionId;

  await waitFor("the home window", renderTimeout, switchToHome);
  await waitFor(
    'the sidebar\'s "Home" button in the home window',
    renderTimeout,
    homeButton,
  );
}

let failed = false;
try {
  await smoke();
  console.log("smoke: the home window rendered its sidebar");
} catch (error) {
  failed = true;
  console.error(`::error title=App smoke test::${String(error)}`);
  if (sessionId !== undefined) {
    try {
      const png = (await call("GET", session("/screenshot"))) as string;
      mkdirSync("test-results", { recursive: true });
      writeFileSync(screenshot, Buffer.from(png, "base64"));
      console.error(`smoke: saved what the window showed to ${screenshot}`);
    } catch (shot) {
      console.error(`smoke: no screenshot either: ${String(shot)}`);
    }
  }
} finally {
  if (sessionId !== undefined) {
    await call("DELETE", session("")).catch(() => undefined);
  }
  stopDriver();
  await driverExited;
  rmSync(home, { recursive: true, force: true, maxRetries: 5 });
}
process.exit(failed ? 1 : 0);
