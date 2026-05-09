// index.ts
import crypto from "crypto";
import path4 from "path";
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

// paths.ts
import path from "path";
import { fileURLToPath } from "url";
function getPluginDir() {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
  }
  return process.cwd();
}

// env.ts
var CONFIG_KEY_MAP = {
  serperApiKey: "SERPER_API_KEY",
  braveApiKey: "BRAVE_API_KEY",
  braveSafesearch: "BRAVE_SAFESEARCH",
  tavilyApiKey: "TAVILY_API_KEY",
  linkupApiKey: "LINKUP_API_KEY",
  queritApiKey: "QUERIT_API_KEY",
  exaApiKey: "EXA_API_KEY",
  firecrawlApiKey: "FIRECRAWL_API_KEY",
  perplexityApiKey: "PERPLEXITY_API_KEY",
  kilocodeApiKey: "KILOCODE_API_KEY",
  youApiKey: "YOU_API_KEY",
  searxngInstanceUrl: "SEARXNG_INSTANCE_URL",
  searxngAllowPrivate: "SEARXNG_ALLOW_PRIVATE",
  enableWebAnswer: "WSP_ENABLE_WEB_ANSWER"
};
function getRuntimeEnv(pluginConfig) {
  const mapped = {};
  for (const [cfgKey, envKey] of Object.entries(CONFIG_KEY_MAP)) {
    const val = pluginConfig?.[cfgKey];
    if (typeof val === "string" && val) mapped[envKey] = val;
    else if (typeof val === "boolean") mapped[envKey] = String(val);
  }
  return mapped;
}

// storage.ts
import fs from "node:fs";
import path2 from "node:path";
function cloneJson(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}
function ensureParentDir(file) {
  fs.mkdirSync(path2.dirname(file), { recursive: true });
}
function readJsonFile(file, fallback) {
  try {
    const text = fs.readFileSync(file, "utf8");
    if (!text.trim()) return cloneJson(fallback);
    return JSON.parse(text);
  } catch {
    return cloneJson(fallback);
  }
}
function writeJsonFile(file, value) {
  ensureParentDir(file);
  const tempFile = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempFile, `${JSON.stringify(cloneJson(value), null, 2)}
`, "utf8");
  fs.renameSync(tempFile, file);
}
function deleteFileIfExists(file) {
  try {
    fs.rmSync(file, { force: true });
  } catch {
  }
}
function readCachedJson(file, ttlSeconds) {
  const cached = readJsonFile(file, null);
  if (!cached) return null;
  const ts = Number(cached._cache_timestamp || 0);
  if (!ts || Date.now() / 1e3 - ts > ttlSeconds) {
    deleteFileIfExists(file);
    return null;
  }
  return cached;
}

// routing-config.ts
import fs2 from "node:fs";
import path3 from "node:path";
var DEFAULT_PROVIDER_PRIORITY = ["tavily", "linkup", "querit", "exa", "firecrawl", "perplexity", "brave", "serper", "you", "searxng"];
var DEFAULT_ROUTING_PREFERENCES = {
  version: 1,
  auto_routing: true,
  default_provider: null,
  provider_priority: [...DEFAULT_PROVIDER_PRIORITY],
  fallback_provider: null,
  disabled_providers: [],
  confidence_threshold: 0.4
};
function cloneDefaults() {
  return {
    ...DEFAULT_ROUTING_PREFERENCES,
    provider_priority: [...DEFAULT_ROUTING_PREFERENCES.provider_priority],
    disabled_providers: [...DEFAULT_ROUTING_PREFERENCES.disabled_providers]
  };
}
function timestamp() {
  return (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
}
function normalizeProviderName(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/_/g, "-");
  if (normalized === "kilo-perplexity") return "perplexity";
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
function normalizeThreshold(value) {
  const threshold = Number(value);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new Error(`Invalid confidence_threshold: ${String(value)}`);
  }
  return Number(threshold.toFixed(3));
}
function atomicWriteJson(file, value) {
  fs2.mkdirSync(path3.dirname(file), { recursive: true });
  const tempFile = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs2.writeFileSync(tempFile, `${JSON.stringify(value, null, 2)}
`, "utf8");
  fs2.renameSync(tempFile, file);
}
function quarantineFile(file) {
  if (!fs2.existsSync(file)) return null;
  const brokenPath = `${file}.broken-${timestamp()}`;
  fs2.mkdirSync(path3.dirname(file), { recursive: true });
  fs2.renameSync(file, brokenPath);
  return brokenPath;
}
function resolveRoutingConfigPath(pluginConfig = {}) {
  const override = pluginConfig?.routingConfigPath || process.env.WSP_ROUTING_CONFIG_PATH;
  return path3.resolve(String(override || path3.join(getPluginDir(), "config", "routing-preferences.json")));
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
  return config;
}
function loadRoutingPreferences(pluginConfig = {}) {
  const file = resolveRoutingConfigPath(pluginConfig);
  if (!fs2.existsSync(file)) {
    return { config: cloneDefaults(), path: file, source: "default" };
  }
  try {
    const text = fs2.readFileSync(file, "utf8");
    const parsed = text.trim() ? JSON.parse(text) : {};
    return { config: validateRoutingPreferences(parsed), path: file, source: "file" };
  } catch (error2) {
    const brokenPath = quarantineFile(file);
    return {
      config: cloneDefaults(),
      path: file,
      source: "default",
      warning: `Routing config reset to defaults after validation failure: ${String(error2?.message || error2)}`,
      quarantine_path: brokenPath || void 0
    };
  }
}
function saveRoutingPreferences(pluginConfig = {}, config) {
  const file = resolveRoutingConfigPath(pluginConfig);
  const validated = validateRoutingPreferences(config);
  atomicWriteJson(file, validated);
  return { config: validated, path: file, source: "file" };
}
function resetRoutingPreferences(pluginConfig = {}) {
  const file = resolveRoutingConfigPath(pluginConfig);
  let backupPath;
  if (fs2.existsSync(file)) {
    backupPath = `${file}.backup-${timestamp()}`;
    fs2.mkdirSync(path3.dirname(file), { recursive: true });
    fs2.copyFileSync(file, backupPath);
  }
  const result = saveRoutingPreferences(pluginConfig, cloneDefaults());
  return { ...result, backup_path: backupPath };
}

// extract.ts
var EXTRACT_PROVIDER_PRIORITY = ["firecrawl", "linkup", "tavily", "exa", "you"];
var EXTRACT_PARAMETERS_SCHEMA = {
  type: "object",
  required: ["urls"],
  properties: {
    urls: { type: "array", items: { type: "string" }, description: "URLs to extract" },
    provider: {
      type: "string",
      enum: ["auto", "firecrawl", "linkup", "tavily", "exa", "you"],
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
function getExtractApiKey(provider, env) {
  const keyMap = {
    firecrawl: env.FIRECRAWL_API_KEY,
    linkup: env.LINKUP_API_KEY,
    tavily: env.TAVILY_API_KEY,
    exa: env.EXA_API_KEY,
    you: env.YOU_API_KEY
  };
  return keyMap[provider];
}
function hasAnyExtractProviderCredential(env) {
  return EXTRACT_PROVIDER_PRIORITY.some((provider) => Boolean(getExtractApiKey(provider, env)));
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
async function extractPlus(urls, provider = "auto", outputFormat = "markdown", includeImages = false, includeRawHtml = false, renderJs = false, env = {}) {
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
    const providerCredential = getExtractApiKey(currentProvider, env);
    if (!providerCredential) {
      errors.push({ provider: currentProvider, error: "missing_api_key" });
      continue;
    }
    try {
      let result;
      if (currentProvider === "firecrawl") {
        result = await extractFirecrawl(cleanedUrls, providerCredential, outputFormat, includeImages, includeRawHtml, renderJs);
      } else if (currentProvider === "linkup") {
        result = await extractLinkup(cleanedUrls, providerCredential, outputFormat, includeImages, includeRawHtml, renderJs);
      } else if (currentProvider === "tavily") {
        result = await extractTavily(cleanedUrls, providerCredential, outputFormat, includeImages, includeRawHtml, renderJs);
      } else if (currentProvider === "exa") {
        result = await extractExa(cleanedUrls, providerCredential, outputFormat, includeImages, includeRawHtml, renderJs);
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

// index.ts
var pluginPathsCache = null;
function getPluginPaths() {
  if (pluginPathsCache) return pluginPathsCache;
  const pluginDir = getPluginDir();
  pluginPathsCache = {
    pluginDir,
    cacheDir: path4.join(pluginDir, ".cache"),
    providerHealthFile: path4.join(pluginDir, ".cache", "provider_health.json")
  };
  return pluginPathsCache;
}
var DEFAULT_CACHE_TTL = 3600;
var RETRY_BACKOFF_MS = [1e3, 3e3, 9e3];
var COOLDOWN_STEPS_SECONDS = [60, 300, 1500, 3600];
var TRANSIENT_HTTP_CODES = /* @__PURE__ */ new Set([408, 425, 429, 500, 502, 503, 504]);
var SEARCH_PROVIDER_ENUM = ["serper", "brave", "tavily", "linkup", "querit", "exa", "firecrawl", "perplexity", "you", "searxng", "kilo-perplexity", "kilo_perplexity", "auto"];
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
    }
  }
};
var ANSWER_PARAMETERS_SCHEMA = {
  type: "object",
  required: ["query"],
  properties: {
    query: { type: "string", description: "Question or topic to answer from the web." },
    mode: {
      type: "string",
      enum: ["quick", "deep"],
      default: "quick",
      description: "quick = fast synthesis from a few sources; deep = broader cited synthesis with a slightly larger search pass."
    },
    sources: {
      type: "number",
      default: 3,
      minimum: 1,
      maximum: 10,
      description: "Number of citation-ready sources to return."
    },
    freshness: {
      type: "string",
      enum: ["none", "auto", "day", "week", "month", "year"],
      default: "none",
      description: "Optional recency control. Default none avoids accidental stale/current overfitting; set auto/day/week/month/year explicitly when needed."
    },
    output: {
      type: "string",
      enum: ["answer", "brief", "sources", "json"],
      default: "answer",
      description: "Return a markdown answer, short brief, sources-only list, or structured JSON."
    },
    max_extracts: {
      type: "number",
      minimum: 0,
      maximum: 5,
      description: "Advanced: number of top URLs to extract. Default 2, hard-capped at 5 for cost safety."
    }
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
var ALL_PROVIDERS = ["serper", "brave", "tavily", "linkup", "querit", "exa", "firecrawl", "perplexity", "you", "searxng"];
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
function getCachePath(cacheKey) {
  return path4.join(getPluginPaths().cacheDir, `${cacheKey}.json`);
}
function cacheGet(query, provider, maxResults, ttl, params) {
  const key = buildCacheKey(query, provider, maxResults, params);
  const file = getCachePath(key);
  return readCachedJson(file, ttl);
}
function cachePut(query, provider, maxResults, result, params) {
  const key = buildCacheKey(query, provider, maxResults, params);
  const file = getCachePath(key);
  const sanitizedResult = sanitizeOutput(result);
  const payload = {
    ...sanitizedResult,
    _cache_timestamp: Math.floor(Date.now() / 1e3),
    _cache_key: key,
    _cache_query: query,
    _cache_provider: provider,
    _cache_max_results: maxResults,
    _cache_params: sanitizeOutput(params || {})
  };
  writeJsonFile(file, payload);
}
function loadProviderHealth() {
  return readJsonFile(getPluginPaths().providerHealthFile, {});
}
function saveProviderHealth(state) {
  writeJsonFile(getPluginPaths().providerHealthFile, state);
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
  const orderedProviders = orderProvidersByPreference(availableProviders, routingConfig);
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
      exa_depth: analysis.exa_depth
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
function getApiKey(provider, env) {
  const keyMap = {
    serper: env.SERPER_API_KEY,
    brave: env.BRAVE_API_KEY,
    tavily: env.TAVILY_API_KEY,
    querit: env.QUERIT_API_KEY,
    exa: env.EXA_API_KEY,
    linkup: env.LINKUP_API_KEY,
    firecrawl: env.FIRECRAWL_API_KEY,
    perplexity: env.KILOCODE_API_KEY || env.PERPLEXITY_API_KEY,
    you: env.YOU_API_KEY,
    searxng: env.SEARXNG_INSTANCE_URL
  };
  return keyMap[provider];
}
function validateApiKey(provider, env) {
  const key = getApiKey(provider, env);
  if (!key) {
    if (provider === "searxng") throw new ProviderConfigError("Missing SearXNG instance URL (SEARXNG_INSTANCE_URL or pluginConfig.searxngInstanceUrl)");
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
function domainFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "unknown";
  }
}
function inferSourceType(url) {
  const domain = domainFromUrl(url);
  if (["docs", "developer", "support", "help"].some((part) => domain.includes(part))) return "docs";
  if (["wikipedia.org", "britannica.com"].some((part) => domain.includes(part))) return "reference";
  if (["github.com", "gitlab.com"].some((part) => domain.includes(part))) return "code";
  if (["reuters.com", "apnews.com", "bbc.com", "nytimes.com", "wsj.com"].some((part) => domain.includes(part))) return "news";
  return "web";
}
function normalizeAnswerFreshness(query, requested = "none") {
  const value = requested || "none";
  if (value !== "auto") {
    return {
      requested: value,
      applied: value === "none" ? "none" : value,
      reason: value === "none" ? "default freshness disabled" : "explicit freshness requested"
    };
  }
  const q = query.toLowerCase();
  const dayTerms = ["today", "right now", "breaking", "now", "heute", "gerade", "aktuell"];
  const weekTerms = ["latest", "this week", "past week", "recent", "news", "updates", "new", "neueste", "diese woche", "nachrichten"];
  const monthTerms = ["this month", "past month", "dieser monat", "letzter monat"];
  if (dayTerms.some((term) => q.includes(term))) return { requested: value, applied: "day", reason: "query looked time-sensitive" };
  if (weekTerms.some((term) => q.includes(term)) || /\b20[2-9][0-9]\b/.test(q)) return { requested: value, applied: "week", reason: "query looked time-sensitive" };
  if (monthTerms.some((term) => q.includes(term))) return { requested: value, applied: "month", reason: "query looked time-sensitive" };
  return { requested: value, applied: "none", reason: "no freshness signals detected" };
}
function preferredAnswerExtractProvider(env) {
  if ((env.LINKUP_API_KEY || "").trim()) return "linkup";
  if (hasAnyExtractProviderCredential(env)) return "auto";
  return null;
}
function cleanAnswerEvidence(input) {
  return String(input || "").replace(/!\[[^\]]*\]\(data:[^)]+\)/gi, " ").replace(/\[Reload\]\([^)]*\)/gi, " ").replace(/skip to content/gi, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}
function normalizeAnswerSources(results, provider, limit = 3) {
  return results.slice(0, limit).map((item) => {
    const url = String(item.url || "");
    const domain = domainFromUrl(url);
    const publishedDate = item.date || item.published_date || item.age || null;
    const title = String(item.title || titleFromUrl2(url));
    return {
      title,
      domain,
      url,
      published_date: publishedDate,
      source_type: inferSourceType(url),
      provider: item.provider || provider || null,
      extracted_status: "not_requested",
      used_in_answer: true,
      citation: `[${title} (${domain}${publishedDate ? `, ${publishedDate}` : ""})](${url})`,
      snippet: cleanAnswerEvidence(String(item.snippet || ""))
    };
  });
}
function buildAnswerText(query, sources, warnings, snippetOnly) {
  const intro = snippetOnly ? `Snippet-backed brief for: ${query}` : `Source-backed brief for: ${query}`;
  const bullets = sources.map((source, index) => `- [${index + 1}] ${source.title} \u2014 ${source.evidence || source.snippet || "No usable evidence captured."}`).join("\n");
  const warningText = warnings.length ? `

Warnings:
${warnings.map((item) => `- ${item}`).join("\n")}` : "";
  const citations = sources.length ? `

Citations:
${sources.map((source) => `- ${source.citation}`).join("\n")}` : "";
  return `${intro}

${bullets || "- No sources found."}${warningText}${citations}`.trim();
}
function formatAnswerBrief(payload) {
  const warnings = Array.isArray(payload.warnings) && payload.warnings.length ? `
**Warnings:**
${payload.warnings.map((item) => `- ${item}`).join("\n")}` : "";
  return `**Answer**
${payload.answer}

**Freshness:** ${payload.freshness?.applied || "none"}${warnings}`.trim();
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
async function validateSearxngUrl(input, env) {
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
  const allowPrivate = ["1", "true", "yes"].includes(String(env.SEARXNG_ALLOW_PRIVATE || "").trim().toLowerCase());
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
    return {
      detected_url: detectedUrl,
      complexity,
      recency_focused: recency.is_recency_focused,
      recency_score: recency.score,
      linkup_source_score: linkupSource.total,
      exa_deep_score: exaDeep.total,
      exa_deep_reasoning_score: exaDeepReasoning.total,
      provider_scores: {
        serper: shopping.total + localNews.total + recency.score * 0.35,
        brave: shopping.total + localNews.total + recency.score * 0.35,
        tavily: research.total + (complexity.is_complex ? 0 : complexity.complexity_score) + recency.score * 0.2,
        linkup: linkupSource.total + rag.total * 0.7 + research.total * 0.45 + recency.score * 0.35,
        querit: research.total * 0.65 + rag.total * 0.35 + recency.score * 0.45,
        exa: discovery.total + (/(\bsimilar|alternatives?|examples?)\b/i.test(query) ? 1 : 0) + exaDeep.total * 0.5 + exaDeepReasoning.total * 0.5,
        firecrawl: discovery.total + research.total * 0.35 + recency.score * 0.25,
        perplexity: direct.total + localNews.total * 0.4 + recency.score * 0.55,
        you: rag.total + recency.score * 0.25,
        searxng: privacy.total
      },
      provider_matches: {
        serper: [...shopping.matches, ...localNews.matches],
        brave: [...shopping.matches, ...localNews.matches],
        tavily: research.matches,
        linkup: [...linkupSource.matches, ...rag.matches, ...research.matches],
        querit: research.matches,
        exa: [...discovery.matches, ...exaDeep.matches, ...exaDeepReasoning.matches],
        firecrawl: [...discovery.matches, ...research.matches],
        perplexity: direct.matches,
        you: rag.matches,
        searxng: privacy.matches
      }
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
      analysis_summary: {
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
async function searchPerplexity(query, apiKey, maxResults, timeRange) {
  const body = {
    model: "perplexity/sonar-pro",
    messages: [
      { role: "system", content: "Answer with concise factual summary and include source URLs." },
      { role: "user", content: query }
    ],
    temperature: 0.2
  };
  if (timeRange) body.search_recency_filter = timeRange;
  const data = await httpJson("https://api.kilo.ai/api/gateway/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const answer = String(data?.choices?.[0]?.message?.content || "").trim();
  let citations = Array.isArray(data?.citations) ? data.citations : [];
  if (!citations.length) {
    const matches = answer.match(/https?:\/\/[^\s)\]}>"']+/g) || [];
    citations = [...new Set(matches)];
  }
  const results = [];
  if (answer) results.push({ title: `Perplexity Answer: ${query.slice(0, 80)}`, url: "https://www.perplexity.ai", snippet: answer.replace(/\[\d+\]/g, "").trim().slice(0, 500), score: 1 });
  for (const [i, citation] of citations.slice(0, Math.max(0, maxResults - 1)).entries()) {
    const url = typeof citation === "string" ? citation : citation?.url || "";
    const title = typeof citation === "string" ? titleFromUrl2(url) : citation?.title || titleFromUrl2(url);
    results.push({ title, url, snippet: `Source cited in Perplexity answer [citation ${i + 1}]`, score: Number((0.9 - i * 0.1).toFixed(3)) });
  }
  return { provider: "perplexity", query, results, images: [], answer, metadata: { model: body.model, usage: data.usage || {} } };
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
async function searchSearxng(query, instanceUrl, maxResults, timeRange, env) {
  const base = await validateSearxngUrl(instanceUrl, env);
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
async function executeWithRetry(fn) {
  let lastError;
  for (let attempt = 0; attempt < RETRY_BACKOFF_MS.length; attempt += 1) {
    try {
      return await fn();
    } catch (error2) {
      lastError = error2;
      if (!(error2 instanceof ProviderRequestError) || !error2.transient || error2.statusCode === 401 || error2.statusCode === 403) break;
      if (attempt < RETRY_BACKOFF_MS.length - 1) await sleep(RETRY_BACKOFF_MS[attempt]);
    }
  }
  throw lastError;
}
async function executeSearch(runtimeEnv, params, pluginConfig = {}) {
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
    const configuredProviders = ALL_PROVIDERS.filter((p) => !!getApiKey(p, runtimeEnv));
    const enabledProviders = configuredProviders.filter((provider2) => !routingConfig.disabled_providers.includes(provider2));
    const braveOptions = {
      safesearch: runtimeEnv.BRAVE_SAFESEARCH
    };
    if (!configuredProviders.length) {
      return { ok: false, payload: { error: "Search failed: no search providers are configured" } };
    }
    if (!enabledProviders.length) {
      return { ok: false, payload: { error: "Search failed: all configured providers are disabled in routing preferences" } };
    }
    let routingInfo = { requested_provider: requestedProvider };
    let provider;
    let strictProviderMode = false;
    let exaDepthHint = "normal";
    if (requestedProvider === "auto") {
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
      if (!configuredProviders.includes(provider)) {
        return { ok: false, payload: { error: `Search failed: provider ${provider} is not configured` } };
      }
      if (routingConfig.disabled_providers.includes(provider)) {
        return { ok: false, payload: { error: `Search failed: provider ${provider} is disabled in routing preferences` } };
      }
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
    const runProvider = async (p) => {
      const key = validateApiKey(p, runtimeEnv);
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
      if (p === "perplexity") return searchPerplexity(query, key, count, timeRange);
      if (p === "you") return searchYou(query, key, count, timeRange);
      return searchSearxng(query, key, count, timeRange, runtimeEnv);
    };
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
    result.routing = routingInfo;
    result.cached = false;
    if (!result.metadata) result.metadata = {};
    if (result.deduplicated == null) result.deduplicated = false;
    if (result.metadata.dedup_count == null) result.metadata.dedup_count = 0;
    cachePut(query, successfulProvider, count, result, cacheContext);
    return { ok: true, payload: sanitizeOutput(result) };
  } catch (error2) {
    return { ok: false, payload: { error: `Search failed: ${sanitizeOutput(String(error2?.message || error2))}` } };
  }
}
async function composeAnswerPayload(runtimeEnv, params, pluginConfig = {}) {
  const query = String(params.query || "").trim();
  if (!query) return { beta: true, stage: "input", error: "query is required" };
  const mode = params.mode === "deep" ? "deep" : "quick";
  const output = ["answer", "brief", "sources", "json"].includes(String(params.output || "")) ? params.output : "answer";
  const sourceCount = Math.max(1, Math.min(10, Math.floor(Number(params.sources || (mode === "deep" ? 6 : 3)))));
  const requestedExtracts = params.max_extracts == null ? 2 : Math.max(0, Math.floor(Number(params.max_extracts)));
  const extractCap = 5;
  const extractCount = Math.min(requestedExtracts, extractCap, sourceCount);
  const freshness = normalizeAnswerFreshness(query, params.freshness || "none");
  const warnings = [];
  if (requestedExtracts > extractCap) warnings.push(`max_extracts capped at ${extractCap} to protect provider budget.`);
  const searchResult = await executeSearch(runtimeEnv, {
    query,
    provider: "auto",
    count: sourceCount,
    depth: mode === "deep" ? "deep" : "normal",
    time_range: freshness.applied === "none" ? void 0 : freshness.applied
  }, pluginConfig);
  if (!searchResult.ok) {
    const failure = searchResult.payload;
    return { beta: true, stage: "search", query, mode, output, freshness, warnings, ...failure };
  }
  const searchPayload = searchResult.payload;
  const normalizedSources = normalizeAnswerSources(searchPayload.results || [], searchPayload.provider, sourceCount);
  const urlsToExtract = normalizedSources.slice(0, extractCount).map((source) => source.url).filter(Boolean);
  const extractProvider = preferredAnswerExtractProvider(runtimeEnv);
  let extractPayload = { provider: null, results: [] };
  if (urlsToExtract.length && !extractProvider) {
    warnings.push("No extraction-capable provider is configured, so this answer uses search snippets only. Add Linkup (preferred), Firecrawl, Tavily, Exa, or You.com for fuller cited answers.");
  } else if (urlsToExtract.length && extractProvider) {
    extractPayload = await extractPlus(urlsToExtract, extractProvider, "markdown", false, false, false, runtimeEnv);
    if (extractPayload?.error) warnings.push(`Extraction issue: ${extractPayload.error}`);
    const extractedByUrl = new Map((extractPayload.results || []).map((item) => [item.url, item]));
    for (const source of normalizedSources.slice(0, extractCount)) {
      const extracted = extractedByUrl.get(source.url);
      if (extracted?.content) {
        source.evidence = cleanAnswerEvidence(String(extracted.content).slice(0, 500));
        source.extracted_status = "extracted";
        source.extraction_provider = extracted.provider || extractPayload.provider || void 0;
      } else if (extracted?.error) {
        source.extracted_status = "failed";
        source.extraction_error = String(extracted.error);
        source.evidence = source.snippet;
        warnings.push(`Extraction failed for ${source.url}: ${source.extraction_error}`);
      }
    }
  }
  for (const source of normalizedSources) {
    if (!source.evidence) {
      source.evidence = source.snippet;
      if (source.extracted_status === "not_requested") {
        source.extracted_status = urlsToExtract.includes(source.url) && extractProvider ? "failed" : "snippet_only";
      }
    }
  }
  const extractedCount = normalizedSources.filter((source) => source.extracted_status === "extracted").length;
  const snippetOnly = extractedCount === 0;
  const answer = buildAnswerText(query, normalizedSources, warnings, snippetOnly);
  const confidence = normalizedSources.length >= 3 && extractedCount > 0 ? "high" : normalizedSources.length >= 2 ? "medium" : "low";
  const payload = {
    beta: true,
    query,
    mode,
    output,
    answer,
    freshness,
    confidence,
    confidence_reason: {
      sources: normalizedSources.length,
      extracted_sources: extractedCount,
      snippet_only: snippetOnly
    },
    warnings,
    provider: searchPayload.provider,
    routing: searchPayload.routing,
    sources: normalizedSources,
    search_results_considered: normalizedSources.length,
    extraction: {
      provider: extractProvider,
      actual_provider: extractPayload?.provider || null,
      requested_urls: urlsToExtract,
      attempted: urlsToExtract.length > 0 && !!extractProvider,
      successful: extractedCount,
      snippet_only: snippetOnly
    },
    cost_estimate: {
      extract_provider: extractProvider,
      extracts_requested: urlsToExtract.length,
      extracts_completed: extractedCount,
      extract_cap: extractCap
    }
  };
  if (output === "json") return payload;
  if (output === "sources") return { text: normalizedSources.map((source) => `- ${source.citation}`).join("\n") || "- No sources found." };
  if (output === "brief") return { text: formatAnswerBrief(payload) };
  return { text: answer };
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
      description: "Search the web with intelligent multi-provider routing across Serper, Brave, Tavily, Linkup, Querit, Exa, Firecrawl, Perplexity, You.com, and SearXNG. Auto-selects the best provider, caches results, retries transient failures, and falls back across providers.",
      parameters: PARAMETERS_SCHEMA,
      async execute(_id, params) {
        try {
          const pluginConfig = api.pluginConfig ?? {};
          const runtimeEnv = getRuntimeEnv(pluginConfig);
          const result = await executeSearch(runtimeEnv, params, pluginConfig);
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
      name: "web_answer_plus",
      description: "Beta: produce a written web answer or cited brief by combining web_search_plus with bounded optional extraction. Prefer web_search_plus instead for current events, sports lineups, live scores, schedules, prices, weather, and raw source discovery. Use this only when you explicitly want a written answer, summary, brief, or cited synthesis.",
      parameters: ANSWER_PARAMETERS_SCHEMA,
      checkFn() {
        const pluginConfig = api.pluginConfig ?? {};
        const runtimeEnv = getRuntimeEnv(pluginConfig);
        return ["1", "true", "yes", "on"].includes(String(runtimeEnv.WSP_ENABLE_WEB_ANSWER || "").toLowerCase());
      },
      async execute(_id, params) {
        try {
          const pluginConfig = api.pluginConfig ?? {};
          const runtimeEnv = getRuntimeEnv(pluginConfig);
          const payload = await composeAnswerPayload(runtimeEnv, params, pluginConfig);
          if (payload.error) return { content: [{ type: "text", text: JSON.stringify(sanitizeOutput(payload)) }] };
          if (typeof payload.text === "string") return { content: [{ type: "text", text: payload.text }] };
          return { content: [{ type: "text", text: JSON.stringify(sanitizeOutput(payload)) }] };
        } catch (error2) {
          return { content: [{ type: "text", text: JSON.stringify(sanitizeOutput({ beta: true, error: String(error2?.message || error2) })) }] };
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
        return hasAnyExtractProviderCredential(getRuntimeEnv(pluginConfig));
      },
      async execute(_id, params) {
        try {
          const pluginConfig = api.pluginConfig ?? {};
          const runtimeEnv = getRuntimeEnv(pluginConfig);
          const result = await extractPlus(
            Array.isArray(params?.urls) ? params.urls : typeof params?.urls === "string" ? [params.urls] : [],
            params?.provider || "auto",
            params?.format === "html" ? "html" : "markdown",
            Boolean(params?.include_images),
            Boolean(params?.include_raw_html),
            Boolean(params?.render_js),
            runtimeEnv
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
  description: "One clean set of web tools for multi-provider search, extraction, and optional beta answer synthesis.",
  register
});
export {
  QueryAnalyzer,
  buildCacheKey,
  chooseTieWinner,
  deduplicateResultsAcrossProviders,
  index_default as default,
  register,
  searchBrave
};
