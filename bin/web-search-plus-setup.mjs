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
];

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
  const opts = { config: defaultConfigPath(), preset: undefined, json: false, set: [] };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--config") opts.config = args[++i];
    else if (arg === "--preset") opts.preset = args[++i];
    else if (arg === "--json") opts.json = true;
    else if (arg === "--set") opts.set.push(args[++i]);
    else if (!opts.subcommand) opts.subcommand = arg;
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
  return PROVIDERS.filter((provider) => Boolean(config[provider.field]));
}

function print(value, json = false) {
  if (json) console.log(JSON.stringify(value, null, 2));
  else if (typeof value === "string") console.log(value);
  else console.log(JSON.stringify(value, null, 2));
}

async function setupProviders(configPath, selectedProviderNames) {
  const rl = readline.createInterface({ input, output });
  const config = readConfig(configPath);
  try {
    for (const provider of PROVIDERS.filter((p) => selectedProviderNames.includes(p.name))) {
      const current = config[provider.field] ? "configured" : "empty";
      const answer = await rl.question(`${provider.name} (${provider.field}, ${current}) — paste value or Enter to skip: `);
      if (answer.trim()) config[provider.field] = answer.trim();
    }
    writeConfig(configPath, config);
    return config;
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
    print(PROVIDERS.map(({ name, field, capability, starter, guarded }) => ({ name, field, capability, starter, guarded })), opts.json);
    return;
  }

  if (command === "setup") {
    const preset = opts.preset || "full";
    if (!PRESETS[preset]) throw new Error(`Unknown preset: ${preset}`);
    const config = await setupProviders(opts.config, PRESETS[preset]);
    print({ config_path: opts.config, configured_providers: configuredProviders(config).map((p) => p.name) }, opts.json);
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
