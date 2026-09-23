import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import pluginEntry from "../index.ts";
import { EXTRACT_PARAMETERS_SCHEMA } from "../extract.ts";
import { ALL_PROVIDER_NAMES } from "../routing-config.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "openclaw.plugin.json"), "utf8"));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

test("runtime config schema is the manifest schema, not OpenClaw's empty default", () => {
  assert.deepEqual(pluginEntry.configSchema.jsonSchema, manifest.configSchema);
  assert.deepEqual(pluginEntry.configSchema.uiHints, manifest.uiHints);

  const parsed = pluginEntry.configSchema.safeParse({ serperApiKey: "secret", parallelMode: "fast" });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.serperApiKey, "secret");
    assert.equal(parsed.data.parallelMode, "fast");
    assert.equal(parsed.data.donsetchTier, "auto");
  }
  assert.equal(pluginEntry.configSchema.safeParse({ unknownSetting: true }).success, false);
});

test("manifest, package, and runtime tool contract stay synchronized", () => {
  assert.equal(packageJson.version, manifest.version);
  assert.equal(packageJson.openclaw.build.openclawVersion, packageJson.openclaw.build.pluginSdkVersion);
  assert.equal(packageJson.openclaw.compat.pluginApi, `>=${packageJson.openclaw.compat.minGatewayVersion}`);

  const registered: string[] = [];
  pluginEntry.register({
    pluginConfig: {},
    runtime: { system: {} },
    registerTool(tool: { name: string }) {
      registered.push(tool.name);
    },
  } as any);
  assert.deepEqual(new Set(registered), new Set(manifest.contracts.tools));
  assert.deepEqual(Object.keys(manifest.toolMetadata).sort(), [...manifest.contracts.tools].sort());
  assert.ok(manifest.contracts.tools.every((name: string) => manifest.toolMetadata[name]?.optional === true));
});

test("search and extraction provider enums reflect the 4.0.3 surface", () => {
  const searchSchema = (manifest.contracts.tools as string[]).includes("web_search_plus");
  assert.equal(searchSchema, true);
  assert.deepEqual(
    [...ALL_PROVIDER_NAMES].sort(),
    [
      "brave", "donsetch", "exa", "firecrawl", "keenable", "linkup", "octen",
      "parallel", "querit", "searxng", "serpbase", "serper", "tavily", "tinyfish", "you",
    ].sort(),
  );

  const extractProviders = (EXTRACT_PARAMETERS_SCHEMA.properties.provider.enum as string[])
    .filter((provider) => provider !== "auto");
  assert.deepEqual(
    extractProviders.sort(),
    ["donsetch", "exa", "firecrawl", "keenable", "linkup", "parallel", "serper", "tavily", "you"].sort(),
  );
  assert.equal(extractProviders.includes("hound"), false);
});

test("changelog keeps Unreleased empty and records 4.0.3 review fixes", () => {
  const changelog = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
  const [beforeCurrent] = changelog.split("## [4.3.1]");
  assert.match(beforeCurrent, /^# Changelog\n\n## \[Unreleased\]\n\n$/);
  assert.match(changelog, /## \[4.0.3\].*contribution guide/s);
  assert.match(changelog, /donsetchBin rejects non-absolute/);
  assert.match(changelog, /Monid FAILED envelopes are not retried/);
});

test("publishable files exist and the OpenClaw SDK remains a host dependency", () => {
  for (const relativePath of packageJson.files) {
    assert.ok(fs.existsSync(path.join(root, relativePath)), `missing package file: ${relativePath}`);
  }
  assert.equal(packageJson.peerDependencies.openclaw, packageJson.openclaw.compat.pluginApi);
  assert.ok(packageJson.scripts.build.includes("--external:openclaw/*"));
});


test("manifest accepts configured default count and package version is 4.3.1", () => {
  const parsed = pluginEntry.configSchema.safeParse({ defaults: { max_results: 12 } });
  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal(parsed.data.defaults.max_results, 12);
  assert.equal(packageJson.version, "4.3.1");
});
