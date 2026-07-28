import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const guidePath = path.join(root, "CONTRIBUTING.md");

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("contribution guide covers OpenClaw plugin contracts", () => {
  assert.ok(fs.existsSync(guidePath), "CONTRIBUTING.md is missing");
  const guide = read("CONTRIBUTING.md");
  for (const marker of [
    "## Project boundaries",
    "## Local setup",
    "## Required checks",
    "## Porting from Web Search Plus",
    "## Provider and tool changes",
    "## Security and privacy",
    "## Pull requests",
    "source-only",
    "openclaw.plugin.json",
    "CHANGELOG.md",
  ]) {
    assert.ok(guide.includes(marker), `missing contribution-guide contract: ${marker}`);
  }
});

test("contribution guide and GitHub workflow share the real npm gates", () => {
  const guide = read("CONTRIBUTING.md");
  const workflow = read(".github/workflows/ci.yml");
  for (const command of ["npm ci", "npm test", "npm run build", "npm pack --dry-run"]) {
    assert.ok(workflow.includes(command), `CI no longer runs documented command: ${command}`);
    assert.ok(guide.includes(command), `guide does not document CI command: ${command}`);
  }
  assert.match(workflow, /node-version:\s*["']?22["']?/);
});

test("contribution guide is linked and internal links resolve", () => {
  assert.ok(read("README.md").includes("CONTRIBUTING.md"));
  const guide = read("CONTRIBUTING.md");
  for (const match of guide.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (/^(?:https?:|mailto:|#)/.test(target)) continue;
    const relativePath = target.split("#", 1)[0];
    if (relativePath) {
      assert.ok(fs.existsSync(path.join(root, relativePath)), `broken internal link: ${target}`);
    }
  }
});
