import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const execFileAsync = promisify(execFile);
const CLI = new URL("../bin/web-search-plus-setup.mjs", import.meta.url).pathname;

test("onboarding CLI lists providers and presets", async () => {
  const providers = JSON.parse((await execFileAsync(process.execPath, [CLI, "list", "providers", "--json"])).stdout);
  assert.ok(providers.some((provider: any) => provider.name === "parallel" && provider.guarded === true));
  assert.ok(providers.some((provider: any) => provider.name === "serpbase" && provider.guarded === true));
  assert.ok(providers.some((provider: any) => provider.name === "hound" && provider.guarded === true));

  const presets = JSON.parse((await execFileAsync(process.execPath, [CLI, "list", "presets", "--json"])).stdout);
  assert.deepEqual(presets.starter.providers, ["you", "serper", "linkup"]);
  assert.deepEqual(presets["self-hosted"].providers, ["searxng", "keenable"]);
});

test("onboarding CLI status and config commands persist explicit plugin fields", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wsp-cli-"));
  const config = join(dir, "config.json");
  try {
    await execFileAsync(process.execPath, [CLI, "config", "--config", config, "--set", "youApiKey=you-test", "--set", "serperApiKey=serper-test", "--json"]);
    const stored = JSON.parse(await readFile(config, "utf8"));
    assert.equal(stored.youApiKey, "you-test");
    assert.equal(stored.serperApiKey, "serper-test");

    const status = JSON.parse((await execFileAsync(process.execPath, [CLI, "status", "--config", config, "--json"])).stdout);
    assert.deepEqual(status.configured_providers.sort(), ["serper", "you"]);
    assert.equal(status.answer_tool_removed, true);
    assert.equal(status.self_hosted_ready, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
