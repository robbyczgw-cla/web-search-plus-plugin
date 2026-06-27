import test from "node:test";
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const execFileAsync = promisify(execFile);
const CLI = new URL("../bin/web-search-plus-setup.mjs", import.meta.url).pathname;

// Drive the interactive setup wizard: write each answer with a small delay so a
// later prompt's line isn't dropped by the readline/promises buffered-input race.
function runSetup(args: string[], answers: string[]): Promise<{ stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], { stdio: ["pipe", "pipe", "inherit"] });
    let stdout = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    answers.forEach((line, i) => setTimeout(() => child.stdin.write(`${line}\n`), 120 * (i + 1)));
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve({ stdout }) : reject(new Error(`exit ${code}`))));
  });
}

test("onboarding CLI lists providers and presets", async () => {
  const providers = JSON.parse((await execFileAsync(process.execPath, [CLI, "list", "providers", "--json"])).stdout);
  assert.ok(providers.some((provider: any) => provider.name === "parallel" && provider.guarded === true));
  assert.ok(providers.some((provider: any) => provider.name === "serpbase" && provider.guarded === true));

  const presets = JSON.parse((await execFileAsync(process.execPath, [CLI, "list", "presets", "--json"])).stdout);
  assert.deepEqual(presets.starter.providers, ["you", "serper", "linkup"]);
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
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("onboarding CLI list annotates keenable as keyless", async () => {
  const providers = JSON.parse((await execFileAsync(process.execPath, [CLI, "list", "providers", "--json"])).stdout);
  assert.ok(providers.some((provider: any) => provider.name === "keenable" && provider.keyless === true));
  assert.ok(providers.some((provider: any) => provider.name === "serper" && provider.keyless === false));
});

test("onboarding CLI setup offers keyless public tier when the key is skipped", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wsp-cli-"));
  const config = join(dir, "config.json");
  try {
    // Skip the key (empty line), then answer "y" to the keyless follow-up.
    await runSetup(["setup", "keenable", "--config", config], ["", "y"]);
    const stored = JSON.parse(await readFile(config, "utf8"));
    assert.equal(stored.keenableAllowPublic, true);
    assert.equal(stored.keenableApiKey, undefined);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("onboarding CLI --keyless-public opts in without the confirmation prompt", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wsp-cli-"));
  const config = join(dir, "config.json");
  try {
    // Only the key prompt is shown (one empty line); the flag auto-confirms the keyless opt-in.
    const { stdout } = await runSetup(["setup", "keenable", "--keyless-public", "--config", config, "--json"], [""]);
    // The interactive prompt prints to stdout ahead of the JSON; parse from the first brace.
    assert.deepEqual(JSON.parse(stdout.slice(stdout.indexOf("{"))).keyless_public_providers, ["keenable"]);
    const stored = JSON.parse(await readFile(config, "utf8"));
    assert.equal(stored.keenableAllowPublic, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("onboarding CLI setup declining the keyless tier writes nothing for it", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wsp-cli-"));
  const config = join(dir, "config.json");
  try {
    await runSetup(["setup", "keenable", "--config", config], ["", "n"]);
    const stored = JSON.parse(await readFile(config, "utf8"));
    assert.equal(stored.keenableAllowPublic, undefined);
    assert.equal(stored.keenableApiKey, undefined);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("onboarding CLI setup does not re-prompt when keyless is already opted in", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wsp-cli-"));
  const config = join(dir, "config.json");
  try {
    await writeFile(config, JSON.stringify({ keenableAllowPublic: true }) + "\n");
    // Only the key prompt runs; if a keyless re-prompt appeared it would hang waiting for input.
    await runSetup(["setup", "keenable", "--config", config], [""]);
    const stored = JSON.parse(await readFile(config, "utf8"));
    assert.equal(stored.keenableAllowPublic, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("onboarding CLI status counts keenable as configured when the public tier is opted in", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wsp-cli-"));
  const config = join(dir, "config.json");
  try {
    let status = JSON.parse((await execFileAsync(process.execPath, [CLI, "status", "--config", config, "--json"])).stdout);
    assert.equal(status.configured_providers.includes("keenable"), false, "keenable not configured by default");

    await execFileAsync(process.execPath, [CLI, "config", "--config", config, "--set", "keenableAllowPublic=true", "--json"]);
    status = JSON.parse((await execFileAsync(process.execPath, [CLI, "status", "--config", config, "--json"])).stdout);
    assert.equal(status.configured_providers.includes("keenable"), true, "keenable configured once public opt-in is set");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
