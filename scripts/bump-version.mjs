// Raises peeps' version everywhere it is written, so a release is one click.
// Usage: node scripts/bump-version.mjs patch|minor|major  (prints the new version)
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** The version after this one: patch 0.2.0 → 0.2.1, minor → 0.3.0, major → 1.0.0. */
export function next(version, part) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) throw new Error(`not a plain version: ${version}`);
  const [major, minor, patch] = match.slice(1).map(Number);
  if (part === "major") return `${major + 1}.0.0`;
  if (part === "minor") return `${major}.${minor + 1}.0`;
  if (part === "patch") return `${major}.${minor}.${patch + 1}`;
  throw new Error(`bump patch, minor or major, not ${part}`);
}

/** Replaces exactly one match, so a file laid out differently fails loudly instead of half-bumping. */
function once(text, pattern, replace, file) {
  const found = text.match(new RegExp(pattern.source, `${pattern.flags}g`));
  if (found?.length !== 1) throw new Error(`expected one version in ${file}`);
  return text.replace(pattern, replace);
}

/** Every file that carries the version, rewritten from `from` to `to`. */
export function rewrite(files, from, to) {
  const out = { ...files };
  out["Cargo.toml"] = once(
    files["Cargo.toml"],
    new RegExp(`^version = "${from}"$`, "m"),
    `version = "${to}"`,
    "Cargo.toml",
  );
  for (const name of ["package.json", "src-tauri/tauri.conf.json"]) {
    out[name] = once(
      files[name],
      new RegExp(`^  "version": "${from}",$`, "m"),
      `  "version": "${to}",`,
      name,
    );
  }
  const lock = JSON.parse(files["package-lock.json"]);
  lock.version = to;
  lock.packages[""].version = to;
  out["package-lock.json"] = `${JSON.stringify(lock, null, 2)}\n`;
  // Only our own crates; a dependency may share the version number.
  out["Cargo.lock"] = files["Cargo.lock"].replace(
    new RegExp(`(name = "peeps-[a-z-]+"\\nversion = )"${from}"`, "g"),
    `$1"${to}"`,
  );
  return out;
}

const FILES = [
  "Cargo.toml",
  "Cargo.lock",
  "package.json",
  "package-lock.json",
  "src-tauri/tauri.conf.json",
];

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = Object.fromEntries(
    FILES.map((name) => [name, readFileSync(name, "utf8")]),
  );
  const from = JSON.parse(files["package.json"]).version;
  const to = next(from, process.argv[2]);
  for (const [name, text] of Object.entries(rewrite(files, from, to)))
    writeFileSync(name, text);
  console.log(to);
}
