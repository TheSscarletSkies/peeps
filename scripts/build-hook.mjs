// Builds peeps-hook and places it where Tauri expects a bundled sidecar binary.
// Usage: node scripts/build-hook.mjs [--release]

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const release = process.argv.includes("--release");

function hostTriple() {
  const info = execFileSync("rustc", ["-vV"], { encoding: "utf8" });
  const host = info.match(/^host: (\S+)$/m);
  if (!host) throw new Error("could not read the host target from `rustc -vV`");
  return host[1];
}

const triple = process.env.TAURI_ENV_TARGET_TRIPLE || hostTriple();
const extension = triple.includes("windows") ? ".exe" : "";

execFileSync(
  "cargo",
  [
    "build",
    "--package",
    "peeps-hook",
    "--target",
    triple,
    ...(release ? ["--release"] : []),
  ],
  { cwd: root, stdio: "inherit" },
);

const built = join(
  root,
  "target",
  triple,
  release ? "release" : "debug",
  `peeps-hook${extension}`,
);
const bundled = join(
  root,
  "src-tauri",
  "binaries",
  `peeps-hook-${triple}${extension}`,
);
mkdirSync(dirname(bundled), { recursive: true });
copyFileSync(built, bundled);
