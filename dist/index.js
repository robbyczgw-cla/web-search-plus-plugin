// index.ts
import crypto2 from "crypto";
import { AsyncLocalStorage } from "async_hooks";
import dns2 from "dns/promises";
import net2 from "net";
import { buildJsonPluginConfigSchema, definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

// openclaw.plugin.json
var openclaw_plugin_default = {
  id: "web-search-plus-plugin-v2",
  name: "Web Search Plus",
  version: "4.4.0",
  description: "OpenClaw-native source-only web search and extraction with Routing v2, research quorum, result provenance, unified freshness/news/locale controls, hosted providers, and an optional separately installed DonSeTch stdio provider.",
  contracts: {
    tools: [
      "web_search_plus",
      "web_extract_plus",
      "web_routing_config_plus",
      "web_search_health_plus",
      "web_extract_benchmark_plus"
    ]
  },
  toolMetadata: {
    web_search_plus: {
      optional: true
    },
    web_extract_plus: {
      optional: true
    },
    web_routing_config_plus: {
      optional: true
    },
    web_search_health_plus: {
      optional: true
    },
    web_extract_benchmark_plus: {
      optional: true
    }
  },
  activation: {
    onStartup: false
  },
  skills: [
    "./SKILL.md"
  ],
  configSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      serperApiKey: {
        type: "string",
        description: "Serper API key for Google-style web search. Optional individually, but at least one provider setting in this plugin must be configured."
      },
      braveApiKey: {
        type: "string",
        description: "Brave Search API key for general web, current, and shopping-style search. Optional individually, but at least one provider setting in this plugin must be configured."
      },
      braveSafesearch: {
        type: "string",
        enum: ["strict", "moderate", "off"],
        description: "Optional Brave safesearch default: `strict`, `moderate`, or `off`."
      },
      tavilyApiKey: {
        type: "string",
        description: "Tavily API key for research-oriented search. Optional individually, but at least one provider setting in this plugin must be configured."
      },
      linkupApiKey: {
        type: "string",
        description: "Linkup API key for source-grounded search with citations, references, and evidence-focused queries. Optional individually, but at least one provider setting in this plugin must be configured."
      },
      queritApiKey: {
        type: "string",
        description: "Querit API key for multilingual AI search. Optional individually, but at least one provider setting in this plugin must be configured."
      },
      exaApiKey: {
        type: "string",
        description: "Exa API key for source-result neural search and extraction. Answer-producing deep modes are intentionally not exposed."
      },
      firecrawlApiKey: {
        type: "string",
        description: "Firecrawl API key for web search with optional page extraction metadata and Google-style recency/domain filtering. Optional individually, but at least one provider setting in this plugin must be configured."
      },
      youApiKey: {
        type: "string",
        description: "You.com API key for source-result general web search and extraction."
      },
      searxngInstanceUrl: {
        type: "string",
        description: "Base URL for a SearXNG instance. Optional individually, but at least one provider setting in this plugin must be configured."
      },
      searxngAllowPrivate: {
        type: "boolean",
        description: "Optional danger flag. When true, disables SearXNG SSRF/private-network protection and should only be used on fully trusted private networks."
      },
      routingConfigPath: {
        type: "string",
        description: "Optional namespace for in-memory routing preferences used by web_routing_config_plus. No filesystem reads are performed at runtime."
      },
      routingPreferences: {
        type: "object",
        description: "Initial routing preferences, including profile=standard or profile=self_hosted. Runtime updates remain in the selected in-memory namespace."
      },
      parallelApiKey: {
        type: "string",
        description: "Parallel API key for source search and extraction. Parallel participates in automatic routing by default in 4.0.2+."
      },
      parallelMode: {
        type: "string",
        enum: ["turbo", "fast", "basic", "advanced"],
        default: "fast",
        description: "Parallel Search mode. Defaults to fast; other modes can change latency and provider cost."
      },
      serpbaseApiKey: {
        type: "string",
        description: "SerpBase API key for guarded Google-style alternate search. Optional individually, but at least one provider setting in this plugin must be configured."
      },
      keenableApiKey: {
        type: "string",
        description: "Keenable API key for independent-index search and extraction. Optional individually, but at least one provider setting in this plugin must be configured."
      },
      keenableAllowPublic: {
        type: "boolean",
        description: "Opt-in: allow Keenable's keyless public tier. Queries and fetched URLs are sent to an unauthenticated shared service (~1000 req/hour, no SLA). Off by default."
      },
      monidApiKey: {
        type: "string",
        description: "Monid API key for the explicit-only Octen source-search adapter. Billing uses the operator's Monid wallet."
      },
      octenTimeoutSeconds: {
        type: "integer",
        minimum: 1,
        maximum: 120,
        description: "Octen via Monid request timeout in seconds (default 30)."
      },
      tinyfishApiKey: {
        type: "string",
        description: "TinyFish BYOK key for explicit-only source search. Review TinyFish terms before sending sensitive queries; its published terms grant broad training/model-improvement rights."
      },
      tinyfishTimeoutSeconds: {
        type: "integer",
        minimum: 1,
        maximum: 120,
        description: "TinyFish request timeout in seconds (default 30)."
      },
      donsetchBin: {
        type: "string",
        description: "Absolute path to a separately installed DonSeTch executable. The plugin does not bundle DonSeTch or invoke a shell."
      },
      donsetchTimeoutSeconds: {
        type: "integer",
        minimum: 5,
        maximum: 600,
        description: "DonSeTch stdio MCP session deadline in seconds (default 180)."
      },
      donsetchMaxContentChars: {
        type: "integer",
        minimum: 500,
        maximum: 2e5,
        description: "Maximum content characters requested from DonSeTch web_fetch per URL (default 15000)."
      },
      donsetchTier: {
        enum: ["auto", 1, 2],
        default: "auto",
        description: "DonSeTch fetch tier: auto, 1, or 2. render_js forces tier 2."
      },
      extractAllowPrivateUrls: {
        type: "boolean",
        description: "Opt-in danger flag. When true, web_extract_plus may target private/internal URLs (trusted intranet extraction). Off by default."
      },
      extractCharLimit: {
        type: "integer",
        minimum: 1e3,
        description: "Per-result inline character budget applied after aggregate prefix allocation and before head/tail truncation (default 15000, minimum 1000)."
      },
      extractMaxUrls: {
        type: "integer",
        minimum: 1,
        maximum: 50,
        description: "Operator ceiling for URLs processed by one extraction call (default 10, hard maximum 50)."
      },
      extractMaxContextChars: {
        type: "integer",
        minimum: 1e3,
        maximum: 2e5,
        description: "Operator ceiling for aggregate inline extraction prefixes in Unicode codepoints, applied before per-result head/tail truncation (default 60000, range 1000-200000)."
      },
      extractCacheMaxEntries: {
        type: "number",
        minimum: 1,
        maximum: 500,
        description: "Maximum process-local LRU entries for completed extraction requests (default 64, range 1-500). Entries are discarded when the host restarts."
      },
      extractCacheMaxChars: {
        type: "number",
        minimum: 1,
        maximum: 2e7,
        description: "Maximum Unicode codepoints retained by the process-local extraction full-text LRU (default 4000000, range 1-20000000). Entries are discarded when the host restarts."
      },
      extractDeadlineSeconds: {
        type: "integer",
        minimum: 1,
        maximum: 180,
        description: "Operator ceiling for request-scoped extraction deadline in seconds (default 30, range 1-180). This is not a daily quota."
      },
      localeCountry: {
        type: "string",
        description: 'Default search country (ISO 3166-1 alpha-2, e.g. "at") for locale-capable providers including Serper, SerpBase, Brave, Querit, Firecrawl, You.com, SearXNG, and TinyFish.'
      },
      localeLanguage: {
        type: "string",
        description: 'Default search language (ISO 639-1, e.g. "de") or "auto" for conservative query language inference. Without this the providers keep their en defaults.'
      },
      parallelMaxCharsPerResult: {
        type: "number",
        description: "Parallel extraction full_content budget per result in characters (default 60000)."
      },
      parallelMaxCharsTotal: {
        type: "number",
        description: "Parallel extraction total character budget (default 120000)."
      },
      qualityBlockedDomains: {
        type: "array",
        items: {
          type: "string"
        },
        description: "Extra domains removed from search results in addition to the built-in spam/mirror blocklist (exact domain or true subdomain matches only)."
      },
      qualityAllowedDomains: {
        type: "array",
        items: {
          type: "string"
        },
        description: "Domains rescued from the built-in and extra blocklists."
      },
      qualityDiversityRerank: {
        type: "boolean",
        description: "Opt-in: in research mode, move URL/content near-duplicate candidates behind the diverse result head without dropping them."
      },
      defaults: {
        type: "object",
        additionalProperties: false,
        properties: {
          max_results: {
            type: "integer",
            description: "Default search result count; clamped to 1\u201320."
          }
        }
      }
    }
  },
  uiHints: {
    serperApiKey: {
      label: "Serper API Key",
      placeholder: "sk-...",
      sensitive: true
    },
    braveApiKey: {
      label: "Brave API Key",
      placeholder: "BSA...",
      sensitive: true
    },
    braveSafesearch: {
      label: "Brave Safesearch",
      placeholder: "moderate",
      sensitive: false
    },
    tavilyApiKey: {
      label: "Tavily API Key",
      placeholder: "tvly-...",
      sensitive: true
    },
    linkupApiKey: {
      label: "Linkup API Key",
      placeholder: "...",
      sensitive: true
    },
    queritApiKey: {
      label: "Querit API Key",
      placeholder: "querit-sk-...",
      sensitive: true
    },
    exaApiKey: {
      label: "Exa API Key",
      placeholder: "exa-...",
      sensitive: true
    },
    firecrawlApiKey: {
      label: "Firecrawl API Key",
      placeholder: "fc-...",
      sensitive: true
    },
    youApiKey: {
      label: "You.com API Key",
      placeholder: "...",
      sensitive: true
    },
    searxngInstanceUrl: {
      label: "SearXNG Instance URL",
      placeholder: "https://searx.example.com",
      description: "Self-hosted metasearch instance URL. Counts as a configured provider even without an API key.",
      sensitive: false
    },
    searxngAllowPrivate: {
      label: "Allow private-network SearXNG (danger)",
      description: "Disables SearXNG SSRF/private-network protection. Only enable on fully trusted private networks.",
      sensitive: false
    },
    routingConfigPath: {
      label: "Routing preferences namespace",
      placeholder: "default",
      description: "Optional namespace for runtime routing behavior. Secrets remain in plugin config; behavior is kept in process memory to avoid runtime filesystem reads.",
      sensitive: false
    },
    parallelApiKey: {
      label: "Parallel API Key",
      placeholder: "par-...",
      sensitive: true
    },
    parallelMode: {
      label: "Parallel Search mode",
      placeholder: "fast",
      description: "Default fast. Turbo/basic/advanced may change latency and cost.",
      sensitive: false
    },
    serpbaseApiKey: {
      label: "SerpBase API Key",
      placeholder: "sb-...",
      sensitive: true
    },
    keenableApiKey: {
      label: "Keenable API Key",
      placeholder: "...",
      sensitive: true
    },
    keenableAllowPublic: {
      label: "Allow Keenable keyless public tier",
      description: "Sends queries and fetched URLs to Keenable's unauthenticated shared service. Off by default.",
      sensitive: false
    },
    monidApiKey: {
      label: "Monid API Key (Octen)",
      placeholder: "...",
      sensitive: true
    },
    octenTimeoutSeconds: {
      label: "Octen timeout seconds",
      placeholder: "30",
      sensitive: false
    },
    tinyfishApiKey: {
      label: "TinyFish API Key",
      placeholder: "...",
      description: "Explicit-only BYOK provider. Review TinyFish terms before sending sensitive queries.",
      sensitive: true
    },
    tinyfishTimeoutSeconds: {
      label: "TinyFish timeout seconds",
      placeholder: "30",
      sensitive: false
    },
    donsetchBin: {
      label: "DonSeTch executable",
      placeholder: "/absolute/path/to/donsetch",
      description: "Separately installed executable; no shell is used.",
      sensitive: false
    },
    donsetchTimeoutSeconds: {
      label: "DonSeTch timeout seconds",
      placeholder: "180",
      sensitive: false
    },
    donsetchMaxContentChars: {
      label: "DonSeTch extract chars",
      placeholder: "15000",
      sensitive: false
    },
    donsetchTier: {
      label: "DonSeTch fetch tier",
      placeholder: "auto",
      sensitive: false
    },
    extractAllowPrivateUrls: {
      label: "Allow private-network extraction targets (danger)",
      description: "Disables the private/internal URL guard for web_extract_plus. Only enable on fully trusted private networks.",
      sensitive: false
    },
    extractCharLimit: {
      label: "Extract inline character budget",
      placeholder: "15000",
      sensitive: false
    },
    extractMaxUrls: {
      label: "Extract URL ceiling",
      placeholder: "10",
      sensitive: false
    },
    extractMaxContextChars: {
      label: "Extract aggregate context ceiling",
      placeholder: "60000",
      sensitive: false
    },
    extractCacheMaxEntries: {
      label: "Extract cache entry limit",
      placeholder: "64",
      sensitive: false
    },
    extractCacheMaxChars: {
      label: "Extract cache character limit",
      placeholder: "4000000",
      sensitive: false
    },
    extractDeadlineSeconds: {
      label: "Extract deadline seconds",
      placeholder: "30",
      sensitive: false
    },
    localeCountry: {
      label: "Default search country",
      placeholder: "at",
      sensitive: false
    },
    localeLanguage: {
      label: "Default search language",
      placeholder: "de or auto",
      sensitive: false
    },
    routingPreferences: {
      label: "Initial routing preferences",
      sensitive: false
    },
    parallelMaxCharsPerResult: {
      label: "Parallel extract chars per result",
      placeholder: "60000",
      sensitive: false
    },
    parallelMaxCharsTotal: {
      label: "Parallel extract chars total",
      placeholder: "120000",
      sensitive: false
    },
    qualityBlockedDomains: {
      label: "Extra blocked result domains",
      sensitive: false
    },
    qualityAllowedDomains: {
      label: "Rescued result domains",
      sensitive: false
    },
    qualityDiversityRerank: {
      label: "Rerank research duplicates",
      description: "Moves near-duplicate research results behind the diverse head. Off by default.",
      sensitive: false
    }
  }
};

// runtime-config.ts
function maybeString(value) {
  if (typeof value !== "string") return void 0;
  const trimmed = value.trim();
  return trimmed ? trimmed : void 0;
}
function getRuntimeConfig(pluginConfig, runCommandWithTimeout) {
  return {
    serperApiKey: maybeString(pluginConfig?.serperApiKey),
    braveApiKey: maybeString(pluginConfig?.braveApiKey),
    braveSafesearch: maybeString(pluginConfig?.braveSafesearch),
    tavilyApiKey: maybeString(pluginConfig?.tavilyApiKey),
    linkupApiKey: maybeString(pluginConfig?.linkupApiKey),
    queritApiKey: maybeString(pluginConfig?.queritApiKey),
    exaApiKey: maybeString(pluginConfig?.exaApiKey),
    firecrawlApiKey: maybeString(pluginConfig?.firecrawlApiKey),
    youApiKey: maybeString(pluginConfig?.youApiKey),
    parallelApiKey: maybeString(pluginConfig?.parallelApiKey),
    parallelMode: normalizeParallelMode(pluginConfig?.parallelMode),
    serpbaseApiKey: maybeString(pluginConfig?.serpbaseApiKey),
    monidApiKey: maybeString(pluginConfig?.monidApiKey),
    octenTimeoutSeconds: maybeBoundedInt(pluginConfig?.octenTimeoutSeconds, 1, 120),
    tinyfishApiKey: maybeString(pluginConfig?.tinyfishApiKey),
    tinyfishTimeoutSeconds: maybeBoundedInt(pluginConfig?.tinyfishTimeoutSeconds, 1, 120),
    searxngInstanceUrl: maybeString(pluginConfig?.searxngInstanceUrl),
    searxngAllowPrivate: pluginConfig?.searxngAllowPrivate === true ? true : void 0,
    keenableApiKey: maybeString(pluginConfig?.keenableApiKey),
    keenableAllowPublic: pluginConfig?.keenableAllowPublic === true ? true : void 0,
    donsetchBin: maybeString(pluginConfig?.donsetchBin),
    donsetchTimeoutSeconds: maybeBoundedInt(pluginConfig?.donsetchTimeoutSeconds, 5, 600),
    donsetchMaxContentChars: maybeBoundedInt(pluginConfig?.donsetchMaxContentChars, 500, 2e5),
    donsetchTier: normalizeDonsetchTier(pluginConfig?.donsetchTier),
    runCommandWithTimeout,
    extractAllowPrivateUrls: pluginConfig?.extractAllowPrivateUrls === true ? true : void 0,
    extractCharLimit: Number.isFinite(Number(pluginConfig?.extractCharLimit)) && Number(pluginConfig?.extractCharLimit) > 0 ? Math.max(1e3, Math.floor(Number(pluginConfig.extractCharLimit))) : void 0,
    extractMaxUrls: maybePositiveInt(pluginConfig?.extractMaxUrls),
    extractMaxContextChars: maybePositiveInt(pluginConfig?.extractMaxContextChars),
    extractCacheMaxEntries: maybeBoundedInt(pluginConfig?.extractCacheMaxEntries, 1, 500),
    extractCacheMaxChars: maybeBoundedInt(pluginConfig?.extractCacheMaxChars, 1, 2e7),
    extractDeadlineSeconds: maybeBoundedInt(pluginConfig?.extractDeadlineSeconds, 1, 180),
    localeCountry: maybeString(pluginConfig?.localeCountry),
    localeLanguage: maybeString(pluginConfig?.localeLanguage),
    parallelMaxCharsPerResult: maybePositiveInt(pluginConfig?.parallelMaxCharsPerResult),
    parallelMaxCharsTotal: maybePositiveInt(pluginConfig?.parallelMaxCharsTotal),
    qualityDiversityRerank: pluginConfig?.qualityDiversityRerank === true ? true : void 0
  };
}
function normalizeParallelMode(value) {
  if (value == null || String(value).trim() === "") return "fast";
  const normalized = String(value).trim().toLowerCase();
  if (["turbo", "fast", "basic", "advanced"].includes(normalized)) return normalized;
  throw new Error("parallelMode must be one of turbo, fast, basic, advanced");
}
function normalizeDonsetchTier(value) {
  if (value == null || String(value).trim() === "") return "auto";
  if (value === 1 || value === "1") return 1;
  if (value === 2 || value === "2") return 2;
  if (String(value).trim().toLowerCase() === "auto") return "auto";
  throw new Error("donsetchTier must be auto, 1, or 2");
}
function maybePositiveInt(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : void 0;
}
function maybeBoundedInt(value, minimum, maximum) {
  const parsed = maybePositiveInt(value);
  return parsed == null ? void 0 : Math.min(maximum, Math.max(minimum, parsed));
}

// routing-config.ts
var ALL_PROVIDER_NAMES = ["serper", "brave", "tavily", "linkup", "querit", "exa", "firecrawl", "you", "searxng", "parallel", "serpbase", "keenable", "donsetch", "octen", "tinyfish"];
var DEFAULT_PROVIDER_PRIORITY = ["brave", "serper", "exa", "tavily", "you", "firecrawl", "linkup", "parallel", "serpbase", "querit", "searxng", "keenable"];
var PRE_5_DEFAULT_PROVIDER_PRIORITY = ["you", "serper", "exa", "firecrawl", "tavily", "linkup", "brave", "parallel", "serpbase", "querit", "searxng", "keenable"];
function sameProviderList(left, right) {
  return left.length === right.length && left.every((provider, index) => provider === right[index]);
}
function isCustomProviderOrder(priority) {
  if (!priority || !priority.length) return false;
  return !sameProviderList(priority, DEFAULT_PROVIDER_PRIORITY) && !sameProviderList(priority, PRE_5_DEFAULT_PROVIDER_PRIORITY);
}
var DEFAULT_EXTRACT_PROVIDER_PRIORITY = ["tavily", "exa", "linkup", "parallel", "firecrawl", "you", "keenable", "serper", "donsetch"];
var GUARDED_AUTO_PROVIDERS = ["serpbase", "querit", "donsetch", "octen", "tinyfish"];
var DEFAULT_ROUTING_PREFERENCES = {
  version: 2,
  profile: "standard",
  auto_routing: true,
  default_provider: null,
  provider_priority: [...DEFAULT_PROVIDER_PRIORITY],
  extract_provider_priority: [...DEFAULT_EXTRACT_PROVIDER_PRIORITY],
  fallback_provider: "serper",
  disabled_providers: [],
  confidence_threshold: 0.3,
  auto_allow: Object.fromEntries(ALL_PROVIDER_NAMES.map((provider) => [provider, !GUARDED_AUTO_PROVIDERS.includes(provider)]))
};
var memoryRoutingPreferences = /* @__PURE__ */ new Map();
function cloneConfig(config) {
  return {
    ...config,
    provider_priority: [...config.provider_priority],
    extract_provider_priority: [...config.extract_provider_priority],
    disabled_providers: [...config.disabled_providers],
    auto_allow: { ...config.auto_allow }
  };
}
function cloneDefaults() {
  return cloneConfig(DEFAULT_ROUTING_PREFERENCES);
}
function applyRoutingProfile(config) {
  const effective = cloneConfig(config);
  if (effective.profile !== "self_hosted") return effective;
  effective.provider_priority = [
    "searxng",
    "keenable",
    ...DEFAULT_PROVIDER_PRIORITY.filter((provider) => provider !== "searxng" && provider !== "keenable")
  ];
  effective.extract_provider_priority = [
    "keenable",
    ...DEFAULT_EXTRACT_PROVIDER_PRIORITY.filter((provider) => provider !== "keenable")
  ];
  effective.fallback_provider = "keenable";
  effective.auto_allow = Object.fromEntries(
    ALL_PROVIDER_NAMES.map((provider) => [provider, provider === "searxng" || provider === "keenable"])
  );
  return effective;
}
function normalizeProviderName(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/_/g, "-");
  if (ALL_PROVIDER_NAMES.includes(normalized)) return normalized;
  throw new Error(`Unknown provider: ${String(value || "")}`);
}
function normalizeOptionalProvider(value) {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized || ["null", "none", "default", "auto"].includes(normalized)) return null;
  return normalizeProviderName(value);
}
function normalizeProviderList(values, allowEmpty = true) {
  if (!Array.isArray(values)) {
    if (allowEmpty) return [];
    throw new Error("Provider list must be an array");
  }
  const unique = [];
  const seen = /* @__PURE__ */ new Set();
  for (const value of values) {
    const provider = normalizeProviderName(value);
    if (!seen.has(provider)) {
      seen.add(provider);
      unique.push(provider);
    }
  }
  return unique;
}
function normalizePriority(values) {
  const requested = normalizeProviderList(values, false);
  const seen = new Set(requested);
  const completed = [...requested];
  for (const provider of DEFAULT_PROVIDER_PRIORITY) {
    if (!seen.has(provider)) completed.push(provider);
  }
  return completed;
}
function normalizeExtractPriority(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("Extract provider priority must be a non-empty array");
  }
  const requested = [];
  for (const value of values) {
    const provider = normalizeProviderName(value);
    if (!DEFAULT_EXTRACT_PROVIDER_PRIORITY.includes(provider)) {
      throw new Error(`Provider does not support extraction: ${provider}`);
    }
    if (!requested.includes(provider)) requested.push(provider);
  }
  for (const provider of DEFAULT_EXTRACT_PROVIDER_PRIORITY) {
    if (!requested.includes(provider)) requested.push(provider);
  }
  return requested;
}
function normalizeAutoAllow(value) {
  const defaults = { ...DEFAULT_ROUTING_PREFERENCES.auto_allow };
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  for (const [rawProvider, rawAllowed] of Object.entries(value)) {
    const provider = normalizeProviderName(rawProvider);
    defaults[provider] = rawAllowed === true;
  }
  return defaults;
}
function normalizeThreshold(value) {
  const threshold = Number(value);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new Error(`Invalid confidence_threshold: ${String(value)}`);
  }
  return Number(threshold.toFixed(3));
}
function resolveRoutingConfigPath(pluginConfig = {}) {
  const configuredName = typeof pluginConfig?.routingConfigPath === "string" && pluginConfig.routingConfigPath.trim() ? pluginConfig.routingConfigPath.trim() : "default";
  return `memory:${configuredName}`;
}
function validateRoutingPreferences(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Routing config must be a JSON object");
  }
  const input = raw;
  const config = cloneDefaults();
  if (input.profile != null) {
    const profile = String(input.profile).trim().toLowerCase();
    if (profile !== "standard" && profile !== "self_hosted") throw new Error(`Unknown routing profile: ${String(input.profile)}`);
    config.profile = profile;
  }
  config.auto_routing = input.auto_routing == null ? config.auto_routing : Boolean(input.auto_routing);
  config.default_provider = input.default_provider == null ? config.default_provider : normalizeOptionalProvider(input.default_provider);
  config.provider_priority = input.provider_priority == null ? config.provider_priority : normalizePriority(input.provider_priority);
  if (sameProviderList(config.provider_priority, PRE_5_DEFAULT_PROVIDER_PRIORITY)) config.provider_priority = [...DEFAULT_PROVIDER_PRIORITY];
  config.extract_provider_priority = input.extract_provider_priority == null ? config.extract_provider_priority : normalizeExtractPriority(input.extract_provider_priority);
  config.fallback_provider = input.fallback_provider == null ? config.fallback_provider : normalizeOptionalProvider(input.fallback_provider);
  config.disabled_providers = input.disabled_providers == null ? config.disabled_providers : normalizeProviderList(input.disabled_providers);
  config.confidence_threshold = input.confidence_threshold == null ? config.confidence_threshold : normalizeThreshold(input.confidence_threshold);
  config.auto_allow = input.auto_allow == null ? config.auto_allow : normalizeAutoAllow(input.auto_allow);
  return config;
}
function loadRoutingPreferences(pluginConfig = {}) {
  const path2 = resolveRoutingConfigPath(pluginConfig);
  const existing = memoryRoutingPreferences.get(path2);
  if (existing) return { config: cloneConfig(existing), path: path2, source: "memory" };
  const configuredPreferences = pluginConfig?.routingPreferences;
  if (configuredPreferences != null) {
    try {
      const validated = validateRoutingPreferences(configuredPreferences);
      memoryRoutingPreferences.set(path2, cloneConfig(validated));
      return { config: cloneConfig(validated), path: path2, source: "plugin_config" };
    } catch (error) {
      return {
        config: cloneDefaults(),
        path: path2,
        source: "default",
        warning: `Routing config reset to defaults after validation failure: ${String(error?.message || error)}`
      };
    }
  }
  return { config: cloneDefaults(), path: path2, source: "default" };
}
function saveRoutingPreferences(pluginConfig = {}, config) {
  const path2 = resolveRoutingConfigPath(pluginConfig);
  const validated = validateRoutingPreferences(config);
  memoryRoutingPreferences.set(path2, cloneConfig(validated));
  return { config: cloneConfig(validated), path: path2, source: "memory" };
}
function resetRoutingPreferences(pluginConfig = {}) {
  const path2 = resolveRoutingConfigPath(pluginConfig);
  memoryRoutingPreferences.delete(path2);
  const configuredPreferences = pluginConfig?.routingPreferences;
  if (configuredPreferences != null) {
    return loadRoutingPreferences(pluginConfig);
  }
  return { config: cloneDefaults(), path: path2, source: "default" };
}

// extract.ts
import dns from "dns/promises";
import net from "net";
import crypto from "crypto";

// span-extraction.ts
var TOKEN_RE = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?/gu;
var PARAGRAPH_BREAK_RE = /(?:\r?\n[\t \f\v]*){2,}/g;
var SENTENCE_END_RE = /(?<=[.!?])(?:["'’)\]]*)\s+/gu;
var MARKDOWN_HEADING_RE = /^[\t ]{0,3}(#{1,6})(?:[\t ]+|$)/gm;
var MAX_HEADING_SECTION_CANDIDATES = 2;
var MAX_HEADING_SECTION_CHARS = 1200;
function codepoints(text) {
  return Array.from(text);
}
function codeUnitToCodepointMap(text) {
  const map = new Array(text.length + 1).fill(0);
  let codeUnitIndex = 0;
  let codepointIndex = 0;
  for (const point of text) {
    for (let offset = 0; offset < point.length; offset += 1) {
      map[codeUnitIndex + offset] = codepointIndex;
    }
    codeUnitIndex += point.length;
    codepointIndex += 1;
    map[codeUnitIndex] = codepointIndex;
  }
  return map;
}
function trimCandidate(points, start, end) {
  while (start < end && /\s/u.test(points[start])) start += 1;
  while (end > start && /\s/u.test(points[end - 1])) end -= 1;
  return start < end ? { start, end, text: points.slice(start, end).join("") } : null;
}
function splitLongSegment(points, start, end, limit) {
  const pieces = [];
  let cursor = start;
  while (cursor < end) {
    let boundary = Math.min(end, cursor + limit);
    if (boundary < end) {
      const earliestBreak = cursor + Math.max(1, Math.floor(limit / 2));
      for (let index = boundary; index >= earliestBreak; index -= 1) {
        if (/\s/u.test(points[index - 1])) {
          boundary = index;
          break;
        }
      }
    }
    const candidate = trimCandidate(points, cursor, boundary);
    if (candidate) pieces.push(candidate);
    cursor = boundary;
    while (cursor < end && /\s/u.test(points[cursor])) cursor += 1;
  }
  return pieces;
}
function findRanges(text, expression, start = 0, end = text.length) {
  const mapping = codeUnitToCodepointMap(text);
  const ranges = [];
  expression.lastIndex = start;
  let cursor = start;
  let match;
  while ((match = expression.exec(text)) && match.index < end) {
    ranges.push([mapping[cursor], mapping[match.index]]);
    cursor = match.index + match[0].length;
    if (!match[0].length) expression.lastIndex += 1;
  }
  ranges.push([mapping[cursor], mapping[end]]);
  return ranges;
}
function candidates(text, maxSpanChars) {
  const points = codepoints(text);
  const mapping = codeUnitToCodepointMap(text);
  const paragraphRanges = findRanges(text, PARAGRAPH_BREAK_RE);
  const all = [];
  for (const [paragraphStart, paragraphEnd] of paragraphRanges) {
    const paragraphStartUnits = text.slice(0, mapping.findIndex((value) => value === paragraphStart)).length;
    let paragraphEndUnits = text.length;
    for (let index = paragraphStartUnits; index < mapping.length; index += 1) {
      if (mapping[index] === paragraphEnd) {
        paragraphEndUnits = index;
        break;
      }
    }
    const sentenceRanges = findRanges(text, SENTENCE_END_RE, paragraphStartUnits, paragraphEndUnits);
    const sentenceCandidates = [];
    for (const [start, end] of sentenceRanges) {
      const candidate = trimCandidate(points, start, end);
      if (!candidate) continue;
      if (candidate.end - candidate.start <= maxSpanChars) {
        sentenceCandidates.push(candidate);
      } else {
        sentenceCandidates.push(...splitLongSegment(points, candidate.start, candidate.end, maxSpanChars));
      }
    }
    all.push(...sentenceCandidates);
    for (let index = 0; index + 1 < sentenceCandidates.length; index += 1) {
      const start = sentenceCandidates[index].start;
      const end = sentenceCandidates[index + 1].end;
      if (end - start <= maxSpanChars) {
        all.push({ start, end, text: points.slice(start, end).join("") });
      }
    }
  }
  return [...new Map(all.map((candidate) => [`${candidate.start}:${candidate.end}`, candidate])).values()].sort((left, right) => left.start - right.start || left.end - right.end);
}
function tokens(text) {
  return [...text.matchAll(TOKEN_RE)].map((match) => match[0].toLocaleLowerCase());
}
function headingSectionCandidates(text, query, maxSpanChars, maxSections) {
  const queryTerms = new Set(tokens(query));
  if (!queryTerms.size || maxSections <= 0) return [];
  const mapping = codeUnitToCodepointMap(text);
  const points = codepoints(text);
  const headings = [];
  MARKDOWN_HEADING_RE.lastIndex = 0;
  let match;
  while (match = MARKDOWN_HEADING_RE.exec(text)) {
    const titleStartUnits = match.index + match[0].length;
    const titleEndUnits = text.indexOf("\n", titleStartUnits);
    headings.push({
      start: mapping[match.index],
      level: match[1].length,
      titleStart: mapping[titleStartUnits],
      titleEnd: mapping[titleEndUnits < 0 ? text.length : titleEndUnits]
    });
  }
  const sectionCharBudget = Math.min(maxSpanChars, MAX_HEADING_SECTION_CHARS);
  const ranked = [];
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const titleTerms = new Set(tokens(points.slice(heading.titleStart, heading.titleEnd).join("")));
    const matchedTerms = [...queryTerms].filter((term) => titleTerms.has(term)).length;
    if (!matchedTerms) continue;
    let sectionEnd = points.length;
    for (const laterHeading of headings.slice(index + 1)) {
      if (laterHeading.level <= heading.level) {
        sectionEnd = laterHeading.start;
        break;
      }
    }
    const candidate = trimCandidate(
      points,
      heading.start,
      Math.min(sectionEnd, heading.start + sectionCharBudget)
    );
    if (candidate && candidate.end >= heading.titleEnd) {
      ranked.push({ matchedTerms, candidate });
    }
  }
  ranked.sort((left, right) => right.matchedTerms - left.matchedTerms || left.candidate.start - right.candidate.start || left.candidate.end - right.candidate.end);
  return ranked.slice(0, maxSections).map(({ candidate }) => candidate);
}
function lexicalScore(candidate, query, total) {
  const candidateTokens = tokens(candidate.text);
  if (!candidateTokens.length) return 0;
  const uniqueTokens = new Set(candidateTokens);
  const lexicalDensity = Math.min(candidateTokens.length, 80) / Math.max(1, codepoints(candidate.text).length / 8);
  const diversity = uniqueTokens.size / candidateTokens.length;
  const densityScore = Math.min(1, lexicalDensity / 4) + 0.2 * diversity;
  const positionPrior = 0.08 * (1 - candidate.start / Math.max(1, total));
  const queryTokens = tokens(query);
  if (!queryTokens.length) return densityScore + positionPrior;
  const queryUnique = new Set(queryTokens);
  const termOverlap = [...queryUnique].filter((token) => uniqueTokens.has(token)).length / queryUnique.size;
  const queryShingles = new Set(queryTokens.slice(0, -1).map((token, index) => `${token}\0${queryTokens[index + 1]}`));
  const candidateShingles = new Set(candidateTokens.slice(0, -1).map((token, index) => `${token}\0${candidateTokens[index + 1]}`));
  const shingleOverlap = queryShingles.size ? [...queryShingles].filter((shingle) => candidateShingles.has(shingle)).length / queryShingles.size : 0;
  const occurrences = [...queryUnique].reduce(
    (sum, token) => sum + candidateTokens.filter((candidateToken) => candidateToken === token).length,
    0
  );
  const occurrenceBonus = Math.min(1, occurrences / Math.max(1, queryTokens.length));
  return 4 * termOverlap + 2 * shingleOverlap + 0.5 * occurrenceBonus + 0.2 * densityScore + positionPrior;
}
function selectSpans(text, query, options = {}) {
  const maxSpans = options.maxSpans ?? 3;
  const maxSpanChars = options.maxSpanChars ?? 600;
  if (!Number.isInteger(maxSpans) || !Number.isInteger(maxSpanChars)) throw new TypeError("Span limits must be integers");
  if (maxSpans <= 0 || maxSpanChars <= 0) return [];
  const normalized = text.normalize("NFC");
  const normalizedQuery = (query || "").normalize("NFC").trim();
  const headingCandidates = headingSectionCandidates(
    normalized,
    normalizedQuery,
    maxSpanChars,
    Math.min(maxSpans, MAX_HEADING_SECTION_CANDIDATES)
  );
  const allCandidates = /* @__PURE__ */ new Map();
  for (const candidate of [...candidates(normalized, maxSpanChars), ...headingCandidates]) {
    allCandidates.set(`${candidate.start}:${candidate.end}`, candidate);
  }
  const ranked = [...allCandidates.values()].map((candidate) => {
    const score = options.ranker ? options.ranker(candidate.text, normalizedQuery) : lexicalScore(candidate, normalizedQuery, codepoints(normalized).length);
    if (!Number.isFinite(score)) throw new Error("Span ranker scores must be finite numbers");
    return { candidate, score };
  });
  ranked.sort((left, right) => right.score - left.score || left.candidate.start - right.candidate.start || left.candidate.end - right.candidate.end);
  const selected = [];
  for (const candidate of headingCandidates) {
    if (selected.some(({ candidate: existing }) => candidate.start < existing.end && existing.start < candidate.end)) continue;
    const item = ranked.find(({ candidate: rankedCandidate }) => rankedCandidate.start === candidate.start && rankedCandidate.end === candidate.end);
    if (item) selected.push(item);
    if (selected.length >= maxSpans) break;
  }
  for (const item of ranked) {
    if (selected.length >= maxSpans) break;
    if (selected.some(({ candidate }) => item.candidate.start < candidate.end && candidate.start < item.candidate.end)) continue;
    selected.push(item);
  }
  selected.sort((left, right) => left.candidate.start - right.candidate.start);
  return selected.map(({ candidate, score }) => ({ ...candidate, score }));
}

// donsetch-transport.ts
import path from "node:path";
var DONSETCH_TESTED_VERSION = "4.7.0";
var DONSETCH_MCP_PROTOCOL_VERSION = "2025-11-25";
var DEFAULT_TIMEOUT_SECONDS = 180;
var DEFAULT_MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
var DEFAULT_MAX_TEXT_CHARS = 2e5;
var MAX_TOOL_CALLS_PER_SESSION = 50;
var STDERR_EXCERPT_CHARS = 2048;
var RUNNER_STDERR_LIMIT_BYTES = 8 * 1024;
var READINESS_STDOUT_LIMIT_BYTES = 32 * 1024;
var VERSION_RE = /(\d+)\.(\d+)\.(\d+)/;
var SECRET_ASSIGNMENT_RE = /\b(api[_-]?key|token|secret|password|authorization)\b(\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi;
var BEARER_RE = /\bbearer\s+[^\s,;]+/gi;
var URL_CREDENTIALS_RE = /\b(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi;
var HOME_PATH_RE = /(?:\/root|\/home\/[^/\s]+|\/Users\/[^/\s]+)(?=\/|\b)/gi;
var DonsetchTransportError = class extends Error {
  code;
  diagnostic;
  constructor(code, diagnostic = "") {
    super(code);
    this.name = "DonsetchTransportError";
    this.code = code;
    const safeDiagnostic = sanitizeDonsetchDiagnostic(diagnostic);
    if (safeDiagnostic) this.diagnostic = safeDiagnostic;
  }
};
function boundedInt(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
}
function byteLength(value) {
  return Buffer.byteLength(value, "utf8");
}
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error ?? "");
}
function sanitizeDonsetchDiagnostic(value, limit = STDERR_EXCERPT_CHARS) {
  if (typeof value !== "string" || !value) return "";
  const boundedLimit = boundedInt(limit, STDERR_EXCERPT_CHARS, 0, 8192);
  if (!boundedLimit) return "";
  const cleaned = value.replace(SECRET_ASSIGNMENT_RE, (_match, label, separator) => `${label}${separator}[redacted]`).replace(BEARER_RE, "Bearer [redacted]").replace(URL_CREDENTIALS_RE, "$1[redacted]@").replace(HOME_PATH_RE, "[path]").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
  return cleaned.length > boundedLimit ? `${cleaned.slice(0, boundedLimit)}\u2026` : cleaned;
}
function normalizeBinary(binary) {
  const candidate = typeof binary === "string" ? binary.trim() : "";
  if (!candidate || /[\u0000\r\n]/.test(candidate) || !path.isAbsolute(candidate) || candidate.split(/[\\/]/).some((segment) => segment === "." || segment === "..")) {
    throw new DonsetchTransportError("donsetch_binary_not_configured");
  }
  return candidate;
}
var PRESERVED_ENV_KEYS = /* @__PURE__ */ new Set([
  "PATH",
  "HOME",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TZ",
  "TMPDIR",
  "TMP",
  "TEMP",
  "XDG_CACHE_HOME",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
  "XDG_RUNTIME_DIR",
  "DISPLAY",
  "WAYLAND_DISPLAY",
  "DBUS_SESSION_BUS_ADDRESS",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
  "NODE_EXTRA_CA_CERTS",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "no_proxy",
  "SystemRoot",
  "WINDIR",
  "ComSpec",
  "PATHEXT",
  "LOCALAPPDATA",
  "APPDATA",
  "USERPROFILE"
]);
function preserveEnvironmentKey(key) {
  return PRESERVED_ENV_KEYS.has(key) || key.startsWith("DONSETCH_") || key.startsWith("PLAYWRIGHT_") || key.startsWith("PUPPETEER_");
}
function isolatedDonsetchEnvironment() {
  const isolated = {};
  for (const [key, value] of Object.entries(process.env)) {
    isolated[key] = preserveEnvironmentKey(key) ? value : void 0;
  }
  return isolated;
}
function buildSessionInput(calls) {
  const messages = [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: DONSETCH_MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "web-search-plus", version: DONSETCH_TESTED_VERSION }
      }
    },
    { jsonrpc: "2.0", method: "notifications/initialized", params: {} }
  ];
  calls.forEach((call, index) => {
    messages.push({
      jsonrpc: "2.0",
      id: index + 2,
      method: "tools/call",
      params: { name: call.tool, arguments: call.arguments }
    });
  });
  return `${messages.map((message) => JSON.stringify(message)).join("\n")}
`;
}
function responseMessages(stdout) {
  const byId = /* @__PURE__ */ new Map();
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
    const id = Number(parsed.id);
    if (!Number.isSafeInteger(id) || id < 1) continue;
    if (byId.has(id)) throw new DonsetchTransportError("donsetch_mcp_contract_failed");
    byId.set(id, parsed);
  }
  return byId;
}
function resultFor(messages, id, initialize = false) {
  const message = messages.get(id);
  if (!message) throw new DonsetchTransportError("donsetch_mcp_contract_failed");
  if (message.error) {
    throw new DonsetchTransportError(initialize ? "donsetch_mcp_initialize_failed" : "donsetch_mcp_call_failed");
  }
  const result = message.result;
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new DonsetchTransportError("donsetch_mcp_contract_failed");
  }
  return result;
}
function boundedTextContent(value, maxChars) {
  const parts = [];
  if (typeof value === "string") {
    parts.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string") parts.push(item);
      else if (item && typeof item === "object" && !Array.isArray(item) && typeof item.text === "string") {
        parts.push(item.text);
      }
    }
  }
  const text = parts.join("\n");
  return {
    text: text.slice(0, maxChars),
    originalChars: text.length,
    truncated: text.length > maxChars
  };
}
function payloadFromResult(result, maxTextChars) {
  if (result.isError === true || result.is_error === true) {
    throw new DonsetchTransportError("donsetch_tool_error");
  }
  const preferred = result.structuredContent;
  const alternate = result.structured_content;
  const structured = preferred && typeof preferred === "object" && !Array.isArray(preferred) ? preferred : alternate && typeof alternate === "object" && !Array.isArray(alternate) ? alternate : {};
  const content = boundedTextContent(result.content, maxTextChars);
  return {
    structured,
    meta: result._meta && typeof result._meta === "object" && !Array.isArray(result._meta) ? result._meta : {},
    text: content.text,
    textTruncated: content.truncated,
    originalTextChars: content.originalChars
  };
}
function timedOut(result) {
  return result.termination === "timeout" || result.termination === "no-output-timeout" || result.noOutputTimedOut === true;
}
async function runDonsetchSession(runCommandWithTimeout, binaryValue, calls, options = {}) {
  const binary = normalizeBinary(binaryValue);
  if (!Array.isArray(calls) || !calls.length || calls.length > MAX_TOOL_CALLS_PER_SESSION) {
    throw new DonsetchTransportError("donsetch_mcp_contract_failed");
  }
  if (calls.some((call) => !call || !["web_search", "web_fetch"].includes(call.tool))) {
    throw new DonsetchTransportError("donsetch_mcp_contract_failed");
  }
  const timeoutSeconds = boundedInt(options.timeoutSeconds, DEFAULT_TIMEOUT_SECONDS, 5, 600);
  const maxResponseBytes = boundedInt(options.maxResponseBytes, DEFAULT_MAX_RESPONSE_BYTES, 1024, 16 * 1024 * 1024);
  const maxTextChars = boundedInt(options.maxTextChars, DEFAULT_MAX_TEXT_CHARS, 500, 1e6);
  const input = buildSessionInput(calls);
  let completed;
  try {
    completed = await runCommandWithTimeout([binary, "mcp"], {
      timeoutMs: timeoutSeconds * 1e3,
      noOutputTimeoutMs: timeoutSeconds * 1e3,
      // OpenClaw 2026.5.2 ignores these forward-compatible options, so the
      // mandatory byte check below remains the compatibility backstop.
      maxOutputBytes: { stdout: maxResponseBytes, stderr: RUNNER_STDERR_LIMIT_BYTES },
      maxCombinedOutputBytes: maxResponseBytes + RUNNER_STDERR_LIMIT_BYTES,
      killProcessTree: true,
      terminateOnOutputLimit: true,
      input,
      env: isolatedDonsetchEnvironment()
    });
  } catch (error) {
    throw new DonsetchTransportError("donsetch_process_failed", errorMessage(error));
  }
  const stderr = sanitizeDonsetchDiagnostic(completed.stderr);
  if (completed.termination === "output-limit" || completed.outputLimitExceeded === true) {
    throw new DonsetchTransportError("donsetch_response_too_large", stderr);
  }
  if (byteLength(completed.stdout) > maxResponseBytes) {
    throw new DonsetchTransportError("donsetch_response_too_large", stderr);
  }
  if (timedOut(completed)) throw new DonsetchTransportError("donsetch_timeout", stderr);
  if (completed.code !== 0 || completed.killed === true) {
    throw new DonsetchTransportError("donsetch_process_failed", stderr);
  }
  const messages = responseMessages(completed.stdout);
  resultFor(messages, 1, true);
  return calls.map((_call, index) => payloadFromResult(resultFor(messages, index + 2), maxTextChars));
}
function parsedVersion(value) {
  const match = VERSION_RE.exec(value);
  if (!match) return null;
  return `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`;
}
function donsetchVersionCompatibility(version) {
  if (!version) return "unknown";
  const versionParts = version.split(".").map(Number);
  const testedParts = DONSETCH_TESTED_VERSION.split(".").map(Number);
  if (versionParts.some((part) => !Number.isInteger(part)) || versionParts.length !== 3) return "unknown";
  if (versionParts.every((part, index) => part === testedParts[index])) return "tested";
  return "compatible_unverified";
}
async function inspectDonsetchReadiness(runCommandWithTimeout, binaryValue, options = {}) {
  const base = {
    state: "missing",
    version: null,
    testedVersion: DONSETCH_TESTED_VERSION,
    compatibility: "unknown",
    binaryConfigured: false
  };
  let binary;
  try {
    binary = normalizeBinary(binaryValue);
  } catch {
    return base;
  }
  base.binaryConfigured = true;
  const timeoutSeconds = boundedInt(options.timeoutSeconds, 5, 1, 15);
  let completed;
  try {
    completed = await runCommandWithTimeout([binary, "--version"], {
      timeoutMs: timeoutSeconds * 1e3,
      noOutputTimeoutMs: timeoutSeconds * 1e3,
      maxOutputBytes: { stdout: READINESS_STDOUT_LIMIT_BYTES, stderr: RUNNER_STDERR_LIMIT_BYTES },
      maxCombinedOutputBytes: READINESS_STDOUT_LIMIT_BYTES + RUNNER_STDERR_LIMIT_BYTES,
      killProcessTree: true,
      terminateOnOutputLimit: true,
      env: isolatedDonsetchEnvironment()
    });
  } catch (error) {
    return { ...base, state: "unavailable", diagnostic: sanitizeDonsetchDiagnostic(errorMessage(error)) || void 0 };
  }
  const diagnostic = sanitizeDonsetchDiagnostic(completed.stderr);
  if (timedOut(completed)) return { ...base, state: "timeout", diagnostic: diagnostic || void 0 };
  if (completed.code !== 0 || completed.killed === true) {
    return { ...base, state: "unavailable", diagnostic: diagnostic || void 0 };
  }
  const versionInput = `${completed.stdout.slice(0, 32768)}
${completed.stderr.slice(0, 32768)}`;
  const version = parsedVersion(versionInput);
  return {
    ...base,
    state: "executable",
    version,
    compatibility: donsetchVersionCompatibility(version)
  };
}

// donsetch-provider.ts
var ALLOWED_SEARCH_TYPES = /* @__PURE__ */ new Set(["search", "news"]);
var ALLOWED_INTENTS = /* @__PURE__ */ new Set(["auto", "web", "code", "paper", "news", "entity"]);
var MAX_URL_CHARS = 8192;
var MAX_TITLE_CHARS = 512;
var MAX_SNIPPET_CHARS = 4096;
function boundedInt2(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
}
function finiteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function boundedString(value, maxChars) {
  return (typeof value === "string" ? value : "").slice(0, maxChars);
}
function cleanStrings(value, limit = 50, maxChars = 256) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, limit).filter((item) => typeof item === "string" && !!item.trim()).map((item) => item.trim().slice(0, maxChars));
}
function cleanDomains(value) {
  return cleanStrings(value, 50, 253).map((domain) => domain.toLowerCase().replace(/^\*\./, "").replace(/\.$/, "")).filter((domain) => !!domain && !/[\s/@]/.test(domain));
}
function domainMatches(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}
function safeHttpUrl(value) {
  if (typeof value !== "string" || !value || value.length > MAX_URL_CHARS) return null;
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) return null;
    return value;
  } catch {
    return null;
  }
}
function urlAllowed(value, includeDomains, excludeDomains) {
  const url = safeHttpUrl(value);
  if (!url) return null;
  const hostname = new URL(url).hostname.toLowerCase().replace(/\.$/, "");
  if (excludeDomains.some((domain) => domainMatches(hostname, domain))) return null;
  if (includeDomains.length && !includeDomains.some((domain) => domainMatches(hostname, domain))) return null;
  return url;
}
function searchIntent(request) {
  const searchType = request.searchType || "search";
  if (!ALLOWED_SEARCH_TYPES.has(searchType)) throw new Error("donsetch_search_type_unsupported");
  if (searchType === "news") return "news";
  return request.category && ALLOWED_INTENTS.has(request.category) ? request.category : "auto";
}
function engineMetadata(structured) {
  const enginesUsed = [];
  const enginesBlocked = [];
  if (Array.isArray(structured.engines)) {
    for (const item of structured.engines.slice(0, 50)) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const engine = boundedString(item.engine, 128);
      if (!engine) continue;
      if (String(item.status || "").toLowerCase() === "ok") enginesUsed.push(engine);
      else enginesBlocked.push(engine);
    }
  }
  if (!enginesUsed.length) enginesUsed.push(...cleanStrings(structured.engines_used, 50, 128));
  if (!enginesBlocked.length) enginesBlocked.push(...cleanStrings(structured.engine_blocked, 50, 128));
  return { enginesUsed, enginesBlocked };
}
function resultRank(value, index) {
  const rank = Number(value);
  return Number.isFinite(rank) && rank >= 1 ? Math.floor(rank) : index + 1;
}
function namespacedDebug(payload, key) {
  const value = payload.meta?.[`com.donsetch/${key}-debug`];
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function parseSearchEvidence(text, rows) {
  const bindings = /* @__PURE__ */ new Map();
  rows.forEach((row, index) => {
    if (row && typeof row === "object" && !Array.isArray(row)) {
      const source = row;
      bindings.set(resultRank(source.rank, index), source);
    }
  });
  const evidence = /* @__PURE__ */ new Map();
  let current;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (!line.startsWith("   ") && /^(Weak results|Degraded retrieval|No results\.|\*degraded:|\*fetch results)/.test(line.trim())) {
      current = void 0;
      continue;
    }
    const header = /^(\d+)\.\s+(.+)$/.exec(line);
    if (header) {
      current = void 0;
      const rank = Number(header[1]);
      const row = bindings.get(rank);
      if (!row) continue;
      const [reference, ...rest] = header[2].trim().split(" \xB7 ");
      const url = typeof row.url === "string" ? row.url : "";
      if (reference !== row.handle && reference !== url && (!url || reference.replace(/\/+$/, "") !== url.replace(/\/+$/, ""))) continue;
      let title = rest.join(" \xB7 ").replace(/\s+·\s+⚠.*$/, "");
      const separator = title.lastIndexOf(" : ");
      if (separator >= 0) title = title.slice(0, separator);
      current = { title: title.trim(), snippet: "" };
      evidence.set(rank, current);
    } else if (current && line.startsWith("   ")) {
      current.snippet = [current.snippet, line.slice(3).trimEnd()].filter(Boolean).join("\n").trim();
    }
  }
  return evidence;
}
async function searchDonsetch(runCommandWithTimeout, request) {
  const query = boundedString(request.query, 2e3).trim();
  if (!query) throw new Error("donsetch_query_required");
  if (request.freshness) throw new Error("donsetch_freshness_unsupported");
  if (request.images) throw new Error("donsetch_image_search_unsupported");
  const maxResults = boundedInt2(request.maxResults, 7, 1, 12);
  const includeDomains = cleanDomains(request.includeDomains);
  const excludeDomains = cleanDomains(request.excludeDomains);
  const [payload] = await runDonsetchSession(
    runCommandWithTimeout,
    request.binary,
    [{
      tool: "web_search",
      arguments: { query, max_results: maxResults, intent: searchIntent(request) }
    }],
    {
      timeoutSeconds: request.timeoutSeconds,
      maxResponseBytes: request.maxResponseBytes,
      maxTextChars: request.maxTextChars
    }
  );
  const upstreamResults = payload.structured.results;
  if (!Array.isArray(upstreamResults)) throw new Error("donsetch_search_contract_failed");
  const debug = namespacedDebug(payload, "search");
  const evidence = parseSearchEvidence(payload.text, upstreamResults);
  const results = [];
  for (const [index, item] of upstreamResults.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const source = item;
    const rank = resultRank(source.rank, index);
    const bound = evidence.get(rank);
    const diagnostic = Array.isArray(debug.results) ? debug.results[index] || {} : {};
    const url = urlAllowed(source.url, includeDomains, excludeDomains);
    if (!url) continue;
    results.push({
      title: boundedString(bound?.title || source.title, MAX_TITLE_CHARS),
      url,
      snippet: boundedString(bound?.snippet || source.snippet, MAX_SNIPPET_CHARS),
      score: finiteNumber(source.score ?? diagnostic.score),
      position: rank,
      source: "donsetch",
      engines: cleanStrings(source.engines ?? diagnostic.engines, 20, 128),
      engines_consensus: boundedString(source.consensus ?? diagnostic.consensus, 512),
      source_type: "web"
    });
    if (results.length >= maxResults) break;
  }
  const engines = engineMetadata({ ...debug, ...payload.structured });
  return {
    provider: "donsetch",
    query,
    results,
    images: [],
    metadata: {
      engines_used: engines.enginesUsed,
      engine_blocked: engines.enginesBlocked,
      intent: boundedString(payload.structured.intent ?? debug.intent, 64),
      cached: (payload.structured.cached ?? debug.cached) === true,
      weak: (payload.structured.weak ?? debug.weak) === true,
      duration_ms: finiteNumber(payload.structured.elapsed_ms ?? debug.elapsed_ms),
      local_sidecar: true
    }
  };
}
function normalizedTier(request) {
  if (request.renderJs) return "2";
  return request.tier === "1" || request.tier === "2" ? request.tier : "auto";
}
function projectFetchItem(payload, requestedUrl, includeImages, includeRawHtml) {
  const debug = namespacedDebug(payload, "fetch");
  const structured = { ...payload.structured };
  for (const key of ["status", "title", "quality", "site", "verdict", "tier"]) {
    if (structured[key] == null) structured[key] = debug[key];
  }
  const observedUrl = safeHttpUrl(structured.url) || requestedUrl;
  const status = boundedInt2(structured.status, 0, 0, 999);
  const verdict = boundedString(structured.verdict, 32).toLowerCase();
  const contentOk = structured.content_ok ?? (verdict === "contentok" && status > 0 && status < 400);
  const failed = contentOk !== true || ["error", "blocked", "failed"].includes(verdict) || status >= 400 || !payload.text.trim();
  if (failed) {
    return {
      url: observedUrl,
      title: "",
      content: "",
      raw_content: "",
      provider: "donsetch",
      error: "donsetch_fetch_failed",
      metadata: { status, local_sidecar: true }
    };
  }
  const result = {
    url: observedUrl,
    title: boundedString(structured.title, MAX_TITLE_CHARS),
    content: payload.text,
    raw_content: payload.text,
    provider: "donsetch",
    metadata: {
      status,
      fetcher: "donsetch",
      page_type: boundedString(structured.content_kind, 128),
      source_type: "web",
      quality: finiteNumber(structured.quality),
      lang: boundedString(structured.lang, 32),
      site: boundedString(structured.site, 256),
      next_offset: structured.next_offset == null ? void 0 : boundedInt2(structured.next_offset, 0, 0, Number.MAX_SAFE_INTEGER),
      local_sidecar: true
    }
  };
  if (includeImages) {
    result.images = cleanStrings(structured.images ?? structured.media, 50, MAX_URL_CHARS).map((url) => safeHttpUrl(url)).filter((url) => !!url).map((url) => ({ url }));
  }
  if (payload.textTruncated) {
    result.truncated = true;
    result.original_chars = payload.originalTextChars;
  }
  if (includeRawHtml) result.raw_error = "donsetch_raw_html_unsupported";
  return result;
}
async function extractDonsetch(runCommandWithTimeout, request) {
  if ((request.outputFormat || "markdown") !== "markdown") throw new Error("donsetch_output_format_unsupported");
  if (!Array.isArray(request.urls) || !request.urls.length || request.urls.length > 50) {
    throw new Error("donsetch_url_count_invalid");
  }
  const urls = request.urls.map((value) => safeHttpUrl(value));
  if (urls.some((url) => !url)) throw new Error("donsetch_url_invalid");
  const safeUrls = urls;
  const maxContentChars = boundedInt2(request.maxContentChars, 15e3, 500, 2e5);
  const payloads = await runDonsetchSession(
    runCommandWithTimeout,
    request.binary,
    safeUrls.map((url) => ({
      tool: "web_fetch",
      arguments: {
        url,
        max_chars: maxContentChars,
        media: request.includeImages === true,
        tier: normalizedTier(request)
      }
    })),
    {
      timeoutSeconds: request.timeoutSeconds,
      maxResponseBytes: request.maxResponseBytes,
      maxTextChars: Math.min(maxContentChars, request.maxTextChars ?? maxContentChars)
    }
  );
  return {
    provider: "donsetch",
    results: payloads.map((payload, index) => projectFetchItem(
      payload,
      safeUrls[index],
      request.includeImages === true,
      request.includeRawHtml === true
    ))
  };
}

// budget-preflight.ts
var MAX_RESEARCH_FANOUT = 3;
var MAX_EXTRACT_DEADLINE_SECONDS = 180;
var DEFAULT_EXTRACT_DEADLINE_SECONDS = 30;
function preflightDeadline(requested, operatorCeiling) {
  const requestedValue = requested == null ? void 0 : Number(requested);
  const ceiling = operatorCeiling == null ? DEFAULT_EXTRACT_DEADLINE_SECONDS : Number(operatorCeiling);
  if (requestedValue != null && (!Number.isInteger(requestedValue) || requestedValue < 1)) {
    throw new Error("deadline_seconds must be a positive integer");
  }
  if (!Number.isInteger(ceiling) || ceiling < 1) {
    throw new Error("operator deadline ceiling must be a positive integer");
  }
  return Math.min(MAX_EXTRACT_DEADLINE_SECONDS, requestedValue ?? ceiling, ceiling);
}
function preflightResearchFanout(providers) {
  return { providers: providers.slice(0, MAX_RESEARCH_FANOUT), omitted: Math.max(0, providers.length - MAX_RESEARCH_FANOUT), max_fanout: MAX_RESEARCH_FANOUT };
}

// extract.ts
var EXTRACT_CACHE_VERSION = 1;
var DEFAULT_EXTRACT_CACHE_MAX_ENTRIES = 64;
var DEFAULT_EXTRACT_CACHE_MAX_CHARS = 4e6;
var extractCache = /* @__PURE__ */ new Map();
var extractCacheChars = 0;
function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stableJson(item)]));
  }
  return value;
}
function cloneResponse(response) {
  return structuredClone(response);
}
function buildExtractCacheKey(identity) {
  return crypto.createHash("sha256").update(JSON.stringify(stableJson(identity))).digest("hex");
}
function extractCacheGet(key) {
  const entry = extractCache.get(key);
  if (!entry) return null;
  extractCache.delete(key);
  extractCache.set(key, entry);
  return cloneResponse(entry.response);
}
function fullTextChars(fullText) {
  return fullText.reduce((total, record) => total + (record ? codepointLength(record.content) + codepointLength(record.raw_content ?? "") : 0), 0);
}
function extractCachePut(key, response, fullText, maxEntries, maxChars) {
  const entryChars = fullTextChars(fullText);
  const previous = extractCache.get(key);
  if (previous) extractCacheChars -= previous.chars;
  extractCache.delete(key);
  if (entryChars > maxChars) return false;
  extractCache.set(key, { response: cloneResponse(response), fullText: structuredClone(fullText), chars: entryChars });
  extractCacheChars += entryChars;
  while (extractCache.size > maxEntries || extractCacheChars > maxChars) {
    const oldestKey = extractCache.keys().next().value;
    extractCacheChars -= extractCache.get(oldestKey).chars;
    extractCache.delete(oldestKey);
  }
  return extractCache.has(key);
}
var MAX_FULLTEXT_RANGE_CHARS = 6e4;
function contentVersion(record) {
  return crypto.createHash("sha256").update(`${record.provider}\0${record.content}\0${record.raw_content ?? record.content}`).digest("hex").slice(0, 16);
}
function fullTextReference(cacheKey, index, record) {
  return `wspx:${EXTRACT_CACHE_VERSION}:${cacheKey}:${index}:${contentVersion(record)}`;
}
function codepointSlice(content, start, end) {
  return Array.from(content).slice(start, end).join("");
}
function readCachedExtractContent(reference, start = 0, end, rawStart, rawEnd) {
  const match = /^wspx:(\d+):([a-f0-9]{64}):(\d+):([a-f0-9]{16})$/.exec(String(reference || ""));
  if (!match || Number(match[1]) !== EXTRACT_CACHE_VERSION) throw new Error("Unknown or expired extraction content reference");
  const entry = extractCache.get(match[2]);
  const index = Number(match[3]);
  const record = entry?.fullText[index];
  if (!record || contentVersion(record) !== match[4]) throw new Error("Unknown or expired extraction content reference");
  const totalChars = Array.from(record.content).length;
  if (!Number.isInteger(start) || start < 0 || start > totalChars) throw new Error("content_start must be a valid Unicode codepoint offset");
  const resolvedEnd = end == null ? Math.min(totalChars, start + MAX_FULLTEXT_RANGE_CHARS) : end;
  if (!Number.isInteger(resolvedEnd) || resolvedEnd < start || resolvedEnd > totalChars || resolvedEnd - start > MAX_FULLTEXT_RANGE_CHARS) {
    throw new Error(`content_end must select at most ${MAX_FULLTEXT_RANGE_CHARS} Unicode codepoints`);
  }
  extractCache.delete(match[2]);
  extractCache.set(match[2], entry);
  const response = {
    content_ref: reference,
    range: { start, end: resolvedEnd, total_chars: totalChars },
    content: codepointSlice(record.content, start, resolvedEnd),
    provider: record.provider
  };
  if (record.raw_content == null) {
    response.raw_content = codepointSlice(record.content, start, resolvedEnd);
    return response;
  }
  const rawTotalChars = Array.from(record.raw_content).length;
  response.raw_content_available = true;
  response.raw_content_chars = rawTotalChars;
  if (rawStart == null && rawEnd == null) return response;
  const resolvedRawStart = rawStart == null ? 0 : rawStart;
  if (!Number.isInteger(resolvedRawStart) || resolvedRawStart < 0 || resolvedRawStart > rawTotalChars) {
    throw new Error("raw_content_start must be a valid Unicode codepoint offset");
  }
  const resolvedRawEnd = rawEnd == null ? Math.min(rawTotalChars, resolvedRawStart + MAX_FULLTEXT_RANGE_CHARS) : rawEnd;
  if (!Number.isInteger(resolvedRawEnd) || resolvedRawEnd < resolvedRawStart || resolvedRawEnd > rawTotalChars || resolvedRawEnd - resolvedRawStart > MAX_FULLTEXT_RANGE_CHARS) {
    throw new Error(`raw_content_end must select at most ${MAX_FULLTEXT_RANGE_CHARS} Unicode codepoints`);
  }
  response.raw_content_range = { start: resolvedRawStart, end: resolvedRawEnd, total_chars: rawTotalChars };
  response.raw_content = codepointSlice(record.raw_content, resolvedRawStart, resolvedRawEnd);
  return response;
}
var EXTRACT_PROVIDER_PRIORITY = [...DEFAULT_EXTRACT_PROVIDER_PRIORITY];
var EXTRACT_PARAMETERS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    urls: { type: "array", items: { type: "string" }, description: "URLs to extract (required unless content_ref is supplied)" },
    content_ref: { type: "string", description: "Process-local full-content reference returned by a prior extraction; valid only while its cache entry remains live." },
    content_start: { type: "integer", minimum: 0, description: "Unicode codepoint offset at which to read a referenced full text (default 0)." },
    content_end: { type: "integer", minimum: 0, description: "Exclusive Unicode codepoint offset for a referenced full text (maximum range 60000)." },
    raw_content_start: { type: "integer", minimum: 0, description: "Unicode codepoint offset for a distinct provider raw text returned by content_ref." },
    raw_content_end: { type: "integer", minimum: 0, description: "Exclusive Unicode codepoint offset for a distinct provider raw text (maximum range 60000)." },
    provider: {
      type: "string",
      enum: ["auto", "firecrawl", "linkup", "tavily", "exa", "parallel", "you", "keenable", "serper", "donsetch"],
      description: "Try this provider first with extraction fallback, or use auto priority (default: auto). Use routing_override_provider for a strict single-provider call."
    },
    routing_override_provider: {
      type: "string",
      enum: ["firecrawl", "linkup", "tavily", "exa", "parallel", "you", "keenable", "serper", "donsetch"],
      description: "Disable automatic extraction routing and force this provider for this request. Reported visibly in routing.override_provider."
    },
    format: {
      type: "string",
      enum: ["markdown", "html"],
      description: "Output format for extracted content (default: markdown)"
    },
    include_images: { type: "boolean", description: "Include image metadata when supported" },
    include_raw_html: { type: "boolean", description: "Include raw HTML when supported" },
    render_js: { type: "boolean", description: "Render JavaScript before extraction when supported" },
    max_urls: {
      type: "integer",
      minimum: 1,
      maximum: 50,
      description: "Maximum URLs to process in request order (default/operator ceiling: 10)"
    },
    max_context_chars: {
      type: "integer",
      minimum: 1e3,
      maximum: 2e5,
      description: "Aggregate inline content prefix budget in Unicode codepoints, applied before the per-result head/tail window (default/operator ceiling: 60000)"
    },
    deadline_seconds: { type: "integer", minimum: 1, maximum: 180, description: "Request deadline for extraction provider starts in seconds (default/operator ceiling: 30)." },
    spans: {
      type: "boolean",
      description: "Return deterministic query-conditioned passages with Unicode codepoint offsets"
    },
    spans_query: {
      type: "string",
      description: "Optional ranking query for spans; lexical-density ranking is used when omitted"
    }
  }
};
function titleFromUrl(url) {
  try {
    const parsed = new URL(url);
    const lastSegment = parsed.pathname.split("/").filter(Boolean).pop();
    return lastSegment || parsed.hostname || url;
  } catch {
    return url;
  }
}
function normalizeExtractResult(provider, url, title = "", content = "", rawContent, extra = {}) {
  const result = {
    url,
    title: title || titleFromUrl(url),
    content: content || "",
    raw_content: rawContent ?? content ?? "",
    provider
  };
  for (const [key, value] of Object.entries(extra)) {
    if (value != null) result[key] = value;
  }
  return result;
}
function normalizeImages(images) {
  if (!Array.isArray(images)) return void 0;
  const normalized = images.map((image) => {
    if (!image) return null;
    if (typeof image === "string") return { url: image };
    if (typeof image.url === "string" && image.url) {
      return { alt: typeof image.alt === "string" ? image.alt : void 0, url: image.url };
    }
    return null;
  }).filter(Boolean);
  return normalized.length ? normalized : void 0;
}
async function requestJson(url, init, timeout = 30) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, timeout) * 1e3);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        if (response.ok) throw new Error(`Provider returned invalid JSON (HTTP ${response.status})`);
      }
    }
    if (!response.ok) {
      const message = data?.error || data?.message || data?.detail || data?.warning || `HTTP ${response.status}`;
      throw new Error(String(message));
    }
    return data;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`Request timed out after ${timeout}s`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
function getExtractApiKey(provider, runtimeConfig) {
  const keyMap = {
    firecrawl: runtimeConfig.firecrawlApiKey,
    linkup: runtimeConfig.linkupApiKey,
    tavily: runtimeConfig.tavilyApiKey,
    exa: runtimeConfig.exaApiKey,
    you: runtimeConfig.youApiKey,
    parallel: runtimeConfig.parallelApiKey,
    keenable: runtimeConfig.keenableApiKey,
    serper: runtimeConfig.serperApiKey,
    donsetch: runtimeConfig.donsetchBin
  };
  return keyMap[provider];
}
function keylessPublicAllowed(provider, runtimeConfig) {
  return provider === "keenable" && runtimeConfig.keenableAllowPublic === true;
}
function hasAnyExtractProviderCredential(runtimeConfig) {
  return EXTRACT_PROVIDER_PRIORITY.some((provider) => isExtractProviderAvailable(provider, runtimeConfig));
}
function isExtractProviderAvailable(provider, runtimeConfig) {
  if (provider === "donsetch") {
    return Boolean(runtimeConfig.donsetchBin && runtimeConfig.runCommandWithTimeout);
  }
  return Boolean(getExtractApiKey(provider, runtimeConfig)) || keylessPublicAllowed(provider, runtimeConfig);
}
var BLOCKED_EXTRACT_HOSTS = /* @__PURE__ */ new Set(["localhost", "metadata.google.internal", "metadata.internal"]);
function isPrivateOrInternalIp(value) {
  const family = net.isIP(value);
  if (family === 4) {
    const octets = value.split(".").map(Number);
    const [a, b] = octets;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 192 && b === 0 && octets[2] === 0) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a >= 224) return true;
    return false;
  }
  if (family === 6) {
    const lower = value.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true;
    if (lower.startsWith("ff")) return true;
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateOrInternalIp(mapped[1]);
    return false;
  }
  return false;
}
async function checkExtractUrl(url, runtimeConfig) {
  if (runtimeConfig.extractAllowPrivateUrls === true) return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return `Invalid URL: ${url}`;
  }
  const hostname = parsed.hostname.trim().toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (!hostname) return `Invalid URL \u2014 hostname is required: ${url}`;
  if (BLOCKED_EXTRACT_HOSTS.has(hostname)) return `Extraction URL blocked: ${hostname} is private/internal`;
  if (net.isIP(hostname)) {
    return isPrivateOrInternalIp(hostname) ? `Extraction URL blocked: ${hostname} is private/internal` : null;
  }
  const records = await dns.lookup(hostname, { all: true, verbatim: true }).catch(() => []);
  if (!records.length) return `Extraction URL blocked: cannot resolve hostname ${hostname}`;
  if (records.some((record) => isPrivateOrInternalIp(record.address))) {
    return `Extraction URL blocked: ${hostname} resolves to a private/internal address`;
  }
  return null;
}
async function extractFirecrawl(urls, apiKey, outputFormat = "markdown", includeImages = false, includeRawHtml = false, renderJs = false, apiUrl = "https://api.firecrawl.dev/v2/scrape", timeout = 60) {
  const formats = outputFormat === "html" ? ["html"] : ["markdown"];
  if (includeRawHtml && !formats.includes("html")) formats.push("html");
  const results = [];
  for (const url of urls) {
    try {
      const body = { url, formats };
      if (renderJs) body.waitFor = 1e3;
      const data = await requestJson(apiUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }, timeout);
      if (data?.success === false) {
        results.push(normalizeExtractResult("firecrawl", url, "", "", void 0, { error: String(data.error || data.warning || "Firecrawl scrape failed") }));
        continue;
      }
      const payload = data?.data && typeof data.data === "object" ? data.data : data;
      const metadata = payload?.metadata && typeof payload.metadata === "object" ? payload.metadata : {};
      const finalUrl = metadata.sourceURL || metadata.url || url;
      const title = metadata.title || "";
      const markdown = String(payload?.markdown || "");
      const html = String(payload?.html || payload?.rawHtml || "");
      const content = outputFormat === "html" ? html : markdown || html;
      let images;
      if (includeImages) {
        const seen = /* @__PURE__ */ new Set();
        const parsedImages = [];
        const ogImage = metadata.ogImage || metadata["og:image"];
        if (typeof ogImage === "string" && ogImage && !seen.has(ogImage)) {
          parsedImages.push({ alt: "og:image", url: ogImage });
          seen.add(ogImage);
        }
        for (const match of markdown.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) {
          const imageUrl = match[2];
          if (!imageUrl || seen.has(imageUrl)) continue;
          parsedImages.push({ alt: match[1] || void 0, url: imageUrl });
          seen.add(imageUrl);
        }
        images = parsedImages.length ? parsedImages : void 0;
      }
      results.push(normalizeExtractResult("firecrawl", finalUrl, title, content, content, {
        raw_html: html || void 0,
        images,
        metadata
      }));
    } catch (error) {
      results.push(normalizeExtractResult("firecrawl", url, "", "", void 0, { error: String(error?.message || error) }));
    }
  }
  return { provider: "firecrawl", results };
}
async function extractLinkup(urls, apiKey, outputFormat = "markdown", includeImages = false, includeRawHtml = false, renderJs = false, apiUrl = "https://api.linkup.so/v1/fetch", timeout = 30) {
  const results = [];
  for (const url of urls) {
    try {
      const data = await requestJson(apiUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          extractImages: includeImages,
          includeRawHtml: includeRawHtml || outputFormat === "html",
          renderJs
        })
      }, timeout);
      if (data?.error) {
        results.push(normalizeExtractResult("linkup", url, "", "", void 0, { error: String(data.error) }));
        continue;
      }
      const markdown = String(data?.markdown || "");
      const rawHtml = String(data?.rawHtml || data?.raw_html || "");
      const content = outputFormat === "html" ? rawHtml : markdown || rawHtml;
      results.push(normalizeExtractResult("linkup", url, "", content, content, {
        raw_html: rawHtml || void 0,
        images: includeImages ? normalizeImages(data?.images) : void 0,
        metadata: data?.metadata && typeof data.metadata === "object" ? data.metadata : void 0
      }));
    } catch (error) {
      results.push(normalizeExtractResult("linkup", url, "", "", void 0, { error: String(error?.message || error) }));
    }
  }
  return { provider: "linkup", results };
}
async function extractTavily(urls, apiKey, outputFormat = "markdown", includeImages = false, _includeRawHtml = false, _renderJs = false, apiUrl = "https://api.tavily.com/extract", timeout = 30) {
  void outputFormat;
  const data = await requestJson(apiUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ urls, include_images: includeImages })
  }, timeout);
  const results = [];
  for (const item of Array.isArray(data?.results) ? data.results : []) {
    const url = String(item?.url || "");
    const content = String(item?.content || item?.raw_content || "");
    const rawContent = String(item?.raw_content || item?.content || "");
    results.push(normalizeExtractResult("tavily", url, String(item?.title || ""), content, rawContent, {
      images: includeImages ? normalizeImages(item?.images) : void 0,
      metadata: item?.metadata && typeof item.metadata === "object" ? item.metadata : void 0
    }));
  }
  for (const failed of Array.isArray(data?.failed_results) ? data.failed_results : []) {
    results.push(normalizeExtractResult("tavily", String(failed?.url || ""), "", "", void 0, {
      error: String(failed?.error || "Tavily extract failed")
    }));
  }
  return { provider: "tavily", results };
}
async function extractExa(urls, apiKey, outputFormat = "markdown", includeImages = false, _includeRawHtml = false, _renderJs = false, apiUrl = "https://api.exa.ai/contents", timeout = 30) {
  void outputFormat;
  const data = await requestJson(apiUrl, {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ urls, text: true })
  }, timeout);
  const results = (Array.isArray(data?.results) ? data.results : []).map((item) => {
    const url = String(item?.url || item?.id || "");
    const content = String(item?.text || item?.summary || "");
    const metadata = {};
    if (item?.summary != null) metadata.summary = item.summary;
    if (item?.highlights != null) metadata.highlights = item.highlights;
    if (item?.publishedDate != null) metadata.published_date = item.publishedDate;
    if (item?.author != null) metadata.author = item.author;
    if (item?.favicon != null) metadata.favicon = item.favicon;
    return normalizeExtractResult("exa", url, String(item?.title || ""), content, content, {
      images: includeImages && item?.image ? [{ alt: "image", url: String(item.image) }] : void 0,
      metadata: Object.keys(metadata).length ? metadata : void 0
    });
  });
  const seen = new Set(results.map((item) => item.url));
  for (const status of Array.isArray(data?.statuses) ? data.statuses : []) {
    const id = String(status?.id || status?.url || "");
    if (!id || status?.status === "success" || seen.has(id)) continue;
    const tag = status?.error?.tag ? String(status.error.tag) : "fetch_failed";
    const http = status?.error?.httpStatusCode ? ` (HTTP ${status.error.httpStatusCode})` : "";
    results.push(normalizeExtractResult("exa", id, "", "", void 0, { error: `Exa could not fetch the URL: ${tag}${http}` }));
    seen.add(id);
  }
  return { provider: "exa", results };
}
var PARALLEL_MAX_CHARS_PER_RESULT = 6e4;
var PARALLEL_MAX_CHARS_TOTAL = 12e4;
async function extractParallel(urls, apiKey, outputFormat = "markdown", _includeImages = false, includeRawHtml = false, _renderJs = false, budgets = {}, apiUrl = "https://api.parallel.ai/v1/extract", timeout = 30) {
  const data = await requestJson(apiUrl, {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      urls,
      max_chars_total: budgets.maxCharsTotal ?? PARALLEL_MAX_CHARS_TOTAL,
      advanced_settings: { full_content: { max_chars_per_result: budgets.maxCharsPerResult ?? PARALLEL_MAX_CHARS_PER_RESULT } }
    })
  }, timeout);
  const rawItems = Array.isArray(data?.results) ? data.results : [];
  const results = rawItems.map((item) => {
    const url = String(item?.url || item?.source_url || "");
    const excerpts = Array.isArray(item?.excerpts) ? item.excerpts : Array.isArray(item?.snippets) ? item.snippets : [];
    const excerptText = excerpts.map((excerpt) => typeof excerpt === "string" ? excerpt : excerpt?.text || excerpt?.content || "").filter(Boolean).join("\n\n");
    const markdown = String(item?.full_content || item?.markdown || item?.content || item?.text || excerptText || "");
    const html = String(item?.html || item?.raw_html || "");
    const content = outputFormat === "html" ? html || markdown : markdown || html;
    return normalizeExtractResult("parallel", url, String(item?.title || ""), content, content, {
      raw_html: includeRawHtml ? html || void 0 : void 0,
      metadata: { search_id: data?.search_id, session_id: data?.session_id, excerpts: excerpts.length ? excerpts : void 0 }
    });
  });
  for (const failed of Array.isArray(data?.errors) ? data.errors : []) {
    results.push(normalizeExtractResult("parallel", typeof failed === "object" ? String(failed?.url || "") : "", "", "", void 0, { error: typeof failed === "string" ? failed : String(failed?.error || "parallel_extract_failed") }));
  }
  return { provider: "parallel", results };
}
async function extractYou(urls, apiKey, outputFormat = "markdown", includeImages = false, includeRawHtml = false, _renderJs = false, apiUrl = "https://ydc-index.io/v1/contents", timeout = 30) {
  void includeImages;
  const formats = [outputFormat === "html" ? "html" : "markdown"];
  if (includeRawHtml && !formats.includes("html")) formats.push("html");
  if (!formats.includes("metadata")) formats.push("metadata");
  const data = await requestJson(apiUrl, {
    method: "POST",
    headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ urls, formats, crawl_timeout: Math.max(1, Math.min(timeout, 60)) })
  }, timeout);
  const rawItems = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : Array.isArray(data?.data) ? data.data : [];
  const results = rawItems.map((item) => {
    const url = String(item?.url || "");
    const markdown = String(item?.markdown || "");
    const html = String(item?.html || "");
    const content = outputFormat === "html" ? html : markdown || html;
    return normalizeExtractResult("you", url, String(item?.title || ""), content, content, {
      raw_html: html || void 0,
      metadata: item?.metadata && typeof item.metadata === "object" ? item.metadata : void 0
    });
  });
  return { provider: "you", results };
}
var BASE64_MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\(\s*data:image\/[^)]+\)/gi;
var BASE64_HTML_IMAGE_RE = /<img\b(?=[^>]*\bsrc=["']data:image\/)[^>]*>/gi;
var DEFAULT_EXTRACT_CHAR_LIMIT = 15e3;
var DEFAULT_EXTRACT_MAX_URLS = 10;
var HARD_EXTRACT_MAX_URLS = 50;
var DEFAULT_EXTRACT_MAX_CONTEXT_CHARS = 6e4;
var MIN_EXTRACT_MAX_CONTEXT_CHARS = 1e3;
var HARD_EXTRACT_MAX_CONTEXT_CHARS = 2e5;
function normalizedCodepoints(content) {
  return Array.from(content.normalize("NFC"));
}
function codepointLength(content) {
  return normalizedCodepoints(content).length;
}
function sanitizeExtractContent(content) {
  let out = content.replace(BASE64_MARKDOWN_IMAGE_RE, (_match, alt) => `[IMAGE: ${String(alt || "image").trim() || "image"}]`);
  out = out.replace(BASE64_HTML_IMAGE_RE, (tag) => {
    const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
    const alt = (altMatch?.[1] || "image").trim() || "image";
    return `[IMAGE: ${alt}]`;
  });
  return out;
}
function splitExtractContent(content, limit) {
  const codepoints2 = normalizedCodepoints(content);
  const headChars = Math.min(Math.max(1, Math.floor(limit * 2 / 3)), Math.max(1, limit - 1));
  const tailChars = Math.min(Math.max(1, Math.floor(limit * 0.2)), Math.max(1, limit - headChars));
  if (headChars + tailChars >= codepoints2.length) return { head: codepoints2.join(""), tail: "", omittedChars: 0 };
  const head = codepoints2.slice(0, headChars).join("").replace(/\s+$/, "");
  const tail = codepoints2.slice(-tailChars).join("").replace(/^\s+/, "");
  return { head, tail, omittedChars: Math.max(0, codepoints2.length - codepointLength(head) - codepointLength(tail)) };
}
function formatTruncatedExtractContent(content, limit) {
  const cleaned = sanitizeExtractContent(content).normalize("NFC");
  const originalChars = codepointLength(cleaned);
  if (originalChars <= limit) return { content: cleaned, truncated: false, originalChars };
  const { head, tail, omittedChars } = splitExtractContent(cleaned, limit);
  const footer = [
    "",
    "---",
    `[Content truncated: original ${originalChars} chars; omitted middle ${omittedChars} chars; showing head and tail.]`,
    "Raise pluginConfig.extractCharLimit for a larger inline budget, or extract a more specific URL for the omitted section."
  ].join("\n");
  return { content: `${head}

[... omitted middle ...]

${tail}
${footer}`, truncated: true, originalChars };
}
function fairShareAllocations(lengths, budget) {
  if (!lengths.length) return [];
  if (lengths.reduce((sum, length) => sum + length, 0) <= budget) return [...lengths];
  const allocations = lengths.map(() => 0);
  let active = lengths.map((_length, index) => index);
  let remaining = budget;
  while (active.length && remaining > 0) {
    const share = Math.floor(remaining / active.length);
    const remainder = remaining % active.length;
    const satisfied = active.filter((index) => lengths[index] - allocations[index] <= share);
    if (satisfied.length) {
      for (const index of satisfied) {
        const need = lengths[index] - allocations[index];
        allocations[index] += need;
        remaining -= need;
      }
      active = active.filter((index) => !satisfied.includes(index));
      continue;
    }
    active.forEach((index, position) => {
      const grant = share + (position < remainder ? 1 : 0);
      allocations[index] += grant;
      remaining -= grant;
    });
    break;
  }
  return allocations;
}
function boundedInteger(value, fallback, minimum, maximum) {
  if (value == null) return fallback;
  if (!Number.isInteger(value)) throw new Error("Extraction context limits must be integers");
  return Math.min(maximum, Math.max(minimum, value));
}
function keenableExtractEndpoint(apiUrl, apiKey, publicAllowed) {
  const headers = { "X-Keenable-Title": "web-search-plus-plugin" };
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
    return { url: apiUrl, headers };
  }
  if (publicAllowed) return { url: `${apiUrl}/public`, headers };
  throw new Error("Keenable requires an API key or an enabled public endpoint");
}
async function extractKeenable(urls, apiKey, _outputFormat = "markdown", _includeImages = false, _includeRawHtml = false, _renderJs = false, publicAllowed = false, apiUrl = "https://api.keenable.ai/v1/fetch", timeout = 30) {
  const endpoint = keenableExtractEndpoint(apiUrl, apiKey, publicAllowed);
  const results = [];
  for (const url of urls) {
    try {
      const data = await requestJson(`${endpoint.url}?url=${encodeURIComponent(url)}`, {
        method: "GET",
        headers: endpoint.headers
      }, timeout);
      const content = String(data?.content || "");
      const metadata = {};
      if (data?.author != null) metadata.author = data.author;
      if (data?.description != null) metadata.description = data.description;
      results.push(normalizeExtractResult("keenable", String(data?.url || url), String(data?.title || ""), content, content, {
        metadata: Object.keys(metadata).length ? metadata : void 0
      }));
    } catch (error) {
      results.push(normalizeExtractResult("keenable", url, "", "", void 0, { error: String(error?.message || error) }));
    }
  }
  return { provider: "keenable", results };
}
async function extractSerper(urls, apiKey, _outputFormat = "markdown", _includeImages = false, _includeRawHtml = false, _renderJs = false, apiUrl = "https://scrape.serper.dev", timeout = 30) {
  const results = [];
  for (const url of urls) {
    try {
      const data = await requestJson(apiUrl, {
        method: "POST",
        headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ url, includeMarkdown: true })
      }, timeout);
      if (data?.error) {
        results.push(normalizeExtractResult("serper", url, "", "", void 0, { error: String(data.error) }));
        continue;
      }
      const markdown = String(data?.markdown || "");
      const text = String(data?.text || data?.content || "");
      const content = markdown || text;
      const metadata = data?.metadata && typeof data.metadata === "object" ? data.metadata : {};
      const title = String(metadata.title || data?.title || "");
      const extra = { metadata: Object.keys(metadata).length ? metadata : void 0 };
      if (data?.jsonld != null) extra.jsonld = data.jsonld;
      if (data?.credits != null) extra.credits = data.credits;
      results.push(normalizeExtractResult("serper", url, title, content, content, extra));
    } catch (error) {
      results.push(normalizeExtractResult("serper", url, "", "", void 0, { error: String(error?.message || error) }));
    }
  }
  return { provider: "serper", results };
}
async function extractPlus(urls, provider = "auto", outputFormat = "markdown", includeImages = false, includeRawHtml = false, renderJs = false, runtimeConfig = {}, disabledProviders = [], providerPriority = EXTRACT_PROVIDER_PRIORITY, contextOptions = {}) {
  const requestedProvider = provider || "auto";
  if (!Array.isArray(urls) || urls.length === 0) {
    return {
      provider: requestedProvider,
      results: [],
      error: "No URLs provided",
      routing: { requested_provider: requestedProvider }
    };
  }
  let requestedMaxUrls;
  let requestedMaxContextChars;
  let deadlineSeconds;
  try {
    requestedMaxUrls = boundedInteger(contextOptions.maxUrls, DEFAULT_EXTRACT_MAX_URLS, 1, HARD_EXTRACT_MAX_URLS);
    requestedMaxContextChars = boundedInteger(
      contextOptions.maxContextChars,
      runtimeConfig.extractMaxContextChars ?? DEFAULT_EXTRACT_MAX_CONTEXT_CHARS,
      MIN_EXTRACT_MAX_CONTEXT_CHARS,
      HARD_EXTRACT_MAX_CONTEXT_CHARS
    );
    deadlineSeconds = preflightDeadline(contextOptions.deadlineSeconds, runtimeConfig.extractDeadlineSeconds);
  } catch (error) {
    return {
      provider: requestedProvider,
      results: [],
      error: String(error?.message || error),
      routing: { requested_provider: requestedProvider }
    };
  }
  const operatorMaxUrls = Math.min(HARD_EXTRACT_MAX_URLS, Math.max(1, runtimeConfig.extractMaxUrls ?? DEFAULT_EXTRACT_MAX_URLS));
  const operatorMaxContextChars = Math.min(
    HARD_EXTRACT_MAX_CONTEXT_CHARS,
    Math.max(MIN_EXTRACT_MAX_CONTEXT_CHARS, runtimeConfig.extractMaxContextChars ?? DEFAULT_EXTRACT_MAX_CONTEXT_CHARS)
  );
  const maxUrls = Math.min(requestedMaxUrls, operatorMaxUrls);
  const maxContextChars = Math.min(requestedMaxContextChars, operatorMaxContextChars);
  const deadlineAt = Date.now() + deadlineSeconds * 1e3;
  const allCleanedUrls = urls.map((url) => typeof url === "string" ? url.trim() : url);
  const cleanedUrls = allCleanedUrls.slice(0, maxUrls);
  const omittedUrls = allCleanedUrls.slice(maxUrls);
  const invalidUrls = cleanedUrls.filter((url) => typeof url !== "string" || !/^https?:\/\//.test(url));
  if (invalidUrls.length) {
    return {
      provider: requestedProvider,
      results: [],
      error: `Invalid URL(s) \u2014 must start with http:// or https://: ${JSON.stringify(invalidUrls)}`,
      routing: { requested_provider: requestedProvider }
    };
  }
  const urlProblems = await Promise.all(cleanedUrls.map((url) => checkExtractUrl(url, runtimeConfig)));
  const blockedItems = [];
  const fetchUrls = [];
  cleanedUrls.forEach((url, index) => {
    const problem = urlProblems[index];
    if (problem) blockedItems.push(normalizeExtractResult("policy", url, "", "", void 0, { error: problem }));
    else fetchUrls.push(url);
  });
  if (!fetchUrls.length) {
    return {
      provider: requestedProvider,
      results: [],
      error: urlProblems.find(Boolean),
      routing: { requested_provider: requestedProvider }
    };
  }
  const configuredPriority = [
    ...providerPriority.filter((item) => EXTRACT_PROVIDER_PRIORITY.includes(item)),
    ...EXTRACT_PROVIDER_PRIORITY.filter((item) => !providerPriority.includes(item))
  ];
  const baseProviders = contextOptions.strictProvider && requestedProvider !== "auto" ? [requestedProvider] : requestedProvider === "auto" ? configuredPriority : [requestedProvider, ...configuredPriority.filter((item) => item !== requestedProvider)];
  const providers = baseProviders.filter(
    (item) => (item === requestedProvider || !disabledProviders.includes(item)) && (requestedProvider !== "auto" || contextOptions.autoAllow?.[item] !== false)
  );
  const cacheKey = buildExtractCacheKey({
    cache_version: EXTRACT_CACHE_VERSION,
    urls: allCleanedUrls,
    requested_provider: requestedProvider,
    format: outputFormat,
    controls: { include_images: includeImages, include_raw_html: includeRawHtml, render_js: renderJs, spans: contextOptions.spans === true, spans_query: contextOptions.spansQuery || null },
    budgets: {
      requested_max_urls: requestedMaxUrls,
      requested_max_context_chars: requestedMaxContextChars,
      operator_max_urls: operatorMaxUrls,
      operator_max_context_chars: operatorMaxContextChars,
      effective_max_urls: maxUrls,
      effective_max_context_chars: maxContextChars,
      extract_char_limit: runtimeConfig.extractCharLimit ?? DEFAULT_EXTRACT_CHAR_LIMIT,
      parallel_max_chars_per_result: runtimeConfig.parallelMaxCharsPerResult ?? PARALLEL_MAX_CHARS_PER_RESULT,
      parallel_max_chars_total: runtimeConfig.parallelMaxCharsTotal ?? PARALLEL_MAX_CHARS_TOTAL,
      donsetch_max_content_chars: runtimeConfig.donsetchMaxContentChars ?? null,
      donsetch_tier: runtimeConfig.donsetchTier ?? "auto",
      deadline_seconds: deadlineSeconds
    },
    provider_policy: {
      priority: configuredPriority,
      disabled: [...disabledProviders].sort(),
      auto_allow: contextOptions.autoAllow || {},
      strict_provider: contextOptions.strictProvider === true,
      // Credential availability affects which fallback can serve the request, while the
      // credential values themselves never enter the identity.
      available: Object.fromEntries(EXTRACT_PROVIDER_PRIORITY.map((item) => [item, isExtractProviderAvailable(item, runtimeConfig)]))
    },
    endpoints: { donsetch_binary_configured: Boolean(runtimeConfig.donsetchBin) },
    url_policy: { extract_allow_private_urls: runtimeConfig.extractAllowPrivateUrls === true },
    storage_policy: "process_memory_only"
  });
  const cached = contextOptions.cacheBypass ? null : extractCacheGet(cacheKey);
  if (cached) return cached;
  const errors = [];
  for (const currentProvider of providers) {
    if (Date.now() >= deadlineAt) {
      errors.push({ provider: currentProvider, error: "deadline_exceeded_before_provider_start" });
      break;
    }
    if (!EXTRACT_PROVIDER_PRIORITY.includes(currentProvider)) {
      errors.push({ provider: currentProvider, error: `Provider ${currentProvider} does not support extraction` });
      continue;
    }
    const providerCredential = getExtractApiKey(currentProvider, runtimeConfig);
    const keylessAllowed = keylessPublicAllowed(currentProvider, runtimeConfig);
    if (!providerCredential && !keylessAllowed) {
      errors.push({ provider: currentProvider, error: "missing_api_key" });
      continue;
    }
    try {
      let result;
      if (currentProvider === "tavily") {
        result = await extractTavily(fetchUrls, providerCredential, outputFormat, includeImages, includeRawHtml, renderJs);
      } else if (currentProvider === "exa") {
        result = await extractExa(fetchUrls, providerCredential, outputFormat, includeImages, includeRawHtml, renderJs);
      } else if (currentProvider === "linkup") {
        result = await extractLinkup(fetchUrls, providerCredential, outputFormat, includeImages, includeRawHtml, renderJs);
      } else if (currentProvider === "parallel") {
        result = await extractParallel(fetchUrls, providerCredential, outputFormat, includeImages, includeRawHtml, renderJs, {
          maxCharsPerResult: runtimeConfig.parallelMaxCharsPerResult,
          maxCharsTotal: runtimeConfig.parallelMaxCharsTotal
        });
      } else if (currentProvider === "firecrawl") {
        result = await extractFirecrawl(fetchUrls, providerCredential, outputFormat, includeImages, includeRawHtml, renderJs);
      } else if (currentProvider === "keenable") {
        result = await extractKeenable(fetchUrls, providerCredential, outputFormat, includeImages, includeRawHtml, renderJs, keylessAllowed);
      } else if (currentProvider === "serper") {
        result = await extractSerper(fetchUrls, providerCredential, outputFormat, includeImages, includeRawHtml, renderJs);
      } else if (currentProvider === "donsetch") {
        if (!runtimeConfig.runCommandWithTimeout) throw new Error("donsetch_openclaw_runner_unavailable");
        result = await extractDonsetch(runtimeConfig.runCommandWithTimeout, {
          binary: providerCredential,
          urls: fetchUrls,
          outputFormat,
          includeImages,
          includeRawHtml,
          renderJs,
          timeoutSeconds: runtimeConfig.donsetchTimeoutSeconds,
          maxContentChars: runtimeConfig.donsetchMaxContentChars,
          tier: String(runtimeConfig.donsetchTier ?? "auto")
        });
      } else {
        result = await extractYou(fetchUrls, providerCredential, outputFormat, includeImages, includeRawHtml, renderJs);
      }
      const providerResults = Array.isArray(result.results) ? result.results : [];
      for (const item of providerResults) {
        if (item && !item.error && (typeof item.content !== "string" || !sanitizeExtractContent(item.content).trim())) {
          item.error = "empty_content: the page returned no readable text";
          item.content = "";
          item.raw_content = "";
        }
      }
      if (providerResults.length === 0) {
        errors.push({ provider: currentProvider, error: "no_results" });
        continue;
      }
      if (providerResults.every((item) => item?.error)) {
        errors.push({ provider: currentProvider, error: "all_urls_failed", details: providerResults.map((item) => item.error) });
        continue;
      }
      const resultList = [...providerResults, ...blockedItems];
      result.results = resultList;
      const completeAnswer = blockedItems.length === 0 && providerResults.length >= fetchUrls.length && providerResults.every((item) => !item.error);
      const charLimit = runtimeConfig.extractCharLimit ?? DEFAULT_EXTRACT_CHAR_LIMIT;
      const contentItems = resultList.map((item, resultIndex) => ({ item, resultIndex })).filter(({ item }) => !item?.error && typeof item?.content === "string");
      const fullText = resultList.map((item) => {
        if (item?.error || typeof item?.content !== "string") return void 0;
        const content = sanitizeExtractContent(item.content).normalize("NFC");
        const rawContent = sanitizeExtractContent(typeof item.raw_content === "string" ? item.raw_content : item.content).normalize("NFC");
        return {
          content,
          raw_content: rawContent === content ? void 0 : rawContent,
          provider: item.provider
        };
      });
      const cacheMaxChars = runtimeConfig.extractCacheMaxChars ?? DEFAULT_EXTRACT_CACHE_MAX_CHARS;
      const cacheableFullText = fullTextChars(fullText) <= cacheMaxChars;
      const sanitizedContent = contentItems.map(({ item }) => sanitizeExtractContent(item.content).normalize("NFC"));
      const selectedSpans = contextOptions.spans ? sanitizedContent.map((content) => selectSpans(content, contextOptions.spansQuery)) : [];
      const allocations = fairShareAllocations(
        sanitizedContent.map((content) => codepointLength(content)),
        maxContextChars
      );
      let truncated = false;
      contentItems.forEach(({ item, resultIndex }, index) => {
        const fullContent = sanitizedContent[index];
        const fullLength = codepointLength(fullContent);
        const globallyTruncated = fullLength > allocations[index];
        const budgetedContent = globallyTruncated ? normalizedCodepoints(fullContent).slice(0, allocations[index]).join("") : fullContent;
        const formatted = formatTruncatedExtractContent(budgetedContent, charLimit);
        item.content = formatted.content;
        if (globallyTruncated || formatted.truncated) {
          item.truncated = true;
          item.original_chars = fullLength;
          truncated = true;
        }
        if ("raw_content" in item) item.raw_content = item.content;
        if (contextOptions.spans) {
          item.span_contract_version = 1;
          item.spans = selectedSpans[index].map((span) => ({
            ...span,
            within_preview: item.content.includes(span.text)
          }));
        }
        const full = fullText[resultIndex];
        if (full && cacheableFullText && !contextOptions.cacheBypass) {
          item.full_content_ref = fullTextReference(cacheKey, resultIndex, full);
          item.full_content_chars = codepointLength(full.content);
        }
      });
      const warnings = [...result.warnings || []];
      if (omittedUrls.length) {
        warnings.push({
          code: "wsp.extract.urls_omitted",
          message: "One or more requested URLs were omitted by the extraction fan-out cap.",
          details: { omitted_url_count: omittedUrls.length }
        });
      }
      if (truncated) {
        warnings.push({
          code: "wsp.content.truncated",
          message: "Inline extracted content was deterministically truncated to the call budget.",
          details: { truncated_result_count: contentItems.filter(({ item }) => item.truncated).length }
        });
      }
      const response = {
        ...result,
        status: omittedUrls.length || truncated ? "degraded" : result.status || "success",
        warnings,
        limits_applied: {
          extract: {
            requested_url_count: allCleanedUrls.length,
            processed_urls: cleanedUrls,
            omitted_urls: omittedUrls,
            omitted_url_count: omittedUrls.length,
            max_urls: maxUrls,
            max_context_chars: maxContextChars,
            deadline_seconds: deadlineSeconds,
            context_chars_returned: contentItems.reduce((sum, { item }) => sum + codepointLength(item.content), 0),
            truncated
          }
        },
        routing: {
          provider: currentProvider,
          requested_provider: requestedProvider,
          fallback_used: errors.length > 0,
          fallback_errors: errors
        }
      };
      if (!contextOptions.cacheBypass && cacheableFullText && completeAnswer) {
        extractCachePut(
          cacheKey,
          response,
          fullText,
          runtimeConfig.extractCacheMaxEntries ?? DEFAULT_EXTRACT_CACHE_MAX_ENTRIES,
          cacheMaxChars
        );
      }
      return response;
    } catch (error) {
      errors.push({ provider: currentProvider, error: String(error?.message || error) });
    }
  }
  return {
    provider: requestedProvider,
    results: [],
    error: "All extraction providers failed",
    fallback_errors: errors,
    routing: { requested_provider: requestedProvider, fallback_used: errors.length > 0, fallback_errors: errors }
  };
}

// research.ts
import { createHash } from "node:crypto";

// diversity.ts
var MULTI_LABEL_SUFFIXES = /* @__PURE__ */ new Set([
  "ac.at",
  "ac.jp",
  "ac.nz",
  "ac.uk",
  "asn.au",
  "co.at",
  "co.in",
  "co.jp",
  "co.nz",
  "co.uk",
  "com.au",
  "com.br",
  "com.cn",
  "com.hk",
  "com.mx",
  "com.my",
  "com.sg",
  "com.tr",
  "edu.au",
  "edu.cn",
  "edu.hk",
  "edu.in",
  "edu.my",
  "edu.sg",
  "ed.jp",
  "firm.in",
  "gen.in",
  "go.jp",
  "gov.au",
  "gov.cn",
  "gov.hk",
  "gov.in",
  "gov.uk",
  "govt.nz",
  "gv.at",
  "id.au",
  "ind.in",
  "ltd.uk",
  "me.uk",
  "ne.jp",
  "net.au",
  "net.cn",
  "net.in",
  "net.nz",
  "or.at",
  "or.jp",
  "org.au",
  "org.cn",
  "org.hk",
  "org.in",
  "org.nz",
  "org.uk",
  "plc.uk",
  "priv.at",
  "sch.uk"
]);
var TRACKING_PARAMETERS = /* @__PURE__ */ new Set([
  "dclid",
  "fbclid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "mkt_tok",
  "msclkid",
  "oly_anon_id",
  "oly_enc_id",
  "ref",
  "vero_id",
  "yclid",
  "_ga"
]);
function parsedUrl(value) {
  if (!value || /\s/.test(value)) return null;
  try {
    return new URL(value.includes("://") ? value : `http://${value}`);
  } catch {
    return null;
  }
}
function registrableDomain(value) {
  const parsed = parsedUrl(value);
  if (!parsed) return "";
  const host = parsed.hostname.replace(/\.$/, "").toLowerCase();
  if (!host || host.includes(":") || /^\d+(?:\.\d+){3}$/.test(host)) return host;
  const labels = host.split(".").filter(Boolean);
  if (labels.length < 2) return host;
  const suffix = labels.slice(-2).join(".");
  return MULTI_LABEL_SUFFIXES.has(suffix) && labels.length >= 3 ? labels.slice(-3).join(".") : suffix;
}
function canonicalDiversityUrl(value) {
  const parsed = parsedUrl(value);
  if (!parsed) return "";
  parsed.hash = "";
  parsed.hostname = parsed.hostname.replace(/\.$/, "").toLowerCase();
  if (parsed.protocol === "http:" && parsed.port === "80" || parsed.protocol === "https:" && parsed.port === "443") parsed.port = "";
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  const kept = [...parsed.searchParams.entries()].filter(([name]) => !name.toLowerCase().startsWith("utm_") && !TRACKING_PARAMETERS.has(name.toLowerCase())).sort(([leftName, leftValue], [rightName, rightValue]) => leftName.localeCompare(rightName) || leftValue.localeCompare(rightValue));
  parsed.search = "";
  for (const [name, valuePart] of kept) parsed.searchParams.append(name, valuePart);
  return parsed.toString().replace(/\/$/, "");
}
function wordTrigrams(value) {
  const words = [...String(value || "").toLocaleLowerCase().matchAll(/[\p{L}\p{N}]+/gu)].map((match) => match[0]);
  return new Set(words.slice(0, -2).map((word, index) => `${word}\0${words[index + 1]}\0${words[index + 2]}`));
}
function snippetSimilarity(left, right) {
  const leftTrigrams = wordTrigrams(left);
  const rightTrigrams = wordTrigrams(right);
  if (!leftTrigrams.size || !rightTrigrams.size) return 0;
  const intersection = [...leftTrigrams].filter((value) => rightTrigrams.has(value)).length;
  return intersection / (/* @__PURE__ */ new Set([...leftTrigrams, ...rightTrigrams])).size;
}
function snippet(item) {
  return String(item.snippet || item.description || "");
}
function duplicateAnalysis(results, threshold = 0.6) {
  const canonicalSeen = /* @__PURE__ */ new Map();
  const urlDuplicates = /* @__PURE__ */ new Map();
  results.forEach((item, index) => {
    const canonical = canonicalDiversityUrl(String(item.url || ""));
    if (!canonical) return;
    const prior = canonicalSeen.get(canonical);
    if (prior == null) canonicalSeen.set(canonical, index);
    else urlDuplicates.set(index, prior);
  });
  const contentDuplicates = /* @__PURE__ */ new Map();
  let nearDuplicatePairs = 0;
  results.forEach((item, index) => {
    for (let prior = 0; prior < index; prior += 1) {
      if (snippetSimilarity(snippet(results[prior]), snippet(item)) >= threshold) {
        nearDuplicatePairs += 1;
        if (!contentDuplicates.has(index)) contentDuplicates.set(index, prior);
      }
    }
  });
  const duplicates = [];
  results.forEach((_item, index) => {
    if (urlDuplicates.has(index)) duplicates.push({ kind: "url", kept: urlDuplicates.get(index), dropped_candidate: index });
    if (contentDuplicates.has(index)) duplicates.push({ kind: "content", kept: contentDuplicates.get(index), dropped_candidate: index });
  });
  return { duplicates, urlDuplicates: urlDuplicates.size, nearDuplicatePairs };
}
function rounded(value) {
  return Number(value.toFixed(4));
}
function scoreDiversity(results, threshold = 0.6) {
  const count = results.length;
  if (!count) {
    return {
      score: 0,
      components: { domain_diversity: 0, url_duplication: 0, content_diversity: 0, provider_mix: 0 },
      duplicates: [],
      dominant_domain: null
    };
  }
  const domains = results.map((item) => registrableDomain(String(item.url || ""))).filter(Boolean);
  const domainCounts = /* @__PURE__ */ new Map();
  for (const domain of domains) domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
  const dominant = [...domainCounts.entries()].sort(([leftDomain, leftCount], [rightDomain, rightCount]) => rightCount - leftCount || leftDomain.localeCompare(rightDomain))[0];
  const analysis = duplicateAnalysis(results, threshold);
  const pairCount = count * (count - 1) / 2;
  const providers = results.map((item) => String(item.provider || "").trim()).filter(Boolean);
  const providerCounts = /* @__PURE__ */ new Map();
  for (const provider of providers) providerCounts.set(provider, (providerCounts.get(provider) || 0) + 1);
  let providerMix = 1;
  if (providerCounts.size > 1) {
    const entropy = [...providerCounts.values()].reduce((sum, providerCount) => {
      const share = providerCount / providers.length;
      return sum - share * Math.log(share);
    }, 0);
    providerMix = entropy / Math.log(providerCounts.size);
  }
  const components = {
    domain_diversity: rounded(domainCounts.size / count),
    url_duplication: rounded(Math.max(0, 1 - analysis.urlDuplicates / count)),
    content_diversity: rounded(pairCount ? Math.max(0, 1 - analysis.nearDuplicatePairs / pairCount) : 1),
    provider_mix: rounded(Math.max(0, providerMix))
  };
  return {
    score: rounded(Math.max(0, Math.min(
      1,
      0.4 * components.domain_diversity + 0.3 * components.url_duplication + 0.2 * components.content_diversity + 0.1 * components.provider_mix
    ))),
    components,
    duplicates: analysis.duplicates,
    dominant_domain: dominant ? { domain: dominant[0], share: rounded(dominant[1] / count) } : null
  };
}
function rerankDuplicateCandidates(results, threshold = 0.6) {
  const analysis = duplicateAnalysis(results, threshold);
  const duplicateIndices = new Set(analysis.duplicates.map((item) => item.dropped_candidate));
  return {
    results: [
      ...results.filter((_item, index) => !duplicateIndices.has(index)),
      ...results.filter((_item, index) => duplicateIndices.has(index))
    ],
    duplicates: analysis.duplicates
  };
}

// research.ts
var SNIPPET_SEPARATOR = "\n\n";
var MAX_AGGREGATED_SNIPPET_CODEPOINTS = 600;
var RESULT_GRACE_MILLISECONDS = 250;
var DEFAULT_QUORUM_RESULT_TARGET_CAP = 5;
var DEFAULT_QUORUM_MIN_UNIQUE_DOMAINS = 3;
var AUTHORITATIVE_SOURCE_TYPES = /* @__PURE__ */ new Set(["docs", "paper", "repo", "reference"]);
function stableId(prefix, ...parts) {
  const raw = parts.map((part) => String(part)).join("");
  return `${prefix}_${createHash("sha256").update(raw).digest("hex").slice(0, 16)}`;
}
function positiveInteger(value, fallback, minimum = 1) {
  if (typeof value === "boolean") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.floor(parsed)) : fallback;
}
function codePointLength(value) {
  return Array.from(value).length;
}
function takeCodePoints(value, count) {
  return Array.from(value).slice(0, Math.max(0, count)).join("");
}
function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
function compareObservations(left, right) {
  return compareStrings(left.provider, right.provider) || left.provider_result_index - right.provider_result_index || compareStrings(left.observation_id, right.observation_id);
}
function sourceType(url, rawHint) {
  let host = "";
  let path2 = "";
  try {
    const parsed = new URL(url);
    host = parsed.hostname.toLowerCase();
    path2 = parsed.pathname.toLowerCase();
  } catch {
  }
  if (["github.com", "gitlab.com", "bitbucket.org"].includes(host)) {
    return { value: "repo", method: "url_heuristic", method_version: "1", confidence: "high" };
  }
  if (["arxiv.org", "doi.org", "semanticscholar.org", "pubmed.ncbi.nlm.nih.gov"].includes(host) || path2.endsWith(".pdf")) {
    return { value: "paper", method: "url_heuristic", method_version: "1", confidence: "high" };
  }
  if (host.startsWith("docs.") || path2.includes("/docs") || path2.includes("/documentation")) {
    return { value: "docs", method: "url_heuristic", method_version: "1", confidence: "high" };
  }
  if (["wikipedia.org", "en.wikipedia.org", "developer.mozilla.org"].includes(host)) {
    return { value: "reference", method: "url_heuristic", method_version: "1", confidence: "high" };
  }
  if (["reddit.", "stackoverflow.", "discourse.", "forum.", "community."].some((token) => host.includes(token))) {
    return { value: "forum", method: "url_heuristic", method_version: "1", confidence: "high" };
  }
  if (host.startsWith("news.") || path2.includes("/news")) {
    return { value: "news", method: "url_heuristic", method_version: "1", confidence: "medium" };
  }
  if (host.startsWith("blog.") || path2.includes("/blog")) {
    return { value: "blog", method: "url_heuristic", method_version: "1", confidence: "medium" };
  }
  const hintValue = rawHint && typeof rawHint === "object" && "value" in rawHint ? rawHint.value : rawHint;
  const hint = String(hintValue || "").toLowerCase().replace(/_/g, "-");
  const hintMap = {
    "official-docs": "docs",
    docs: "docs",
    documentation: "docs",
    paper: "paper",
    repository: "repo",
    repo: "repo",
    blog: "blog",
    forum: "forum",
    reference: "reference",
    news: "news"
  };
  if (hintMap[hint]) {
    return { value: hintMap[hint], method: "provider_hint_normalized", method_version: "1", confidence: "medium" };
  }
  return { value: "other", method: "url_heuristic", method_version: "1", confidence: "low" };
}
function fetchPriority(engineRank, observations2, classifiedSource) {
  const consensus = new Set(observations2.map((observation) => observation.provider)).size >= 2;
  return fetchPriorityFromSignals(engineRank, consensus, classifiedSource);
}
function fetchPriorityFromSignals(engineRank, consensus, classifiedSource) {
  const authoritative = AUTHORITATIVE_SOURCE_TYPES.has(classifiedSource.value);
  const reasonCodes = [
    consensus ? "cluster_consensus" : "cluster_single_observation",
    engineRank <= 3 ? "rank_top_3" : "rank_beyond_top_3",
    authoritative ? "source_type_authoritative" : "source_type_general"
  ];
  const score = (consensus ? 2 : 0) + (engineRank <= 3 ? 1 : 0) + (authoritative ? 1 : 0);
  return { tier: score >= 3 ? "high" : score >= 1 ? "medium" : "low", reason_codes: reasonCodes };
}
function aggregateSnippet(observations2) {
  const candidates2 = observations2.filter((observation) => typeof observation.item.snippet === "string" && observation.item.snippet.length > 0);
  if (!candidates2.length) return null;
  const normalizedSnippet = (observation) => String(observation.item.snippet).normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
  const retained = [];
  const retainedNormalized = [];
  for (const candidate of [...candidates2].sort((left, right) => {
    const lengthDifference = codePointLength(normalizedSnippet(right)) - codePointLength(normalizedSnippet(left));
    return lengthDifference || compareObservations(left, right);
  })) {
    const normalized = normalizedSnippet(candidate);
    if (!normalized) continue;
    if (retainedNormalized.some((existing) => normalized.includes(existing) || existing.includes(normalized))) continue;
    retained.push(candidate);
    retainedNormalized.push(normalized);
  }
  retained.sort(compareObservations);
  const fragments = [];
  let usedCodePoints = 0;
  for (const observation of retained) {
    const separatorLength = fragments.length ? codePointLength(SNIPPET_SEPARATOR) : 0;
    const remaining = MAX_AGGREGATED_SNIPPET_CODEPOINTS - usedCodePoints - separatorLength;
    if (remaining <= 0) break;
    const sourceText = String(observation.item.snippet).normalize("NFC");
    const text2 = takeCodePoints(sourceText, remaining);
    const transformations = ["mechanical_segmentation"];
    if (codePointLength(text2) < codePointLength(sourceText)) transformations.push("deterministic_truncation");
    fragments.push({
      observation_id: observation.observation_id,
      provider: observation.provider,
      provider_result_index: observation.provider_result_index,
      source_field: "snippet",
      text: text2,
      transformations
    });
    usedCodePoints += codePointLength(text2) + separatorLength;
    if (codePointLength(text2) < codePointLength(sourceText)) break;
  }
  if (!fragments.length) return null;
  const text = fragments.map((fragment) => fragment.text).join(SNIPPET_SEPARATOR);
  const provenance = observations2.length > 1 ? { aggregation: "concat", separator: SNIPPET_SEPARATOR, fragments } : { ...fragments[0] };
  return { text, provenance };
}
function enrichCluster(cluster, engineRank) {
  const representative = cluster.representative;
  const observations2 = [...cluster.observations].sort(compareObservations);
  const classifiedSource = sourceType(representative.item.url || "", representative.item.source_type);
  const snippet2 = aggregateSnippet(observations2);
  const result = {
    ...representative.item,
    // The actual adapter is authoritative; a provider-returned provider label must
    // not be able to misattribute the result or its snippet fragments.
    provider: representative.provider,
    representative_observation_id: representative.observation_id,
    observation_ids: observations2.map((observation) => observation.observation_id),
    source_observations: observations2.map((observation) => {
      const rawSnippet = typeof observation.item.snippet === "string" ? observation.item.snippet.normalize("NFC") : "";
      return {
        observation_id: observation.observation_id,
        provider: observation.provider,
        provider_result_index: observation.provider_result_index,
        url: String(observation.item.url || ""),
        title: String(observation.item.title || ""),
        ...rawSnippet ? {
          snippet_sha256: createHash("sha256").update(rawSnippet).digest("hex"),
          snippet_codepoint_length: codePointLength(rawSnippet)
        } : {}
      };
    }),
    dedup_cluster_id: stableId("cluster", cluster.key),
    source_type: classifiedSource,
    fetch_priority: fetchPriority(engineRank, observations2, classifiedSource)
  };
  if (snippet2) {
    result.snippet = snippet2.text;
    result.snippet_origin = observations2.length > 1 ? "engine" : "provider";
    result.snippet_provenance = snippet2.provenance;
  }
  return result;
}
function normalizeResultUrl(url) {
  try {
    const u = new URL(url.trim());
    const host = u.host.replace(/^www\./i, "").toLowerCase();
    const pathname = u.pathname.replace(/\/$/, "");
    return `${host}${pathname}`;
  } catch {
    return url.trim().toLowerCase();
  }
}
function deduplicateResultsAcrossProviders(resultsByProvider, maxResults) {
  const deduped = [];
  const seen = /* @__PURE__ */ new Set();
  let dedupCount = 0;
  for (const [provider, data] of resultsByProvider) {
    for (const item of data.results || []) {
      if (!item || typeof item !== "object") continue;
      const norm = normalizeResultUrl(item.url || "");
      if (norm && seen.has(norm)) {
        dedupCount += 1;
        continue;
      }
      if (norm) seen.add(norm);
      deduped.push({ ...item, provider: item.provider || provider });
      if (deduped.length >= maxResults) return { results: deduped, dedupCount };
    }
  }
  return { results: deduped, dedupCount };
}
function mergeResearchResultsAcrossProviders(resultsByProvider, maxResults) {
  const clusters = [];
  const clustersByKey = /* @__PURE__ */ new Map();
  let dedupCount = 0;
  for (const [providerSubmissionIndex, [provider, data]] of resultsByProvider.entries()) {
    for (const [providerResultIndex, item] of (data.results || []).entries()) {
      if (!item || typeof item !== "object") continue;
      const norm = normalizeResultUrl(item.url || "");
      const key = norm || `missing-url:${providerSubmissionIndex}:${providerResultIndex}`;
      const observation = {
        observation_id: stableId(
          "obs",
          provider,
          providerSubmissionIndex,
          providerResultIndex,
          norm,
          String(item.title || ""),
          String(item.snippet || "").normalize("NFC")
        ),
        provider,
        provider_submission_index: providerSubmissionIndex,
        provider_result_index: providerResultIndex,
        item
      };
      const existing = clustersByKey.get(key);
      if (existing) {
        existing.observations.push(observation);
        dedupCount += 1;
        continue;
      }
      const cluster = { key, representative: observation, observations: [observation] };
      clusters.push(cluster);
      clustersByKey.set(key, cluster);
    }
  }
  const limit = Number.isFinite(maxResults) ? Math.max(0, Math.floor(maxResults)) : 0;
  return {
    results: clusters.slice(0, limit).map((cluster, index) => enrichCluster(cluster, index + 1)),
    dedupCount
  };
}
function researchQuorumSnapshot(resultsByProvider) {
  const seenUrls = /* @__PURE__ */ new Set();
  const domains = /* @__PURE__ */ new Set();
  const contributingProviders = [];
  let deduplicatedResultCount = 0;
  for (const [provider, payload] of resultsByProvider) {
    let contributed = false;
    for (const item of payload.results || []) {
      if (!item || typeof item !== "object" || typeof item.url !== "string" || !item.url.trim()) continue;
      const normalized = normalizeResultUrl(item.url);
      if (!normalized || seenUrls.has(normalized)) continue;
      seenUrls.add(normalized);
      deduplicatedResultCount += 1;
      contributed = true;
      try {
        const domain = new URL(item.url).hostname.replace(/^www\./i, "").toLowerCase();
        if (domain) domains.add(domain);
      } catch {
      }
    }
    if (contributed) contributingProviders.push(provider);
  }
  return { deduplicatedResultCount, uniqueDomainCount: domains.size, contributingProviders };
}
function selectResearchProviders(primaryProvider, providerPriority, availableProviders, maxProviders = 3) {
  const preferred = [primaryProvider, "linkup", "tavily", "exa", "firecrawl", "brave", "serper", "you", "querit"];
  const ordered = [];
  for (const provider of [...preferred, ...providerPriority]) {
    if (provider && availableProviders.has(provider) && !ordered.includes(provider)) {
      ordered.push(provider);
    }
    if (ordered.length >= maxProviders) break;
  }
  return ordered;
}
function withResearchDeadline(promise, remainingSeconds, onTimeout, graceMilliseconds = 0) {
  if (remainingSeconds == null) return promise;
  return new Promise((resolve, reject) => {
    let graceTimer;
    const rejectForDeadline = () => {
      onTimeout?.();
      reject(new Error("research_deadline_exceeded"));
    };
    const timer = setTimeout(() => {
      if (graceMilliseconds > 0) {
        graceTimer = setTimeout(rejectForDeadline, graceMilliseconds);
        graceTimer.unref?.();
      } else {
        rejectForDeadline();
      }
    }, Math.max(1, remainingSeconds * 1e3));
    timer.unref?.();
    promise.then(
      (value) => {
        clearTimeout(timer);
        if (graceTimer) clearTimeout(graceTimer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        if (graceTimer) clearTimeout(graceTimer);
        reject(error);
      }
    );
  });
}
async function runResearchMode(options) {
  const { query, researchProviders, executeSearch: executeSearch2, extractUrls, maxResults } = options;
  const maxExtractUrls = options.maxExtractUrls ?? 3;
  const timeBudgetSeconds = options.timeBudgetSeconds ?? null;
  const now = options.nowFn || (() => Date.now() / 1e3);
  const start = now();
  const budgetExhausted = () => timeBudgetSeconds != null && now() - start >= timeBudgetSeconds;
  const quorumEnabled = options.quorumEnabled !== false;
  const quorumMinContributingProviders = Math.max(2, positiveInteger(options.quorumMinContributingProviders, 2));
  const quorumResultTargetCap = positiveInteger(options.quorumResultTargetCap, DEFAULT_QUORUM_RESULT_TARGET_CAP);
  const quorumResultTarget = Math.min(Math.max(1, positiveInteger(maxResults, 1)), quorumResultTargetCap);
  const quorumMinUniqueDomains = Math.min(
    quorumResultTarget,
    positiveInteger(options.quorumMinUniqueDomains, DEFAULT_QUORUM_MIN_UNIQUE_DOMAINS)
  );
  const providerErrors = [];
  const providerAttempts = /* @__PURE__ */ new Map();
  const launched = /* @__PURE__ */ new Map();
  const completionQueue = [];
  let wakeCompletion = null;
  const publishCompletion = (completion) => {
    completionQueue.push(completion);
    const wake = wakeCompletion;
    wakeCompletion = null;
    wake?.();
  };
  const waitForCompletion = async () => {
    if (completionQueue.length) return;
    await new Promise((resolve) => {
      wakeCompletion = resolve;
    });
  };
  for (const [index, provider] of researchProviders.entries()) {
    if (budgetExhausted()) {
      const error = "skipped: research time budget exhausted";
      providerErrors.push({ index, provider, error });
      providerAttempts.set(index, { provider, outcome: "skipped", result_count: 0, error });
      continue;
    }
    const elapsed = now() - start;
    const remaining = timeBudgetSeconds == null ? null : Math.max(0, timeBudgetSeconds - elapsed);
    const controller = new AbortController();
    launched.set(index, { provider, controller });
    const providerPromise = Promise.resolve().then(() => executeSearch2(provider, controller.signal));
    void withResearchDeadline(
      providerPromise,
      remaining,
      () => controller.abort("research_deadline_exceeded"),
      RESULT_GRACE_MILLISECONDS
    ).then(
      (response) => publishCompletion({ index, provider, response }),
      (error) => publishCompletion({ index, provider, error })
    );
  }
  const resultsByIndex = /* @__PURE__ */ new Map();
  const pending = new Set(launched.keys());
  let quorumTriggered = false;
  const providerResultsInSubmissionOrder = () => [...resultsByIndex.keys()].sort((left, right) => left - right).map((index) => resultsByIndex.get(index));
  const quorumSnapshot = () => researchQuorumSnapshot(providerResultsInSubmissionOrder());
  const quorumReached = () => {
    if (!quorumEnabled) return false;
    const snapshot = quorumSnapshot();
    return snapshot.contributingProviders.length >= quorumMinContributingProviders && snapshot.deduplicatedResultCount >= quorumResultTarget && snapshot.uniqueDomainCount >= quorumMinUniqueDomains;
  };
  const harvestCompletion = (completion) => {
    if (!pending.delete(completion.index)) return;
    const { index, provider } = completion;
    if (completion.error == null) {
      const response = completion.response;
      if (!response || typeof response !== "object" || Array.isArray(response)) {
        const error2 = "provider returned a non-object result";
        providerErrors.push({ index, provider, error: error2 });
        providerAttempts.set(index, { provider, outcome: "failed", result_count: 0, error: error2 });
        return;
      }
      resultsByIndex.set(index, [provider, response]);
      providerAttempts.set(index, { provider, outcome: "success", result_count: Array.isArray(response.results) ? response.results.length : 0 });
      return;
    }
    const rawMessage = String(completion.error?.message || completion.error);
    const deadlineExceeded = rawMessage === "research_deadline_exceeded";
    const error = deadlineExceeded ? "cancelled: research time budget exceeded after provider start" : rawMessage;
    providerErrors.push({ index, provider, error });
    providerAttempts.set(index, { provider, outcome: deadlineExceeded ? "cancelled" : "failed", result_count: 0, error });
  };
  while (pending.size) {
    await waitForCompletion();
    await Promise.resolve();
    while (completionQueue.length) harvestCompletion(completionQueue.shift());
    if (!pending.size) break;
    if (quorumReached()) {
      await new Promise((resolve) => setImmediate(resolve));
      while (completionQueue.length) harvestCompletion(completionQueue.shift());
      if (!pending.size) break;
    }
    if (quorumReached()) {
      for (const index of [...pending].sort((left, right) => left - right)) {
        const launchedProvider = launched.get(index);
        launchedProvider.controller.abort("preempted_after_quorum");
        const error = "preempted_after_quorum";
        providerErrors.push({ index, provider: launchedProvider.provider, error });
        providerAttempts.set(index, { provider: launchedProvider.provider, outcome: "cancelled", result_count: 0, error });
        pending.delete(index);
      }
      quorumTriggered = true;
      break;
    }
  }
  const providerResults = providerResultsInSubmissionOrder();
  const publicProviderErrors = providerErrors.sort((left, right) => left.index - right.index || compareStrings(left.error, right.error)).map(({ provider, error }) => ({ provider, error }));
  const { results: deduped, dedupCount } = mergeResearchResultsAcrossProviders(providerResults, maxResults);
  const diversityRerank = options.diversityRerank ? rerankDuplicateCandidates(deduped) : { results: deduped, duplicates: [] };
  const researchResults = diversityRerank.results.map((item, index) => {
    const classifiedSource = item.source_type;
    const consensus = item.fetch_priority?.reason_codes?.[0] === "cluster_consensus";
    return {
      ...item,
      fetch_priority: fetchPriorityFromSignals(index + 1, consensus, classifiedSource)
    };
  });
  const urls = researchResults.map((item) => item.url).filter(Boolean).slice(0, Math.max(0, maxExtractUrls));
  let extracted = { provider: null, results: [] };
  let extractionError = null;
  if (urls.length) {
    if (budgetExhausted()) {
      extractionError = "skipped: research time budget exhausted";
    } else {
      try {
        const remaining = timeBudgetSeconds == null ? null : Math.max(0, timeBudgetSeconds - (now() - start));
        extracted = await withResearchDeadline(extractUrls(urls), remaining) || { provider: null, results: [] };
        if (extracted.error && !(extracted.results || []).length) {
          extractionError = String(extracted.error);
          extracted = { provider: extracted.provider ?? null, results: [] };
        }
      } catch (error) {
        extractionError = String(error?.message || error) === "research_deadline_exceeded" ? "timed out: research time budget exhausted" : String(error?.message || error);
        extracted = { provider: null, results: [] };
      }
    }
  }
  const routing = {
    providers_queried: providerResults.map(([provider]) => provider),
    provider_attempts: [...providerAttempts.entries()].sort(([left], [right]) => left - right).map(([, attempt]) => attempt),
    provider_errors: publicProviderErrors,
    extraction_provider: extracted.provider ?? null
  };
  if (extractionError) routing.extraction_error = extractionError;
  const sourceSummaries = (extracted.results || []).map((source) => {
    const text = String(source.content || source.raw_content || "").trim();
    const excerpt = text.length > 500 && query ? selectSpans(text, query, { maxSpans: 1, maxSpanChars: 500 })[0]?.text || text : text;
    const summary = excerpt.slice(0, 500);
    return {
      ...source,
      content: summary,
      ...source.raw_content != null ? { raw_content: summary } : {},
      ...text.length > 500 ? { summary_truncated: true, summary_original_chars: text.length } : {}
    };
  });
  const materialProviderErrors = publicProviderErrors.filter((entry) => entry.error !== "preempted_after_quorum");
  const finalQuorumSnapshot = quorumSnapshot();
  const status = providerResults.length === 0 ? "failed" : materialProviderErrors.length > 0 || extractionError ? "degraded" : "success";
  return {
    status,
    mode: "research",
    provider: "research",
    query,
    results: researchResults,
    source_summaries: sourceSummaries,
    ...status === "failed" ? { error: "All research providers failed" } : {},
    routing,
    metadata: {
      dedup_count: dedupCount,
      diversity_rerank: {
        enabled: options.diversityRerank === true,
        moved_candidate_count: new Set(diversityRerank.duplicates.map((item) => item.dropped_candidate)).size,
        duplicates: diversityRerank.duplicates
      },
      providers_merged: providerResults.map(([provider]) => provider),
      extracted_url_count: sourceSummaries.length,
      research_quorum: {
        enabled: quorumEnabled,
        triggered: quorumTriggered,
        min_contributing_providers: quorumMinContributingProviders,
        result_target: quorumResultTarget,
        min_unique_domains: quorumMinUniqueDomains,
        contributing_providers: finalQuorumSnapshot.contributingProviders,
        deduplicated_result_count: finalQuorumSnapshot.deduplicatedResultCount,
        unique_domain_count: finalQuorumSnapshot.uniqueDomainCount
      }
    }
  };
}

// quality.ts
function resultDomain(url) {
  try {
    return new URL(url || "").hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}
function normalizeUrlForRule(url) {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    const pathname = u.pathname.replace(/\/$/, "");
    return `${host}${pathname}`;
  } catch {
    return url.trim().toLowerCase();
  }
}
var CANONICAL_DOMAIN_RULES = {
  "official/vendor-release": {
    boost: [
      "mistral.ai",
      "anthropic.com",
      "openai.com",
      "googleblog.com",
      "blog.google",
      "ai.google.dev",
      "meta.com",
      "ai.meta.com",
      "nvidia.com",
      "developer.nvidia.com",
      "apple.com",
      "microsoft.com"
    ],
    demote: ["youtube.com", "youtu.be", "medium.com", "aizolo.com", "reddit.com"]
  },
  "docs/api": {
    boost: ["docs.", "developer.", "github.com", "readthedocs.io", "modelcontextprotocol.io"],
    demote: ["medium.com", "dev.to", "reddit.com", "stackoverflow.com", "youtube.com"]
  },
  "official/regulatory": {
    boost: ["europa.eu", "ec.europa.eu", "nist.gov", "nvlpubs.nist.gov", "oecd.org", "who.int", "gov.uk", "federalregister.gov"],
    demote: ["scribd.com", "researchgate.net", "universityofcalifornia.edu", "slideshare.net"]
  },
  "finance/IR": {
    boost: ["investor.", "ir.", "nvidia.com", "sec.gov", "nasdaq.com"],
    demote: ["reddit.com", "fool.com", "seekingalpha.com", "youtube.com"]
  },
  "security/cve": {
    boost: ["nvd.nist.gov", "cve.org", "github.com", "github.com/advisories", "security.", "cert.europa.eu", "kb.cert.org"],
    demote: ["youtube.com", "medium.com", "reddit.com"]
  }
};
function domainMatchesRule(domain, rule) {
  if (rule.endsWith(".")) {
    return domain.startsWith(rule);
  }
  return domain === rule || domain.endsWith(`.${rule}`);
}
var SPAM_MIRROR_DOMAINS = [
  // Stack Overflow / Q&A scrapers
  "newbedev.com",
  "stackoom.com",
  "stackovergo.com",
  "syntaxfix.com",
  "copyprogramming.com",
  "devcodef1.com",
  "exceptionshub.com",
  "code-examples.net",
  "i-harness.com",
  "fixmycodeerror.com",
  "stacklesson.com",
  // GitHub issue/readme mirrors
  "githubmemory.com",
  "gitmemory.com",
  "issueexplorer.com",
  "bleepcoder.com",
  "gitanswer.com",
  // Documentation mirrors
  "w3cub.com",
  // Generic AI/SEO content farms already demoted by the intent reranker
  "aizolo.com"
];
function blockedDomainMatches(domain, rule) {
  return domain === rule || domain.endsWith(`.${rule}`);
}
var SITE_OPERATOR_RE = /\bsite:([a-z0-9][a-z0-9.-]*)/gi;
function extractDomainConstraints(query, includeDomains) {
  const domains = [];
  for (const match of String(query || "").matchAll(SITE_OPERATOR_RE)) {
    domains.push(match[1].toLowerCase().replace(/\.+$/, ""));
  }
  for (const entry of includeDomains || []) {
    if (entry && entry.trim()) domains.push(entry.toLowerCase().trim());
  }
  return [...new Set(domains)].sort();
}
function filterSpamResults(results, extraBlocked, allowed) {
  const blockedRules = [...SPAM_MIRROR_DOMAINS, ...(extraBlocked || []).map((d) => String(d || "").toLowerCase().trim()).filter(Boolean)];
  const allowedRules = (allowed || []).map((d) => String(d || "").toLowerCase().trim()).filter(Boolean);
  const kept = [];
  const removedDomains = [];
  for (const item of results) {
    const domain = resultDomain(item.url || "");
    if (domain && !allowedRules.some((rule) => blockedDomainMatches(domain, rule)) && blockedRules.some((rule) => blockedDomainMatches(domain, rule))) {
      removedDomains.push(domain);
      continue;
    }
    kept.push(item);
  }
  return { results: kept, removedDomains: [...new Set(removedDomains)].sort() };
}
function rerankDomainDiversity(results, maxPerDomain = 2) {
  if (maxPerDomain < 1 || results.length < 3) return { results, demotedCount: 0 };
  const head = [];
  const overflow = [];
  const perDomain = /* @__PURE__ */ new Map();
  for (const item of results) {
    const domain = resultDomain(item.url || "");
    const count = perDomain.get(domain) || 0;
    if (domain && count >= maxPerDomain) {
      overflow.push(item);
      continue;
    }
    perDomain.set(domain, count + 1);
    head.push(item);
  }
  return { results: [...head, ...overflow], demotedCount: overflow.length };
}
function urlMatchesRule(url, rule) {
  const domain = resultDomain(url);
  if (!rule.includes("/")) return domainMatchesRule(domain, rule);
  const normalized = normalizeUrlForRule(url);
  const normalizedRule = rule.toLowerCase().trim().replace(/\/+$/, "");
  return normalized === normalizedRule || normalized.startsWith(`${normalizedRule}/`);
}
function rerankResultsForIntent(query, routingClass, results) {
  const rules = CANONICAL_DOMAIN_RULES[routingClass];
  if (!results.length || !rules) {
    return { results, metadata: { reranked: false, routing_class: routingClass } };
  }
  const q = query.toLowerCase();
  const scored = results.map((item, idx) => {
    const url = item.url || "";
    const domain = resultDomain(url);
    const title = String(item.title || "").toLowerCase();
    const snippet2 = String(item.snippet || item.description || "").toLowerCase();
    let score = (results.length - idx) * 0.01;
    if (rules.boost.some((rule) => urlMatchesRule(url, rule))) score += 10;
    if (rules.demote.some((rule) => urlMatchesRule(url, rule))) score -= 6;
    if (routingClass === "official/vendor-release" && ["mistral", "anthropic", "openai", "nvidia", "google", "meta"].some((term) => domain.includes(term))) score += 3;
    if (routingClass === "official/regulatory" && (url.toLowerCase().endsWith(".pdf") || title.includes("pdf"))) score += 2;
    if (q.includes("official") && (title.includes("official") || snippet2.includes("official"))) score += 1;
    return { score, idx, item };
  });
  const reranked = [...scored].sort((a, b) => b.score - a.score || a.idx - b.idx).map(({ item }) => ({ ...item }));
  const changed = results.some((item, idx) => (item.url || "") !== (reranked[idx]?.url || ""));
  return {
    results: reranked,
    metadata: {
      reranked: changed,
      routing_class: routingClass,
      top_domain_before: results.length ? resultDomain(results[0].url || "") : null,
      top_domain_after: reranked.length ? resultDomain(reranked[0].url || "") : null
    }
  };
}
function buildAuthoritySignals(routingClass, results) {
  const rules = CANONICAL_DOMAIN_RULES[routingClass] || { boost: [], demote: [] };
  const urls = results.map((item) => item.url || "").filter(Boolean);
  const domains = urls.map((url) => resultDomain(url));
  const boostedDomains = [];
  const demotedDomains = [];
  const boostedFlags = [];
  for (const [i, url] of urls.entries()) {
    const boosted = rules.boost.some((rule) => urlMatchesRule(url, rule));
    const demoted = rules.demote.some((rule) => urlMatchesRule(url, rule));
    boostedFlags.push(boosted);
    if (boosted) boostedDomains.push(domains[i]);
    if (demoted) demotedDomains.push(domains[i]);
  }
  return {
    routing_class: routingClass,
    rules_applied: !!CANONICAL_DOMAIN_RULES[routingClass],
    top_domain: domains[0] || null,
    canonical_domain_hits: [...new Set(boostedDomains)].sort(),
    demoted_domain_hits: [...new Set(demotedDomains)].sort(),
    canonical_top_result: boostedFlags.length > 0 && boostedFlags[0]
  };
}

// query-limits.ts
var MAX_QUERY_CHARS = 2e3;
var PROVIDER_QUERY_LIMITS = {
  brave: { chars: 600, words: 75 }
};
function capQueryLength(query) {
  const chars = Array.from(query);
  return chars.length > MAX_QUERY_CHARS ? chars.slice(0, MAX_QUERY_CHARS).join("").trim() : query;
}
function fitQuery(provider, text) {
  const limit = PROVIDER_QUERY_LIMITS[provider];
  const words = text.split(/\s+/).filter(Boolean);
  if (!limit || text.length <= limit.chars && words.length <= limit.words) return { query: text };
  const kept = [];
  let used = 0;
  for (const word of words) {
    const add = word.length + (kept.length ? 1 : 0);
    if (used + add > limit.chars || kept.length + 1 > limit.words) break;
    kept.push(word);
    used += add;
  }
  if (!kept.length && words.length) kept.push(words[0].slice(0, limit.chars));
  const query = kept.join(" ");
  return {
    query,
    truncated: {
      provider,
      limit_chars: limit.chars,
      limit_words: limit.words,
      original_chars: text.length,
      original_words: words.length,
      sent_chars: query.length,
      sent_words: kept.length
    }
  };
}

// intent-routing.ts
var INTENT_FIRST_PROVIDER = {
  academic: "exa",
  docs: "exa",
  security: "serper",
  shopping: "serper"
};
var MEASURED_PROVIDER_ORDER = ["brave", "serper", "exa", "tavily"];
var SHOPPING_WORDS = /\b(buy|price|preis|kaufen|shop|shopping)\b/;
function mapRoutingClassToIntent(routingClass, query) {
  switch (routingClass) {
    case "academic/arxiv":
      return "academic";
    case "docs/api":
      return "docs";
    case "security/cve":
      return "security";
    case "community/reddit":
      return "community";
    case "multilingual/current":
      return "news";
    case "local/shopping":
      return SHOPPING_WORDS.test(query.toLowerCase()) ? "shopping" : "local";
    // official/*, finance/IR, weather/factual, oss-discovery, answer/synthesis
    // and general have no measured reason to leave the Brave default.
    default:
      return "general";
  }
}
function planIntentRouting(routingClass, query, providerPriority) {
  const intent = mapRoutingClassToIntent(routingClass, query);
  const customOrder = isCustomProviderOrder(providerPriority);
  if (customOrder) {
    return { intent, customOrder, reason: "custom_order", preferred: [...providerPriority] };
  }
  const first = INTENT_FIRST_PROVIDER[intent];
  return {
    intent,
    customOrder,
    reason: routingClass === "general" ? "no_signals_matched" : `intent_${intent}`,
    preferred: [...first ? [first] : [], ...MEASURED_PROVIDER_ORDER, ...providerPriority]
  };
}

// provider-stats.ts
var MAX_SAMPLES_PER_PROVIDER = 50;
var SAMPLE_MAX_AGE_SECONDS = 7 * 24 * 3600;
var MIN_SAMPLES_FOR_ADJUSTMENT = 5;
var MAX_SCORE_ADJUSTMENT = 1;
var LATENCY_CEILING_SECONDS = 8;
var PERFORMANCE_BASELINE = 0.75;
var providerSamples = /* @__PURE__ */ new Map();
var processStartedAt = Date.now();
function nowSeconds() {
  return Date.now() / 1e3;
}
function recordProviderOutcome(provider, latencySeconds, resultCount2, error, now) {
  const sample = {
    t: Math.floor(now ?? nowSeconds()),
    lat: Math.round(Math.max(0, Number(latencySeconds) || 0) * 1e3) / 1e3,
    n: Math.max(0, Math.floor(Number(resultCount2) || 0)),
    err: Boolean(error)
  };
  const samples = providerSamples.get(provider) || [];
  samples.push(sample);
  providerSamples.set(provider, samples.slice(-MAX_SAMPLES_PER_PROVIDER));
}
function freshSamples(provider, now) {
  const cutoff = now - SAMPLE_MAX_AGE_SECONDS;
  return (providerSamples.get(provider) || []).filter((sample) => sample.t >= cutoff);
}
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function getProviderPerformance(provider, now) {
  const nowTs = now ?? nowSeconds();
  const samples = freshSamples(provider, nowTs);
  if (!samples.length) return null;
  const successes = samples.filter((s) => !s.err);
  const empty = successes.filter((s) => s.n === 0);
  const latencies = successes.map((s) => s.lat);
  return {
    samples: samples.length,
    success_rate: Number((successes.length / samples.length).toFixed(3)),
    empty_rate: successes.length ? Number((empty.length / successes.length).toFixed(3)) : 0,
    median_latency_seconds: latencies.length ? Number(median(latencies).toFixed(3)) : null
  };
}
function performanceAdjustment(provider, now) {
  const perf = getProviderPerformance(provider, now);
  if (!perf || perf.samples < MIN_SAMPLES_FOR_ADJUSTMENT) return 0;
  const reliability = perf.success_rate * (1 - 0.5 * perf.empty_rate);
  const speed = perf.median_latency_seconds == null ? 0 : Math.max(0, Math.min(1, 1 - perf.median_latency_seconds / LATENCY_CEILING_SECONDS));
  const combined = 0.6 * reliability + 0.4 * speed;
  const adjustment = (combined - PERFORMANCE_BASELINE) * 2 * MAX_SCORE_ADJUSTMENT;
  return Number(Math.max(-MAX_SCORE_ADJUSTMENT, Math.min(MAX_SCORE_ADJUSTMENT, adjustment)).toFixed(3));
}
function getProviderHealthSnapshot(providers, now) {
  const nowMs = Date.now();
  const snapshots = {};
  for (const provider of providers) {
    const performance = getProviderPerformance(provider, now);
    snapshots[provider] = { ...performance || { samples: 0, success_rate: 0, empty_rate: 0, median_latency_seconds: null }, score_adjustment: performanceAdjustment(provider, now) };
  }
  return { scope: "process_local", process_started_at: new Date(processStartedAt).toISOString(), observed_since_seconds: Math.max(0, Math.floor((nowMs - processStartedAt) / 1e3)), providers: snapshots };
}
function __resetProviderStatsForTests() {
  providerSamples.clear();
}

// search-locale.ts
var FALLBACK_COUNTRY = "us";
var FALLBACK_LANGUAGE = "en";
var AUTO_LANGUAGE = "auto";
var LOCALE_PROVIDERS = /* @__PURE__ */ new Set(["serper", "serpbase", "brave", "querit", "firecrawl", "you", "searxng", "tinyfish"]);
var LOCATION_COUNTRY_HINTS = {
  // Austria
  wien: "at",
  vienna: "at",
  graz: "at",
  salzburg: "at",
  innsbruck: "at",
  "\xF6sterreich": "at",
  austria: "at",
  // Germany
  berlin: "de",
  "m\xFCnchen": "de",
  munich: "de",
  hamburg: "de",
  frankfurt: "de",
  deutschland: "de",
  germany: "de",
  // Switzerland
  "z\xFCrich": "ch",
  zurich: "ch",
  schweiz: "ch",
  switzerland: "ch",
  // France
  paris: "fr",
  lyon: "fr",
  marseille: "fr",
  france: "fr",
  // Spain
  madrid: "es",
  barcelona: "es",
  "espa\xF1a": "es",
  spain: "es",
  // Italy
  rome: "it",
  roma: "it",
  milano: "it",
  milan: "it",
  italia: "it",
  italy: "it",
  // Portugal
  lisbon: "pt",
  lisboa: "pt",
  portugal: "pt",
  // Netherlands
  amsterdam: "nl",
  rotterdam: "nl",
  netherlands: "nl",
  // United Kingdom
  london: "gb",
  manchester: "gb",
  "united kingdom": "gb",
  // United States
  "new york": "us",
  chicago: "us",
  "san francisco": "us",
  usa: "us"
};
var LANGUAGE_INFERENCE_MIN_MATCHES = 2;
var LANGUAGE_INFERENCE_STOPWORDS = {
  en: /* @__PURE__ */ new Set(["the", "and", "what", "how", "where", "when", "which", "who", "best", "near", "hours", "open", "with", "from", "for", "are", "is", "was", "does", "latest", "today", "new"]),
  de: /* @__PURE__ */ new Set(["der", "die", "das", "und", "oder", "nicht", "ist", "sind", "ein", "eine", "einen", "mit", "f\xFCr", "von", "wie", "wo", "was", "warum", "welche", "beste", "besten", "gibt", "\xF6ffnungszeiten", "heute", "morgen", "preis", "kaufen", "g\xFCnstig", "n\xE4he"]),
  es: /* @__PURE__ */ new Set(["el", "los", "las", "una", "unos", "que", "qu\xE9", "c\xF3mo", "d\xF3nde", "cu\xE1l", "por", "para", "con", "mejores", "mejor", "cerca", "hoy", "horario", "horarios", "abierto", "abiertos", "tiendas", "restaurantes", "precio", "precios", "donde", "como"]),
  fr: /* @__PURE__ */ new Set(["le", "les", "des", "une", "du", "o\xF9", "quel", "quelle", "quels", "quelles", "meilleur", "meilleure", "meilleurs", "meilleures", "horaires", "ouvert", "ouverts", "ouverture", "aujourd", "hui", "pr\xE8s", "proche", "avec", "pour", "prix", "cher", "que"]),
  it: /* @__PURE__ */ new Set(["il", "lo", "gli", "che", "come", "dove", "quale", "quali", "migliori", "migliore", "orari", "orario", "aperto", "aperti", "vicino", "con", "oggi", "prezzo", "prezzi", "negozi", "ristoranti", "della", "delle"]),
  pt: /* @__PURE__ */ new Set(["os", "do", "dos", "das", "um", "uma", "que", "como", "onde", "qual", "quais", "melhores", "melhor", "hor\xE1rios", "aberto", "perto", "hoje", "pre\xE7o", "lojas", "com", "voc\xEA", "para", "restaurantes"]),
  nl: /* @__PURE__ */ new Set(["het", "een", "waar", "hoe", "welke", "beste", "goedkoop", "goedkoopste", "vandaag", "morgen", "openingstijden", "winkel", "winkels", "dichtbij", "buurt", "naar", "zijn", "niet", "voor"])
};
var LANGUAGE_INFERENCE_CHAR_HINTS = {
  de: "\xE4\xF6\xFC\xDF",
  es: "\xF1\xBF\xA1",
  pt: "\xE3\xF5",
  fr: "\u0153"
};
function providerSupportsLocale(provider) {
  return LOCALE_PROVIDERS.has(provider);
}
function detectLocationCountry(query) {
  if (!query) return null;
  const lowered = query.toLowerCase();
  const countries = /* @__PURE__ */ new Set();
  for (const [place, country] of Object.entries(LOCATION_COUNTRY_HINTS)) {
    const escaped = place.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}($|[^\\p{L}\\p{N}_])`, "iu").test(lowered)) countries.add(country);
  }
  return countries.size === 1 ? [...countries][0] : null;
}
function inferQueryLanguage(query) {
  if (!query) return null;
  const lowered = query.toLowerCase();
  const words = new Set(lowered.match(/[\p{L}\p{N}_]+/gu) || []);
  const counts = {};
  for (const [language, stopwords] of Object.entries(LANGUAGE_INFERENCE_STOPWORDS)) {
    let count = 0;
    for (const word of words) if (stopwords.has(word)) count += 1;
    for (const char of LANGUAGE_INFERENCE_CHAR_HINTS[language] || "") {
      if (lowered.includes(char)) count += 1;
    }
    if (count) counts[language] = count;
  }
  const ranked = Object.entries(counts).sort(([la, ca], [lb, cb]) => cb - ca || la.localeCompare(lb));
  if (!ranked.length) return null;
  const [bestLanguage, bestCount] = ranked[0];
  if (bestCount < LANGUAGE_INFERENCE_MIN_MATCHES) return null;
  if (ranked.length > 1 && ranked[1][1] === bestCount) return null;
  return bestLanguage;
}
function resolveLocale(provider, runtimeConfig, query) {
  const configuredCountry = String(runtimeConfig.localeCountry || "").trim().toLowerCase();
  const configuredLanguage = String(runtimeConfig.localeLanguage || "").trim().toLowerCase();
  let country;
  let countrySource;
  const hinted = detectLocationCountry(query);
  if (hinted) {
    country = hinted;
    countrySource = "hint";
  } else if (configuredCountry) {
    country = configuredCountry;
    countrySource = "config";
  } else {
    country = FALLBACK_COUNTRY;
    countrySource = "fallback";
  }
  let language;
  let languageSource;
  const autoLanguage = configuredLanguage === AUTO_LANGUAGE;
  if (configuredLanguage && !autoLanguage) {
    language = configuredLanguage;
    languageSource = "config";
  } else {
    const inferred = autoLanguage ? inferQueryLanguage(query || "") : null;
    if (inferred) {
      language = inferred;
      languageSource = "inferred";
    } else {
      language = FALLBACK_LANGUAGE;
      languageSource = "fallback";
    }
  }
  return {
    country,
    language,
    metadata: { country, language, source: { country: countrySource, language: languageSource } }
  };
}

// shadow-quality.ts
var startedAt = Date.now();
var observations = 0;
var resultCount = 0;
var domainCount = 0;
var thinSnippets = 0;
var degraded = 0;
function recordShadowQualityObservation(payload) {
  const results = Array.isArray(payload?.results) ? payload.results : [];
  const domains = /* @__PURE__ */ new Set();
  for (const result of results) {
    try {
      domains.add(new URL(String(result?.url || "")).hostname.replace(/^www\./, "").toLowerCase());
    } catch {
    }
    if (String(result?.snippet || "").length < 40) thinSnippets += 1;
  }
  observations += 1;
  resultCount += results.length;
  domainCount += domains.size;
  if (payload?.status === "degraded" || payload?.status === "failed") degraded += 1;
}
function getShadowQualitySnapshot() {
  return {
    scope: "process_local",
    process_started_at: new Date(startedAt).toISOString(),
    observations,
    aggregate: {
      average_result_count: observations ? Number((resultCount / observations).toFixed(3)) : 0,
      average_domain_count: observations ? Number((domainCount / observations).toFixed(3)) : 0,
      thin_snippet_rate: resultCount ? Number((thinSnippets / resultCount).toFixed(3)) : 0,
      degraded_or_failed_rate: observations ? Number((degraded / observations).toFixed(3)) : 0
    },
    note: "Passive observations only; they do not alter routing or results."
  };
}

// extract-benchmark.ts
var latest = null;
function saveExtractBenchmark(result) {
  latest = structuredClone(result);
}

// provider-http.ts
var ProviderConfigError = class extends Error {
  code;
  constructor(code) {
    super(code);
    this.name = "ProviderConfigError";
    this.code = code;
  }
};
var ProviderRequestError = class extends Error {
  code;
  statusCode;
  transient;
  retryAfter;
  constructor(code, options = {}) {
    super(code);
    this.name = "ProviderRequestError";
    this.code = code;
    this.statusCode = options.statusCode;
    this.transient = options.transient === true;
    this.retryAfter = options.retryAfter;
  }
};
function boundedTimeoutSeconds(value, fallback, errorCode) {
  const parsed = value == null ? fallback : Number(value);
  if (!Number.isFinite(parsed)) throw new ProviderConfigError(errorCode);
  const bounded = Math.floor(parsed);
  if (bounded < 1 || bounded > 120) throw new ProviderConfigError(errorCode);
  return bounded;
}
function parseFiniteRetryAfter(value) {
  if (value == null || !value.trim()) return void 0;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : void 0;
}
async function discardBody(response) {
  try {
    await response.body?.cancel();
  } catch {
  }
}
async function readBoundedBytes(response, maxResponseBytes, errorPrefix) {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxResponseBytes) {
    await discardBody(response);
    throw new ProviderRequestError(`${errorPrefix}_response_too_large`, { transient: true });
  }
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maxResponseBytes) {
      throw new ProviderRequestError(`${errorPrefix}_response_too_large`, { transient: true });
    }
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > maxResponseBytes) {
        try {
          await reader.cancel();
        } catch {
        }
        throw new ProviderRequestError(`${errorPrefix}_response_too_large`, { transient: true });
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}
async function requestBoundedJson(url, init, options) {
  const timeoutSeconds = boundedTimeoutSeconds(
    options.timeoutSeconds,
    30,
    `${options.errorPrefix}_timeout_invalid`
  );
  const maxResponseBytes = Math.floor(Number(options.maxResponseBytes));
  if (!Number.isFinite(maxResponseBytes) || maxResponseBytes < 1) {
    throw new ProviderConfigError(`${options.errorPrefix}_response_limit_invalid`);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutSeconds * 1e3);
  timer.unref?.();
  try {
    const response = await fetch(url, {
      ...init,
      redirect: "error",
      signal: controller.signal
    });
    if (!response.ok) {
      const statusCode = response.status;
      const retryAfter = statusCode === 429 ? parseFiniteRetryAfter(response.headers.get("retry-after")) : void 0;
      await discardBody(response);
      throw new ProviderRequestError(`${options.errorPrefix}_http_${statusCode}`, {
        statusCode,
        transient: options.transientStatuses?.has(statusCode) === true,
        retryAfter
      });
    }
    const bytes = await readBoundedBytes(response, maxResponseBytes, options.errorPrefix);
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return JSON.parse(text);
    } catch {
      throw new ProviderRequestError(`${options.errorPrefix}_invalid_response`, { transient: true });
    }
  } catch (error) {
    if (error instanceof ProviderConfigError || error instanceof ProviderRequestError) throw error;
    throw new ProviderRequestError(`${options.errorPrefix}_unavailable`, { transient: true });
  } finally {
    clearTimeout(timer);
  }
}

// octen-provider.ts
var OCTEN_API_URL = "https://api.monid.ai/v1/run";
var OCTEN_MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
var OCTEN_TRANSIENT_STATUSES = /* @__PURE__ */ new Set([429, 500, 502, 503, 504]);
var FRESHNESS_VALUES = /* @__PURE__ */ new Set(["day", "week", "month", "year"]);
var OCTEN_PROVIDER_METADATA = Object.freeze({
  id: "octen",
  displayName: "Octen via Monid",
  apiKeyConfig: "monidApiKey",
  autoAllowedByDefault: false,
  capabilities: ["search", "freshness"],
  freeTier: "No free-tier claim; Monid API key and wallet balance required",
  signupUrl: "https://app.monid.ai/access/api-keys"
});
function cleanDomains2(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}
function finiteCount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new ProviderConfigError("octen_max_results_invalid");
  return Math.max(1, Math.min(100, Math.floor(parsed)));
}
function stringValue(value) {
  return typeof value === "string" ? value : "";
}
function safeHttpUrl2(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) return "";
    return value;
  } catch {
    return "";
  }
}
function providerFailure(code) {
  const statusCode = Number.isInteger(code) ? Number(code) : void 0;
  const suffix = statusCode == null ? "unknown" : String(statusCode);
  return new ProviderRequestError(`octen_api_${suffix}`, {
    statusCode,
    transient: statusCode != null && OCTEN_TRANSIENT_STATUSES.has(statusCode)
  });
}
function projectMetadata(envelope, output) {
  const metadata = {};
  if (typeof envelope.runId === "string" && envelope.runId) metadata.monid_run_id = envelope.runId;
  if (typeof output.request_id === "string" && output.request_id) metadata.request_id = output.request_id;
  const meta = output.meta;
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    if (typeof meta.latency === "number" && Number.isFinite(meta.latency)) metadata.latency_ms = meta.latency;
    const usage = meta.usage;
    if (usage && typeof usage === "object" && !Array.isArray(usage)) {
      const projectedUsage = {};
      if (Number.isInteger(usage.num_search_queries) && usage.num_search_queries >= 0) {
        projectedUsage.search_queries = usage.num_search_queries;
      }
      if (Number.isInteger(usage.full_content_tokens) && usage.full_content_tokens >= 0) {
        projectedUsage.full_content_tokens = usage.full_content_tokens;
      }
      if (Object.keys(projectedUsage).length) metadata.usage = projectedUsage;
    }
  }
  const actualCost = envelope.billing?.actualCost;
  if (actualCost && typeof actualCost === "object" && typeof actualCost.value === "number" && Number.isFinite(actualCost.value) && actualCost.unit === "MICRO_DOLLAR") {
    metadata.cost_usd = actualCost.value / 1e6;
  }
  return metadata;
}
async function searchOcten(query, apiKey, maxResults, options = {}) {
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    throw new ProviderConfigError("monid_api_key_required");
  }
  if (typeof query !== "string" || !query.trim()) {
    throw new ProviderConfigError("octen_query_invalid");
  }
  const count = finiteCount(maxResults);
  const timeoutSeconds = boundedTimeoutSeconds(
    options.timeoutSeconds,
    30,
    "octen_timeout_invalid"
  );
  const input = {
    query,
    count,
    // Octen has a news topic, but this source-only adapter intentionally stays
    // on the truthful capability surface until native vertical metadata is
    // wired through the OpenClaw router.
    topic: "general",
    highlight: { enable: true, max_tokens: 300 },
    full_content: { enable: false },
    format: "text"
  };
  const includeDomains = cleanDomains2(options.includeDomains);
  const excludeDomains = cleanDomains2(options.excludeDomains);
  if (includeDomains.length) input.include_domains = includeDomains;
  if (excludeDomains.length) input.exclude_domains = excludeDomains;
  const freshness = FRESHNESS_VALUES.has(String(options.freshness || "")) ? options.freshness : options.timeRange;
  if (FRESHNESS_VALUES.has(String(freshness || ""))) input.time_range = freshness;
  const envelope = await requestBoundedJson(OCTEN_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({ provider: "octen", endpoint: "/search", input })
  }, {
    timeoutSeconds,
    maxResponseBytes: OCTEN_MAX_RESPONSE_BYTES,
    errorPrefix: "octen",
    transientStatuses: OCTEN_TRANSIENT_STATUSES
  });
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
    throw new ProviderRequestError("octen_invalid_response", { transient: true });
  }
  if (envelope.provider !== "octen" || envelope.endpoint !== "/search") {
    throw new ProviderRequestError("octen_monid_invalid_envelope", { transient: true });
  }
  if (envelope.status === "FAILED") {
    throw new ProviderRequestError("octen_monid_failed", { statusCode: 500, transient: false });
  }
  if (envelope.status !== "COMPLETED") {
    throw new ProviderRequestError("octen_monid_not_completed", { transient: true });
  }
  const providerResponse = envelope.providerResponse;
  const providerStatus = providerResponse && typeof providerResponse === "object" ? providerResponse.httpStatus : void 0;
  if (!Number.isInteger(providerStatus)) {
    throw new ProviderRequestError("octen_monid_invalid_response", { transient: true });
  }
  if (providerStatus < 200 || providerStatus >= 300) {
    throw new ProviderRequestError(`octen_provider_http_${providerStatus}`, {
      statusCode: providerStatus,
      transient: OCTEN_TRANSIENT_STATUSES.has(providerStatus)
    });
  }
  const output = envelope.output;
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    throw new ProviderRequestError("octen_monid_invalid_response", { transient: true });
  }
  if (output.code !== 0) throw providerFailure(output.code);
  if (!output.data || typeof output.data !== "object" || !Array.isArray(output.data.results)) {
    throw new ProviderRequestError("octen_invalid_response", { transient: true });
  }
  const results = [];
  for (const item of output.data.results.slice(0, count)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const url = safeHttpUrl2(item.url);
    if (!url) continue;
    const projected = {
      url,
      title: stringValue(item.title),
      snippet: stringValue(item.highlight)
    };
    const optional = {
      date: item.time_published,
      author: item.authors,
      favicon: item.favicon,
      last_crawled: item.time_last_crawled
    };
    for (const [field, value] of Object.entries(optional)) {
      if (typeof value === "string" && value) projected[field] = value;
    }
    results.push(projected);
  }
  return {
    provider: "octen",
    query,
    results,
    images: [],
    metadata: projectMetadata(envelope, output)
  };
}

// tinyfish-provider.ts
var TINYFISH_PROVIDER_METADATA = Object.freeze({
  id: "tinyfish",
  kind: "search",
  envVar: "TINYFISH_API_KEY",
  displayName: "TinyFish Search",
  description: "Direct source-only TinyFish web/news search using your own account/API key. The plugin does not provide, pool, proxy, or share TinyFish credentials. Domain filters and result hosts are accepted only as ASCII/Punycode hostnames. Privacy warning: TinyFish's standard Terms permit Customer Data to be used for model training and fine-tuning; review https://www.tinyfish.ai/terms and https://www.tinyfish.ai/privacy-policy before use. Explicit-only by default.",
  capabilityLabels: Object.freeze(["search", "news", "freshness", "privacy-warning"]),
  upstreamCapabilities: Object.freeze([
    "search",
    "news",
    "research-paper",
    "freshness",
    "domain-filtering"
  ]),
  autoAllowedByDefault: false,
  explicitOnly: true,
  recommended: false,
  supportsFreshness: true,
  freeTier: "Search does not consume credits; API access required (30 rpm Free/PAYG)",
  signupUrl: "https://agent.tinyfish.ai/api-keys",
  termsUrl: "https://www.tinyfish.ai/terms",
  privacyPolicyUrl: "https://www.tinyfish.ai/privacy-policy"
});
var API_URL = "https://api.search.tinyfish.ai/";
var MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
var MAX_QUERY_CHARS2 = 2e3;
var MAX_DOMAIN_COUNT = 20;
var MAX_DOMAIN_CHARS = 253;
var MAX_DOMAIN_LIST_CHARS = 2048;
var MAX_REQUEST_URL_CHARS = 8192;
var MAX_URL_CHARS2 = 8192;
var MAX_TITLE_CHARS2 = 1e3;
var MAX_SNIPPET_CHARS2 = 8e3;
var TRANSIENT_STATUSES = /* @__PURE__ */ new Set([429, 500, 503]);
var FRESHNESS_MINUTES = Object.freeze({
  day: 24 * 60,
  week: 7 * 24 * 60,
  month: 30 * 24 * 60,
  year: 365 * 24 * 60
});
var OTHER_CHARACTER = new RegExp("\\p{C}", "u");
var WHITE_SPACE = new RegExp("\\p{White_Space}", "u");
var DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
function codePoints(value) {
  return Array.from(value);
}
function codePointLength2(value) {
  return codePoints(value).length;
}
function hasWhitespaceOrOther(value) {
  return codePoints(value).some((character) => WHITE_SPACE.test(character) || OTHER_CHARACTER.test(character));
}
function canonicalHostname(hostname) {
  if (!hostname || hostname.endsWith("..") || hasWhitespaceOrOther(hostname)) return "";
  const token = hostname.endsWith(".") ? hostname.slice(0, -1) : hostname;
  if (codePoints(token).some((character) => character.codePointAt(0) > 127)) return "";
  const canonical = token.toLowerCase();
  const labels = canonical.split(".");
  if (!canonical || canonical.length > MAX_DOMAIN_CHARS || labels.length < 2 || labels.some((label) => !DOMAIN_LABEL.test(label))) return "";
  return canonical;
}
function cleanDomains3(value) {
  if (!Array.isArray(value)) return [];
  if (value.length > MAX_DOMAIN_COUNT) throw new ProviderConfigError("tinyfish_domains_invalid");
  const rawItems = [];
  for (const item of value) {
    if (typeof item !== "string" || !item || hasWhitespaceOrOther(item)) {
      throw new ProviderConfigError("tinyfish_domains_invalid");
    }
    const rootDotAllowance = item.endsWith(".") ? 1 : 0;
    if (codePointLength2(item) > MAX_DOMAIN_CHARS + rootDotAllowance) {
      throw new ProviderConfigError("tinyfish_domains_invalid");
    }
    rawItems.push(item);
  }
  if (rawItems.join(",").length > MAX_DOMAIN_LIST_CHARS) {
    throw new ProviderConfigError("tinyfish_domains_invalid");
  }
  const domains = [];
  for (const item of rawItems) {
    const raw = item.toLowerCase();
    if (raw.endsWith("..")) throw new ProviderConfigError("tinyfish_domains_invalid");
    const token = raw.endsWith(".") ? raw.slice(0, -1) : raw;
    const wildcard = token.startsWith("*.");
    const hostname = wildcard ? token.slice(2) : token;
    const canonical = canonicalHostname(hostname);
    if (!canonical) throw new ProviderConfigError("tinyfish_domains_invalid");
    const normalized = wildcard ? `*.${canonical}` : canonical;
    if (normalized.length > MAX_DOMAIN_CHARS) {
      throw new ProviderConfigError("tinyfish_domains_invalid");
    }
    if (!domains.includes(normalized)) domains.push(normalized);
  }
  if (domains.join(",").length > MAX_DOMAIN_LIST_CHARS) {
    throw new ProviderConfigError("tinyfish_domains_invalid");
  }
  return domains;
}
function rawAuthority(url) {
  const match = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/i.exec(url);
  return match?.[1] ?? "";
}
function rawHostname(authority) {
  if (!authority || authority.includes("@") || authority.startsWith("[")) return "";
  const firstColon = authority.indexOf(":");
  if (firstColon < 0) return authority;
  if (firstColon !== authority.lastIndexOf(":")) return "";
  const portToken = authority.slice(firstColon + 1);
  if (portToken && (!/^\d+$/.test(portToken) || Number(portToken) < 1 || Number(portToken) > 65535)) {
    return "";
  }
  return authority.slice(0, firstColon);
}
function safeUrl(value) {
  if (typeof value !== "string" || !value || codePointLength2(value) > MAX_URL_CHARS2 || hasWhitespaceOrOther(value)) return "";
  const authority = rawAuthority(value);
  const canonical = canonicalHostname(rawHostname(authority));
  if (!canonical) return "";
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) return "";
  } catch {
    return "";
  }
  return value;
}
function boundedString2(value, limit) {
  if (typeof value !== "string") return "";
  const cleaned = codePoints(value).filter((character) => character === " " || character === "\n" || character === "	" || !OTHER_CHARACTER.test(character) && !WHITE_SPACE.test(character)).join("").trim();
  return codePoints(cleaned).slice(0, limit).join("");
}
function domainMatches2(hostname, domain) {
  let normalized = domain.trim().toLowerCase().replace(/\.$/, "");
  if (normalized.startsWith("*.")) normalized = normalized.slice(2);
  return !!normalized && (hostname === normalized || hostname.endsWith(`.${normalized}`));
}
function urlAllowedByDomains(url, includeDomains, excludeDomains) {
  const hostname = canonicalHostname(rawHostname(rawAuthority(url)));
  if (!hostname || excludeDomains.some((domain) => domainMatches2(hostname, domain))) return false;
  return !includeDomains.length || includeDomains.some((domain) => domainMatches2(hostname, domain));
}
function boundedResultCount(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ProviderConfigError("tinyfish_max_results_invalid");
  }
  return Math.max(1, Math.min(Math.trunc(value), 100));
}
function queryParams(options, query, includeDomains, excludeDomains) {
  const params = new URLSearchParams({ query });
  if (typeof options.country === "string" && options.country.trim()) {
    params.set("location", options.country.trim().toUpperCase());
  }
  if (typeof options.language === "string" && options.language.trim()) {
    params.set("language", options.language.trim().toLowerCase());
  }
  if (includeDomains.length) params.set("include_domains", includeDomains.join(","));
  if (excludeDomains.length) params.set("exclude_domains", excludeDomains.join(","));
  params.set("domain_type", options.searchType === "news" ? "news" : "web");
  const freshness = options.freshness && FRESHNESS_MINUTES[options.freshness] != null ? options.freshness : options.timeRange;
  if (freshness && FRESHNESS_MINUTES[freshness] != null) {
    params.set("recency_minutes", String(FRESHNESS_MINUTES[freshness]));
  }
  return params;
}
function projectResults(rawResults, count, includeDomains, excludeDomains) {
  const projected = [];
  for (const item of rawResults) {
    if (projected.length >= count) break;
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const source = item;
    const url = safeUrl(source.url);
    if (!url || !urlAllowedByDomains(url, includeDomains, excludeDomains)) continue;
    const result = {
      url,
      title: boundedString2(source.title, MAX_TITLE_CHARS2),
      snippet: boundedString2(source.snippet, MAX_SNIPPET_CHARS2)
    };
    for (const [field, value] of [
      ["date", source.date],
      ["source", source.site_name],
      ["author", source.publisher]
    ]) {
      const projectedValue = boundedString2(value, 1e3);
      if (projectedValue) result[field] = projectedValue;
    }
    if (Number.isInteger(source.position) && source.position >= 1) result.position = source.position;
    projected.push(result);
  }
  return projected;
}
async function searchTinyFish(query, apiKey, maxResults, options = {}) {
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    throw new ProviderConfigError("tinyfish_api_key_required");
  }
  if (typeof query !== "string") throw new ProviderConfigError("tinyfish_query_invalid");
  const normalizedQuery = query.trim();
  if (!normalizedQuery || codePointLength2(normalizedQuery) > MAX_QUERY_CHARS2) {
    throw new ProviderConfigError("tinyfish_query_invalid");
  }
  const count = boundedResultCount(maxResults);
  const includeDomains = cleanDomains3(options.includeDomains);
  const excludeDomains = cleanDomains3(options.excludeDomains);
  const timeoutSeconds = boundedTimeoutSeconds(
    options.timeoutSeconds,
    30,
    "tinyfish_timeout_invalid"
  );
  const params = queryParams(options, normalizedQuery, includeDomains, excludeDomains);
  const requestUrl = `${API_URL}?${params.toString()}`;
  if (requestUrl.length > MAX_REQUEST_URL_CHARS) {
    throw new ProviderConfigError("tinyfish_request_too_large");
  }
  const payload = await requestBoundedJson(requestUrl, {
    method: "GET",
    headers: {
      "X-API-Key": apiKey.trim(),
      Accept: "application/json"
    },
    redirect: "error"
  }, {
    timeoutSeconds,
    maxResponseBytes: MAX_RESPONSE_BYTES,
    errorPrefix: "tinyfish",
    transientStatuses: TRANSIENT_STATUSES
  });
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || !Array.isArray(payload.results)) {
    throw new ProviderRequestError("tinyfish_invalid_response", { transient: true });
  }
  const body = payload;
  const metadata = {};
  for (const field of ["total_results", "page"]) {
    const value = body[field];
    if (Number.isInteger(value) && value >= 0) metadata[field] = value;
  }
  return {
    provider: "tinyfish",
    query: normalizedQuery,
    results: projectResults(body.results, count, includeDomains, excludeDomains),
    images: [],
    metadata
  };
}

// source-only-gate.ts
var ANSWER_ONLY_PROVIDERS = /* @__PURE__ */ new Set([
  "perplexity",
  "kilo-perplexity"
]);
var BANNED_REQUEST_KEYS = /* @__PURE__ */ new Set([
  "messages",
  "system",
  "systemprompt",
  "answer",
  "includeanswer",
  "synthesis",
  "fullsynthesis",
  "reasoning",
  "claim",
  "verification"
]);
var BANNED_RESULT_KEYS = /* @__PURE__ */ new Set([
  "answer",
  "synthesis",
  "fullsynthesis",
  "claim",
  "verification"
]);
var BANNED_INSTRUCTION_FRAGMENTS = [
  "answer the user",
  "provide an answer",
  "synthesize",
  "reason step by step",
  "verify the claim"
];
var SourceOnlyGateError = class extends Error {
  code;
  path;
  constructor(code, path2, detail = code) {
    super(path2 ? `${detail} at ${path2}` : detail);
    this.name = "SourceOnlyGateError";
    this.code = code;
    this.path = path2;
  }
};
function normalizedProvider(provider) {
  return String(provider ?? "").trim().toLowerCase().replace(/_/g, "-");
}
function normalizedKey(key) {
  return key.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}
function childPath(parent, key) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? `${parent}.${key}` : `${parent}[${JSON.stringify(key)}]`;
}
function isInstructionLikeKey(key) {
  const keyName = normalizedKey(key);
  return keyName.includes("instruction") || keyName.includes("prompt") || keyName === "system" || keyName.startsWith("system");
}
function walkRecursively(value, visitor, path2 = "$", key = void 0, ancestors = /* @__PURE__ */ new Set(), parentInstructionContext = false) {
  const instructionContext = parentInstructionContext || key != null && isInstructionLikeKey(key);
  visitor(value, path2, key, instructionContext);
  if (value == null || typeof value !== "object") return;
  if (ancestors.has(value)) {
    throw new SourceOnlyGateError("source_only_non_json_cycle", path2);
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      value.forEach((child, index) => {
        walkRecursively(
          child,
          visitor,
          `${path2}[${index}]`,
          void 0,
          ancestors,
          instructionContext
        );
      });
      return;
    }
    for (const [key2, child] of Object.entries(value)) {
      walkRecursively(
        child,
        visitor,
        childPath(path2, key2),
        key2,
        ancestors,
        instructionContext
      );
    }
  } finally {
    ancestors.delete(value);
  }
}
function requireObject(value, code) {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new SourceOnlyGateError(code, "$");
  }
}
function assertSourceOnlyProvider(provider) {
  const normalized = normalizedProvider(provider);
  if (ANSWER_ONLY_PROVIDERS.has(normalized)) {
    throw new SourceOnlyGateError(
      "source_only_answer_provider",
      void 0,
      `${normalized} has no verified source-only endpoint`
    );
  }
  return normalized;
}
function validateSourceOnlyOutboundRequest(provider, body) {
  const normalized = assertSourceOnlyProvider(provider);
  requireObject(body, "source_only_request_body_invalid");
  walkRecursively(body, (value, path2, key, instructionContext) => {
    if (key != null) {
      const keyName = normalizedKey(key);
      if (BANNED_REQUEST_KEYS.has(keyName)) {
        if (keyName === "includeanswer" && value === false) return;
        throw new SourceOnlyGateError("source_only_request_field", path2);
      }
    }
    if (instructionContext && typeof value === "string") {
      const instruction = value.toLowerCase().replace(/\s+/g, " ");
      if (BANNED_INSTRUCTION_FRAGMENTS.some((fragment) => instruction.includes(fragment))) {
        throw new SourceOnlyGateError("source_only_request_instruction", path2);
      }
    }
  });
  if (normalized === "tavily" && body.include_answer !== false) {
    throw new SourceOnlyGateError(
      "source_only_tavily_requires_include_answer_false",
      "$.include_answer",
      "tavily source-only mode requires include_answer=false"
    );
  }
  if (normalized === "linkup" && body.outputType !== "searchResults") {
    throw new SourceOnlyGateError(
      "source_only_linkup_requires_search_results",
      "$.outputType",
      "linkup source-only mode requires outputType=searchResults"
    );
  }
  if (normalized === "exa") {
    walkRecursively(body, (value, path2, key) => {
      if (key == null || typeof value !== "string") return;
      if (!["type", "depth", "searchdepth"].includes(normalizedKey(key))) return;
      const mode = value.trim().toLowerCase();
      if (mode === "deep" || mode === "deep-reasoning") {
        throw new SourceOnlyGateError(
          "source_only_exa_deep_mode",
          path2,
          "exa deep modes are not source-only"
        );
      }
    });
  }
}
function validateSourceOnlyAdapterResult(provider, result) {
  assertSourceOnlyProvider(provider);
  requireObject(result, "source_only_adapter_result_invalid");
  walkRecursively(result, (value, path2, key) => {
    if (key != null && BANNED_RESULT_KEYS.has(normalizedKey(key))) {
      throw new SourceOnlyGateError("source_only_adapter_result_field", path2);
    }
    if (key != null && normalizedKey(key) === "type" && typeof value === "string") {
      const resultType = value.trim().toLowerCase();
      if (resultType === "answer" || resultType === "synthesis") {
        throw new SourceOnlyGateError("source_only_adapter_result_type", path2);
      }
    }
  });
}

// index.ts
var DEFAULT_CACHE_TTL = 3600;
var NO_RESULTS_MESSAGE = "No results found for this query. Do not invent sources or facts; say that nothing was found, or retry with a broader or differently worded query.";
var RETRY_BACKOFF_MS = [1e3, 3e3, 9e3];
var RETRY_JITTER_FRACTION = 0.5;
var DEFAULT_RESEARCH_EXTRACT_COUNT = 3;
var DEFAULT_RESEARCH_TIME_BUDGET_SECONDS = 55;
var COOLDOWN_STEPS_SECONDS = [60, 300, 1500, 3600];
var TRANSIENT_HTTP_CODES = /* @__PURE__ */ new Set([408, 425, 429, 500, 502, 503, 504]);
var FAILURE_DECAY_SECONDS = 1800;
var RATE_LIMIT_MAX_ATTEMPTS = 2;
var MAX_RETRY_AFTER_WAIT_SECONDS = 30;
var SEARCH_PROVIDER_ENUM = [...ALL_PROVIDER_NAMES, "auto"];
var PARAMETERS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["query"],
  properties: {
    query: { type: "string", description: "Search query" },
    provider: {
      type: "string",
      enum: SEARCH_PROVIDER_ENUM,
      description: "Force a provider, or use auto routing (default: auto)"
    },
    routing_override_provider: {
      type: "string",
      enum: SEARCH_PROVIDER_ENUM.filter((provider) => provider !== "auto"),
      description: "Disable automatic search routing and force this provider for this request. Reported visibly in routing.override_provider."
    },
    no_cache: { type: "boolean", default: false, description: "Bypass search cache reads and writes." },
    cache_ttl: { type: "integer", minimum: 1, maximum: 86400, description: "Search cache TTL in seconds, capped by recency." },
    count: { type: "integer", minimum: 1, maximum: 20, description: "Number of source results (defaults.max_results or 5)" },
    time_range: {
      type: "string",
      enum: ["hour", "day", "week", "month", "year"],
      description: "Recency filter where supported."
    },
    freshness: {
      type: "string",
      enum: ["day", "week", "month", "year"],
      description: "Unified recency filter. Providers with native date filters receive the mapped value; providers without support run the normal search and report freshness.applied=false in metadata."
    },
    search_type: {
      type: "string",
      enum: ["search", "news"],
      description: "Result vertical. Serper serves news natively via its /news endpoint; other providers run their normal search and report search_type.applied=false in metadata."
    },
    include_domains: {
      type: "array",
      items: { type: "string" },
      description: "Only include results from these domains (Tavily, Linkup, Querit, Exa, Firecrawl where supported)."
    },
    exclude_domains: {
      type: "array",
      items: { type: "string" },
      description: "Exclude results from these domains (Tavily, Linkup, Querit, Exa, Firecrawl where supported)."
    },
    quality_report: { type: "boolean", description: "Attach routing decision, provider score, result-quality, authority-signal, and fallback diagnostics." },
    mode: {
      type: "string",
      enum: ["normal", "research"],
      description: "normal routes to a single provider; research queries up to 3 providers concurrently, deduplicates, and extracts top sources for grounding."
    },
    research_providers: {
      type: "array",
      maxItems: 3,
      items: { type: "string", enum: SEARCH_PROVIDER_ENUM.filter((value) => value !== "auto") },
      description: "Explicit provider list for mode=research. Defaults to an auto-selected compact set."
    },
    research_extract_count: { type: "number", description: "Number of top research-mode URLs to extract for grounding (default: 3, max: 5)." },
    research_time_budget: { type: "number", description: "Best-effort wall-clock budget in seconds for research mode; skips remaining providers and extraction when exhausted (default: 55)." }
  }
};
var ROUTING_CONFIG_ACTIONS = [
  "show",
  "set_default_provider",
  "set_auto_routing",
  "set_provider_priority",
  "set_extract_provider_priority",
  "set_fallback_provider",
  "disable_provider",
  "enable_provider",
  "set_confidence_threshold",
  "set_profile",
  "set_auto_allow",
  "reset"
];
var ROUTING_CONFIG_PARAMETERS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["action"],
  properties: {
    action: { type: "string", enum: ROUTING_CONFIG_ACTIONS },
    provider: { type: "string", enum: [...SEARCH_PROVIDER_ENUM.filter((value) => value !== "auto"), "none", "null"] },
    enabled: { type: "boolean", description: "Boolean value used by set_auto_routing and set_auto_allow." },
    providers: { type: "array", items: { type: "string", enum: SEARCH_PROVIDER_ENUM.filter((value) => value !== "auto") }, description: "Search or extraction priority order, depending on the selected action. Missing providers are appended in default order." },
    confidence_threshold: { type: "number", minimum: 0, maximum: 1 },
    profile: { type: "string", enum: ["standard", "self_hosted"] }
  }
};
var ALL_PROVIDERS = [...ALL_PROVIDER_NAMES];
function parseRetryAfter(value) {
  if (!value) return void 0;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const dateMs = Date.parse(trimmed);
  if (!Number.isNaN(dateMs)) return Math.max(0, Math.ceil((dateMs - Date.now()) / 1e3));
  return void 0;
}
var SENSITIVE_PATTERNS = [
  /\b(?:sk|pk|rk|api|tok)_[A-Za-z0-9\-_]{10,}\b/g,
  /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/gi,
  /\b(?:key|token|secret|password|api[_-]?key)\s*[:=]\s*[^\s,"'}]+/gi,
  /([?&](?:api[_-]?key|key|token|access[_-]?token|auth|authorization)=)([^&#\s]+)/gi,
  /\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g
];
function sanitizeOutput(input) {
  if (typeof input === "string") {
    let out = input;
    for (const pattern of SENSITIVE_PATTERNS) {
      out = out.replace(pattern, (_m, p1) => p1 ? `${p1}[REDACTED]` : "[REDACTED]");
    }
    return out;
  }
  if (Array.isArray(input)) return input.map((v) => sanitizeOutput(v));
  if (input && typeof input === "object") {
    const result = {};
    for (const [k, v] of Object.entries(input)) {
      if (/(?:api[_-]?key|token|secret|password|authorization)/i.test(k)) {
        result[k] = "[REDACTED]";
      } else {
        result[k] = sanitizeOutput(v);
      }
    }
    return result;
  }
  return input;
}
var toolCallSignal = new AsyncLocalStorage();
function toolCallCancelled() {
  return toolCallSignal.getStore()?.aborted === true;
}
function sleep(ms) {
  const signal = toolCallSignal.getStore();
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    signal?.addEventListener("abort", done, { once: true });
  });
}
function sha256(input) {
  return crypto2.createHash("sha256").update(input).digest("hex");
}
function normalizeJsonForCache(value) {
  if (Array.isArray(value)) return value.map((item) => normalizeJsonForCache(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, normalizeJsonForCache(item)])
    );
  }
  return value;
}
function buildCacheKey(query, provider, maxResults, params) {
  return sha256(JSON.stringify(normalizeJsonForCache({ query, provider, maxResults, params: params || null }))).slice(0, 32);
}
var memoryCache = /* @__PURE__ */ new Map();
var providerHealthState = {};
function effectiveSearchCacheTtl(query, recency, requested = DEFAULT_CACHE_TTL) {
  const intent = new QueryAnalyzer().detectRecencyIntent(query);
  const caps = { hour: 60, day: 300, week: 1800 };
  const ttl = Number.isFinite(requested) && requested > 0 ? requested : DEFAULT_CACHE_TTL;
  return Math.min(
    ttl,
    DEFAULT_CACHE_TTL,
    caps[recency || ""] ?? DEFAULT_CACHE_TTL,
    intent.is_recency_focused ? intent.score >= 3 ? 60 : 300 : DEFAULT_CACHE_TTL
  );
}
function cacheGet(query, provider, maxResults, ttl, params) {
  const key = buildCacheKey(query, provider, maxResults, params);
  const cached = memoryCache.get(key);
  if (!cached) return null;
  const ts = Number(cached._cache_timestamp || 0);
  if (!ts || Date.now() / 1e3 - ts > ttl) {
    memoryCache.delete(key);
    return null;
  }
  return cached;
}
function cachePut(query, provider, maxResults, result, params) {
  const key = buildCacheKey(query, provider, maxResults, params);
  const sanitizedResult = sanitizeOutput(result);
  memoryCache.set(key, {
    ...sanitizedResult,
    _cache_timestamp: Math.floor(Date.now() / 1e3),
    _cache_key: key,
    _cache_query: query,
    _cache_provider: provider,
    _cache_max_results: maxResults,
    _cache_params: sanitizeOutput(params || {})
  });
}
function loadProviderHealth() {
  return providerHealthState;
}
function saveProviderHealth(state) {
  if (state === providerHealthState) return;
  for (const key of Object.keys(providerHealthState)) delete providerHealthState[key];
  Object.assign(providerHealthState, state);
}
function providerInCooldown(provider) {
  const state = loadProviderHealth();
  const cooldownUntil = Number(state?.[provider]?.cooldown_until || 0);
  const remaining = cooldownUntil - Math.floor(Date.now() / 1e3);
  return { inCooldown: remaining > 0, remaining: Math.max(0, remaining) };
}
function markProviderFailure(provider, message, retryAfter) {
  const state = loadProviderHealth();
  const now = Math.floor(Date.now() / 1e3);
  let prevCount = Number(state?.[provider]?.failure_count || 0);
  const lastFailureAt = Number(state?.[provider]?.last_failure_at || 0);
  if (lastFailureAt && now - lastFailureAt > FAILURE_DECAY_SECONDS) {
    prevCount = 0;
  }
  const failCount = prevCount + 1;
  let cooldownSeconds = COOLDOWN_STEPS_SECONDS[Math.min(failCount - 1, COOLDOWN_STEPS_SECONDS.length - 1)];
  if (retryAfter != null && retryAfter > 0) {
    cooldownSeconds = Math.min(Math.max(cooldownSeconds, Math.floor(retryAfter)), COOLDOWN_STEPS_SECONDS[COOLDOWN_STEPS_SECONDS.length - 1]);
  }
  state[provider] = {
    failure_count: failCount,
    cooldown_until: now + cooldownSeconds,
    cooldown_seconds: cooldownSeconds,
    last_error: sanitizeOutput(message),
    last_failure_at: now
  };
  saveProviderHealth(state);
  return state[provider];
}
function resetProviderHealth(provider) {
  const state = loadProviderHealth();
  if (state[provider]) {
    delete state[provider];
    saveProviderHealth(state);
  }
}
function __resetRuntimeStateForTests() {
  memoryCache.clear();
  for (const key of Object.keys(providerHealthState)) delete providerHealthState[key];
  __resetProviderStatsForTests();
}
function chooseTieWinner(query, winners, priority) {
  const orderedWinners = priority.filter((provider) => winners.includes(provider));
  const candidates2 = orderedWinners.length ? orderedWinners : [...winners].sort();
  if (candidates2.length <= 1) return candidates2[0];
  const digest = sha256(`${query}|${candidates2.join("|")}`);
  const idx = parseInt(digest.slice(0, 8), 16) % candidates2.length;
  return candidates2[idx];
}
function normalizeRequestedProvider(value) {
  if (!value || value === "auto") return "auto";
  return normalizeProviderName(value);
}
function orderProvidersByPreference(providers, routingConfig) {
  const requestedOrder = routingConfig.provider_priority?.length ? routingConfig.provider_priority : DEFAULT_PROVIDER_PRIORITY;
  const seen = /* @__PURE__ */ new Set();
  const ordered = [];
  for (const provider of requestedOrder) {
    if (providers.includes(provider) && !seen.has(provider)) {
      seen.add(provider);
      ordered.push(provider);
    }
  }
  for (const provider of providers) {
    if (!seen.has(provider)) ordered.push(provider);
  }
  return ordered;
}
function isProviderUsable(provider, availableProviders, disabledProviders) {
  return !!provider && availableProviders.includes(provider) && !disabledProviders.includes(provider);
}
function pickStrictDefaultProvider(availableProviders, routingConfig) {
  return isProviderUsable(routingConfig.default_provider, availableProviders, routingConfig.disabled_providers) ? routingConfig.default_provider : null;
}
function selectAutoProvider(query, availableProviders, routingConfig) {
  const autoExcluded = availableProviders.filter((provider2) => routingConfig.auto_allow?.[provider2] === false);
  const autoProviders = availableProviders.filter((provider2) => routingConfig.auto_allow?.[provider2] !== false);
  const candidates2 = autoProviders.length ? autoProviders : availableProviders;
  const orderedProviders = orderProvidersByPreference(candidates2, routingConfig);
  const analyzer = new QueryAnalyzer();
  const analysis = analyzer.analyze(query);
  const plan = planIntentRouting(analysis.routing_class, query, routingConfig.provider_priority?.length ? routingConfig.provider_priority : DEFAULT_PROVIDER_PRIORITY);
  const provider = plan.preferred.find((candidate) => candidates2.includes(candidate)) ?? orderedProviders[0] ?? "serper";
  const hasIntent = plan.customOrder || analysis.routing_class !== "general";
  return {
    provider,
    routing: {
      requested_provider: "auto",
      auto_routed: true,
      provider,
      confidence_level: plan.customOrder ? "high" : hasIntent ? "medium" : "low",
      reason: plan.reason,
      confidence_threshold: routingConfig.confidence_threshold,
      exa_depth: "normal",
      routing_policy: "routing-v3-intent-lite",
      language_hint: analysis.language_hint,
      routing_class: analysis.routing_class,
      routing_intent: plan.intent,
      provider_order: plan.customOrder ? "custom" : "measured",
      scores: {},
      adaptive_adjustments: {},
      below_threshold: false,
      auto_allow_excluded: autoExcluded
    }
  };
}
function buildAutoFallbackOrder(primary, availableProviders, routingConfig) {
  const priority = routingConfig.provider_priority?.length ? routingConfig.provider_priority : DEFAULT_PROVIDER_PRIORITY;
  const custom = isCustomProviderOrder(priority);
  const ordered = orderProvidersByPreference(availableProviders, routingConfig);
  const unique = [primary];
  const seen = new Set(unique);
  const push = (provider) => {
    if (provider && !seen.has(provider) && isProviderUsable(provider, availableProviders, routingConfig.disabled_providers)) {
      unique.push(provider);
      seen.add(provider);
    }
  };
  if (routingConfig.fallback_provider && routingConfig.fallback_provider !== DEFAULT_ROUTING_PREFERENCES.fallback_provider) push(routingConfig.fallback_provider);
  if (!custom) MEASURED_PROVIDER_ORDER.forEach(push);
  ordered.forEach(push);
  return unique;
}
function getApiKey(provider, runtimeConfig) {
  const keyMap = {
    serper: runtimeConfig.serperApiKey,
    brave: runtimeConfig.braveApiKey,
    tavily: runtimeConfig.tavilyApiKey,
    querit: runtimeConfig.queritApiKey,
    exa: runtimeConfig.exaApiKey,
    linkup: runtimeConfig.linkupApiKey,
    firecrawl: runtimeConfig.firecrawlApiKey,
    you: runtimeConfig.youApiKey,
    searxng: runtimeConfig.searxngInstanceUrl,
    parallel: runtimeConfig.parallelApiKey,
    serpbase: runtimeConfig.serpbaseApiKey,
    keenable: runtimeConfig.keenableApiKey,
    donsetch: runtimeConfig.donsetchBin,
    octen: runtimeConfig.monidApiKey,
    tinyfish: runtimeConfig.tinyfishApiKey
  };
  return keyMap[provider];
}
function providerIsConfigured(provider, runtimeConfig) {
  if (getApiKey(provider, runtimeConfig)) return true;
  return provider === "keenable" && runtimeConfig.keenableAllowPublic === true;
}
function validateApiKey(provider, runtimeConfig) {
  const key = getApiKey(provider, runtimeConfig);
  if (!key) {
    if (provider === "searxng") throw new ProviderConfigError("Missing SearXNG instance URL (pluginConfig.searxngInstanceUrl)");
    if (provider === "keenable") {
      if (runtimeConfig.keenableAllowPublic === true) return "";
      throw new ProviderConfigError("Keenable requires an API key (pluginConfig.keenableApiKey) or the opt-in public tier (pluginConfig.keenableAllowPublic=true)");
    }
    if (provider === "donsetch") throw new ProviderConfigError("Missing DonSeTch executable path (pluginConfig.donsetchBin)");
    if (provider === "octen") throw new ProviderConfigError("Missing Monid API key for Octen (pluginConfig.monidApiKey)");
    if (provider === "tinyfish") throw new ProviderConfigError("Missing TinyFish API key (pluginConfig.tinyfishApiKey)");
    throw new ProviderConfigError(`Missing API key for ${provider}`);
  }
  return key;
}
function toTimeRange(value) {
  return value && ["hour", "day", "week", "month", "year"].includes(value) ? value : void 0;
}
var FRESHNESS_VALUES2 = ["day", "week", "month", "year"];
var EXA_FRESHNESS_DAYS = { hour: 1 / 24, day: 1, week: 7, month: 30, year: 365 };
function exaDateBounds(freshness, now = /* @__PURE__ */ new Date()) {
  if (!freshness || EXA_FRESHNESS_DAYS[freshness] == null) return {};
  const end = new Date(now.getTime());
  const start = new Date(end.getTime() - EXA_FRESHNESS_DAYS[freshness] * 24 * 60 * 60 * 1e3);
  const secondPrecision = (value) => value.toISOString().replace(/\.\d{3}Z$/, "Z");
  return { startPublishedDate: secondPrecision(start), endPublishedDate: secondPrecision(end) };
}
var PROVIDER_FRESHNESS_FORMATS = {
  tavily: { day: "day", week: "week", month: "month", year: "year" },
  // searchSerper: body.tbs
  serper: { day: "qdr:d", week: "qdr:w", month: "qdr:m", year: "qdr:y" },
  // searchBrave: freshness query param
  brave: { day: "pd", week: "pw", month: "pm", year: "py" },
  // searchQuerit: filters.timeRange.date
  querit: { day: "d1", week: "w1", month: "m1", year: "y1" },
  // searchFirecrawl: body.tbs
  firecrawl: { day: "qdr:d", week: "qdr:w", month: "qdr:m", year: "qdr:y" },
  // searchKeenable: body.published_after
  keenable: { day: "1d", week: "7d", month: "1mo", year: "1y" },
  // Exa receives absolute UTC start/end publication bounds.
  exa: { hour: "hour", day: "day", week: "week", month: "month", year: "year" },
  // Octen and TinyFish expose native recency controls in their source APIs.
  octen: { day: "day", week: "week", month: "month", year: "year" },
  tinyfish: { day: "day", week: "week", month: "month", year: "year" },
  // searchYou: freshness query param (native values match the unified ones)
  you: { day: "day", week: "week", month: "month", year: "year" },
  // searchSearxng: time_range query param
  searxng: { day: "day", week: "week", month: "month", year: "year" }
};
function normalizeFreshness(value) {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  if (!FRESHNESS_VALUES2.includes(normalized)) {
    throw new Error(`Invalid freshness value: ${JSON.stringify(value)}. Valid values: ${FRESHNESS_VALUES2.join(", ")}`);
  }
  return normalized;
}
function freshnessMetadata(provider, requested, exaBounds) {
  const native = PROVIDER_FRESHNESS_FORMATS[provider]?.[requested];
  if (provider === "exa" && native != null) {
    const bounds = exaBounds || {};
    return { requested, applied: Boolean(bounds.startPublishedDate || bounds.endPublishedDate), provider, native_value: bounds };
  }
  if (native != null) return { requested, applied: true, provider, native_value: native };
  return { requested, applied: false, provider, reason: `provider ${provider} does not support freshness` };
}
var SEARCH_TYPE_VALUES = ["search", "news"];
var PROVIDER_SEARCH_TYPES = {
  // searchSerper: endpoint path https://google.serper.dev/<type>
  serper: { search: "search", news: "news" },
  // TinyFish: domain_type query parameter.
  tinyfish: { search: "web", news: "news" }
};
function normalizeSearchType(value) {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  if (!SEARCH_TYPE_VALUES.includes(normalized)) {
    throw new Error(`Invalid search_type value: ${JSON.stringify(value)}. Valid values: ${SEARCH_TYPE_VALUES.join(", ")}`);
  }
  return normalized;
}
function searchTypeMetadata(provider, requested) {
  const native = PROVIDER_SEARCH_TYPES[provider]?.[requested];
  if (native != null) return { requested, applied: true, provider, native_value: native };
  return { requested, applied: false, provider, reason: `provider ${provider} does not support search_type ${requested}` };
}
function normalizeBraveCountry(value) {
  const normalized = String(value || "US").trim();
  return normalized ? normalized.toUpperCase() : "US";
}
function normalizeBraveLanguage(value) {
  const normalized = String(value || "en").trim();
  return normalized ? normalized.toLowerCase() : "en";
}
function normalizeBraveSafesearch(value) {
  const normalized = String(value || "moderate").trim().toLowerCase();
  return normalized === "strict" || normalized === "off" ? normalized : "moderate";
}
function titleFromUrl2(url) {
  try {
    const u = new URL(url);
    const domain = u.hostname.replace(/^www\./, "");
    const segs = u.pathname.split("/").filter(Boolean);
    const last = segs.length ? segs[segs.length - 1].replace(/[-_]/g, " ").replace(/\.\w{2,4}$/, "") : "";
    return last ? `${domain} \u2014 ${last}` : domain;
  } catch {
    return url.slice(0, 80);
  }
}
async function httpJson(url, init, timeoutMs = 3e4) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const hostSignal = toolCallSignal.getStore();
  const onHostAbort = () => controller.abort();
  if (hostSignal?.aborted) {
    clearTimeout(timer);
    throw new ProviderRequestError("Request cancelled: the tool call was aborted", { transient: false });
  }
  hostSignal?.addEventListener("abort", onHostAbort, { once: true });
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "User-Agent": "ClawdBot-WebSearchPlus/3.2",
        ...init.headers || {}
      },
      signal: controller.signal
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
    }
    if (!res.ok) {
      const detail = data?.error || data?.message || text || res.statusText;
      const retryAfter = res.status === 429 ? parseRetryAfter(res.headers.get("retry-after")) : void 0;
      throw new ProviderRequestError(`${detail} (HTTP ${res.status})`, { statusCode: res.status, transient: TRANSIENT_HTTP_CODES.has(res.status), retryAfter });
    }
    return data ?? {};
  } catch (error) {
    if (hostSignal?.aborted) throw new ProviderRequestError("Request cancelled: the tool call was aborted", { transient: false });
    if (error?.name === "AbortError") throw new ProviderRequestError(`Request timed out after ${timeoutMs}ms`, { transient: true });
    if (error instanceof ProviderRequestError) throw error;
    throw new ProviderRequestError(`Network error: ${String(error?.message || error)}`, { transient: true });
  } finally {
    clearTimeout(timer);
    hostSignal?.removeEventListener("abort", onHostAbort);
  }
}
async function validateSearxngUrl(input, runtimeConfig) {
  let u;
  try {
    u = new URL(input);
  } catch {
    throw new ProviderConfigError("Invalid SearXNG URL");
  }
  if (!["http:", "https:"].includes(u.protocol)) throw new ProviderConfigError(`SearXNG URL must use http or https, got ${u.protocol}`);
  if (!u.hostname) throw new ProviderConfigError("SearXNG URL must include a hostname");
  const blockedHosts = /* @__PURE__ */ new Set(["169.254.169.254", "metadata.google.internal", "metadata.internal"]);
  if (blockedHosts.has(u.hostname)) throw new ProviderConfigError("SearXNG URL blocked: metadata endpoint");
  const allowPrivate = runtimeConfig.searxngAllowPrivate === true;
  if (!allowPrivate) {
    const records = await dns2.lookup(u.hostname, { all: true, verbatim: true }).catch(() => []);
    if (!records.length && net2.isIP(u.hostname)) records.push({ address: u.hostname, family: net2.isIP(u.hostname) });
    if (!records.length) throw new ProviderConfigError(`SearXNG URL blocked: cannot resolve hostname ${u.hostname}`);
    for (const record of records) {
      const ip = record.address;
      const lower = ip.toLowerCase();
      const isIpv4Private = /^10\./.test(ip) || /^127\./.test(ip) || /^169\.254\./.test(ip) || /^192\.168\./.test(ip) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) || ip === "0.0.0.0";
      const isIpv6Private = lower === "::1" || lower === "::" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80:");
      if (isIpv4Private || isIpv6Private) {
        throw new ProviderConfigError(`SearXNG URL blocked: ${u.hostname} resolves to private/internal IP ${ip}`);
      }
    }
  }
  return u.toString().replace(/\/$/, "");
}
var SHOPPING_SIGNALS = {
  "\\bhow much\\b": 4,
  "\\bprice of\\b": 4,
  "\\bcost of\\b": 4,
  "\\bprices?\\b": 3,
  "\\$\\d+|\\d+\\s*dollars?": 3,
  "\u20AC\\d+|\\d+\\s*euros?": 3,
  "\xA3\\d+|\\d+\\s*pounds?": 3,
  "\\bpreis(e)?\\b": 3.5,
  "\\bkosten\\b": 3,
  "\\bwieviel\\b": 3.5,
  "\\bwie viel\\b": 3.5,
  "\\bwas kostet\\b": 4,
  "\\bbuy\\b": 3.5,
  "\\bpurchase\\b": 3.5,
  "\\border\\b(?!\\s+by)": 3,
  "\\bshopping\\b": 3.5,
  "\\bshop for\\b": 3.5,
  "\\bwhere to (buy|get|purchase)\\b": 4,
  "\\bkaufen\\b": 3.5,
  "\\bbestellen\\b": 3.5,
  "\\bwo kaufen\\b": 4,
  "\\bh\xE4ndler\\b": 3,
  "\\bshop\\b": 2.5,
  "\\bdeal(s)?\\b": 3,
  "\\bdiscount(s)?\\b": 3,
  "\\bsale\\b": 2.5,
  "\\bcheap(er|est)?\\b": 3,
  "\\baffordable\\b": 2.5,
  "\\bbudget\\b": 2.5,
  "\\bbest price\\b": 3.5,
  "\\bcompare prices\\b": 3.5,
  "\\bcoupon\\b": 3,
  "\\bg\xFCnstig(er|ste)?\\b": 3,
  "\\bbillig(er|ste)?\\b": 3,
  "\\bangebot(e)?\\b": 3,
  "\\brabatt\\b": 3,
  "\\baktion\\b": 2.5,
  "\\bschn\xE4ppchen\\b": 3,
  "\\bvs\\.?\\b": 2,
  "\\bversus\\b": 2,
  "\\bor\\b.*\\bwhich\\b": 2,
  "\\bspecs?\\b": 2.5,
  "\\bspecifications?\\b": 2.5,
  "\\breview(s)?\\b": 2,
  "\\brating(s)?\\b": 2,
  "\\bunboxing\\b": 2.5,
  "\\btest\\b": 2.5,
  "\\bbewertung(en)?\\b": 2.5,
  "\\btechnische daten\\b": 3,
  "\\bspezifikationen\\b": 2.5
};
var RESEARCH_SIGNALS = {
  "\\bhow does\\b": 4,
  "\\bhow do\\b": 3.5,
  "\\bwhy does\\b": 4,
  "\\bwhy do\\b": 3.5,
  "\\bwhy is\\b": 3.5,
  "\\bexplain\\b": 4,
  "\\bexplanation\\b": 4,
  "\\bwhat is\\b": 3,
  "\\bwhat are\\b": 3,
  "\\bdefine\\b": 3.5,
  "\\bdefinition of\\b": 3.5,
  "\\bmeaning of\\b": 3,
  "\\banalyze\\b": 3.5,
  "\\banalysis\\b": 3.5,
  "\\bcompare\\b(?!\\s*prices?)": 3,
  "\\bcomparison\\b": 3,
  "\\bstatus of\\b": 3.5,
  "\\bstatus\\b": 2.5,
  "\\bwhat happened with\\b": 4,
  "\\bpros and cons\\b": 4,
  "\\badvantages?\\b": 3,
  "\\bdisadvantages?\\b": 3,
  "\\bbenefits?\\b": 2.5,
  "\\bdrawbacks?\\b": 3,
  "\\bdifference between\\b": 3.5,
  "\\bunderstand\\b": 3,
  "\\blearn(ing)?\\b": 2.5,
  "\\btutorial\\b": 3,
  "\\bguide\\b": 2.5,
  "\\bhow to\\b": 2,
  "\\bstep by step\\b": 3,
  "\\bin[- ]depth\\b": 3,
  "\\bdetailed\\b": 2.5,
  "\\bcomprehensive\\b": 3,
  "\\bthorough\\b": 2.5,
  "\\bdeep dive\\b": 3.5,
  "\\boverall\\b": 2,
  "\\bsummary\\b": 2,
  "\\bstudy\\b": 2.5,
  "\\bresearch shows\\b": 3.5,
  "\\baccording to\\b": 2.5,
  "\\bevidence\\b": 3,
  "\\bscientific\\b": 3,
  "\\bhistory of\\b": 3,
  "\\bbackground\\b": 2.5,
  "\\bcontext\\b": 2.5,
  "\\bimplications?\\b": 3,
  "\\bwie funktioniert\\b": 4,
  "\\bwarum\\b": 3.5,
  "\\berkl\xE4r(en|ung)?\\b": 4,
  "\\bwas ist\\b": 3,
  "\\bwas sind\\b": 3,
  "\\bbedeutung\\b": 3,
  "\\banalyse\\b": 3.5,
  "\\bvergleich(en)?\\b": 3,
  "\\bvor- und nachteile\\b": 4,
  "\\bvorteile\\b": 3,
  "\\bnachteile\\b": 3,
  "\\bunterschied(e)?\\b": 3.5,
  "\\bverstehen\\b": 3,
  "\\blernen\\b": 2.5,
  "\\banleitung\\b": 3,
  "\\b\xFCbersicht\\b": 2.5,
  "\\bhintergrund\\b": 2.5,
  "\\bzusammenfassung\\b": 2.5
};
var DISCOVERY_SIGNALS = {
  "\\bsimilar to\\b": 5,
  "\\blike\\s+\\w+\\.com": 4.5,
  "\\balternatives? to\\b": 5,
  "\\bcompetitors? (of|to)\\b": 4.5,
  "\\bcompeting with\\b": 4,
  "\\brivals? (of|to)\\b": 4,
  "\\binstead of\\b": 3,
  "\\breplacement for\\b": 3.5,
  "\\bcompanies (like|that|doing|building)\\b": 4.5,
  "\\bstartups? (like|that|doing|building)\\b": 4.5,
  "\\bwho else\\b": 4,
  "\\bother (companies|startups|tools|apps)\\b": 3.5,
  "\\bfind (companies|startups|tools|examples?)\\b": 4.5,
  "\\bevents? in\\b": 4,
  "\\bthings to do in\\b": 4.5,
  "\\bseries [a-d]\\b": 4,
  "\\byc\\b|y combinator": 4,
  "\\bfund(ed|ing|raise)\\b": 3.5,
  "\\bventure\\b": 3,
  "\\bvaluation\\b": 3,
  "\\bresearch papers? (on|about)\\b": 4,
  "\\barxiv\\b": 4.5,
  "\\bgithub (projects?|repos?)\\b": 4.5,
  "\\bopen source\\b.*\\bprojects?\\b": 4,
  "\\btweets? (about|on)\\b": 3.5,
  "\\bblogs? (about|on|like)\\b": 3,
  "https?://[^\\s]+": 5,
  "\\b\\w+\\.(com|org|io|ai|co|dev)\\b": 3.5
};
var LOCAL_NEWS_SIGNALS = {
  "\\bnear me\\b": 4,
  "\\bnearby\\b": 3.5,
  "\\blocal\\b": 3,
  "\\bin (my )?(city|area|town|neighborhood)\\b": 3.5,
  "\\brestaurants?\\b": 2.5,
  "\\bhotels?\\b": 2.5,
  "\\bcafes?\\b": 2.5,
  "\\bstores?\\b": 2,
  "\\bdirections? to\\b": 3.5,
  "\\bmap of\\b": 3,
  "\\bphone number\\b": 3,
  "\\baddress of\\b": 3,
  "\\bopen(ing)? hours\\b": 3,
  "\\bweather\\b": 4,
  "\\bforecast\\b": 3.5,
  "\\btemperature\\b": 3,
  "\\btime in\\b": 3,
  "\\blatest\\b": 2.5,
  "\\brecent\\b": 2.5,
  "\\btoday\\b": 2.5,
  "\\bbreaking\\b": 3.5,
  "\\bnews\\b": 2.5,
  "\\bheadlines?\\b": 3,
  "\\b202[4-9]\\b": 2,
  "\\blast (week|month|year)\\b": 2,
  "\\bin der n\xE4he\\b": 4,
  "\\bin meiner n\xE4he\\b": 4,
  "\\b\xF6ffnungszeiten\\b": 3,
  "\\badresse von\\b": 3,
  "\\bweg(beschreibung)? nach\\b": 3.5,
  "\\bheute\\b": 2.5,
  "\\bmorgen\\b": 2,
  "\\baktuell\\b": 2.5,
  "\\bnachrichten\\b": 3
};
var RAG_SIGNALS = {
  "\\brag\\b": 4.5,
  "\\bcontext for\\b": 4,
  "\\bsummarize\\b": 3.5,
  "\\bbrief(ly)?\\b": 3,
  "\\bquick overview\\b": 3.5,
  "\\btl;?dr\\b": 4,
  "\\bkey (points|facts|info)\\b": 3.5,
  "\\bmain (points|takeaways)\\b": 3.5,
  "\\b(web|online)\\s+and\\s+news\\b": 4,
  "\\ball sources\\b": 3.5,
  "\\bcomprehensive (search|overview)\\b": 3.5,
  "\\blatest\\s+(news|updates)\\b": 3,
  "\\bcurrent (events|situation|status)\\b": 3.5,
  "\\bright now\\b": 3,
  "\\bas of today\\b": 3.5,
  "\\bup.to.date\\b": 3.5,
  "\\breal.time\\b": 4,
  "\\blive\\b": 2.5,
  "\\bwhat'?s happening with\\b": 3.5,
  "\\bwhat'?s the latest\\b": 4,
  "\\bupdates?\\s+on\\b": 3.5,
  "\\bstatus of\\b": 3,
  "\\bsituation (in|with|around)\\b": 3.5
};
var PRIVACY_SIGNALS = {
  "\\bprivate(ly)?\\b": 4,
  "\\banonymous(ly)?\\b": 4,
  "\\bwithout tracking\\b": 4.5,
  "\\bno track(ing)?\\b": 4.5,
  "\\bprivacy\\b": 3.5,
  "\\bprivacy.?focused\\b": 4.5,
  "\\bprivacy.?first\\b": 4.5,
  "\\bduckduckgo alternative\\b": 4.5,
  "\\bprivate search\\b": 5,
  "\\bprivat\\b": 4,
  "\\banonym\\b": 4,
  "\\bohne tracking\\b": 4.5,
  "\\bdatenschutz\\b": 4,
  "\\baggregate results?\\b": 4,
  "\\bmultiple sources?\\b": 4,
  "\\bdiverse (results|perspectives|sources)\\b": 4,
  "\\bfrom (all|multiple|different) (engines?|sources?)\\b": 4.5,
  "\\bmeta.?search\\b": 5,
  "\\ball engines?\\b": 4,
  "\\bverschiedene quellen\\b": 4,
  "\\baus mehreren quellen\\b": 4,
  "\\balle suchmaschinen\\b": 4.5,
  "\\bfree search\\b": 3.5,
  "\\bno api cost\\b": 4,
  "\\bself.?hosted search\\b": 5,
  "\\bzero cost\\b": 3.5,
  "\\bbudget\\b(?!\\s*(laptop|phone|option))\\b": 2.5,
  "\\bkostenlos(e)?\\s+suche\\b": 3.5,
  "\\bkeine api.?kosten\\b": 4
};
var LINKUP_SOURCE_SIGNALS = {
  "\\bcitations?\\b": 5,
  "\\bsources?\\b": 4.5,
  "\\bsource.?backed\\b": 5,
  "\\bwith sources\\b": 5,
  "\\bwith references\\b": 5,
  "\\breferences?\\b": 4.5,
  "\\bevidence\\b": 4.5,
  "\\bcredible sources?\\b": 5.5,
  "\\bprimary sources?\\b": 5,
  "\\bsupporting links?\\b": 4.5,
  "\\bverify (this|the)?\\b": 4.5,
  "\\bfact.?check\\b": 5,
  "\\bground(ed|ing)?\\b": 4.5,
  "\\bground this\\b": 5,
  "\\bclaim\\b": 2.5,
  "\\bfind (credible )?sources?\\b": 5.5,
  "\\bfind pages? that support\\b": 5,
  "\\bwhere did this come from\\b": 5,
  "\\bsource material\\b": 4
};
var EXA_DEEP_SIGNALS = {
  "\\bsynthesi[sz]e\\b": 5,
  "\\bdeep research\\b": 5,
  "\\bcomprehensive (analysis|report|overview|survey)\\b": 4.5,
  "\\bacross (multiple|many|several) (sources|documents|papers)\\b": 4.5,
  "\\baggregat(e|ing) (information|data|results)\\b": 4,
  "\\bcross.?referenc": 4.5,
  "\\bsec filings?\\b": 4.5,
  "\\bannual reports?\\b": 4,
  "\\bearnings (call|report|transcript)\\b": 4.5,
  "\\bfinancial analysis\\b": 4,
  "\\bliterature (review|survey)\\b": 5,
  "\\bacademic literature\\b": 4.5,
  "\\bstate of the (art|field|industry)\\b": 4,
  "\\bcompile (a |the )?(report|findings|results)\\b": 4.5,
  "\\bsummariz(e|ing) (research|papers|studies)\\b": 4,
  "\\bmultiple documents?\\b": 4,
  "\\bdossier\\b": 4.5,
  "\\bdue diligence\\b": 4.5,
  "\\bstructured (output|data|report)\\b": 4,
  "\\bmarket research\\b": 4,
  "\\bindustry (report|analysis|overview)\\b": 4,
  "\\bresearch (on|about|into)\\b": 4,
  "\\bwhitepaper\\b": 4.5,
  "\\btechnical report\\b": 4,
  "\\bsurvey of\\b": 4.5,
  "\\bmeta.?analysis\\b": 5,
  "\\bsystematic review\\b": 5,
  "\\bcase study\\b": 3.5,
  "\\bbenchmark(s|ing)?\\b": 3.5,
  "\\btiefenrecherche\\b": 5,
  "\\bumfassende (analyse|\xFCbersicht|recherche)\\b": 4.5,
  "\\baus mehreren quellen zusammenfassen\\b": 4.5,
  "\\bmarktforschung\\b": 4
};
var EXA_DEEP_REASONING_SIGNALS = {
  "\\bdeep.?reasoning\\b": 6,
  "\\bcomplex (analysis|reasoning|research)\\b": 4.5,
  "\\bcontradictions?\\b": 4.5,
  "\\breconcil(e|ing)\\b": 5,
  "\\bcritical(ly)? analyz": 4.5,
  "\\bweigh(ing)? (the )?evidence\\b": 4.5,
  "\\bcompeting (claims|theories|perspectives)\\b": 4.5,
  "\\bcomplex financial\\b": 4.5,
  "\\bregulatory (analysis|compliance|landscape)\\b": 4.5,
  "\\blegal analysis\\b": 4.5,
  "\\bcomprehensive (due diligence|investigation)\\b": 5,
  "\\bpatent (landscape|analysis|search)\\b": 4.5,
  "\\bmarket intelligence\\b": 4.5,
  "\\bcompetitive (intelligence|landscape)\\b": 4.5,
  "\\btrade.?offs?\\b": 4,
  "\\bpros and cons of\\b": 4,
  "\\bshould I (use|choose|pick)\\b": 3.5,
  "\\bwhich is better\\b": 4,
  "\\bkomplexe analyse\\b": 4.5,
  "\\bwiderspr\xFCche\\b": 4.5,
  "\\bquellen abw\xE4gen\\b": 4.5,
  "\\brechtliche analyse\\b": 4.5,
  "\\bvergleich(e|en)?\\b": 3.5
};
var BRAND_PATTERNS = [
  "\\b(apple|iphone|ipad|macbook|airpods?)\\b",
  "\\b(samsung|galaxy)\\b",
  "\\b(google|pixel)\\b",
  "\\b(microsoft|surface|xbox)\\b",
  "\\b(sony|playstation)\\b",
  "\\b(nvidia|geforce|rtx)\\b",
  "\\b(amd|ryzen|radeon)\\b",
  "\\b(intel|core i[3579])\\b",
  "\\b(dell|hp|lenovo|asus|acer)\\b",
  "\\b(lg|tcl|hisense)\\b",
  "\\b(laptop|phone|tablet|tv|monitor|headphones?|earbuds?)\\b",
  "\\b(camera|lens|drone)\\b",
  "\\b(watch|smartwatch|fitbit|garmin)\\b",
  "\\b(router|modem|wifi)\\b",
  "\\b(keyboard|mouse|gaming)\\b"
];
var QueryAnalyzer = class {
  calculateSignalScore(query, signals) {
    const q = query.toLowerCase();
    const matches = [];
    let total = 0;
    for (const [pattern, weight] of Object.entries(signals)) {
      const regex = new RegExp(pattern, "i");
      const found = q.match(regex);
      if (found) {
        matches.push({ pattern, matched: found[0], weight });
        total += weight;
      }
    }
    return { total, matches };
  }
  detectProductBrandCombo(query) {
    const hasBrand = BRAND_PATTERNS.some((p) => new RegExp(p, "i").test(query));
    const productIndicators = ["\\b(buy|price|specs?|review|vs|compare)\\b", "\\b(pro|max|plus|mini|ultra|lite)\\b", "\\b\\d+\\s*(gb|tb|inch|mm|hz)\\b"];
    const hasProduct = productIndicators.some((p) => new RegExp(p, "i").test(query));
    if (hasBrand && hasProduct) return 3;
    if (hasBrand) return 1.5;
    return 0;
  }
  detectUrl(query) {
    const found = query.match(/https?:\/\/[^\s]+|\b\w+\.(com|org|io|ai|co|dev|net|app)\b/i);
    return found?.[0] || null;
  }
  assessQueryComplexity(query) {
    const words = query.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const questionWords = (query.match(/\b(what|why|how|when|where|which|who|whose|whom)\b/gi) || []).length;
    const clauseMarkers = (query.match(/\b(and|but|or|because|since|while|although|if|when)\b/gi) || []).length;
    let complexityScore = 0;
    if (wordCount > 10) complexityScore += 1.5;
    if (wordCount > 20) complexityScore += 1;
    if (questionWords > 1) complexityScore += 1;
    if (clauseMarkers > 0) complexityScore += clauseMarkers * 0.5;
    return { word_count: wordCount, question_words: questionWords, clause_markers: clauseMarkers, complexity_score: complexityScore, is_complex: complexityScore > 2 };
  }
  detectLanguageHint(query) {
    if (/[äöüß]|\b(was|wer|wie|wann|wo|warum|aktuell|preis|kaufen)\b/i.test(query)) return "de";
    if (/\b(arxiv|paper|github|npm|python|api|docs|cve)\b/i.test(query)) return "en";
    return "en";
  }
  detectRoutingClass(query) {
    const q = query.toLowerCase();
    if (/\b(arxiv|paper|papers|doi|academic|literature review|research paper)\b/.test(q)) return "academic/arxiv";
    if (/\b(github|api docs?|sdk|package docs?|npm|pypi|readme)\b/.test(q)) return "docs/api";
    if (/\b(cve|security advisory|vulnerability|patch notes|vendor advisory)\b/.test(q)) return "security/cve";
    if (/\b(reddit|hacker news|hn|community discussion|forum)\b/.test(q)) return "community/reddit";
    if (/\b(official|release|announcement|launch|changelog|release notes?)\b/.test(q) && /\b(mistral|anthropic|openai|google|meta|nvidia|apple|microsoft|claude|gemini|llama)\b/.test(q)) return "official/vendor-release";
    if (/\b(regulation|regulatory|official|policy|pdf|government|eu commission)\b/.test(q)) return "official/regulatory";
    if (/\b(annual report|investor relations|10-k|earnings|sec filing|ir)\b/.test(q)) return "finance/IR";
    if (/\b(weather|temperature|forecast|rain|snow)\b/.test(q)) return "weather/factual";
    if (/\b(similar|alternatives?|companies like|tools like|oss|open source discovery)\b/.test(q)) return "oss-discovery";
    if (/\b(summarize|synthesis|briefing|answer|explain)\b/.test(q)) return "answer/synthesis";
    if (/\b(buy|price|preis|kaufen|shop|shopping|near me|graz|austria|österreich)\b/.test(q)) return "local/shopping";
    if (/\b(latest|current|aktuell|aktuelle|news|nachrichten|today|heute|multilingual|deutsch|english|spanish)\b/.test(q)) return "multilingual/current";
    return "general";
  }
  applyRoutingV2Boosts(query, scores, matches) {
    const routingClass = this.detectRoutingClass(query);
    const boost = (provider, amount, label) => {
      scores[provider] = (scores[provider] || 0) + amount;
      (matches[provider] ||= []).push({ pattern: `routing_v2:${routingClass}`, matched: label, weight: amount });
    };
    if (routingClass === "academic/arxiv") boost("exa", 8, "arXiv/academic intent");
    else if (routingClass === "docs/api") {
      boost("exa", 5, "docs/API intent");
      boost("firecrawl", 4, "docs/API scrape intent");
    } else if (routingClass === "security/cve") boost("firecrawl", 7, "vendor/CVE source intent");
    else if (routingClass === "community/reddit") {
      boost("serper", 9, "community intent");
      boost("brave", 8, "community intent");
    } else if (routingClass === "official/vendor-release") {
      boost("you", 9, "official vendor announcement intent");
      boost("linkup", 7, "primary-source grounding");
      boost("exa", 5, "vendor blog discovery");
    } else if (routingClass === "official/regulatory") boost("linkup", 7, "official/regulatory grounding");
    else if (routingClass === "finance/IR") {
      boost("linkup", 5, "finance IR grounding");
      boost("tavily", 4, "finance research");
    } else if (routingClass === "weather/factual") boost("you", 10, "snippet-first factual intent");
    else if (routingClass === "oss-discovery") boost("exa", 6, "semantic source discovery");
    else if (routingClass === "answer/synthesis") {
      boost("exa", 3, "synthesis intent without answer tool");
      boost("tavily", 3, "synthesis research");
    } else if (routingClass === "local/shopping") boost("serper", 12, "local/shopping intent");
    else if (routingClass === "multilingual/current") {
      boost("querit", 5, "multilingual/current intent");
      boost("brave", 4, "current web intent");
    }
    return routingClass;
  }
  detectRecencyIntent(query) {
    const patterns = [
      [/\b(latest|newest|recent|current)\b/i, 2.5],
      [/\b(today|yesterday|this week|this month)\b/i, 3],
      [/\b(202[4-9]|2030)\b/i, 2],
      [/\b(breaking|live|just|now)\b/i, 3],
      [/\blast (hour|day|week|month)\b/i, 2.5]
    ];
    let total = 0;
    for (const [regex, weight] of patterns) if (regex.test(query)) total += weight;
    return { is_recency_focused: total > 2, score: total };
  }
  analyze(query) {
    const shopping = this.calculateSignalScore(query, SHOPPING_SIGNALS);
    const research = this.calculateSignalScore(query, RESEARCH_SIGNALS);
    const discovery = this.calculateSignalScore(query, DISCOVERY_SIGNALS);
    const localNews = this.calculateSignalScore(query, LOCAL_NEWS_SIGNALS);
    const rag = this.calculateSignalScore(query, RAG_SIGNALS);
    const privacy = this.calculateSignalScore(query, PRIVACY_SIGNALS);
    const linkupSource = this.calculateSignalScore(query, LINKUP_SOURCE_SIGNALS);
    const exaDeep = this.calculateSignalScore(query, EXA_DEEP_SIGNALS);
    const exaDeepReasoning = this.calculateSignalScore(query, EXA_DEEP_REASONING_SIGNALS);
    const brandBonus = this.detectProductBrandCombo(query);
    if (brandBonus > 0) {
      shopping.total += brandBonus;
      shopping.matches.push({ pattern: "product_brand_combo", matched: "brand + product detected", weight: brandBonus });
    }
    const detectedUrl = this.detectUrl(query);
    if (detectedUrl) {
      discovery.total += 5;
      discovery.matches.push({ pattern: "url_detected", matched: detectedUrl, weight: 5 });
    }
    const complexity = this.assessQueryComplexity(query);
    if (complexity.is_complex) {
      research.total += complexity.complexity_score;
      research.matches.push({ pattern: "query_complexity", matched: `complex query (${complexity.word_count} words)`, weight: complexity.complexity_score });
    }
    const recency = this.detectRecencyIntent(query);
    const providerScores = {
      serper: shopping.total + localNews.total + recency.score * 0.35,
      brave: shopping.total + localNews.total + recency.score * 0.35,
      tavily: research.total + (complexity.is_complex ? 0 : complexity.complexity_score) + recency.score * 0.2,
      linkup: linkupSource.total + rag.total * 0.7 + research.total * 0.45 + recency.score * 0.35,
      querit: research.total * 0.65 + rag.total * 0.35 + recency.score * 0.45,
      exa: discovery.total + (/(\bsimilar|alternatives?|examples?)\b/i.test(query) ? 1 : 0) + exaDeep.total * 0.5 + exaDeepReasoning.total * 0.5,
      firecrawl: discovery.total + research.total * 0.35 + recency.score * 0.25,
      parallel: research.total * 0.5 + discovery.total * 0.5,
      serpbase: shopping.total + localNews.total + recency.score * 0.35,
      you: rag.total + recency.score * 0.25,
      searxng: privacy.total,
      // Keenable is a last-resort fallback: no query-class signals boost it.
      keenable: 0
    };
    const providerMatches = {
      serper: [...shopping.matches, ...localNews.matches],
      brave: [...shopping.matches, ...localNews.matches],
      tavily: research.matches,
      linkup: [...linkupSource.matches, ...rag.matches, ...research.matches],
      querit: research.matches,
      exa: [...discovery.matches, ...exaDeep.matches, ...exaDeepReasoning.matches],
      firecrawl: [...discovery.matches, ...research.matches],
      parallel: [...research.matches, ...discovery.matches],
      serpbase: [...shopping.matches, ...localNews.matches],
      you: rag.matches,
      searxng: privacy.matches,
      keenable: []
    };
    const routingClass = this.applyRoutingV2Boosts(query, providerScores, providerMatches);
    return {
      detected_url: detectedUrl,
      language_hint: this.detectLanguageHint(query),
      routing_class: routingClass,
      complexity,
      recency_focused: recency.is_recency_focused,
      recency_score: recency.score,
      linkup_source_score: linkupSource.total,
      exa_deep_score: exaDeep.total,
      exa_deep_reasoning_score: exaDeepReasoning.total,
      provider_scores: providerScores,
      provider_matches: providerMatches
    };
  }
  route(query, availableProviders, adaptiveAdjustments = {}) {
    const analysis = this.analyze(query);
    const scores = analysis.provider_scores;
    const available = Object.fromEntries(availableProviders.map((p) => [p, (scores[p] ?? 0) + (adaptiveAdjustments[p] || 0)]));
    const providers = Object.keys(available);
    if (!providers.length) {
      return { provider: "serper", confidence: 0, confidence_level: "low", reason: "no_available_providers", scores: {}, top_signals: [], exa_depth: "normal" };
    }
    const maxScore = Math.max(...providers.map((p) => available[p]));
    let winners = providers.filter((p) => available[p] === maxScore);
    if (winners.length > 1 && winners.includes("keenable")) winners = winners.filter((p) => p !== "keenable");
    const winner = chooseTieWinner(query, winners, availableProviders);
    const secondBest = [...providers.map((p) => available[p])].sort((a, b) => b - a)[1] || 0;
    const margin = maxScore > 0 ? (maxScore - secondBest) / maxScore : 0;
    const normalizedScore = Math.min(maxScore / 15, 1);
    const confidence = maxScore === 0 ? 0 : Number((normalizedScore * 0.6 + margin * 0.4).toFixed(3));
    return {
      provider: winner,
      confidence,
      confidence_level: confidence >= 0.7 ? "high" : confidence >= 0.4 ? "medium" : "low",
      reason: maxScore === 0 ? "no_signals_matched" : confidence >= 0.7 ? "high_confidence_match" : confidence >= 0.4 ? "moderate_confidence_match" : "low_confidence_match",
      adaptive_adjustments: adaptiveAdjustments,
      exa_depth: "normal",
      scores: Object.fromEntries(providers.map((p) => [p, Number((available[p] || 0).toFixed(2))])),
      top_signals: (analysis.provider_matches[winner] || []).sort((a, b) => b.weight - a.weight).slice(0, 5).map((s) => ({ matched: s.matched, weight: s.weight })),
      routing_policy: "routing-v2",
      analysis_summary: {
        language_hint: analysis.language_hint,
        routing_class: analysis.routing_class,
        query_length: query.trim().split(/\s+/).filter(Boolean).length,
        is_complex: analysis.complexity.is_complex,
        has_url: !!analysis.detected_url,
        recency_focused: analysis.recency_focused
      }
    };
  }
};
async function searchSerper(query, apiKey, maxResults, timeRange, locale, searchType = "search") {
  const body = { q: query, gl: locale?.country || "us", hl: locale?.language || "en", num: maxResults, autocorrect: true };
  const tbsMap = { day: "qdr:d", week: "qdr:w", month: "qdr:m", year: "qdr:y" };
  if (timeRange && tbsMap[timeRange]) body.tbs = tbsMap[timeRange];
  const data = await httpJson(`https://google.serper.dev/${searchType}`, { method: "POST", headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const rawItems = searchType === "news" ? data.news || [] : data.organic || [];
  const results = rawItems.slice(0, maxResults).map((item, i) => {
    const result = { title: item.title || "", url: item.link || "", snippet: item.snippet || "", score: Number((1 - i * 0.1).toFixed(2)), date: item.date };
    if (searchType === "news") {
      if (item.source != null) result.source = item.source;
      if (item.imageUrl) result.thumbnail = item.imageUrl;
      if (item.position != null) result.position = item.position;
    }
    return result;
  });
  return { provider: "serper", query, results, images: [], knowledge_graph: data.knowledgeGraph, related_searches: (data.relatedSearches || []).map((r) => r.query) };
}
async function searchBrave(query, apiKey, maxResults, options) {
  const freshnessMap = { hour: "pd", day: "pd", week: "pw", month: "pm", year: "py" };
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(maxResults));
  url.searchParams.set("country", normalizeBraveCountry(options?.country));
  url.searchParams.set("search_lang", normalizeBraveLanguage(options?.search_lang));
  url.searchParams.set("safesearch", normalizeBraveSafesearch(options?.safesearch));
  url.searchParams.set("spellcheck", "1");
  const timeRange = toTimeRange(options?.time_range);
  if (timeRange && freshnessMap[timeRange]) url.searchParams.set("freshness", freshnessMap[timeRange]);
  const data = await httpJson(url.toString(), {
    method: "GET",
    headers: {
      "X-Subscription-Token": apiKey,
      Accept: "application/json",
      "Accept-Encoding": "gzip"
    }
  });
  const webResults = (data?.web?.results || []).slice(0, maxResults);
  const results = webResults.map((item, i) => {
    const snippetParts = [item.description || item.snippet || "", ...(item.extra_snippets || []).slice(0, 2)].filter(Boolean);
    return {
      title: item.title || "",
      url: item.url || "",
      snippet: snippetParts.join(" ... "),
      score: Number((1 - i * 0.1).toFixed(2)),
      age: item.age
    };
  });
  return { provider: "brave", query, results, images: [], mixed: data?.mixed };
}
async function searchTavily(query, apiKey, maxResults, includeDomains, excludeDomains, timeRange) {
  const body = { api_key: apiKey, query, max_results: maxResults, search_depth: "basic", topic: "general", include_images: false, include_answer: false, include_raw_content: false };
  if (includeDomains?.length) body.include_domains = includeDomains;
  if (excludeDomains?.length) body.exclude_domains = excludeDomains;
  if (timeRange) body.time_range = timeRange;
  validateSourceOnlyOutboundRequest("tavily", body);
  const data = await httpJson("https://api.tavily.com/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const results = (data.results || []).slice(0, maxResults).map((item) => ({ title: item.title || "", url: item.url || "", snippet: item.content || "", score: Number((item.score || 0).toFixed(3)) }));
  return { provider: "tavily", query, results, images: data.images || [] };
}
async function searchLinkup(query, apiKey, maxResults, includeDomains, excludeDomains) {
  const body = { q: query, depth: "standard", outputType: "searchResults" };
  if (includeDomains?.length) body.includeDomains = includeDomains.slice(0, 50);
  if (excludeDomains?.length) body.excludeDomains = excludeDomains.slice(0, 50);
  validateSourceOnlyOutboundRequest("linkup", body);
  const data = await httpJson("https://api.linkup.so/v1/search", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (data.error) throw new ProviderRequestError(String(data.error));
  const raw = data.results || data.sources || [];
  const results = raw.slice(0, maxResults).map((item, i) => {
    const url = item.url || "";
    const result = {
      title: item.name || item.title || titleFromUrl2(url),
      url,
      snippet: item.content || item.snippet || item.description || "",
      score: Number((1 - i * 0.05).toFixed(3))
    };
    if (item.type != null) result.type = item.type;
    if (item.favicon != null) result.favicon = item.favicon;
    return result;
  });
  return { provider: "linkup", query, results, images: data.images || [], metadata: { depth: body.depth, output_type: body.outputType } };
}
async function searchQuerit(query, apiKey, maxResults, timeRange, includeDomains, excludeDomains, locale) {
  const timeMap = { day: "d1", week: "w1", month: "m1", year: "y1" };
  const filters = { languages: { include: [locale?.language || "en"] }, geo: { countries: { include: [(locale?.country || "us").toUpperCase()] } } };
  if (includeDomains?.length || excludeDomains?.length) {
    filters.sites = {};
    if (includeDomains?.length) filters.sites.include = includeDomains;
    if (excludeDomains?.length) filters.sites.exclude = excludeDomains;
  }
  if (timeRange && timeMap[timeRange]) filters.timeRange = { date: timeMap[timeRange] };
  const body = { query, count: maxResults, filters };
  const data = await httpJson("https://api.querit.ai/v1/search", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (data.error_msg || data.error_code != null && ![0, 200].includes(data.error_code)) throw new ProviderRequestError(data.error_msg || `Querit request failed with error_code=${data.error_code}`);
  const raw = data?.results?.result || [];
  const results = raw.slice(0, maxResults).map((item, i) => ({ title: item.title || titleFromUrl2(item.url || ""), url: item.url || "", snippet: item.snippet || item.page_age || "", score: Number((1 - i * 0.05).toFixed(3)), page_time: item.page_time, date: item.page_age, language: item.language }));
  return { provider: "querit", query, results, images: [], metadata: { search_id: data.search_id, time_range: timeRange && timeMap[timeRange] } };
}
async function searchExa(query, apiKey, maxResults, includeDomains, excludeDomains, freshness, suppliedDateBounds) {
  const body = { query, numResults: maxResults, type: "neural", contents: { text: { maxCharacters: 2e3, verbosity: "standard" }, highlights: { numSentences: 3, highlightsPerUrl: 2 } } };
  if (includeDomains?.length) body.includeDomains = includeDomains;
  if (excludeDomains?.length) body.excludeDomains = excludeDomains;
  const dateBounds = suppliedDateBounds || exaDateBounds(freshness);
  if (dateBounds.startPublishedDate) body.startPublishedDate = dateBounds.startPublishedDate;
  if (dateBounds.endPublishedDate) body.endPublishedDate = dateBounds.endPublishedDate;
  validateSourceOnlyOutboundRequest("exa", body);
  const data = await httpJson("https://api.exa.ai/search", { method: "POST", headers: { "x-api-key": apiKey, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const results = (data.results || []).slice(0, maxResults).map((item) => ({ title: item.title || "", url: item.url || "", snippet: (Array.isArray(item.highlights) ? item.highlights.filter((value) => typeof value === "string" && value.trim()).slice(0, 2).join(" ... ") : "") || String(item.text || "").slice(0, 800), score: Number((item.score || 0).toFixed(3)), published_date: item.publishedDate, author: item.author }));
  return { provider: "exa", query, results, images: [], metadata: freshness ? { freshness: { requested: freshness, ...dateBounds } } : {} };
}
function mapFirecrawlTimeRange(timeRange) {
  const tbsMap = { hour: "qdr:h", day: "qdr:d", week: "qdr:w", month: "qdr:m", year: "qdr:y" };
  return timeRange ? tbsMap[timeRange] || timeRange : void 0;
}
async function searchFirecrawl(query, apiKey, maxResults, timeRange, includeDomains, excludeDomains, locale) {
  const body = { query, limit: maxResults, sources: ["web"], timeout: 3e4, ignoreInvalidURLs: false, country: (locale?.country || "us").toUpperCase() };
  const tbs = mapFirecrawlTimeRange(timeRange);
  if (tbs) body.tbs = tbs;
  if (includeDomains?.length) body.query += ` ${includeDomains.map((domain) => `site:${domain}`).join(" ")}`;
  if (excludeDomains?.length) body.query += ` ${excludeDomains.map((domain) => `-site:${domain}`).join(" ")}`;
  const data = await httpJson("https://api.firecrawl.dev/v2/search", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }, 3e4);
  if (data.success === false) throw new ProviderRequestError(data.error || data.warning || "Firecrawl request failed");
  const responseData = data.data || {};
  const rawWeb = responseData.web || [];
  const results = rawWeb.slice(0, maxResults).map((item, i) => {
    const url = item.url || "";
    const result = {
      title: item.title || titleFromUrl2(url),
      url,
      snippet: item.description || item.snippet || "",
      score: Number((1 - i * 0.05).toFixed(3))
    };
    if (item.position != null) result.position = item.position;
    if (item.category != null) result.category = item.category;
    if (item.markdown) {
      result.raw_content = item.markdown;
      if (!result.snippet) result.snippet = String(item.markdown).slice(0, 500);
    }
    const metadata = item.metadata || {};
    if (metadata.statusCode != null) result.status_code = metadata.statusCode;
    if (metadata.error) result.error = metadata.error;
    return result;
  });
  const images = (responseData.images || []).map((image) => image.imageUrl).filter(Boolean);
  return { provider: "firecrawl", query, results, images, warning: data.warning, credits_used: data.creditsUsed, metadata: { id: data.id, sources: body.sources, tbs } };
}
function stripTrackingParams(rawUrl) {
  try {
    const url = new URL(rawUrl);
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}
async function searchSerpBase(query, apiKey, maxResults, locale) {
  const body = { q: query, hl: locale?.language || "en", gl: locale?.country || "us", page: 1 };
  const data = await httpJson("https://api.serpbase.dev/google/search", {
    method: "POST",
    headers: { "X-API-Key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body)
  });
  if (data?.status != null && Number(data.status) !== 0) {
    const status = Number(data.status);
    throw new ProviderRequestError(`SerpBase error ${status}`, { transient: [1029, 1502, 1503, 1504].includes(status) });
  }
  const organic = data.organic || [];
  const results = organic.slice(0, maxResults).map((item, i) => ({
    title: item.title || "",
    url: stripTrackingParams(item.link || item.url || ""),
    snippet: item.snippet || item.description || "",
    score: Number((1 - i * 0.1).toFixed(2)),
    rank: item.rank || item.position || i + 1,
    display_link: item.display_link || item.displayed_link
  }));
  return { provider: "serpbase", query, results, images: [], knowledge_graph: data?.knowledge_graph, related_searches: (data.related_searches || []).map((r) => typeof r === "string" ? r : r?.query || r?.title).filter(Boolean), session_id: data.session_id, metadata: { session_id: data.session_id } };
}
async function searchParallel(query, apiKey, maxResults, includeDomains, excludeDomains, mode = "fast") {
  const advanced_settings = { max_results: maxResults };
  if (includeDomains?.length) advanced_settings.source_policy = { include_domains: includeDomains };
  if (excludeDomains?.length) advanced_settings.source_policy = { ...advanced_settings.source_policy, exclude_domains: excludeDomains };
  const data = await httpJson("https://api.parallel.ai/v1/search", {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ objective: query, search_queries: [query], advanced_settings, mode: mode || "fast" })
  }, 45e3);
  const raw = data.results || [];
  const results = raw.slice(0, maxResults).map((item, i) => {
    const excerpts = Array.isArray(item.excerpts) ? item.excerpts : [];
    const snippet2 = excerpts.map((excerpt) => typeof excerpt === "string" ? excerpt : excerpt?.text || excerpt?.content || "").filter(Boolean).join("\n\n").trim();
    return { title: item.title || titleFromUrl2(item.url || ""), url: item.url || "", snippet: snippet2, score: Number((1 - i * 0.05).toFixed(3)), publish_date: item.publish_date, excerpts };
  });
  return { provider: "parallel", query, results, images: [], metadata: { search_id: data.search_id, session_id: data.session_id, result_count_raw: raw.length, mode: mode || "fast" } };
}
async function searchYou(query, apiKey, maxResults, timeRange, locale) {
  const url = new URL("https://ydc-index.io/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("count", String(maxResults));
  url.searchParams.set("safesearch", "moderate");
  url.searchParams.set("country", (locale?.country || "us").toUpperCase());
  url.searchParams.set("language", (locale?.language || "en").toUpperCase());
  if (timeRange) url.searchParams.set("freshness", timeRange);
  const data = await httpJson(url.toString(), { method: "GET", headers: { "X-API-KEY": apiKey, Accept: "application/json" } });
  const web = data?.results?.web || [];
  const news = data?.results?.news || [];
  const results = web.slice(0, maxResults).map((item, i) => ({ title: item.title || "", url: item.url || "", snippet: item?.snippets?.[0] || item.description || "", score: Number((1 - i * 0.05).toFixed(3)), date: item.page_age, source: "web", additional_snippets: Array.isArray(item.snippets) ? item.snippets.slice(1, 3) : void 0, thumbnail: item.thumbnail_url, favicon: item.favicon_url }));
  return { provider: "you", query, results, news: news.slice(0, 5), images: [], metadata: { search_uuid: data?.metadata?.search_uuid, latency: data?.metadata?.latency } };
}
var KEENABLE_TIME_RANGE = { hour: "1h", day: "1d", week: "7d", month: "1mo", year: "1y" };
var keenablePublicWarned = false;
function keenableEndpoint(apiUrl, apiKey, publicAllowed) {
  const headers = { "X-Keenable-Title": "web-search-plus-plugin" };
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
    return { url: apiUrl, headers, publicTier: false };
  }
  if (publicAllowed) return { url: `${apiUrl}/public`, headers, publicTier: true };
  throw new ProviderConfigError("Keenable requires an API key or an enabled public endpoint");
}
async function searchKeenable(query, apiKey, maxResults, timeRange, includeDomains, publicAllowed) {
  const body = { query };
  if (timeRange && KEENABLE_TIME_RANGE[timeRange]) body.published_after = KEENABLE_TIME_RANGE[timeRange];
  if (includeDomains?.length) body.site = includeDomains[0];
  const endpoint = keenableEndpoint("https://api.keenable.ai/v1/search", apiKey, publicAllowed);
  const data = await httpJson(endpoint.url, { method: "POST", headers: { ...endpoint.headers, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const results = (data.results || []).slice(0, maxResults).map((item, i) => ({
    title: item.title || titleFromUrl2(item.url || ""),
    url: item.url || "",
    snippet: item.snippet || item.description || "",
    score: Number((1 - i * 0.05).toFixed(3)),
    date: item.published_at,
    acquired_at: item.acquired_at
  }));
  const metadata = { number_of_results: data.number_of_results };
  if (endpoint.publicTier) {
    metadata.public_endpoint = true;
    if (!keenablePublicWarned) {
      keenablePublicWarned = true;
      metadata.public_endpoint_warning = "Keenable keyless public endpoint in use: queries are sent to an unauthenticated shared service (https://keenable.ai) with no SLA. Set pluginConfig.keenableApiKey for the authenticated endpoint.";
    }
  }
  return { provider: "keenable", query, results, images: [], metadata };
}
async function searchSearxng(query, instanceUrl, maxResults, timeRange, runtimeConfig, locale) {
  const base = await validateSearxngUrl(instanceUrl, runtimeConfig);
  const url = new URL(`${base}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("language", locale?.language || "en");
  url.searchParams.set("safesearch", "0");
  if (timeRange) url.searchParams.set("time_range", timeRange);
  const data = await httpJson(url.toString(), { method: "GET", headers: { Accept: "application/json" } });
  const enginesUsed = /* @__PURE__ */ new Set();
  const results = (data.results || []).slice(0, maxResults).map((item, i) => {
    enginesUsed.add(item.engine || "unknown");
    return { title: item.title || "", url: item.url || "", snippet: item.content || "", score: Number((item.score ?? 1 - i * 0.05).toFixed(3)), engine: item.engine || "unknown", category: item.category || "general", date: item.publishedDate };
  });
  return { provider: "searxng", query, results, images: [], suggestions: data.suggestions || [], corrections: data.corrections || [], metadata: { number_of_results: data.number_of_results, engines_used: [...enginesUsed], instance_url: base } };
}
function computeRetryDelayMs(attempt) {
  const base = RETRY_BACKOFF_MS[Math.min(attempt, RETRY_BACKOFF_MS.length - 1)];
  return base + Math.random() * base * RETRY_JITTER_FRACTION;
}
async function executeWithRetry(fn) {
  let lastError;
  for (let attempt = 0; attempt < RETRY_BACKOFF_MS.length; attempt += 1) {
    try {
      if (toolCallCancelled()) throw lastError ?? new ProviderRequestError("Request cancelled: the tool call was aborted", { transient: false });
      return await fn();
    } catch (error) {
      lastError = error;
      if (toolCallCancelled()) break;
      if (!(error instanceof ProviderRequestError) || !error.transient || error.statusCode === 401 || error.statusCode === 403) break;
      const isRateLimited = error.statusCode === 429;
      const attemptCap = isRateLimited ? Math.min(RETRY_BACKOFF_MS.length, RATE_LIMIT_MAX_ATTEMPTS) : RETRY_BACKOFF_MS.length;
      if (attempt >= attemptCap - 1) break;
      if (isRateLimited && error.retryAfter != null) {
        if (error.retryAfter > MAX_RETRY_AFTER_WAIT_SECONDS) {
          break;
        }
        await sleep(error.retryAfter * 1e3);
      } else {
        await sleep(computeRetryDelayMs(attempt));
      }
    }
  }
  throw lastError;
}
function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}
function buildQualityReport(result, routingInfo, errors, cooldownSkips, providersConsidered) {
  const results = Array.isArray(result.results) ? result.results : [];
  const domains = [...new Set(results.map((r) => hostnameOf(r.url)).filter(Boolean))];
  const thinSnippetCount = results.filter((r) => String(r.snippet || "").length < 40).length;
  const extractReasons = [];
  if ((routingInfo.confidence_level || "") === "low") extractReasons.push("low_routing_confidence");
  if (results.length < 3) extractReasons.push("few_results");
  if (domains.length <= 1 && results.length > 1) extractReasons.push("low_domain_diversity");
  if (thinSnippetCount >= Math.ceil(Math.max(1, results.length) / 2)) extractReasons.push("thin_snippets");
  const dedupCount = Number((result.metadata || {}).dedup_count || 0);
  if (dedupCount > 0) extractReasons.push("duplicates_removed");
  const routingClass = routingInfo.routing_class ? String(routingInfo.routing_class) : null;
  return {
    routing_decision: { provider: result.provider, requested_provider: routingInfo.requested_provider, routing_policy: routingInfo.routing_policy || "routing-v2", routing_class: routingInfo.routing_class, language_hint: routingInfo.language_hint, confidence_level: routingInfo.confidence_level, reason: routingInfo.reason, scores: routingInfo.scores || {}, adaptive_adjustments: routingInfo.adaptive_adjustments || {} },
    result_quality: { result_count: results.length, domain_count: domains.length, domains, domain_diversity: results.length ? Number((domains.length / results.length).toFixed(3)) : 0, thin_snippet_count: thinSnippetCount, dedup_count: dedupCount },
    fallback_chain: { providers_considered: providersConsidered, provider_errors: errors, cooldown_skips: cooldownSkips },
    extract_recommended: extractReasons.length > 0,
    extract_reasons: extractReasons,
    authority_signals: routingClass ? buildAuthoritySignals(routingClass, results) : null,
    diversity: scoreDiversity(results)
  };
}
async function executeSearch(runtimeConfig, params, pluginConfig = {}) {
  try {
    const query = capQueryLength(String(params.query || "").trim());
    if (!query) return { ok: false, payload: { error: "Search failed: query is required" } };
    const requestedCount = Number(params.count ?? pluginConfig.defaults?.max_results ?? 5);
    const count = Number.isFinite(requestedCount) ? Math.max(1, Math.min(20, Math.floor(requestedCount))) : 5;
    const routingOverride = params.routing_override_provider == null ? null : normalizeRequestedProvider(params.routing_override_provider);
    if (routingOverride === "auto") return { ok: false, payload: { error: "Search failed: routing_override_provider must name a provider" } };
    if (routingOverride && params.provider && params.provider !== "auto" && params.provider !== routingOverride) {
      return { ok: false, payload: { error: "Search failed: provider and routing_override_provider disagree" } };
    }
    const requestedProvider = routingOverride || normalizeRequestedProvider(params.provider);
    let freshness = null;
    let searchType = null;
    try {
      freshness = normalizeFreshness(params.freshness);
      searchType = normalizeSearchType(params.search_type);
    } catch (error) {
      return { ok: false, payload: { error: `Search failed: ${String(error?.message || error)}` } };
    }
    const timeRange = toTimeRange(params.time_range) || freshness || void 0;
    const exaFreshnessBounds = exaDateBounds(timeRange);
    const includeDomains = Array.isArray(params.include_domains) ? params.include_domains.filter(Boolean) : void 0;
    const excludeDomains = Array.isArray(params.exclude_domains) ? params.exclude_domains.filter(Boolean) : void 0;
    const routingConfigResult = loadRoutingPreferences(pluginConfig);
    const routingConfig = applyRoutingProfile(routingConfigResult.config);
    const configuredProviders = ALL_PROVIDERS.filter((p) => providerIsConfigured(p, runtimeConfig));
    const enabledProviders = configuredProviders.filter((provider2) => !routingConfig.disabled_providers.includes(provider2));
    const autoEnabledProviders = enabledProviders.filter((candidate) => routingConfig.auto_allow[candidate] !== false);
    const braveOptions = {
      safesearch: runtimeConfig.braveSafesearch
    };
    let routingInfo = { requested_provider: requestedProvider };
    let provider;
    let strictProviderMode = false;
    if (requestedProvider === "auto") {
      if (!configuredProviders.length) {
        return { ok: false, payload: { error: "Search failed: no search providers are configured" } };
      }
      if (!enabledProviders.length) {
        return { ok: false, payload: { error: "Search failed: all configured providers are disabled in routing preferences" } };
      }
      if (!autoEnabledProviders.length) {
        return {
          ok: false,
          payload: {
            error: routingConfig.profile === "self_hosted" ? "Search failed: self_hosted profile requires pluginConfig.searxngInstanceUrl or Keenable credentials/public-tier opt-in" : "Search failed: no configured providers are allowed for automatic routing; select one explicitly or enable auto_allow",
            routing: { requested_provider: "auto", profile: routingConfig.profile }
          }
        };
      }
      if (!routingConfig.auto_routing) {
        const strictDefault = pickStrictDefaultProvider(autoEnabledProviders, routingConfig);
        if (!strictDefault) {
          return { ok: false, payload: { error: "Search failed: auto routing is disabled but default_provider is missing, disabled, or not configured" } };
        }
        provider = strictDefault;
        strictProviderMode = true;
        routingInfo = { requested_provider: "auto", auto_routed: false, provider, fixed_provider_mode: true, reason: "auto_routing_disabled" };
      } else {
        const selection = selectAutoProvider(query, enabledProviders, routingConfig);
        provider = selection.provider;
        routingInfo = selection.routing;
      }
    } else {
      provider = requestedProvider;
      strictProviderMode = true;
      if (routingConfig.disabled_providers.includes(provider)) {
        return { ok: false, payload: { error: `Search failed: provider ${provider} is disabled in routing preferences` } };
      }
      validateApiKey(provider, runtimeConfig);
      routingInfo = { requested_provider: provider, auto_routed: false, provider, fixed_provider_mode: true, reason: "explicit_provider" };
    }
    routingInfo = {
      ...routingInfo,
      profile: routingConfig.profile,
      ...routingOverride ? { override_provider: routingOverride, override_mode: "forced_provider" } : {},
      ...routingConfig.profile === "self_hosted" && requestedProvider !== "auto" ? { explicit_profile_override: true } : {}
    };
    const providersToTry = strictProviderMode ? [provider] : buildAutoFallbackOrder(provider, autoEnabledProviders, routingConfig);
    const eligibleProviders = [];
    const cooldownSkips = [];
    if (strictProviderMode) {
      eligibleProviders.push(provider);
    } else {
      for (const p of providersToTry) {
        const cooldown = providerInCooldown(p);
        if (cooldown.inCooldown) cooldownSkips.push({ provider: p, cooldown_remaining_seconds: cooldown.remaining });
        else eligibleProviders.push(p);
      }
      if (!eligibleProviders.length) eligibleProviders.push(provider);
    }
    const runProvider = async (p) => {
      const key = validateApiKey(p, runtimeConfig);
      if (p === "donsetch" && timeRange) throw new ProviderConfigError("donsetch_freshness_unsupported");
      const locale = providerSupportsLocale(p) ? resolveLocale(p, runtimeConfig, query) : void 0;
      const executeProvider = async () => {
        if (p === "serper") return searchSerper(query, key, count, timeRange, locale, PROVIDER_SEARCH_TYPES.serper[searchType || "search"] || "search");
        if (p === "brave") {
          const fitted = fitQuery("brave", query);
          const response = await searchBrave(fitted.query, key, count, { ...braveOptions, country: locale?.country, search_lang: locale?.language, time_range: timeRange });
          response.query = query;
          if (fitted.truncated) response.metadata = { ...response.metadata || {}, query_truncated: fitted.truncated };
          return response;
        }
        if (p === "tavily") return searchTavily(query, key, count, includeDomains, excludeDomains, timeRange);
        if (p === "linkup") return searchLinkup(query, key, count, includeDomains, excludeDomains);
        if (p === "querit") return searchQuerit(query, key, count, timeRange, includeDomains, excludeDomains, locale);
        if (p === "exa") {
          return searchExa(query, key, count, includeDomains, excludeDomains, timeRange, exaFreshnessBounds);
        }
        if (p === "firecrawl") return searchFirecrawl(query, key, count, timeRange, includeDomains, excludeDomains, locale);
        if (p === "parallel") return searchParallel(query, key, count, includeDomains, excludeDomains, runtimeConfig.parallelMode);
        if (p === "serpbase") return searchSerpBase(query, key, count, locale);
        if (p === "you") return searchYou(query, key, count, timeRange, locale);
        if (p === "keenable") return searchKeenable(query, key || void 0, count, timeRange, includeDomains, runtimeConfig.keenableAllowPublic === true);
        if (p === "octen") return searchOcten(query, key, count, { freshness: freshness || void 0, timeRange, searchType: searchType === "news" ? "news" : "search", includeDomains, excludeDomains, timeoutSeconds: runtimeConfig.octenTimeoutSeconds });
        if (p === "tinyfish") return searchTinyFish(query, key, count, { freshness: freshness || void 0, timeRange, searchType: searchType || "search", includeDomains, excludeDomains, country: locale?.country, language: locale?.language, timeoutSeconds: runtimeConfig.tinyfishTimeoutSeconds });
        if (p === "donsetch") {
          if (!runtimeConfig.runCommandWithTimeout) throw new ProviderConfigError("donsetch_openclaw_runner_unavailable");
          return searchDonsetch(runtimeConfig.runCommandWithTimeout, {
            binary: key,
            query,
            maxResults: count,
            searchType: searchType || "search",
            freshness: timeRange,
            includeDomains,
            excludeDomains,
            timeoutSeconds: runtimeConfig.donsetchTimeoutSeconds
          });
        }
        return searchSearxng(query, key, count, timeRange, runtimeConfig, locale);
      };
      const startedAt2 = Date.now();
      try {
        const response = await executeProvider();
        validateSourceOnlyAdapterResult(p, response);
        recordProviderOutcome(p, (Date.now() - startedAt2) / 1e3, (response.results || []).length, false);
        return response;
      } catch (error) {
        if (error instanceof DonsetchTransportError && error.code === "donsetch_binary_not_configured") throw new ProviderConfigError(error.code);
        if (!(error instanceof ProviderConfigError)) recordProviderOutcome(p, (Date.now() - startedAt2) / 1e3, 0, true);
        throw error;
      }
    };
    if (params.mode === "research") {
      const providerEligibleForExplicitResearch = (p) => !routingConfig.disabled_providers.includes(p) && providerIsConfigured(p, runtimeConfig) && !providerInCooldown(p).inCooldown;
      const providerEligibleForAutomaticResearch = (p) => providerEligibleForExplicitResearch(p) && routingConfig.auto_allow?.[p] !== false;
      const availableResearchProviders = new Set(configuredProviders.filter(providerEligibleForAutomaticResearch));
      if (providerIsConfigured(provider, runtimeConfig) && !routingConfig.disabled_providers.includes(provider) && !providerInCooldown(provider).inCooldown) {
        availableResearchProviders.add(provider);
      }
      let researchProviders;
      if (routingOverride) {
        researchProviders = [provider];
      } else if (Array.isArray(params.research_providers) && params.research_providers.length) {
        researchProviders = [...new Set(params.research_providers.map((value) => normalizeProviderName(value)))].filter(providerEligibleForExplicitResearch);
      } else {
        researchProviders = selectResearchProviders(
          provider,
          routingConfig.provider_priority?.length ? routingConfig.provider_priority : DEFAULT_PROVIDER_PRIORITY,
          availableResearchProviders,
          3
        );
      }
      const researchFanout = preflightResearchFanout(researchProviders);
      researchProviders = researchFanout.providers;
      if (!researchProviders.length) {
        return { ok: false, payload: sanitizeOutput({ error: "No configured providers available for research mode", provider, query, routing: routingInfo, cooldown_skips: cooldownSkips }) };
      }
      const researchExtractCount = Math.max(0, Math.min(5, Math.floor(Number(params.research_extract_count ?? DEFAULT_RESEARCH_EXTRACT_COUNT))));
      const researchTimeBudget = Number(params.research_time_budget ?? DEFAULT_RESEARCH_TIME_BUDGET_SECONDS);
      const result2 = await runResearchMode({
        query,
        researchProviders,
        executeSearch: async (p) => {
          try {
            const response = await executeWithRetry(() => runProvider(p));
            resetProviderHealth(p);
            return response;
          } catch (error) {
            if (!(error instanceof ProviderConfigError)) {
              markProviderFailure(p, String(error?.message || error), error?.retryAfter);
            }
            throw error;
          }
        },
        extractUrls: (urls) => extractPlus(
          urls,
          routingOverride || "auto",
          "markdown",
          false,
          false,
          false,
          runtimeConfig,
          routingConfig.disabled_providers,
          routingConfig.extract_provider_priority,
          { autoAllow: routingConfig.auto_allow, strictProvider: Boolean(routingOverride) }
        ),
        maxResults: count,
        maxExtractUrls: researchExtractCount,
        timeBudgetSeconds: Number.isFinite(researchTimeBudget) && researchTimeBudget > 0 ? researchTimeBudget : null,
        diversityRerank: runtimeConfig.qualityDiversityRerank === true
      });
      result2.metadata = { ...result2.metadata || {}, budget_preflight: { research: researchFanout, daily_quota: "not_supported_without_persistent_ledger" } };
      if (timeRange) {
        result2.metadata = {
          ...result2.metadata || {},
          freshness: { requested: timeRange, per_provider: researchProviders.map((p) => freshnessMetadata(p, timeRange, exaFreshnessBounds)) }
        };
      }
      if (searchType && searchType !== "search") {
        result2.metadata = {
          ...result2.metadata || {},
          search_type: { requested: searchType, per_provider: researchProviders.map((p) => searchTypeMetadata(p, searchType)) }
        };
      }
      routingInfo = { ...routingInfo, mode: "research", provider: "research" };
      if (cooldownSkips.length) routingInfo.cooldown_skips = cooldownSkips;
      if (routingConfigResult.warning) routingInfo.config_warning = routingConfigResult.warning;
      result2.routing = { ...result2.routing, ...routingInfo };
      result2.quality_report = buildQualityReport(result2, routingInfo, result2.routing.provider_errors || [], cooldownSkips, researchProviders);
      return { ok: true, payload: sanitizeOutput(result2) };
    }
    const cacheContext = {
      time_range: timeRange,
      search_type: searchType || "search",
      locale: providerSupportsLocale(provider) ? (({ country, language }) => ({ country, language }))(resolveLocale(provider, runtimeConfig, query)) : null,
      include_domains: includeDomains ? [...includeDomains].sort() : null,
      exclude_domains: excludeDomains ? [...excludeDomains].sort() : null,
      exa_depth: "normal",
      parallel_mode: runtimeConfig.parallelMode || "fast",
      brave_safesearch: normalizeBraveSafesearch(braveOptions.safesearch),
      routing_preferences: routingConfig
    };
    const cached = params.no_cache ? null : cacheGet(query, provider, count, effectiveSearchCacheTtl(query, timeRange, params.cache_ttl), cacheContext);
    if (cached) {
      const result2 = { ...cached };
      for (const key of Object.keys(result2)) if (key.startsWith("_cache_")) delete result2[key];
      result2.cached = true;
      result2.recency_query = new QueryAnalyzer().detectRecencyIntent(query).is_recency_focused || Boolean(timeRange);
      result2.cache_age_seconds = Math.floor(Date.now() / 1e3 - Number(cached._cache_timestamp || 0));
      result2.routing = { ...routingInfo, ...cooldownSkips.length ? { cooldown_skips: cooldownSkips } : {}, ...routingConfigResult.warning ? { config_warning: routingConfigResult.warning } : {} };
      return { ok: true, payload: sanitizeOutput(result2) };
    }
    const errors = [];
    const successes = [];
    for (const p of eligibleProviders) {
      if (toolCallCancelled()) {
        errors.push({ provider: p, error: "skipped: the tool call was aborted before this provider started" });
        break;
      }
      try {
        const result2 = await executeWithRetry(() => runProvider(p));
        resetProviderHealth(p);
        successes.push([p, result2]);
        const gotResults = (result2.results || []).length;
        if (strictProviderMode || gotResults >= count || errors.length === 0 && gotResults > 0) break;
      } catch (error) {
        const message = sanitizeOutput(String(error?.message || error));
        const isConfigError = error instanceof ProviderConfigError;
        const skipCooldown = strictProviderMode || isConfigError;
        const cooldown = skipCooldown ? { cooldown_seconds: 0 } : markProviderFailure(p, message, error?.retryAfter);
        errors.push({ provider: p, error: message, ...skipCooldown ? {} : { cooldown_seconds: cooldown.cooldown_seconds } });
        if (strictProviderMode) break;
      }
    }
    if (!successes.length) {
      return { ok: false, payload: sanitizeOutput({ error: "All providers failed", provider, query, routing: { ...routingInfo, ...cooldownSkips.length ? { cooldown_skips: cooldownSkips } : {}, ...routingConfigResult.warning ? { config_warning: routingConfigResult.warning } : {} }, provider_errors: errors }) };
    }
    let result;
    const leadSuccess = successes.find(([, response]) => (response.results || []).length > 0) ?? successes[0];
    if (successes.length === 1) {
      result = successes[0][1];
    } else {
      result = { ...leadSuccess[1] };
      const deduped = deduplicateResultsAcrossProviders(successes, count);
      result.results = deduped.results;
      result.deduplicated = deduped.dedupCount > 0;
      result.metadata = { ...result.metadata || {}, dedup_count: deduped.dedupCount, providers_merged: successes.map(([p]) => p) };
    }
    const successfulProvider = leadSuccess[0];
    if (!strictProviderMode && successfulProvider !== provider) {
      routingInfo = { ...routingInfo, fallback_used: true, original_provider: provider, provider: successfulProvider };
    }
    if (cooldownSkips.length) routingInfo.cooldown_skips = cooldownSkips;
    if (routingConfigResult.warning) routingInfo.config_warning = routingConfigResult.warning;
    const routingClass = String(routingInfo.routing_class || "general");
    if (Array.isArray(result.results)) {
      const domainConstraints = extractDomainConstraints(query, includeDomains);
      const extraBlocked = Array.isArray(pluginConfig.qualityBlockedDomains) ? pluginConfig.qualityBlockedDomains : [];
      const extraAllowed = Array.isArray(pluginConfig.qualityAllowedDomains) ? pluginConfig.qualityAllowedDomains : [];
      const spamFilter = filterSpamResults(result.results, extraBlocked, [...extraAllowed, ...domainConstraints]);
      result.results = spamFilter.results;
      const rerank = rerankResultsForIntent(query, routingClass, result.results);
      result.results = rerank.results;
      if (rerank.metadata.reranked) result.metadata = { ...result.metadata || {}, intent_rerank: rerank.metadata };
      let diversityDemoted = 0;
      if (!domainConstraints.length) {
        const diversity = rerankDomainDiversity(result.results);
        result.results = diversity.results;
        diversityDemoted = diversity.demotedCount;
      }
      if (spamFilter.removedDomains.length || diversityDemoted || domainConstraints.length) {
        result.metadata = {
          ...result.metadata || {},
          result_filter: {
            spam_removed_domains: spamFilter.removedDomains,
            diversity_demoted_count: diversityDemoted,
            domain_constraints: domainConstraints
          }
        };
      }
    }
    if (timeRange) {
      result.metadata = { ...result.metadata || {}, freshness: freshnessMetadata(successfulProvider, timeRange, exaFreshnessBounds) };
    }
    if (searchType && searchType !== "search") {
      result.metadata = { ...result.metadata || {}, search_type: searchTypeMetadata(successfulProvider, searchType) };
    }
    if (providerSupportsLocale(successfulProvider)) {
      result.metadata = { ...result.metadata || {}, locale: resolveLocale(successfulProvider, runtimeConfig, query).metadata };
    }
    const noResults = Array.isArray(result.results) && result.results.length === 0;
    if (noResults) {
      result.message = NO_RESULTS_MESSAGE;
      result.metadata = { ...result.metadata || {}, no_results: true };
    }
    result.routing = routingInfo;
    result.cached = false;
    if (!result.metadata) result.metadata = {};
    if (result.deduplicated == null) result.deduplicated = false;
    if (result.metadata.dedup_count == null) result.metadata.dedup_count = 0;
    if (params.quality_report) {
      result.quality_report = buildQualityReport(result, routingInfo, errors, cooldownSkips, providersToTry);
    }
    if (!params.no_cache && !noResults) cachePut(query, successfulProvider, count, result, cacheContext);
    return { ok: true, payload: sanitizeOutput(result) };
  } catch (error) {
    return { ok: false, payload: { error: `Search failed: ${sanitizeOutput(String(error?.message || error))}` } };
  }
}
function routingConfigStatus(loadResult) {
  return sanitizeOutput({
    storage_scope: "process_local",
    expires_on_host_restart: true,
    namespace: loadResult.path,
    config_path: loadResult.path,
    source: loadResult.source,
    warning: loadResult.warning,
    quarantine_path: loadResult.quarantine_path,
    config: loadResult.config,
    effective_config: applyRoutingProfile(loadResult.config)
  });
}
function updateRoutingPreferences(pluginConfig, mutator) {
  const current = loadRoutingPreferences(pluginConfig).config;
  const draft = {
    ...current,
    provider_priority: [...current.provider_priority],
    disabled_providers: [...current.disabled_providers]
  };
  const next = mutator(draft) || draft;
  return saveRoutingPreferences(pluginConfig, next);
}
function executeRoutingConfigAction(pluginConfig, params) {
  const action = String(params?.action || "show");
  if (action === "show") return routingConfigStatus(loadRoutingPreferences(pluginConfig));
  if (action === "reset") return routingConfigStatus(resetRoutingPreferences(pluginConfig));
  if (action === "set_default_provider") {
    return routingConfigStatus(updateRoutingPreferences(pluginConfig, (config) => {
      const provider = String(params?.provider || "").trim().toLowerCase();
      config.default_provider = !provider || provider === "none" || provider === "null" ? null : normalizeProviderName(provider);
    }));
  }
  if (action === "set_auto_routing") {
    if (typeof params?.enabled !== "boolean") throw new Error("set_auto_routing requires enabled=true or false");
    return routingConfigStatus(updateRoutingPreferences(pluginConfig, (config) => {
      config.auto_routing = params.enabled;
    }));
  }
  if (action === "set_provider_priority") {
    if (!Array.isArray(params?.providers) || !params.providers.length) throw new Error("set_provider_priority requires a non-empty providers array");
    return routingConfigStatus(updateRoutingPreferences(pluginConfig, (config) => {
      config.provider_priority = [...new Set(params.providers.map((value) => normalizeProviderName(value)))];
      for (const provider of DEFAULT_PROVIDER_PRIORITY) {
        if (!config.provider_priority.includes(provider)) config.provider_priority.push(provider);
      }
    }));
  }
  if (action === "set_extract_provider_priority") {
    if (!Array.isArray(params?.providers) || !params.providers.length) throw new Error("set_extract_provider_priority requires a non-empty providers array");
    return routingConfigStatus(updateRoutingPreferences(pluginConfig, (config) => {
      const requested = [...new Set(params.providers.map((value) => normalizeProviderName(value)))];
      for (const provider of requested) {
        if (!DEFAULT_EXTRACT_PROVIDER_PRIORITY.includes(provider)) {
          throw new Error(`Provider does not support extraction: ${provider}`);
        }
      }
      config.extract_provider_priority = [
        ...requested,
        ...DEFAULT_EXTRACT_PROVIDER_PRIORITY.filter((provider) => !requested.includes(provider))
      ];
    }));
  }
  if (action === "set_fallback_provider") {
    return routingConfigStatus(updateRoutingPreferences(pluginConfig, (config) => {
      const provider = String(params?.provider || "").trim().toLowerCase();
      config.fallback_provider = !provider || provider === "none" || provider === "null" ? null : normalizeProviderName(provider);
    }));
  }
  if (action === "disable_provider") {
    const provider = normalizeProviderName(params?.provider);
    return routingConfigStatus(updateRoutingPreferences(pluginConfig, (config) => {
      if (!config.disabled_providers.includes(provider)) config.disabled_providers.push(provider);
      config.default_provider = config.default_provider === provider ? null : config.default_provider;
      config.fallback_provider = config.fallback_provider === provider ? null : config.fallback_provider;
    }));
  }
  if (action === "enable_provider") {
    const provider = normalizeProviderName(params?.provider);
    return routingConfigStatus(updateRoutingPreferences(pluginConfig, (config) => {
      config.disabled_providers = config.disabled_providers.filter((item) => item !== provider);
    }));
  }
  if (action === "set_confidence_threshold") {
    return routingConfigStatus(updateRoutingPreferences(pluginConfig, (config) => {
      config.confidence_threshold = Number(params?.confidence_threshold);
    }));
  }
  if (action === "set_profile") {
    const profile = String(params?.profile || "").trim().toLowerCase();
    if (profile !== "standard" && profile !== "self_hosted") throw new Error("set_profile requires profile=standard or self_hosted");
    return routingConfigStatus(updateRoutingPreferences(pluginConfig, (config) => {
      config.profile = profile;
    }));
  }
  if (action === "set_auto_allow") {
    if (typeof params?.enabled !== "boolean") throw new Error("set_auto_allow requires enabled=true or false");
    const provider = normalizeProviderName(params?.provider);
    return routingConfigStatus(updateRoutingPreferences(pluginConfig, (config) => {
      config.auto_allow = { ...config.auto_allow, [provider]: params.enabled };
    }));
  }
  throw new Error(`Unsupported routing config action: ${action}`);
}
function register(api) {
  const commandRunner = api.runtime?.system?.runCommandWithTimeout;
  api.registerTool(
    {
      name: "web_search_health_plus",
      description: "Read-only process-local provider health from adaptive routing samples. Reports only what this host process has observed since it started; when DonSeTch is configured it also runs the local executable's --version readiness check. No HTTP endpoint or persisted history is used.",
      parameters: { type: "object", properties: {} },
      async execute() {
        const runtimeConfig = getRuntimeConfig(api.pluginConfig ?? {}, commandRunner);
        const readiness = commandRunner ? await inspectDonsetchReadiness(commandRunner, runtimeConfig.donsetchBin, { timeoutSeconds: 5 }) : { state: runtimeConfig.donsetchBin ? "unavailable" : "missing", version: null, testedVersion: "4.7.0", compatibility: "unknown", binaryConfigured: Boolean(runtimeConfig.donsetchBin), diagnostic: runtimeConfig.donsetchBin ? "openclaw_command_runner_unavailable" : void 0 };
        return { content: [{ type: "text", text: JSON.stringify({ ...getProviderHealthSnapshot(ALL_PROVIDERS), shadow_quality: getShadowQualitySnapshot(), donsetch: readiness }) }] };
      }
    },
    { optional: true }
  );
  const BENCHMARK_LATENCY_CEILING_MS = 3e4;
  const BENCHMARK_CONTENT_TARGET_CHARS_PER_URL = 5e3;
  const BENCHMARK_SCORE_WEIGHTS = { success_rate: 0.6, latency: 0.2, content_yield: 0.2 };
  const benchmarkScore = (successRate, latencyMs, returnedChars, urlCount) => {
    const latency = Math.max(0, 1 - latencyMs / BENCHMARK_LATENCY_CEILING_MS);
    const content = Math.min(1, returnedChars / Math.max(1, urlCount * BENCHMARK_CONTENT_TARGET_CHARS_PER_URL));
    return Number((0.6 * successRate + 0.2 * latency + 0.2 * content).toFixed(3));
  };
  api.registerTool(
    {
      name: "web_extract_benchmark_plus",
      description: "Explicit opt-in extraction benchmark. Never runs automatically; makes at most max_provider_calls (1-3) direct provider calls, bypasses the response cache, and returns a process-local priority recommendation. DonSeTch remains excluded unless auto_allow.donsetch=true.",
      parameters: { type: "object", required: ["urls"], properties: { urls: { type: "array", minItems: 1, maxItems: 3, items: { type: "string" } }, max_provider_calls: { type: "integer", minimum: 1, maximum: 3 } } },
      async execute(_id, params) {
        try {
          const pluginConfig = api.pluginConfig ?? {};
          const runtimeConfig = getRuntimeConfig(pluginConfig, commandRunner);
          const routing = applyRoutingProfile(loadRoutingPreferences(pluginConfig).config);
          const maxCalls = Math.max(1, Math.min(3, Math.floor(Number(params?.max_provider_calls ?? 3))));
          const candidates2 = routing.extract_provider_priority.filter((provider) => !routing.disabled_providers.includes(provider) && routing.auto_allow[provider] !== false && isExtractProviderAvailable(provider, runtimeConfig)).slice(0, maxCalls);
          const attempts = [];
          for (const provider of candidates2) {
            const startedAt2 = Date.now();
            const response = await extractPlus(params.urls, provider, "markdown", false, false, false, runtimeConfig, routing.disabled_providers, routing.extract_provider_priority, { autoAllow: routing.auto_allow, strictProvider: true, cacheBypass: true });
            const returnedChars = (response.results || []).reduce((sum, item) => sum + String(item?.content || "").length, 0);
            const successCount = (response.results || []).filter((item) => String(item?.content || "").length > 0).length;
            attempts.push({ provider, latency_ms: Date.now() - startedAt2, status: response.error ? "failed" : "success", result_count: response.results.length, returned_chars: returnedChars, success_rate: Number((successCount / Math.max(1, params.urls.length)).toFixed(3)), score: benchmarkScore(successCount / Math.max(1, params.urls.length), Date.now() - startedAt2, returnedChars, params.urls.length), error: response.error });
          }
          const priority_recommendation = attempts.filter((attempt) => attempt.status === "success" && attempt.result_count > 0).sort((left, right) => right.score - left.score || left.latency_ms - right.latency_ms).map((attempt) => attempt.provider);
          const result = { scope: "process_local", explicit_opt_in: true, score_weights: BENCHMARK_SCORE_WEIGHTS, max_provider_calls: maxCalls, provider_calls_made: attempts.length, donsetch_auto_allow: routing.auto_allow.donsetch === true, attempts, priority_recommendation };
          saveExtractBenchmark(result);
          return { content: [{ type: "text", text: JSON.stringify(sanitizeOutput(result)) }] };
        } catch (error) {
          return { content: [{ type: "text", text: JSON.stringify(sanitizeOutput({ error: String(error?.message || error) })) }] };
        }
      }
    },
    { optional: true }
  );
  api.registerTool(
    {
      name: "web_search_plus",
      description: "Search the web, routing each query to the best configured provider with automatic fallback. Source-only multi-provider routing across Serper, Brave, Tavily, Linkup, Querit, Exa, Firecrawl, Parallel, SerpBase, You.com, SearXNG, Keenable, explicit-only Octen/TinyFish, and optional separately installed DonSeTch. Automatic routing supports canonical-source reranking, a process-local response cache, bounded transient retries, and provider fallback. mode=research can query up to three providers and stop after a conservative source-quality quorum.",
      parameters: PARAMETERS_SCHEMA,
      async execute(_id, params, signal) {
        try {
          const pluginConfig = api.pluginConfig ?? {};
          const runtimeConfig = getRuntimeConfig(pluginConfig, commandRunner);
          const result = await toolCallSignal.run(signal, () => executeSearch(runtimeConfig, params, pluginConfig));
          if (!result.ok) {
            const failure = result.payload;
            return { content: [{ type: "text", text: JSON.stringify(sanitizeOutput(failure)) }] };
          }
          recordShadowQualityObservation(result.payload);
          return { content: [{ type: "text", text: JSON.stringify(sanitizeOutput(result.payload)) }] };
        } catch (error) {
          return { content: [{ type: "text", text: `Search failed: ${sanitizeOutput(String(error?.message || error))}` }] };
        }
      }
    },
    { optional: true }
  );
  api.registerTool(
    {
      name: "web_routing_config_plus",
      description: "Show or update process-local routing preferences for web_search_plus and web_extract_plus. Updates remain in the selected in-memory namespace only until the host process restarts; no routing file is read or written.",
      parameters: ROUTING_CONFIG_PARAMETERS_SCHEMA,
      async execute(_id, params) {
        try {
          const pluginConfig = api.pluginConfig ?? {};
          return { content: [{ type: "text", text: JSON.stringify(executeRoutingConfigAction(pluginConfig, params)) }] };
        } catch (error) {
          return { content: [{ type: "text", text: JSON.stringify(sanitizeOutput({ error: String(error?.message || error) })) }] };
        }
      }
    },
    { optional: true }
  );
  api.registerTool(
    {
      name: "web_extract_plus",
      description: "Extract page content from URLs, with per-URL errors and provider fallback. Extraction runs across configured providers, including optional separately installed DonSeTch over a host-managed stdio process, with bounded automatic fallback, per-URL errors, and unified output. The aggregate context budget selects a prefix before the per-result head/tail window. Inline raw_content mirrors final budgeted content; distinct provider raw text remains available through process-local full-content references. routing_override_provider makes one strict provider attempt with no fallback.",
      parameters: EXTRACT_PARAMETERS_SCHEMA,
      checkFn() {
        const pluginConfig = api.pluginConfig ?? {};
        return hasAnyExtractProviderCredential(getRuntimeConfig(pluginConfig, commandRunner));
      },
      async execute(_id, params) {
        try {
          if (typeof params?.content_ref === "string") {
            const content = readCachedExtractContent(
              params.content_ref,
              params?.content_start == null ? 0 : Number(params.content_start),
              params?.content_end == null ? void 0 : Number(params.content_end),
              params?.raw_content_start == null ? void 0 : Number(params.raw_content_start),
              params?.raw_content_end == null ? void 0 : Number(params.raw_content_end)
            );
            return { content: [{ type: "text", text: JSON.stringify(sanitizeOutput(content)) }] };
          }
          const pluginConfig = api.pluginConfig ?? {};
          const runtimeConfig = getRuntimeConfig(pluginConfig, commandRunner);
          const routingPreferences = applyRoutingProfile(loadRoutingPreferences(pluginConfig).config);
          const routingOverride = typeof params?.routing_override_provider === "string" ? params.routing_override_provider : null;
          if (routingOverride && params?.provider && params.provider !== "auto" && params.provider !== routingOverride) throw new Error("provider and routing_override_provider disagree");
          const result = await extractPlus(
            Array.isArray(params?.urls) ? params.urls : typeof params?.urls === "string" ? [params.urls] : [],
            routingOverride || params?.provider || "auto",
            params?.format === "html" ? "html" : "markdown",
            Boolean(params?.include_images),
            Boolean(params?.include_raw_html),
            Boolean(params?.render_js),
            runtimeConfig,
            routingPreferences.disabled_providers,
            routingPreferences.extract_provider_priority,
            {
              maxUrls: params?.max_urls,
              maxContextChars: params?.max_context_chars,
              spans: params?.spans === true,
              spansQuery: typeof params?.spans_query === "string" ? params.spans_query : void 0,
              autoAllow: routingPreferences.auto_allow,
              deadlineSeconds: params?.deadline_seconds,
              strictProvider: Boolean(routingOverride)
            }
          );
          if (routingOverride) result.routing = { ...result.routing || { requested_provider: routingOverride }, override_provider: routingOverride, override_mode: "forced_provider" };
          return { content: [{ type: "text", text: JSON.stringify(sanitizeOutput(result)) }] };
        } catch (error) {
          return { content: [{ type: "text", text: JSON.stringify(sanitizeOutput({ error: String(error?.message || error) })) }] };
        }
      }
    },
    { optional: true }
  );
}
var index_default = definePluginEntry({
  id: "web-search-plus-plugin-v2",
  name: "Web Search Plus",
  description: "One clean set of web tools for multi-provider search and extraction.",
  configSchema: buildJsonPluginConfigSchema(openclaw_plugin_default.configSchema, { uiHints: openclaw_plugin_default.uiHints }),
  register
});
export {
  CANONICAL_DOMAIN_RULES,
  FAILURE_DECAY_SECONDS,
  FRESHNESS_VALUES2 as FRESHNESS_VALUES,
  MAX_RETRY_AFTER_WAIT_SECONDS,
  PROVIDER_FRESHNESS_FORMATS,
  PROVIDER_SEARCH_TYPES,
  QueryAnalyzer,
  RATE_LIMIT_MAX_ATTEMPTS,
  RETRY_JITTER_FRACTION,
  SEARCH_TYPE_VALUES,
  __resetRuntimeStateForTests,
  buildAuthoritySignals,
  buildCacheKey,
  chooseTieWinner,
  computeRetryDelayMs,
  deduplicateResultsAcrossProviders,
  index_default as default,
  effectiveSearchCacheTtl,
  exaDateBounds,
  freshnessMetadata,
  keenableEndpoint,
  normalizeFreshness,
  normalizeSearchType,
  parseRetryAfter,
  register,
  rerankResultsForIntent,
  searchBrave,
  searchTypeMetadata
};
