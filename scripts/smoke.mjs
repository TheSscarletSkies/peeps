// Opens the built app through tauri-driver and waits for the hub's sidebar. The e2e tests run
// against the demo bridge, so this is the only check that the real backend lets a window render.
// Usage: node scripts/smoke.mjs [built app] [screenshot path], after `npx tauri build --debug --no-bundle`.

import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [application = "target/debug/peeps-desktop", screenshot = "smoke.png"] =
  process.argv.slice(2);

const DRIVER = "http://127.0.0.1:4444";
const RENDER_TIMEOUT_MS = 60_000;
// A deadlocked main thread also stalls the WebDriver commands themselves, so none may wait forever.
const REQUEST_TIMEOUT_MS = 10_000;
const HOME_BUTTON =
  '//nav[@aria-label="Sections"]//button[normalize-space(.)="Home"]';
const ELEMENT = "element-6066-11e4-a52e-4f735466cecf";

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function call(method, path, body, timeout = REQUEST_TIMEOUT_MS) {
  let response;
  try {
    response = await fetch(DRIVER + path, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
  } catch (error) {
    if (error.name !== "TimeoutError") throw error;
    throw new Error(
      `${method} ${path} got no answer in ${timeout / 1000}s; the app's main thread is likely blocked`,
    );
  }
  const { value } = await response.json();
  if (!response.ok) {
    throw new Error(`${method} ${path}: ${value?.error}: ${value?.message}`);
  }
  return value;
}

async function driverUp(deadline) {
  while (Date.now() < deadline) {
    try {
      await call("GET", "/status");
      return;
    } catch {
      await sleep(250);
    }
  }
  throw new Error("tauri-driver did not start listening");
}

/** Switches to the hub window, which is the webview loaded with `?view=home`. */
async function findHome(session) {
  const handles = await call("GET", `/session/${session}/window/handles`);
  for (const handle of handles) {
    await call("POST", `/session/${session}/window`, { handle });
    const url = await call("GET", `/session/${session}/url`);
    if (new URL(url).searchParams.get("view") === "home") return url;
  }
  throw new Error("no window has loaded index.html?view=home yet");
}

async function homeButtonShown(session) {
  const found = await call("POST", `/session/${session}/elements`, {
    using: "xpath",
    value: HOME_BUTTON,
  });
  if (found.length === 0) {
    throw new Error("the sidebar's Home button has not rendered");
  }
  const shown = await call(
    "GET",
    `/session/${session}/element/${found[0][ELEMENT]}/displayed`,
  );
  if (!shown) throw new Error("the sidebar's Home button is hidden");
}

async function saveScreenshot(session) {
  try {
    const png = await call("GET", `/session/${session}/screenshot`);
    writeFileSync(screenshot, Buffer.from(png, "base64"));
    console.error(`Screenshot of the hub window saved to ${screenshot}`);
  } catch (error) {
    console.error(`No screenshot: ${error.message}`);
  }
}

const driver = spawn("tauri-driver", [], { stdio: "inherit" });
const driverExit = new Promise((_, fail) => {
  driver.on("error", fail);
  driver.on("exit", (code) =>
    fail(new Error(`tauri-driver exited early with code ${code}`)),
  );
});

let session;
let failure;
try {
  await Promise.race([driverUp(Date.now() + 20_000), driverExit]);
  // Starting a session launches the app, which takes longer than any other command.
  ({ sessionId: session } = await call(
    "POST",
    "/session",
    {
      capabilities: {
        alwaysMatch: { "tauri:options": { application: resolve(application) } },
      },
    },
    RENDER_TIMEOUT_MS,
  ));

  const deadline = Date.now() + RENDER_TIMEOUT_MS;
  for (;;) {
    try {
      const url = await findHome(session);
      await homeButtonShown(session);
      console.log(`The hub rendered its sidebar at ${url}`);
      break;
    } catch (error) {
      if (Date.now() >= deadline) {
        failure = `The hub window did not render within ${RENDER_TIMEOUT_MS / 1000}s: ${error.message}`;
        await saveScreenshot(session);
        break;
      }
      await sleep(500);
    }
  }
} catch (error) {
  failure = `Could not open the app: ${error.message}`;
} finally {
  if (session) await call("DELETE", `/session/${session}`).catch(() => {});
  driver.removeAllListeners();
  driver.kill();
}

if (failure) {
  console.error(`::error title=Smoke test::${failure}`);
  process.exit(1);
}
