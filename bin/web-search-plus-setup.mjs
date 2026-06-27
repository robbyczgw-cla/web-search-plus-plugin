#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const PROVIDERS = [
  { name: "you", field: "youApiKey", capability: "fast factual snippets and general web search", starter: true, guarded: false },
  { name: "serper", field: "serperApiKey", capability: "Google-style local, shopping, community, and current search", starter: true, guarded: false },
  { name: "linkup", field: "linkupApiKey", capability: "source-grounded official, regulatory, finance, and citation-heavy search/extraction", starter: true, guarded: false },
  { name: "tavily", field: "tavilyApiKey", capability: "reliable research search and Tavily-first extraction", starter: false, guarded: false },
  { name: "exa", field: "exaApiKey", capability: "docs/API, arXiv, OSS discovery, deep/deep-reasoning search, and extraction", starter: false, guarded: false },
  { name: "firecrawl", field: "firecrawlApiKey", capability: "robust scraper safety net, vendor/CVE pages, and extraction fallback", starter: false, guarded: false },
  { name: "brave", field: "braveApiKey", capability: "current web and multilingual fallback; guarded in auto routing", starter: false, guarded: true },
  { name: "querit", field: "queritApiKey", capability: "multilingual/current AI search; guarded in auto routing", starter: false, guarded: true },
  { name: "parallel", field: "parallelApiKey", capability: "Parallel search and extraction; guarded in auto routing", starter: false, guarded: true },
  { name: "serpbase", field: "serpbaseApiKey", capability: "Google-style alternate search; guarded in auto routing", starter: false, guarded: true },
  { name: "perplexity", field: "perplexityApiKey", capability: "answer-style source search via direct Perplexity; guarded in auto routing", starter: false, guarded: true },
  { name: "kilo-perplexity", field: "kilocodeApiKey", capability: "Kilo gateway Perplexity-compatible search; guarded in auto routing", starter: false, guarded: true },
  { name: "searxng", field: "searxngInstanceUrl", capability: "self-hosted privacy metasearch", starter: false, guarded: false },
  { name: "keenable", field: "keenableApiKey", keylessField: "keenableAllowPublic", capability: "independent web index search and extraction; optional opt-in keyless public tier (off by default)", starter: false, guarded: false },
];

// Strict opt-in parse, mirroring isTruthy in runtime-config.ts.
function isTruthy(value) {
  if (typeof value === "boolean") return value;
  if (value == null) return false;
  return ["1", "true", "yes", "on"].includes(String(value).trim().replace(/^['"]|['"]$/g, "").toLowerCase());
}

const PRESETS = {
  starter: ["you", "serper", "linkup"],
  full: PROVIDERS.map((p) => p.name),
};

function defaultConfigPath() {
  return path.join(process.cwd(), "web-search-plus-plugin.config.json");
}

function parseArgs(argv) {
  const args = [...argv];
  const command = args.shift() || "status";
  const opts = { config: defaultConfigPath(), preset: undefined, json: false, set: [], keylessPublic: false, positionals: [] };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--config") opts.config = args[++i];
    else if (arg === "--preset") opts.preset = args[++i];
    else if (arg === "--json") opts.json = true;
    else if (arg === "--set") opts.set.push(args[++i]);
    else if (arg === "--keyless-public") opts.keylessPublic = true;
    else {
      opts.positionals.push(arg);
      if (!opts.subcommand) opts.subcommand = arg;
    }
  }
  return { command, opts };
}

function readConfig(configPath) {
  try {
    const text = fs.readFileSync(configPath, "utf8");
    return JSON.parse(text || "{}");
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw error;
  }
}

function writeConfig(configPath, config) {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function configuredProviders(config) {
  // A provider counts as configured when it has a credential, or — for a keyless
  // provider — when its public tier is opted in (keeps status honest about what runs).
  return PROVIDERS.filter((provider) =>
    Boolean(config[provider.field]) || (provider.keylessField && isTruthy(config[provider.keylessField])));
}

function print(value, json = false) {
  if (json) console.log(JSON.stringify(value, null, 2));
  else if (typeof value === "string") console.log(value);
  else console.log(JSON.stringify(value, null, 2));
}

async function setupProviders(configPath, selectedProviderNames, forceKeyless = false) {
  const rl = readline.createInterface({ input, output });
  const config = readConfig(configPath);
  const keylessEnabled = [];
  try {
    for (const provider of PROVIDERS.filter((p) => selectedProviderNames.includes(p.name))) {
      const current = config[provider.field] ? "configured" : "empty";
      const answer = await rl.question(`${provider.name} (${provider.field}, ${current}) — paste value or Enter to skip: `);
      if (answer.trim()) {
        config[provider.field] = answer.trim();
        continue;
      }
      // Skipped the key. For a keyless provider not already opted in, offer the public tier.
      if (!provider.keylessField || isTruthy(config[provider.keylessField])) continue;
      const opt = forceKeyless
        ? "y"
        : (await rl.question(`  Use ${provider.name} keyless public search (no API key)? [y/N, Enter to skip]: `)).trim().toLowerCase();
      if (opt === "y" || opt === "yes") {
        config[provider.keylessField] = true;
        keylessEnabled.push(provider.name);
      }
    }
    writeConfig(configPath, config);
    return { config, keylessEnabled };
  } finally {
    rl.close();
  }
}

async function main() {
  const { command, opts } = parseArgs(process.argv.slice(2));
  if (command === "status") {
    const config = readConfig(opts.config);
    const configured = configuredProviders(config);
    print({
      config_path: opts.config,
      configured_providers: configured.map((p) => p.name),
      missing_starter_providers: PRESETS.starter.filter((name) => !configured.some((p) => p.name === name)),
      capabilities: configured.map((p) => ({ provider: p.name, capability: p.capability, guarded: p.guarded })),
      tools: ["web_search_plus", "web_extract_plus", "web_routing_config_plus"],
      answer_tool_removed: true,
    }, opts.json);
    return;
  }

  if (command === "list") {
    if (opts.subcommand === "presets") {
      print(Object.fromEntries(Object.entries(PRESETS).map(([name, providers]) => [name, { providers }])), opts.json);
      return;
    }
    print(PROVIDERS.map(({ name, field, capability, starter, guarded, keylessField }) => ({ name, field, capability, starter, guarded, keyless: Boolean(keylessField) })), opts.json);
    return;
  }

  if (command === "setup") {
    let selected;
    if (opts.positionals.length) {
      const unknown = opts.positionals.filter((name) => !PROVIDERS.some((p) => p.name === name));
      if (unknown.length) throw new Error(`Unknown provider(s): ${unknown.join(", ")}`);
      selected = opts.positionals;
    } else {
      const preset = opts.preset || "full";
      if (!PRESETS[preset]) throw new Error(`Unknown preset: ${preset}`);
      selected = PRESETS[preset];
    }
    const { config, keylessEnabled } = await setupProviders(opts.config, selected, opts.keylessPublic);
    print({
      config_path: opts.config,
      configured_providers: configuredProviders(config).map((p) => p.name),
      keyless_public_enabled: keylessEnabled,
    }, opts.json);
    return;
  }

  if (command === "config") {
    const config = readConfig(opts.config);
    for (const item of opts.set) {
      const eq = item.indexOf("=");
      if (eq <= 0) throw new Error(`Invalid --set ${item}; expected key=value`);
      config[item.slice(0, eq)] = item.slice(eq + 1);
    }
    if (opts.set.length) writeConfig(opts.config, config);
    print({ config_path: opts.config, config }, opts.json);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
