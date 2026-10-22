import { describe, expect, it } from "vitest";

import { next, rewrite } from "./bump-version.mjs";

describe("bump-version", () => {
  it("raises the right part", () => {
    expect(next("0.2.0", "patch")).toBe("0.2.1");
    expect(next("0.2.9", "minor")).toBe("0.3.0");
    expect(next("0.2.9", "major")).toBe("1.0.0");
    expect(() => next("0.2.0", "huge")).toThrow();
    expect(() => next("0.2", "patch")).toThrow();
  });

  it("rewrites every file, and only our own crates in the lock", () => {
    const files = {
      "Cargo.toml":
        '[workspace.package]\nversion = "0.2.0"\nedition = "2021"\n',
      "Cargo.lock":
        '[[package]]\nname = "foldhash"\nversion = "0.2.0"\n\n[[package]]\nname = "peeps-core"\nversion = "0.2.0"\n',
      "package.json":
        '{\n  "name": "peeps",\n  "version": "0.2.0",\n  "x": 1\n}\n',
      "package-lock.json": JSON.stringify({
        version: "0.2.0",
        packages: { "": { version: "0.2.0" } },
      }),
      "src-tauri/tauri.conf.json":
        '{\n  "productName": "peeps",\n  "version": "0.2.0",\n}\n',
    };
    const out = rewrite(files, "0.2.0", "0.2.1");
    expect(out["Cargo.toml"]).toContain('version = "0.2.1"');
    expect(out["Cargo.lock"]).toContain('name = "foldhash"\nversion = "0.2.0"');
    expect(out["Cargo.lock"]).toContain(
      'name = "peeps-core"\nversion = "0.2.1"',
    );
    expect(out["package.json"]).toContain('"version": "0.2.1"');
    expect(JSON.parse(out["package-lock.json"]).packages[""].version).toBe(
      "0.2.1",
    );
    expect(out["src-tauri/tauri.conf.json"]).toContain('"version": "0.2.1"');
    expect(() => rewrite(files, "9.9.9", "9.9.10")).toThrow();
  });
});
