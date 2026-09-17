import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const execFileAsync = promisify(execFile);
const CLI = new URL("../bin/web-search-plus-setup.mjs", import.meta.url).pathname;

test("onboarding CLI lists providers and presets", async () => {
  const providers = JSON.parse((await execFileAsync(process.execPath, [CLI, "list", "providers", "--json"])).stdout);
  const byName = new Map(providers.map((provider: any) => [provider.name, provider]));

  assert.equal(byName.has("hound"), false);
  assert.equal((byName.get("parallel") as any).guarded, false);
  assert.match((byName.get("parallel") as any).capability, /parallelMode defaults to fast/);
  assert.ok(providers.some((provider: any) => provider.name === "serpbase" && provider.guarded === true));
  assert.match((byName.get("exa") as any).capability, /source-only/);
  assert.doesNotMatch((byName.get("exa") as any).capability, /deep-reasoning/);
  assert.deepEqual(
    ["donsetch", "octen", "tinyfish", "search1api"].map((name) => ({
      name,
      field: (byName.get(name) as any).field,
      guarded: (byName.get(name) as any).guarded,
    })),
    [
      { name: "donsetch", field: "donsetchBin", guarded: true },
      { name: "octen", field: "monidApiKey", guarded: true },
      { name: "tinyfish", field: "tinyfishApiKey", guarded: true },
      { name: "search1api", field: "search1apiApiKey", guarded: true },
    ],
  );

  const presets = JSON.parse((await execFileAsync(process.execPath, [CLI, "list", "presets", "--json"])).stdout);
  assert.deepEqual(presets.starter.providers, ["you", "serper", "linkup"]);
  assert.deepEqual(presets["self-hosted"].providers, ["searxng", "keenable"]);
  assert.equal(presets.full.providers.includes("hound"), false);
  assert.ok(presets.full.providers.includes("donsetch"));
  assert.ok(presets.full.providers.includes("octen"));
  assert.ok(presets.full.providers.includes("tinyfish"));
});

test("onboarding CLI types config values, redacts secrets, and writes mode 0600", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wsp-cli-"));
  const config = join(dir, "config.json");
  try {
    await writeFile(config, "{}\n", { mode: 0o644 });
    await chmod(config, 0o644);
    const configured = await execFileAsync(process.execPath, [
      CLI,
      "config",
      "--config",
      config,
      "--set",
      "youApiKey=you-test",
      "--set",
      "serperApiKey=serper-test",
      "--set",
      "keenableAllowPublic=true",
      "--set",
      "extractMaxUrls=7",
      "--set",
      'routingPreferences={"profile":"self_hosted"}',
      "--set",
      'qualityBlockedDomains=["spam.example"]',
      "--set",
      "localeCountry=at",
      "--json",
    ]);

    assert.equal(configured.stdout.includes("you-test"), false);
    assert.equal(configured.stdout.includes("serper-test"), false);
    const printed = JSON.parse(configured.stdout);
    assert.equal(printed.config.youApiKey, "[REDACTED]");
    assert.equal(printed.config.serperApiKey, "[REDACTED]");

    const stored = JSON.parse(await readFile(config, "utf8"));
    assert.equal(stored.youApiKey, "you-test");
    assert.equal(stored.serperApiKey, "serper-test");
    assert.equal(stored.keenableAllowPublic, true);
    assert.equal(stored.extractMaxUrls, 7);
    assert.deepEqual(stored.routingPreferences, { profile: "self_hosted" });
    assert.deepEqual(stored.qualityBlockedDomains, ["spam.example"]);
    assert.equal(stored.localeCountry, "at");
    assert.equal((await stat(config)).mode & 0o777, 0o600);

    const shown = await execFileAsync(process.execPath, [CLI, "config", "--config", config, "--json"]);
    assert.equal(shown.stdout.includes("you-test"), false);
    assert.equal(JSON.parse(shown.stdout).config.youApiKey, "[REDACTED]");

    const status = JSON.parse((await execFileAsync(process.execPath, [CLI, "status", "--config", config, "--json"])).stdout);
    assert.deepEqual(status.configured_providers.sort(), ["serper", "you"]);
    assert.deepEqual(status.tools, [
      "web_search_plus",
      "web_extract_plus",
      "web_routing_config_plus",
      "web_search_health_plus",
      "web_extract_benchmark_plus",
    ]);
    assert.equal(status.answer_tool_removed, true);
    assert.equal(status.self_hosted_ready, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
