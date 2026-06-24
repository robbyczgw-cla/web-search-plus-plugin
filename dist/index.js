// index.ts
import crypto from "crypto";
import dns from "dns/promises";
import net from "net";

// node_modules/openclaw/dist/plugin-cache-primitives-BXH3UUqE.js
var PluginLruCache = class {
  #defaultMaxEntries;
  #maxEntries;
  #entries = /* @__PURE__ */ new Map();
  constructor(defaultMaxEntries) {
    this.#defaultMaxEntries = normalizeMaxEntries(defaultMaxEntries, 1);
    this.#maxEntries = this.#defaultMaxEntries;
  }
  get maxEntries() {
    return this.#maxEntries;
  }
  get size() {
    return this.#entries.size;
  }
  setMaxEntriesForTest(value) {
    this.#maxEntries = typeof value === "number" ? normalizeMaxEntries(value, this.#defaultMaxEntries) : this.#defaultMaxEntries;
    this.#evictOldestEntries();
  }
  clear() {
    this.#entries.clear();
  }
  get(cacheKey) {
    const cached = this.getResult(cacheKey);
    return cached.hit ? cached.value : void 0;
  }
  getResult(cacheKey) {
    if (!this.#entries.has(cacheKey)) return { hit: false };
    const cached = this.#entries.get(cacheKey);
    this.#entries.delete(cacheKey);
    this.#entries.set(cacheKey, cached);
    return {
      hit: true,
      value: cached
    };
  }
  set(cacheKey, value) {
    if (this.#entries.has(cacheKey)) this.#entries.delete(cacheKey);
    this.#entries.set(cacheKey, value);
    this.#evictOldestEntries();
  }
  #evictOldestEntries() {
    while (this.#entries.size > this.#maxEntries) {
      const oldestEntry = this.#entries.keys().next();
      if (oldestEntry.done) break;
      this.#entries.delete(oldestEntry.value);
    }
  }
};
function normalizeMaxEntries(value, fallback) {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.max(1, Math.floor(value));
}

// node_modules/openclaw/dist/ansi-Dqm1lzVL.js
var ANSI_CSI_PATTERN = "\\x1b\\[[\\x20-\\x3f]*[\\x40-\\x7e]";
var OSC8_PATTERN = "\\x1b\\]8;;.*?(?:\\x1b\\\\|\\x07)|\\x1b\\]8;;(?:\\x1b\\\\|\\x07)";
var ANSI_CSI_REGEX = new RegExp(ANSI_CSI_PATTERN, "g");
var OSC8_REGEX = new RegExp(OSC8_PATTERN, "g");
var graphemeSegmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(void 0, { granularity: "grapheme" }) : null;

// node_modules/openclaw/dist/schema-validator-CwMY3Tzl.js
import { createRequire } from "node:module";
var require2 = createRequire(import.meta.url);
var schemaCache = new PluginLruCache(512);

// node_modules/openclaw/dist/config-schema-Crc2mMHj.js
function error(message) {
  return {
    success: false,
    error: { issues: [{
      path: [],
      message
    }] }
  };
}
function emptyPluginConfigSchema() {
  return {
    safeParse(value) {
      if (value === void 0) return {
        success: true,
        data: void 0
      };
      if (!value || typeof value !== "object" || Array.isArray(value)) return error("expected config object");
      if (Object.keys(value).length > 0) return error("config must be empty");
      return {
        success: true,
        data: value
      };
    },
    jsonSchema: {
      type: "object",
      additionalProperties: false,
      properties: {}
    }
  };
}

// node_modules/openclaw/dist/plugin-entry-DmhVEOw1.js
function createCachedLazyValueGetter(value, fallback) {
  let resolved = false;
  let cached;
  return () => {
    if (!resolved) {
      cached = (typeof value === "function" ? value() : value) ?? fallback;
      resolved = true;
    }
    return cached;
  };
}
function definePluginEntry({ id, name, description, kind, configSchema = emptyPluginConfigSchema, reload, nodeHostCommands, securityAuditCollectors, register: register2 }) {
  const getConfigSchema = createCachedLazyValueGetter(configSchema);
  return {
    id,
    name,
    description,
    ...kind ? { kind } : {},
    ...reload ? { reload } : {},
    ...nodeHostCommands ? { nodeHostCommands } : {},
    ...securityAuditCollectors ? { securityAuditCollectors } : {},
    get configSchema() {
      return getConfigSchema();
    },
    register: register2
  };
}

// runtime-config.ts
var KEENABLE_PUBLIC_SENTINEL = "keenable:public";
function maybeString(value) {
  if (typeof value !== "string") return void 0;
  const trimmed = value.trim();
  return trimmed ? trimmed : void 0;
}
function getRuntimeConfig(pluginConfig) {
  return {
    serperApiKey: maybeString(pluginConfig?.serperApiKey),
    braveApiKey: maybeString(pluginConfig?.braveApiKey),
    braveSafesearch: maybeString(pluginConfig?.braveSafesearch),
    tavilyApiKey: maybeString(pluginConfig?.tavilyApiKey),
    linkupApiKey: maybeString(pluginConfig?.linkupApiKey),
    queritApiKey: maybeString(pluginConfig?.queritApiKey),
    exaApiKey: maybeString(pluginConfig?.exaApiKey),
    firecrawlApiKey: maybeString(pluginConfig?.firecrawlApiKey),
    perplexityApiKey: maybeString(pluginConfig?.perplexityApiKey),
    kilocodeApiKey: maybeString(pluginConfig?.kilocodeApiKey),
    youApiKey: maybeString(pluginConfig?.youApiKey),
    parallelApiKey: maybeString(pluginConfig?.parallelApiKey),
    serpbaseApiKey: maybeString(pluginConfig?.serpbaseApiKey),
    keenableApiKey: maybeString(pluginConfig?.keenableApiKey),
    searxngInstanceUrl: maybeString(pluginConfig?.searxngInstanceUrl),
    searxngAllowPrivate: pluginConfig?.searxngAllowPrivate === true ? true : void 0
  };
}

// routing-config.ts
var DEFAULT_PROVIDER_PRIORITY = ["tavily", "exa", "linkup", "parallel", "firecrawl", "you", "serper", "brave", "serpbase", "querit", "perplexity", "kilo-perplexity", "searxng", "keenable"];
var GUARDED_AUTO_PROVIDERS = ["brave", "serpbase", "querit", "parallel", "perplexity", "kilo-perplexity"];
var DEFAULT_ROUTING_PREFERENCES = {
  version: 2,
  auto_routing: true,
  default_provider: null,
  provider_priority: [...DEFAULT_PROVIDER_PRIORITY],
  fallback_provider: null,
  disabled_providers: [],
  confidence_threshold: 0.4,
  auto_allow: Object.fromEntries(DEFAULT_PROVIDER_PRIORITY.map((provider) => [provider, !GUARDED_AUTO_PROVIDERS.includes(provider)]))
};
var memoryRoutingPreferences = /* @__PURE__ */ new Map();
function cloneConfig(config) {
  return {
    ...config,
    provider_priority: [...config.provider_priority],
    disabled_providers: [...config.disabled_providers],
    auto_allow: { ...config.auto_allow }
  };
}
function cloneDefaults() {
  return cloneConfig(DEFAULT_ROUTING_PREFERENCES);
}
function normalizeProviderName(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/_/g, "-");
  if (normalized === "kilo-perplexity") return "kilo-perplexity";
  if (DEFAULT_PROVIDER_PRIORITY.includes(normalized)) return normalized;
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
  config.auto_routing = input.auto_routing == null ? config.auto_routing : Boolean(input.auto_routing);
  config.default_provider = input.default_provider == null ? config.default_provider : normalizeOptionalProvider(input.default_provider);
  config.provider_priority = input.provider_priority == null ? config.provider_priority : normalizePriority(input.provider_priority);
  config.fallback_provider = input.fallback_provider == null ? config.fallback_provider : normalizeOptionalProvider(input.fallback_provider);
  config.disabled_providers = input.disabled_providers == null ? config.disabled_providers : normalizeProviderList(input.disabled_providers);
  config.confidence_threshold = input.confidence_threshold == null ? config.confidence_threshold : normalizeThreshold(input.confidence_threshold);
  config.auto_allow = input.auto_allow == null ? config.auto_allow : normalizeAutoAllow(input.auto_allow);
  return config;
}
function loadRoutingPreferences(pluginConfig = {}) {
  const path = resolveRoutingConfigPath(pluginConfig);
  const existing = memoryRoutingPreferences.get(path);
  if (existing) return { config: cloneConfig(existing), path, source: "memory" };
  const configuredPreferences = pluginConfig?.routingPreferences;
  if (configuredPreferences != null) {
    try {
      const validated = validateRoutingPreferences(configuredPreferences);
      memoryRoutingPreferences.set(path, cloneConfig(validated));
      return { config: cloneConfig(validated), path, source: "plugin_config" };
    } catch (error2) {
      return {
        config: cloneDefaults(),
        path,
        source: "default",
        warning: `Routing config reset to defaults after validation failure: ${String(error2?.message || error2)}`
      };
    }
  }
  return { config: cloneDefaults(), path, source: "default" };
}
function saveRoutingPreferences(pluginConfig = {}, config) {
  const path = resolveRoutingConfigPath(pluginConfig);
  const validated = validateRoutingPreferences(config);
  memoryRoutingPreferences.set(path, cloneConfig(validated));
  return { config: cloneConfig(validated), path, source: "memory" };
}
function resetRoutingPreferences(pluginConfig = {}) {
  const path = resolveRoutingConfigPath(pluginConfig);
  memoryRoutingPreferences.delete(path);
  const configuredPreferences = pluginConfig?.routingPreferences;
  if (configuredPreferences != null) {
    return loadRoutingPreferences(pluginConfig);
  }
  return { config: cloneDefaults(), path, source: "default" };
}

// extract.ts
var EXTRACT_PROVIDER_PRIORITY = ["tavily", "exa", "linkup", "parallel", "firecrawl", "you", "keenable"];
var EXTRACT_PARAMETERS_SCHEMA = {
  type: "object",
  required: ["urls"],
  properties: {
    urls: { type: "array", items: { type: "string" }, description: "URLs to extract" },
    provider: {
      type: "string",
      enum: ["auto", "firecrawl", "linkup", "tavily", "exa", "parallel", "you", "keenable"],
      description: "Force a provider, or use auto fallback routing (default: auto)"
    },
    format: {
      type: "string",
      enum: ["markdown", "html"],
      description: "Output format for extracted content (default: markdown)"
    },
    include_images: { type: "boolean", description: "Include image metadata when supported" },
    include_raw_html: { type: "boolean", description: "Include raw HTML when supported" },
    render_js: { type: "boolean", description: "Render JavaScript before extraction when supported" }
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
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      const message = data?.error || data?.message || data?.detail || data?.warning || `HTTP ${response.status}`;
      throw new Error(String(message));
    }
    return data;
  } catch (error2) {
    if (error2?.name === "AbortError") throw new Error(`Request timed out after ${timeout}s`);
    throw error2;
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
    keenable: runtimeConfig.keenableApiKey || KEENABLE_PUBLIC_SENTINEL
  };
  return keyMap[provider];
}
function hasAnyExtractProviderCredential(runtimeConfig) {
  return EXTRACT_PROVIDER_PRIORITY.some((provider) => Boolean(getExtractApiKey(provider, runtimeConfig)));
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
    } catch (error2) {
      results.push(normalizeExtractResult("firecrawl", url, "", "", void 0, { error: String(error2?.message || error2) }));
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
    } catch (error2) {
      results.push(normalizeExtractResult("linkup", url, "", "", void 0, { error: String(error2?.message || error2) }));
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
    const content = String(item?.raw_content || item?.content || "");
    results.push(normalizeExtractResult("tavily", url, String(item?.title || ""), content, content, {
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
  return { provider: "exa", results };
}
async function extractParallel(urls, apiKey, outputFormat = "markdown", _includeImages = false, includeRawHtml = false, _renderJs = false, apiUrl = "https://api.parallel.ai/v1beta/tasks/extract", timeout = 30) {
  const data = await requestJson(apiUrl, {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      urls,
      max_chars_total: 2e4,
      advanced_settings: { full_content: { max_chars_per_result: 8e3 } }
    })
  }, timeout);
  const rawItems = Array.isArray(data?.results) ? data.results : Array.isArray(data?.data) ? data.data : [];
  const results = rawItems.map((item) => {
    const url = String(item?.url || item?.source_url || "");
    const excerpts = Array.isArray(item?.excerpts) ? item.excerpts : Array.isArray(item?.snippets) ? item.snippets : [];
    const markdown = String(item?.markdown || item?.content || item?.text || excerpts.join("\n\n") || "");
    const html = String(item?.html || item?.raw_html || "");
    const content = outputFormat === "html" ? html || markdown : markdown || html;
    return normalizeExtractResult("parallel", url, String(item?.title || ""), content, content, {
      raw_html: includeRawHtml ? html || void 0 : void 0,
      metadata: { search_id: data?.search_id, session_id: data?.session_id }
    });
  });
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
async function extractKeenable(urls, apiKey, _outputFormat = "markdown", _includeImages = false, _includeRawHtml = false, _renderJs = false, apiBase = "https://api.keenable.ai/v1/fetch", timeout = 30) {
  const authenticated = apiKey !== KEENABLE_PUBLIC_SENTINEL;
  const headers = { "X-Keenable-Title": "openclaw-web-search-plus", ...authenticated ? { "X-API-Key": apiKey } : {} };
  const results = [];
  for (const url of urls) {
    try {
      const endpoint = `${apiBase}${authenticated ? "" : "/public"}?url=${encodeURIComponent(url)}`;
      const data = await requestJson(endpoint, { method: "GET", headers }, timeout);
      const content = String(data?.content || "");
      results.push(normalizeExtractResult("keenable", String(data?.url || url), String(data?.title || ""), content, content, {
        metadata: data?.author || data?.description ? { author: data.author, description: data.description } : void 0
      }));
    } catch (error2) {
      results.push(normalizeExtractResult("keenable", url, "", "", void 0, { error: String(error2?.message || error2) }));
    }
  }
  return { provider: "keenable", results };
}
async function extractPlus(urls, provider = "auto", outputFormat = "markdown", includeImages = false, includeRawHtml = false, renderJs = false, runtimeConfig = {}) {
  const requestedProvider = provider || "auto";
  if (!Array.isArray(urls) || urls.length === 0) {
    return {
      provider: requestedProvider,
      results: [],
      error: "No URLs provided",
      routing: { requested_provider: requestedProvider }
    };
  }
  const cleanedUrls = urls.map((url) => typeof url === "string" ? url.trim() : url);
  const invalidUrls = cleanedUrls.filter((url) => typeof url !== "string" || !/^https?:\/\//.test(url));
  if (invalidUrls.length) {
    return {
      provider: requestedProvider,
      results: [],
      error: `Invalid URL(s) \u2014 must start with http:// or https://: ${JSON.stringify(invalidUrls)}`,
      routing: { requested_provider: requestedProvider }
    };
  }
  const providers = requestedProvider === "auto" ? EXTRACT_PROVIDER_PRIORITY : [requestedProvider, ...EXTRACT_PROVIDER_PRIORITY.filter((item) => item !== requestedProvider)];
  const errors = [];
  for (const currentProvider of providers) {
    if (!EXTRACT_PROVIDER_PRIORITY.includes(currentProvider)) {
      errors.push({ provider: currentProvider, error: `Provider ${currentProvider} does not support extraction` });
      continue;
    }
    const providerCredential = getExtractApiKey(currentProvider, runtimeConfig);
    if (!providerCredential) {
      errors.push({ provider: currentProvider, error: "missing_api_key" });
      continue;
    }
    try {
      let result;
      if (currentProvider === "tavily") {
        result = await extractTavily(cleanedUrls, providerCredential, outputFormat, includeImages, includeRawHtml, renderJs);
      } else if (currentProvider === "exa") {
        result = await extractExa(cleanedUrls, providerCredential, outputFormat, includeImages, includeRawHtml, renderJs);
      } else if (currentProvider === "linkup") {
        result = await extractLinkup(cleanedUrls, providerCredential, outputFormat, includeImages, includeRawHtml, renderJs);
      } else if (currentProvider === "parallel") {
        result = await extractParallel(cleanedUrls, providerCredential, outputFormat, includeImages, includeRawHtml, renderJs);
      } else if (currentProvider === "firecrawl") {
        result = await extractFirecrawl(cleanedUrls, providerCredential, outputFormat, includeImages, includeRawHtml, renderJs);
      } else if (currentProvider === "keenable") {
        result = await extractKeenable(cleanedUrls, providerCredential, outputFormat, includeImages, includeRawHtml, renderJs);
      } else {
        result = await extractYou(cleanedUrls, providerCredential, outputFormat, includeImages, includeRawHtml, renderJs);
      }
      const resultList = Array.isArray(result.results) ? result.results : [];
      const allUrlsFailed = resultList.length > 0 && resultList.every((item) => item?.error);
      if (allUrlsFailed) {
        errors.push({ provider: currentProvider, error: "all_urls_failed", details: resultList.map((item) => item.error) });
        continue;
      }
      return {
        ...result,
        routing: {
          provider: currentProvider,
          requested_provider: requestedProvider,
          fallback_used: errors.length > 0,
          fallback_errors: errors
        }
      };
    } catch (error2) {
      errors.push({ provider: currentProvider, error: String(error2?.message || error2) });
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
function normalizeResultUrl(url) {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
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
async function runResearchMode(options) {
  const { query, researchProviders, executeSearch: executeSearch2, extractUrls, maxResults } = options;
  const maxExtractUrls = options.maxExtractUrls ?? 3;
  const timeBudgetSeconds = options.timeBudgetSeconds ?? null;
  const now = options.nowFn || (() => Date.now() / 1e3);
  const start = now();
  const budgetExhausted = () => timeBudgetSeconds != null && now() - start >= timeBudgetSeconds;
  const providerErrors = [];
  const launched = [];
  for (const [index, provider] of researchProviders.entries()) {
    if (budgetExhausted()) {
      providerErrors.push({ provider, error: "skipped: research time budget exhausted" });
      continue;
    }
    launched.push({ index, provider, promise: executeSearch2(provider) });
  }
  const resultsByIndex = /* @__PURE__ */ new Map();
  for (const { index, provider, promise } of launched) {
    try {
      resultsByIndex.set(index, [provider, await promise]);
    } catch (error2) {
      providerErrors.push({ provider, error: String(error2?.message || error2) });
    }
  }
  const providerResults = [...resultsByIndex.keys()].sort((a, b) => a - b).map((index) => resultsByIndex.get(index));
  const { results: deduped, dedupCount } = deduplicateResultsAcrossProviders(providerResults, maxResults);
  const urls = deduped.map((item) => item.url).filter(Boolean).slice(0, Math.max(0, maxExtractUrls));
  let extracted = { provider: null, results: [] };
  let extractionError = null;
  if (urls.length) {
    if (budgetExhausted()) {
      extractionError = "skipped: research time budget exhausted";
    } else {
      try {
        extracted = await extractUrls(urls) || { provider: null, results: [] };
        if (extracted.error && !(extracted.results || []).length) {
          extractionError = String(extracted.error);
          extracted = { provider: extracted.provider ?? null, results: [] };
        }
      } catch (error2) {
        extractionError = String(error2?.message || error2);
        extracted = { provider: null, results: [] };
      }
    }
  }
  const routing = {
    providers_queried: providerResults.map(([provider]) => provider),
    provider_errors: providerErrors,
    extraction_provider: extracted.provider ?? null
  };
  if (extractionError) routing.extraction_error = extractionError;
  const sourceSummaries = extracted.results || [];
  return {
    mode: "research",
    provider: "research",
    query,
    results: deduped,
    source_summaries: sourceSummaries,
    routing,
    metadata: {
      dedup_count: dedupCount,
      providers_merged: providerResults.map(([provider]) => provider),
      extracted_url_count: sourceSummaries.length
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
  return domain === rule || domain.endsWith(`.${rule}`) || domain.startsWith(rule);
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
    const snippet = String(item.snippet || item.description || "").toLowerCase();
    let score = (results.length - idx) * 0.01;
    if (rules.boost.some((rule) => urlMatchesRule(url, rule))) score += 10;
    if (rules.demote.some((rule) => urlMatchesRule(url, rule))) score -= 6;
    if (routingClass === "official/vendor-release" && ["mistral", "anthropic", "openai", "nvidia", "google", "meta"].some((term) => domain.includes(term))) score += 3;
    if (routingClass === "official/regulatory" && (url.toLowerCase().endsWith(".pdf") || title.includes("pdf"))) score += 2;
    if (q.includes("official") && (title.includes("official") || snippet.includes("official"))) score += 1;
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

// index.ts
var DEFAULT_CACHE_TTL = 3600;
var RETRY_BACKOFF_MS = [1e3, 3e3, 9e3];
var RETRY_JITTER_FRACTION = 0.5;
var DEFAULT_RESEARCH_EXTRACT_COUNT = 3;
var DEFAULT_RESEARCH_TIME_BUDGET_SECONDS = 55;
var COOLDOWN_STEPS_SECONDS = [60, 300, 1500, 3600];
var TRANSIENT_HTTP_CODES = /* @__PURE__ */ new Set([408, 425, 429, 500, 502, 503, 504]);
var SEARCH_PROVIDER_ENUM = ["serper", "brave", "tavily", "linkup", "querit", "exa", "firecrawl", "parallel", "serpbase", "perplexity", "kilo-perplexity", "you", "searxng", "keenable", "kilo_perplexity", "auto"];
var PARAMETERS_SCHEMA = {
  type: "object",
  required: ["query"],
  properties: {
    query: { type: "string", description: "Search query" },
    provider: {
      type: "string",
      enum: SEARCH_PROVIDER_ENUM,
      description: "Force a provider, or use auto routing (default: auto)"
    },
    count: { type: "number", description: "Number of results (default: 5)" },
    depth: {
      type: "string",
      enum: ["normal", "deep", "deep-reasoning"],
      description: "Exa depth when using Exa or when auto-routing chooses Exa."
    },
    time_range: {
      type: "string",
      enum: ["hour", "day", "week", "month", "year"],
      description: "Recency filter where supported."
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
  "set_fallback_provider",
  "disable_provider",
  "enable_provider",
  "set_confidence_threshold",
  "reset"
];
var ROUTING_CONFIG_PARAMETERS_SCHEMA = {
  type: "object",
  required: ["action"],
  properties: {
    action: { type: "string", enum: ROUTING_CONFIG_ACTIONS },
    provider: { type: "string", enum: [...SEARCH_PROVIDER_ENUM.filter((value) => value !== "auto"), "none", "null"] },
    enabled: { type: "boolean", description: "Used by set_auto_routing. True enables auto routing, false switches provider:auto to strict default_provider mode." },
    providers: { type: "array", items: { type: "string", enum: SEARCH_PROVIDER_ENUM.filter((value) => value !== "auto") }, description: "Priority order. Missing providers are appended in default order." },
    confidence_threshold: { type: "number", minimum: 0, maximum: 1 }
  }
};
var ALL_PROVIDERS = ["serper", "brave", "tavily", "linkup", "querit", "exa", "firecrawl", "parallel", "serpbase", "perplexity", "kilo-perplexity", "you", "searxng", "keenable"];
var ProviderConfigError = class extends Error {
};
var ProviderRequestError = class extends Error {
  statusCode;
  transient;
  constructor(message, statusCode, transient = false) {
    super(message);
    this.name = "ProviderRequestError";
    this.statusCode = statusCode;
    this.transient = transient;
  }
};
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
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
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
function markProviderFailure(provider, message) {
  const state = loadProviderHealth();
  const now = Math.floor(Date.now() / 1e3);
  const failCount = Number(state?.[provider]?.failure_count || 0) + 1;
  const cooldownSeconds = COOLDOWN_STEPS_SECONDS[Math.min(failCount - 1, COOLDOWN_STEPS_SECONDS.length - 1)];
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
}
function chooseTieWinner(query, winners, priority) {
  const orderedWinners = priority.filter((provider) => winners.includes(provider));
  const candidates = orderedWinners.length ? orderedWinners : [...winners].sort();
  if (candidates.length <= 1) return candidates[0];
  const digest = sha256(`${query}|${candidates.join("|")}`);
  const idx = parseInt(digest.slice(0, 8), 16) % candidates.length;
  return candidates[idx];
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
  const orderedProviders = orderProvidersByPreference(autoProviders.length ? autoProviders : availableProviders, routingConfig);
  const analyzer = new QueryAnalyzer();
  const analysis = analyzer.route(query, orderedProviders);
  let provider = analysis.provider;
  let reason = analysis.reason;
  if (analysis.confidence < routingConfig.confidence_threshold) {
    const lowConfidenceProvider = pickStrictDefaultProvider(availableProviders, routingConfig) || orderedProviders[0];
    if (lowConfidenceProvider && lowConfidenceProvider !== provider) {
      provider = lowConfidenceProvider;
      reason = pickStrictDefaultProvider(availableProviders, routingConfig) ? "below_confidence_threshold_default_provider" : "below_confidence_threshold_priority_provider";
    }
  }
  return {
    provider,
    routing: {
      requested_provider: "auto",
      auto_routed: true,
      provider,
      confidence_level: analysis.confidence >= routingConfig.confidence_threshold ? analysis.confidence_level : "low",
      reason,
      confidence_threshold: routingConfig.confidence_threshold,
      exa_depth: analysis.exa_depth,
      routing_policy: analysis.routing_policy,
      language_hint: analysis.analysis_summary?.language_hint,
      routing_class: analysis.analysis_summary?.routing_class,
      scores: analysis.scores,
      auto_allow_excluded: autoExcluded
    }
  };
}
function buildAutoFallbackOrder(primary, availableProviders, routingConfig) {
  const ordered = orderProvidersByPreference(availableProviders, routingConfig);
  const unique = [primary];
  const seen = new Set(unique);
  if (isProviderUsable(routingConfig.fallback_provider, availableProviders, routingConfig.disabled_providers) && !seen.has(routingConfig.fallback_provider)) {
    unique.push(routingConfig.fallback_provider);
    seen.add(routingConfig.fallback_provider);
  }
  for (const provider of ordered) {
    if (!seen.has(provider)) {
      unique.push(provider);
      seen.add(provider);
    }
  }
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
    perplexity: runtimeConfig.perplexityApiKey,
    "kilo-perplexity": runtimeConfig.kilocodeApiKey,
    you: runtimeConfig.youApiKey,
    searxng: runtimeConfig.searxngInstanceUrl,
    parallel: runtimeConfig.parallelApiKey,
    serpbase: runtimeConfig.serpbaseApiKey,
    keenable: runtimeConfig.keenableApiKey || KEENABLE_PUBLIC_SENTINEL
  };
  return keyMap[provider];
}
function validateApiKey(provider, runtimeConfig) {
  const key = getApiKey(provider, runtimeConfig);
  if (!key) {
    if (provider === "searxng") throw new ProviderConfigError("Missing SearXNG instance URL (pluginConfig.searxngInstanceUrl)");
    if (provider === "perplexity") throw new ProviderConfigError("Missing API key for perplexity (PERPLEXITY_API_KEY or pluginConfig.perplexityApiKey)");
    if (provider === "kilo-perplexity") throw new ProviderConfigError("Missing API key for kilo-perplexity (KILOCODE_API_KEY or pluginConfig.kilocodeApiKey)");
    throw new ProviderConfigError(`Missing API key for ${provider}`);
  }
  return key;
}
function toTimeRange(value) {
  return value && ["hour", "day", "week", "month", "year"].includes(value) ? value : void 0;
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
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "User-Agent": "ClawdBot-WebSearchPlus/3.0",
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
      throw new ProviderRequestError(`${detail} (HTTP ${res.status})`, res.status, TRANSIENT_HTTP_CODES.has(res.status));
    }
    return data ?? {};
  } catch (error2) {
    if (error2?.name === "AbortError") throw new ProviderRequestError(`Request timed out after ${timeoutMs}ms`, void 0, true);
    if (error2 instanceof ProviderRequestError) throw error2;
    throw new ProviderRequestError(`Network error: ${String(error2?.message || error2)}`, void 0, true);
  } finally {
    clearTimeout(timer);
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
    const records = await dns.lookup(u.hostname, { all: true, verbatim: true }).catch(() => []);
    if (!records.length && net.isIP(u.hostname)) records.push({ address: u.hostname, family: net.isIP(u.hostname) });
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
var DIRECT_ANSWER_SIGNALS = {
  "\\bwhat is\\b": 3,
  "\\bwhat are\\b": 2.5,
  "\\bcurrent status\\b": 4,
  "\\bstatus of\\b": 3.5,
  "\\bstatus\\b": 2.5,
  "\\bwhat happened with\\b": 4,
  "\\bwhat'?s happening with\\b": 4,
  "\\bas of (today|now)\\b": 4,
  "\\bthis weekend\\b": 3.5,
  "\\bevents? in\\b": 3.5,
  "\\bthings to do in\\b": 4,
  "\\bnear me\\b": 3,
  "\\bcan you (tell me|summarize|explain)\\b": 3.5,
  "\\bwann\\b": 3,
  "\\bwer\\b": 3,
  "\\bwo\\b": 2.5,
  "\\bwie viele\\b": 3
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
    else if (routingClass === "oss-discovery") boost("exa", 6, "similar-page discovery");
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
    const direct = this.calculateSignalScore(query, DIRECT_ANSWER_SIGNALS);
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
      perplexity: direct.total + localNews.total * 0.4 + recency.score * 0.55,
      "kilo-perplexity": direct.total + localNews.total * 0.4 + recency.score * 0.55,
      you: rag.total + recency.score * 0.25,
      searxng: privacy.total
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
      perplexity: direct.matches,
      "kilo-perplexity": direct.matches,
      you: rag.matches,
      searxng: privacy.matches
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
  route(query, availableProviders) {
    const analysis = this.analyze(query);
    const scores = analysis.provider_scores;
    const available = Object.fromEntries(availableProviders.map((p) => [p, scores[p] ?? 0]));
    const providers = Object.keys(available);
    if (!providers.length) {
      return { provider: "serper", confidence: 0, confidence_level: "low", reason: "no_available_providers", scores: {}, top_signals: [], exa_depth: "normal" };
    }
    const maxScore = Math.max(...providers.map((p) => available[p]));
    const winners = providers.filter((p) => available[p] === maxScore);
    const priority = [...DEFAULT_PROVIDER_PRIORITY];
    const braveSerperCandidates = ["brave", "serper"].filter((p) => providers.includes(p) && maxScore - (available[p] || 0) <= 0.5);
    const winner = braveSerperCandidates.length > 0 && maxScore <= 6.5 ? chooseTieWinner(query, braveSerperCandidates, ["brave", "serper"]) : chooseTieWinner(query, winners, priority);
    const secondBest = [...providers.map((p) => available[p])].sort((a, b) => b - a)[1] || 0;
    const margin = maxScore > 0 ? (maxScore - secondBest) / maxScore : 0;
    const normalizedScore = Math.min(maxScore / 15, 1);
    const confidence = maxScore === 0 ? 0 : Number((normalizedScore * 0.6 + margin * 0.4).toFixed(3));
    let exaDepth = "normal";
    if (winner === "exa") {
      if ((analysis.exa_deep_reasoning_score || 0) >= 4) exaDepth = "deep-reasoning";
      else if ((analysis.exa_deep_score || 0) >= 4) exaDepth = "deep";
    }
    return {
      provider: winner,
      confidence,
      confidence_level: confidence >= 0.7 ? "high" : confidence >= 0.4 ? "medium" : "low",
      reason: maxScore === 0 ? "no_signals_matched" : confidence >= 0.7 ? "high_confidence_match" : confidence >= 0.4 ? "moderate_confidence_match" : "low_confidence_match",
      exa_depth: exaDepth,
      scores: Object.fromEntries(providers.map((p) => [p, Number((available[p] || 0).toFixed(2))])),
      top_signals: (analysis.provider_matches[winner] || []).sort((a, b) => b.weight - a.weight).slice(0, 5).map((s) => ({ matched: s.matched, weight: s.weight })),
      routing_policy: "routing-v2",
      analysis_summary: {
        language_hint: analysis.language_hint,
        routing_class: analysis.routing_class,
        answer_mode_recommended: analysis.routing_class === "answer/synthesis",
        query_length: query.trim().split(/\s+/).filter(Boolean).length,
        is_complex: analysis.complexity.is_complex,
        has_url: !!analysis.detected_url,
        recency_focused: analysis.recency_focused
      }
    };
  }
};
async function searchSerper(query, apiKey, maxResults, timeRange) {
  const body = { q: query, gl: "us", hl: "en", num: maxResults, autocorrect: true };
  const tbsMap = { day: "qdr:d", week: "qdr:w", month: "qdr:m", year: "qdr:y" };
  if (timeRange && tbsMap[timeRange]) body.tbs = tbsMap[timeRange];
  const data = await httpJson("https://google.serper.dev/search", { method: "POST", headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const results = (data.organic || []).slice(0, maxResults).map((item, i) => ({ title: item.title || "", url: item.link || "", snippet: item.snippet || "", score: Number((1 - i * 0.1).toFixed(2)), date: item.date }));
  const answer = data?.answerBox?.answer || data?.answerBox?.snippet || data?.knowledgeGraph?.description || results[0]?.snippet || "";
  return { provider: "serper", query, results, images: [], answer, knowledge_graph: data.knowledgeGraph, related_searches: (data.relatedSearches || []).map((r) => r.query) };
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
  const answer = data?.summary || data?.infobox?.description || results[0]?.snippet || "";
  return { provider: "brave", query, results, images: [], answer, mixed: data?.mixed };
}
async function searchTavily(query, apiKey, maxResults, includeDomains, excludeDomains) {
  const body = { api_key: apiKey, query, max_results: maxResults, search_depth: "basic", topic: "general", include_images: false, include_answer: true, include_raw_content: false };
  if (includeDomains?.length) body.include_domains = includeDomains;
  if (excludeDomains?.length) body.exclude_domains = excludeDomains;
  const data = await httpJson("https://api.tavily.com/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const results = (data.results || []).slice(0, maxResults).map((item) => ({ title: item.title || "", url: item.url || "", snippet: item.content || "", score: Number((item.score || 0).toFixed(3)) }));
  return { provider: "tavily", query, results, images: data.images || [], answer: data.answer || "" };
}
async function searchLinkup(query, apiKey, maxResults, includeDomains, excludeDomains) {
  const body = { q: query, depth: "standard", outputType: "searchResults" };
  if (includeDomains?.length) body.includeDomains = includeDomains.slice(0, 50);
  if (excludeDomains?.length) body.excludeDomains = excludeDomains.slice(0, 50);
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
  return { provider: "linkup", query, results, images: data.images || [], answer: data.answer || "", metadata: { depth: body.depth, output_type: body.outputType } };
}
async function searchQuerit(query, apiKey, maxResults, timeRange, includeDomains, excludeDomains) {
  const timeMap = { day: "d1", week: "w1", month: "m1", year: "y1" };
  const filters = { languages: { include: ["en"] }, geo: { countries: { include: ["US"] } } };
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
  return { provider: "querit", query, results, images: [], answer: results[0]?.snippet || "", metadata: { search_id: data.search_id, time_range: timeRange && timeMap[timeRange] } };
}
async function searchExa(query, apiKey, maxResults, exaDepth, includeDomains, excludeDomains) {
  const isDeep = exaDepth === "deep" || exaDepth === "deep-reasoning";
  const body = isDeep ? { query, numResults: maxResults, type: exaDepth, contents: { text: { maxCharacters: 5e3, verbosity: "full" } } } : { query, numResults: maxResults, type: "neural", contents: { text: { maxCharacters: 2e3, verbosity: "standard" }, highlights: { numSentences: 3, highlightsPerUrl: 2 } } };
  if (includeDomains?.length) body.includeDomains = includeDomains;
  if (excludeDomains?.length) body.excludeDomains = excludeDomains;
  const data = await httpJson("https://api.exa.ai/search", { method: "POST", headers: { "x-api-key": apiKey, "Content-Type": "application/json" }, body: JSON.stringify(body) }, isDeep ? 55e3 : 3e4);
  if (isDeep) {
    const deepOutput = data.output || {};
    const synthesis = typeof deepOutput.content === "string" ? deepOutput.content : deepOutput.content ? JSON.stringify(deepOutput.content) : "";
    const grounding = [];
    for (const field of deepOutput.grounding || []) {
      for (const cite of field.citations || []) grounding.push({ url: cite.url || "", title: cite.title || "", confidence: field.confidence, field: field.field });
    }
    const results2 = [];
    if (synthesis) results2.push({ title: `Exa ${exaDepth.replace(/-/g, " ")} synthesis`, url: "", snippet: synthesis, full_synthesis: synthesis, score: 1, grounding: grounding.slice(0, 10), type: "synthesis" });
    for (const item of (data.results || []).slice(0, maxResults)) {
      const snippet = item.text ? String(item.text).slice(0, 800) : (item.highlights || [])[0] || "";
      results2.push({ title: item.title || "", url: item.url || "", snippet, score: Number((item.score || 0).toFixed(3)), published_date: item.publishedDate, author: item.author, type: "source" });
    }
    return { provider: "exa", query, exa_depth: exaDepth, results: results2, images: [], answer: synthesis || results2[1]?.snippet || "", grounding, metadata: { synthesis_length: synthesis.length, source_count: (data.results || []).length } };
  }
  const results = (data.results || []).slice(0, maxResults).map((item) => ({ title: item.title || "", url: item.url || "", snippet: item.text ? String(item.text).slice(0, 800) : Array.isArray(item.highlights) ? item.highlights.slice(0, 2).join(" ... ") : "", score: Number((item.score || 0).toFixed(3)), published_date: item.publishedDate, author: item.author }));
  return { provider: "exa", query, results, images: [], answer: results[0]?.snippet || "" };
}
function mapFirecrawlTimeRange(timeRange) {
  const tbsMap = { hour: "qdr:h", day: "qdr:d", week: "qdr:w", month: "qdr:m", year: "qdr:y" };
  return timeRange ? tbsMap[timeRange] || timeRange : void 0;
}
async function searchFirecrawl(query, apiKey, maxResults, timeRange, includeDomains, excludeDomains) {
  const body = { query, limit: maxResults, sources: ["web"], timeout: 3e4, ignoreInvalidURLs: false, country: "US" };
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
  return { provider: "firecrawl", query, results, images, answer: results[0]?.snippet || "", warning: data.warning, credits_used: data.creditsUsed, metadata: { id: data.id, sources: body.sources, tbs } };
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
async function searchSerpBase(query, apiKey, maxResults, timeRange) {
  const url = new URL("https://api.serpbase.com/search");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("q", query);
  url.searchParams.set("num", String(maxResults));
  if (timeRange) url.searchParams.set("time_range", timeRange);
  const data = await httpJson(url.toString(), { method: "GET", headers: { Accept: "application/json" } });
  if (data?.status != null && Number(data.status) !== 0) {
    throw new ProviderRequestError(String(data?.error || data?.message || `SerpBase request failed with status=${data.status}`));
  }
  const organic = data.organic_results || data.organic || data.results || [];
  const results = organic.slice(0, maxResults).map((item, i) => ({
    title: item.title || "",
    url: stripTrackingParams(item.link || item.url || ""),
    snippet: item.snippet || item.description || "",
    score: Number((1 - i * 0.05).toFixed(3)),
    position: item.position
  }));
  return { provider: "serpbase", query, results, images: [], answer: data?.answer_box?.answer || data?.knowledge_graph?.description || results[0]?.snippet || "", knowledge_graph: data?.knowledge_graph, related_searches: (data.related_searches || []).map((r) => typeof r === "string" ? r : r.query).filter(Boolean), metadata: { session_id: data.session_id } };
}
async function searchParallel(query, apiKey, maxResults, includeDomains, excludeDomains) {
  const searchQuery = [query, ...(includeDomains || []).map((domain) => `site:${domain}`), ...(excludeDomains || []).map((domain) => `-site:${domain}`)].join(" ").trim();
  const data = await httpJson("https://api.parallel.ai/v1beta/search", {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ objective: query, search_queries: [searchQuery] })
  }, 3e4);
  const raw = data.results || data.search_results || data.data || [];
  const results = raw.slice(0, maxResults).map((item, i) => {
    const excerpts = Array.isArray(item.excerpts) ? item.excerpts : Array.isArray(item.snippets) ? item.snippets : [];
    return { title: item.title || titleFromUrl2(item.url || ""), url: item.url || item.link || "", snippet: excerpts.length ? excerpts.join(" ... ") : item.snippet || item.description || "", score: Number((1 - i * 0.05).toFixed(3)) };
  });
  return { provider: "parallel", query, results, images: [], answer: results[0]?.snippet || "", metadata: { search_id: data.search_id, session_id: data.session_id } };
}
async function searchPerplexityCompatible(provider, query, apiKey, maxResults, timeRange) {
  const body = {
    model: provider === "perplexity" ? "sonar-pro" : "perplexity/sonar-pro",
    messages: [
      { role: "system", content: "Answer with concise factual summary and include source URLs." },
      { role: "user", content: query }
    ],
    temperature: 0.2
  };
  if (timeRange) body.search_recency_filter = timeRange;
  const url = provider === "perplexity" ? "https://api.perplexity.ai/chat/completions" : "https://api.kilo.ai/api/gateway/chat/completions";
  const data = await httpJson(url, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const answer = String(data?.choices?.[0]?.message?.content || "").trim();
  let citations = Array.isArray(data?.citations) ? data.citations : [];
  if (!citations.length) {
    const matches = answer.match(/https?:\/\/[^\s)\]}>"']+/g) || [];
    citations = [...new Set(matches)];
  }
  const results = [];
  const answerTitle = provider === "perplexity" ? "Perplexity Answer" : "Kilo Perplexity Answer";
  if (answer) results.push({ title: `${answerTitle}: ${query.slice(0, 80)}`, url: "https://www.perplexity.ai", snippet: answer.replace(/\[\d+\]/g, "").trim().slice(0, 500), score: 1 });
  for (const [i, citation] of citations.slice(0, Math.max(0, maxResults - 1)).entries()) {
    const url2 = typeof citation === "string" ? citation : citation?.url || "";
    const title = typeof citation === "string" ? titleFromUrl2(url2) : citation?.title || titleFromUrl2(url2);
    results.push({ title, url: url2, snippet: `Source cited in Perplexity answer [citation ${i + 1}]`, score: Number((0.9 - i * 0.1).toFixed(3)) });
  }
  return { provider, query, results, images: [], answer, metadata: { model: body.model, usage: data.usage || {} } };
}
async function searchPerplexity(query, apiKey, maxResults, timeRange) {
  return searchPerplexityCompatible("perplexity", query, apiKey, maxResults, timeRange);
}
async function searchKiloPerplexity(query, apiKey, maxResults, timeRange) {
  return searchPerplexityCompatible("kilo-perplexity", query, apiKey, maxResults, timeRange);
}
async function searchYou(query, apiKey, maxResults, timeRange) {
  const url = new URL("https://ydc-index.io/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("count", String(maxResults));
  url.searchParams.set("safesearch", "moderate");
  url.searchParams.set("country", "US");
  url.searchParams.set("language", "EN");
  if (timeRange) url.searchParams.set("freshness", timeRange);
  const data = await httpJson(url.toString(), { method: "GET", headers: { "X-API-KEY": apiKey, Accept: "application/json" } });
  const web = data?.results?.web || [];
  const news = data?.results?.news || [];
  const results = web.slice(0, maxResults).map((item, i) => ({ title: item.title || "", url: item.url || "", snippet: item?.snippets?.[0] || item.description || "", score: Number((1 - i * 0.05).toFixed(3)), date: item.page_age, source: "web", additional_snippets: Array.isArray(item.snippets) ? item.snippets.slice(1, 3) : void 0, thumbnail: item.thumbnail_url, favicon: item.favicon_url }));
  const answer = results.slice(0, 3).map((r) => r.snippet).filter(Boolean).join(" ").slice(0, 1e3);
  return { provider: "you", query, results, news: news.slice(0, 5), images: [], answer, metadata: { search_uuid: data?.metadata?.search_uuid, latency: data?.metadata?.latency } };
}
async function searchSearxng(query, instanceUrl, maxResults, timeRange, runtimeConfig) {
  const base = await validateSearxngUrl(instanceUrl, runtimeConfig);
  const url = new URL(`${base}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("language", "en");
  url.searchParams.set("safesearch", "0");
  if (timeRange) url.searchParams.set("time_range", timeRange);
  const data = await httpJson(url.toString(), { method: "GET", headers: { Accept: "application/json" } });
  const enginesUsed = /* @__PURE__ */ new Set();
  const results = (data.results || []).slice(0, maxResults).map((item, i) => {
    enginesUsed.add(item.engine || "unknown");
    return { title: item.title || "", url: item.url || "", snippet: item.content || "", score: Number((item.score ?? 1 - i * 0.05).toFixed(3)), engine: item.engine || "unknown", category: item.category || "general", date: item.publishedDate };
  });
  const answer = Array.isArray(data.answers) && data.answers[0] ? String(data.answers[0]) : Array.isArray(data.infoboxes) && data.infoboxes[0] ? String(data.infoboxes[0].content || data.infoboxes[0].infobox || "") : results[0]?.snippet || "";
  return { provider: "searxng", query, results, images: [], answer, suggestions: data.suggestions || [], corrections: data.corrections || [], metadata: { number_of_results: data.number_of_results, engines_used: [...enginesUsed], instance_url: base } };
}
var KEENABLE_TIME_RANGE = { hour: "1h", day: "1d", week: "7d", month: "1mo", year: "1y" };
async function searchKeenable(query, apiKey, maxResults, timeRange, includeDomains) {
  const authenticated = apiKey !== KEENABLE_PUBLIC_SENTINEL;
  const url = `https://api.keenable.ai/v1/search${authenticated ? "" : "/public"}`;
  const body = { query };
  if (timeRange && KEENABLE_TIME_RANGE[timeRange]) body.published_after = KEENABLE_TIME_RANGE[timeRange];
  if (includeDomains?.length) body.site = includeDomains[0];
  const data = await httpJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Keenable-Title": "openclaw-web-search-plus", ...authenticated ? { "X-API-Key": apiKey } : {} },
    body: JSON.stringify(body)
  });
  const results = (data.results || []).slice(0, maxResults).map((item) => ({
    title: item.title || titleFromUrl2(item.url || ""),
    url: item.url || "",
    snippet: item.snippet || item.description || "",
    published_at: item.published_at,
    acquired_at: item.acquired_at
  }));
  return { provider: "keenable", query, results, images: [], answer: results[0]?.snippet || "" };
}
function computeRetryDelayMs(attempt) {
  const base = RETRY_BACKOFF_MS[Math.min(attempt, RETRY_BACKOFF_MS.length - 1)];
  return base + Math.random() * base * RETRY_JITTER_FRACTION;
}
async function executeWithRetry(fn) {
  let lastError;
  for (let attempt = 0; attempt < RETRY_BACKOFF_MS.length; attempt += 1) {
    try {
      return await fn();
    } catch (error2) {
      lastError = error2;
      if (!(error2 instanceof ProviderRequestError) || !error2.transient || error2.statusCode === 401 || error2.statusCode === 403) break;
      if (attempt < RETRY_BACKOFF_MS.length - 1) await sleep(computeRetryDelayMs(attempt));
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
    routing_decision: { provider: result.provider, requested_provider: routingInfo.requested_provider, routing_policy: routingInfo.routing_policy || "routing-v2", routing_class: routingInfo.routing_class, language_hint: routingInfo.language_hint, confidence_level: routingInfo.confidence_level, reason: routingInfo.reason, scores: routingInfo.scores || {} },
    result_quality: { result_count: results.length, domain_count: domains.length, domains, domain_diversity: results.length ? Number((domains.length / results.length).toFixed(3)) : 0, thin_snippet_count: thinSnippetCount, dedup_count: dedupCount },
    fallback_chain: { providers_considered: providersConsidered, provider_errors: errors, cooldown_skips: cooldownSkips },
    extract_recommended: extractReasons.length > 0,
    extract_reasons: extractReasons,
    authority_signals: routingClass ? buildAuthoritySignals(routingClass, results) : null
  };
}
async function executeSearch(runtimeConfig, params, pluginConfig = {}) {
  try {
    const query = String(params.query || "").trim();
    if (!query) return { ok: false, payload: { error: "Search failed: query is required" } };
    const count = Math.max(1, Math.min(10, Math.floor(Number(params.count || 5))));
    const requestedProvider = normalizeRequestedProvider(params.provider);
    const timeRange = toTimeRange(params.time_range);
    const includeDomains = Array.isArray(params.include_domains) ? params.include_domains.filter(Boolean) : void 0;
    const excludeDomains = Array.isArray(params.exclude_domains) ? params.exclude_domains.filter(Boolean) : void 0;
    const routingConfigResult = loadRoutingPreferences(pluginConfig);
    const routingConfig = routingConfigResult.config;
    const configuredProviders = ALL_PROVIDERS.filter((p) => !!getApiKey(p, runtimeConfig));
    const enabledProviders = configuredProviders.filter((provider2) => !routingConfig.disabled_providers.includes(provider2));
    const braveOptions = {
      safesearch: runtimeConfig.braveSafesearch
    };
    let routingInfo = { requested_provider: requestedProvider };
    let provider;
    let strictProviderMode = false;
    let exaDepthHint = "normal";
    if (requestedProvider === "auto") {
      if (!configuredProviders.length) {
        return { ok: false, payload: { error: "Search failed: no search providers are configured" } };
      }
      if (!enabledProviders.length) {
        return { ok: false, payload: { error: "Search failed: all configured providers are disabled in routing preferences" } };
      }
      if (!routingConfig.auto_routing) {
        const strictDefault = pickStrictDefaultProvider(enabledProviders, routingConfig);
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
        exaDepthHint = selection.routing.exa_depth || "normal";
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
    if (provider === "exa" && params.depth) exaDepthHint = params.depth;
    const providersToTry = strictProviderMode ? [provider] : buildAutoFallbackOrder(provider, enabledProviders, routingConfig);
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
      if (p === "serper") return searchSerper(query, key, count, timeRange);
      if (p === "brave") return searchBrave(query, key, count, { ...braveOptions, time_range: timeRange });
      if (p === "tavily") return searchTavily(query, key, count, includeDomains, excludeDomains);
      if (p === "linkup") return searchLinkup(query, key, count, includeDomains, excludeDomains);
      if (p === "querit") return searchQuerit(query, key, count, timeRange, includeDomains, excludeDomains);
      if (p === "exa") {
        const exaDepth = params.depth || exaDepthHint || "normal";
        return searchExa(query, key, count, exaDepth, includeDomains, excludeDomains);
      }
      if (p === "firecrawl") return searchFirecrawl(query, key, count, timeRange, includeDomains, excludeDomains);
      if (p === "parallel") return searchParallel(query, key, count, includeDomains, excludeDomains);
      if (p === "serpbase") return searchSerpBase(query, key, count, timeRange);
      if (p === "perplexity") return searchPerplexity(query, key, count, timeRange);
      if (p === "kilo-perplexity") return searchKiloPerplexity(query, key, count, timeRange);
      if (p === "you") return searchYou(query, key, count, timeRange);
      if (p === "keenable") return searchKeenable(query, key, count, timeRange, includeDomains);
      return searchSearxng(query, key, count, timeRange, runtimeConfig);
    };
    if (params.mode === "research") {
      const providerEligibleForResearch = (p) => !routingConfig.disabled_providers.includes(p) && routingConfig.auto_allow?.[p] !== false && !!getApiKey(p, runtimeConfig) && !providerInCooldown(p).inCooldown;
      const availableResearchProviders = new Set(configuredProviders.filter(providerEligibleForResearch));
      if (getApiKey(provider, runtimeConfig) && !routingConfig.disabled_providers.includes(provider) && !providerInCooldown(provider).inCooldown) {
        availableResearchProviders.add(provider);
      }
      let researchProviders;
      if (Array.isArray(params.research_providers) && params.research_providers.length) {
        researchProviders = [...new Set(params.research_providers.map((value) => normalizeProviderName(value)))].filter(providerEligibleForResearch);
      } else {
        researchProviders = selectResearchProviders(
          provider,
          routingConfig.provider_priority?.length ? routingConfig.provider_priority : DEFAULT_PROVIDER_PRIORITY,
          availableResearchProviders,
          3
        );
      }
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
          } catch (error2) {
            markProviderFailure(p, String(error2?.message || error2));
            throw error2;
          }
        },
        extractUrls: (urls) => extractPlus(urls, "auto", "markdown", false, false, false, runtimeConfig),
        maxResults: count,
        maxExtractUrls: researchExtractCount,
        timeBudgetSeconds: Number.isFinite(researchTimeBudget) && researchTimeBudget > 0 ? researchTimeBudget : null
      });
      routingInfo = { ...routingInfo, mode: "research", provider: "research" };
      if (cooldownSkips.length) routingInfo.cooldown_skips = cooldownSkips;
      if (routingConfigResult.warning) routingInfo.config_warning = routingConfigResult.warning;
      result2.routing = { ...result2.routing, ...routingInfo };
      result2.quality_report = buildQualityReport(result2, routingInfo, result2.routing.provider_errors || [], cooldownSkips, researchProviders);
      return { ok: true, payload: sanitizeOutput(result2) };
    }
    const cacheContext = {
      time_range: timeRange,
      include_domains: includeDomains ? [...includeDomains].sort() : null,
      exclude_domains: excludeDomains ? [...excludeDomains].sort() : null,
      exa_depth: params.depth || exaDepthHint || "normal",
      brave_safesearch: normalizeBraveSafesearch(braveOptions.safesearch),
      routing_preferences: routingConfig
    };
    const cached = cacheGet(query, provider, count, DEFAULT_CACHE_TTL, cacheContext);
    if (cached) {
      const result2 = { ...cached };
      for (const key of Object.keys(result2)) if (key.startsWith("_cache_")) delete result2[key];
      result2.cached = true;
      result2.cache_age_seconds = Math.floor(Date.now() / 1e3 - Number(cached._cache_timestamp || 0));
      result2.routing = { ...routingInfo, ...cooldownSkips.length ? { cooldown_skips: cooldownSkips } : {}, ...routingConfigResult.warning ? { config_warning: routingConfigResult.warning } : {} };
      return { ok: true, payload: sanitizeOutput(result2) };
    }
    const errors = [];
    const successes = [];
    for (const p of eligibleProviders) {
      try {
        const result2 = await executeWithRetry(() => runProvider(p));
        resetProviderHealth(p);
        successes.push([p, result2]);
        if (strictProviderMode || (result2.results || []).length >= count || errors.length === 0) break;
      } catch (error2) {
        const message = sanitizeOutput(String(error2?.message || error2));
        const cooldown = strictProviderMode ? { cooldown_seconds: 0 } : markProviderFailure(p, message);
        errors.push({ provider: p, error: message, ...strictProviderMode ? {} : { cooldown_seconds: cooldown.cooldown_seconds } });
        if (strictProviderMode) break;
      }
    }
    if (!successes.length) {
      return { ok: false, payload: sanitizeOutput({ error: "All providers failed", provider, query, routing: { ...routingInfo, ...cooldownSkips.length ? { cooldown_skips: cooldownSkips } : {}, ...routingConfigResult.warning ? { config_warning: routingConfigResult.warning } : {} }, provider_errors: errors }) };
    }
    let result;
    if (successes.length === 1) {
      result = successes[0][1];
    } else {
      result = { ...successes[0][1] };
      const deduped = deduplicateResultsAcrossProviders(successes, count);
      result.results = deduped.results;
      result.deduplicated = deduped.dedupCount > 0;
      result.metadata = { ...result.metadata || {}, dedup_count: deduped.dedupCount, providers_merged: successes.map(([p]) => p) };
    }
    const successfulProvider = successes[0][0];
    if (!strictProviderMode && successfulProvider !== provider) {
      routingInfo = { ...routingInfo, fallback_used: true, original_provider: provider, provider: successfulProvider };
    }
    if (cooldownSkips.length) routingInfo.cooldown_skips = cooldownSkips;
    if (routingConfigResult.warning) routingInfo.config_warning = routingConfigResult.warning;
    const routingClass = String(routingInfo.routing_class || "general");
    if (Array.isArray(result.results)) {
      const rerank = rerankResultsForIntent(query, routingClass, result.results);
      result.results = rerank.results;
      if (rerank.metadata.reranked) result.metadata = { ...result.metadata || {}, intent_rerank: rerank.metadata };
    }
    result.routing = routingInfo;
    result.cached = false;
    if (!result.metadata) result.metadata = {};
    if (result.deduplicated == null) result.deduplicated = false;
    if (result.metadata.dedup_count == null) result.metadata.dedup_count = 0;
    if (params.quality_report) {
      result.quality_report = buildQualityReport(result, routingInfo, errors, cooldownSkips, providersToTry);
    }
    cachePut(query, successfulProvider, count, result, cacheContext);
    return { ok: true, payload: sanitizeOutput(result) };
  } catch (error2) {
    return { ok: false, payload: { error: `Search failed: ${sanitizeOutput(String(error2?.message || error2))}` } };
  }
}
function routingConfigStatus(loadResult) {
  return sanitizeOutput({
    config_path: loadResult.path,
    source: loadResult.source,
    warning: loadResult.warning,
    quarantine_path: loadResult.quarantine_path,
    config: loadResult.config
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
  if (action === "reset") return sanitizeOutput(resetRoutingPreferences(pluginConfig));
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
  throw new Error(`Unsupported routing config action: ${action}`);
}
function register(api) {
  api.registerTool(
    {
      name: "web_search_plus",
      description: "Search the web with intelligent multi-provider routing across Serper, Brave, Tavily, Linkup, Querit, Exa, Firecrawl, Perplexity, You.com, and SearXNG. Auto-selects the best provider, reranks canonical sources, caches results, retries transient failures, and falls back across providers. mode=research queries multiple providers concurrently and extracts top sources for grounding.",
      parameters: PARAMETERS_SCHEMA,
      async execute(_id, params) {
        try {
          const pluginConfig = api.pluginConfig ?? {};
          const runtimeConfig = getRuntimeConfig(pluginConfig);
          const result = await executeSearch(runtimeConfig, params, pluginConfig);
          if (!result.ok) {
            const failure = result.payload;
            return { content: [{ type: "text", text: JSON.stringify(sanitizeOutput(failure)) }] };
          }
          return { content: [{ type: "text", text: JSON.stringify(sanitizeOutput(result.payload)) }] };
        } catch (error2) {
          return { content: [{ type: "text", text: `Search failed: ${sanitizeOutput(String(error2?.message || error2))}` }] };
        }
      }
    },
    { optional: true }
  );
  api.registerTool(
    {
      name: "web_routing_config_plus",
      description: "Show or update persistent routing preferences for web_search_plus. Keeps routing behavior in a JSON file separate from provider secrets.",
      parameters: ROUTING_CONFIG_PARAMETERS_SCHEMA,
      async execute(_id, params) {
        try {
          const pluginConfig = api.pluginConfig ?? {};
          return { content: [{ type: "text", text: JSON.stringify(executeRoutingConfigAction(pluginConfig, params)) }] };
        } catch (error2) {
          return { content: [{ type: "text", text: JSON.stringify(sanitizeOutput({ error: String(error2?.message || error2) })) }] };
        }
      }
    },
    { optional: true }
  );
  api.registerTool(
    {
      name: "web_extract_plus",
      description: "Extract URL content with automatic fallback across Firecrawl, Linkup, Tavily, Exa, and You.com, with per-URL errors and unified output.",
      parameters: EXTRACT_PARAMETERS_SCHEMA,
      checkFn() {
        const pluginConfig = api.pluginConfig ?? {};
        return hasAnyExtractProviderCredential(getRuntimeConfig(pluginConfig));
      },
      async execute(_id, params) {
        try {
          const pluginConfig = api.pluginConfig ?? {};
          const runtimeConfig = getRuntimeConfig(pluginConfig);
          const result = await extractPlus(
            Array.isArray(params?.urls) ? params.urls : typeof params?.urls === "string" ? [params.urls] : [],
            params?.provider || "auto",
            params?.format === "html" ? "html" : "markdown",
            Boolean(params?.include_images),
            Boolean(params?.include_raw_html),
            Boolean(params?.render_js),
            runtimeConfig
          );
          return { content: [{ type: "text", text: JSON.stringify(sanitizeOutput(result)) }] };
        } catch (error2) {
          return { content: [{ type: "text", text: JSON.stringify(sanitizeOutput({ error: String(error2?.message || error2) })) }] };
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
  register
});
export {
  CANONICAL_DOMAIN_RULES,
  QueryAnalyzer,
  RETRY_JITTER_FRACTION,
  __resetRuntimeStateForTests,
  buildAuthoritySignals,
  buildCacheKey,
  chooseTieWinner,
  computeRetryDelayMs,
  deduplicateResultsAcrossProviders,
  index_default as default,
  register,
  rerankResultsForIntent,
  searchBrave,
  searchKeenable
};
