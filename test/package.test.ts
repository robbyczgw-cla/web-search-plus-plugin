import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const pluginManifest = JSON.parse(readFileSync(new URL("../openclaw.plugin.json", import.meta.url), "utf8"));

test("published files exclude the internal porting plan", () => {
  assert.equal(packageJson.files.includes("PLAN.md"), false);
});

test("the declared package entrypoint is the included runtime bundle", () => {
  assert.equal(packageJson.main, "dist/index.js");
  assert.equal(packageJson.files.includes(packageJson.main), true);
});

test("manifest accepts the documented extraction cache character budget", () => {
  assert.deepEqual(pluginManifest.configSchema.properties.extractCacheMaxChars, {
    type: "number",
    minimum: 1,
    maximum: 20_000_000,
    description: "Maximum Unicode codepoints retained by the process-local extraction full-text LRU (default 4000000, range 1-20000000). Entries are discarded when the host restarts.",
  });
});

test("every packaged source module resolves inside the package", () => {
  const packagedSources = new Set(packageJson.files.filter((entry: string) => entry.endsWith(".ts")));
  const unresolved: string[] = [];
  for (const entry of packagedSources) {
    const source = readFileSync(new URL(`../${entry}`, import.meta.url), "utf8");
    for (const match of source.matchAll(/from "\.\/([A-Za-z0-9._-]+\.ts)"/g)) {
      if (!packagedSources.has(match[1])) unresolved.push(`${entry} -> ${match[1]}`);
    }
  }
  assert.deepEqual(unresolved, []);
});

test("the declared OpenClaw source entry is packaged", () => {
  for (const entry of packageJson.openclaw.extensions) {
    assert.equal(packageJson.files.includes(entry.replace(/^\.\//, "")), true);
  }
});
