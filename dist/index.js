// index.ts
import crypto2 from "crypto";
import dns2 from "dns/promises";
import net2 from "net";

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
    youApiKey: maybeString(pluginConfig?.youApiKey),
    parallelApiKey: maybeString(pluginConfig?.parallelApiKey),
    serpbaseApiKey: maybeString(pluginConfig?.serpbaseApiKey),
    searxngInstanceUrl: maybeString(pluginConfig?.searxngInstanceUrl),
    searxngAllowPrivate: pluginConfig?.searxngAllowPrivate === true ? true : void 0,
    keenableApiKey: maybeString(pluginConfig?.keenableApiKey),
    keenableAllowPublic: pluginConfig?.keenableAllowPublic === true ? true : void 0,
    houndMcpUrl: maybeString(pluginConfig?.houndMcpUrl),
    houndTimeoutSeconds: maybePositiveInt(pluginConfig?.houndTimeoutSeconds),
    houndMaxResponseBytes: maybePositiveInt(pluginConfig?.houndMaxResponseBytes),
    houndMaxContentChars: maybePositiveInt(pluginConfig?.houndMaxContentChars),
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
function maybePositiveInt(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : void 0;
}
function maybeBoundedInt(value, minimum, maximum) {
  const parsed = maybePositiveInt(value);
  return parsed == null ? void 0 : Math.min(maximum, Math.max(minimum, parsed));
}

// routing-config.ts
var DEFAULT_PROVIDER_PRIORITY = ["tavily", "exa", "linkup", "parallel", "firecrawl", "you", "serper", "brave", "serpbase", "querit", "searxng", "keenable", "hound"];
var DEFAULT_EXTRACT_PROVIDER_PRIORITY = ["tavily", "exa", "linkup", "parallel", "firecrawl", "you", "keenable", "serper", "hound"];
var GUARDED_AUTO_PROVIDERS = ["serpbase", "querit", "parallel", "hound"];
var DEFAULT_ROUTING_PREFERENCES = {
  version: 2,
  profile: "standard",
  auto_routing: true,
  default_provider: null,
  provider_priority: [...DEFAULT_PROVIDER_PRIORITY],
  extract_provider_priority: [...DEFAULT_EXTRACT_PROVIDER_PRIORITY],
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
    DEFAULT_PROVIDER_PRIORITY.map((provider) => [provider, provider === "searxng" || provider === "keenable"])
  );
  return effective;
}
function normalizeProviderName(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/_/g, "-");
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
  config.extract_provider_priority = input.extract_provider_priority == null ? config.extract_provider_priority : normalizeExtractPriority(input.extract_provider_priority);
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
import dns from "dns/promises";
import net from "net";
import crypto from "crypto";

// span-extraction.ts
var TOKEN_RE = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?/gu;
var PARAGRAPH_BREAK_RE = /(?:\r?\n[\t \f\v]*){2,}/g;
var SENTENCE_END_RE = /(?<=[.!?])(?:["'’)\]]*)\s+/gu;
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
  const ranked = candidates(normalized, maxSpanChars).map((candidate) => {
    const score = options.ranker ? options.ranker(candidate.text, normalizedQuery) : lexicalScore(candidate, normalizedQuery, codepoints(normalized).length);
    if (!Number.isFinite(score)) throw new Error("Span ranker scores must be finite numbers");
    return { candidate, score };
  });
  ranked.sort((left, right) => right.score - left.score || left.candidate.start - right.candidate.start || left.candidate.end - right.candidate.end);
  const selected = [];
  for (const item of ranked) {
    if (selected.some(({ candidate }) => item.candidate.start < candidate.end && candidate.start < item.candidate.end)) continue;
    selected.push(item);
    if (selected.length >= maxSpans) break;
  }
  selected.sort((left, right) => left.candidate.start - right.candidate.start);
  return selected.map(({ candidate, score }) => ({ ...candidate, score }));
}

// hound-transport.ts
var HOUND_SESSION_CLEANUP_TIMEOUT_MS = 250;
var HoundTransportError = class extends Error {
  constructor(code = "hound_mcp_unavailable") {
    super(code);
    this.name = "HoundTransportError";
  }
};
function validateHoundEndpoint(value) {
  const endpoint = String(value || "").trim();
  if (!endpoint || endpoint.includes("?") || endpoint.includes("#")) throw new Error("hound_endpoint_invalid");
  let parsed;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error("hound_endpoint_invalid");
  }
  if (parsed.protocol !== "http:" || !["127.0.0.1", "[::1]"].includes(parsed.hostname) || !parsed.port || parsed.pathname !== "/mcp" || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("hound_endpoint_invalid");
  }
  return endpoint;
}
function parseWirePayload(text) {
  const candidates2 = text.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).filter(Boolean);
  const payloadText = candidates2.length ? candidates2[candidates2.length - 1] : text.trim();
  if (!payloadText) return {};
  const payload = JSON.parse(payloadText);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("invalid_mcp_payload");
  return payload;
}
async function readBoundedResponse(response, maxResponseBytes) {
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > maxResponseBytes) throw new Error("hound_response_too_large");
  let bytes;
  if (response.body) {
    const reader = response.body.getReader();
    const chunks = [];
    let totalBytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > maxResponseBytes) {
          void reader.cancel().catch(() => {
          });
          throw new Error("hound_response_too_large");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
  } else {
    bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maxResponseBytes) throw new Error("hound_response_too_large");
  }
  if (!response.ok && response.status !== 202) throw new Error(`hound_http_${response.status}`);
  return parseWirePayload(new TextDecoder().decode(bytes));
}
function toolPayload(result) {
  if (result.isError === true) throw new Error("hound_mcp_call_failed");
  if (result.structuredContent && typeof result.structuredContent === "object" && !Array.isArray(result.structuredContent)) {
    return result.structuredContent;
  }
  for (const item of Array.isArray(result.content) ? result.content : []) {
    if (item?.type !== "text" || typeof item.text !== "string") continue;
    try {
      const parsed = JSON.parse(item.text);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
    }
  }
  throw new Error("hound_mcp_contract_failed");
}
function closeHoundSession(endpoint, sessionId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HOUND_SESSION_CLEANUP_TIMEOUT_MS);
  timer.unref?.();
  try {
    void fetch(endpoint, {
      method: "DELETE",
      headers: {
        "Mcp-Session-Id": sessionId,
        "MCP-Protocol-Version": "2025-03-26"
      },
      redirect: "error",
      signal: controller.signal
    }).catch(() => {
    }).finally(() => clearTimeout(timer));
  } catch {
    clearTimeout(timer);
  }
}
async function callHoundTool(endpointValue, tool, argumentsValue, options = {}) {
  const endpoint = validateHoundEndpoint(endpointValue);
  const timeoutSeconds = Math.min(180, Math.max(5, Math.floor(options.timeoutSeconds ?? 120)));
  const maxResponseBytes = Math.min(16 * 1024 * 1024, Math.max(1024, Math.floor(options.maxResponseBytes ?? 2 * 1024 * 1024)));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutSeconds * 1e3);
  timer.unref?.();
  let sessionId = "";
  let requestId = 1;
  const request = async (body, includeSession = false) => {
    const headers = {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json"
    };
    if (includeSession && sessionId) {
      headers["Mcp-Session-Id"] = sessionId;
      headers["MCP-Protocol-Version"] = "2025-03-26";
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      redirect: "error",
      signal: controller.signal
    });
    const returnedSession = response.headers.get("mcp-session-id");
    if (returnedSession) sessionId = returnedSession;
    return readBoundedResponse(response, maxResponseBytes);
  };
  try {
    const initialized = await request({
      jsonrpc: "2.0",
      id: requestId++,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "web-search-plus", version: "3.3.0" }
      }
    });
    if (initialized.error || !initialized.result) throw new Error("hound_mcp_initialize_failed");
    await request({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }, true);
    const called = await request({
      jsonrpc: "2.0",
      id: requestId,
      method: "tools/call",
      params: { name: tool, arguments: argumentsValue }
    }, true);
    if (called.error || !called.result || typeof called.result !== "object") throw new Error("hound_mcp_call_failed");
    return toolPayload(called.result);
  } catch (error2) {
    if (error2 instanceof HoundTransportError) throw error2;
    throw new HoundTransportError();
  } finally {
    clearTimeout(timer);
    if (sessionId) closeHoundSession(endpoint, sessionId);
  }
}

// hound-provider.ts
function boundedInt(value, fallback, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Math.floor(value ?? fallback)));
}
function cleanStrings(value, limit = 20) {
  return Array.isArray(value) ? value.slice(0, limit).filter((item) => typeof item === "string" && !!item) : [];
}
function textContent(value) {
  if (typeof value === "string") return value;
  return Array.isArray(value) ? value.filter((item) => typeof item === "string").join("\n") : "";
}
function domainMatches(hostname, domain) {
  const normalized = String(domain || "").trim().toLowerCase().replace(/^\*\./, "").replace(/\.$/, "");
  return !!normalized && (hostname === normalized || hostname.endsWith(`.${normalized}`));
}
function urlAllowed(url, includeDomains, excludeDomains) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
    if (!["http:", "https:"].includes(parsed.protocol) || !hostname) return false;
    if (excludeDomains.some((domain) => domainMatches(hostname, domain))) return false;
    return !includeDomains.length || includeDomains.some((domain) => domainMatches(hostname, domain));
  } catch {
    return false;
  }
}
async function searchHound(query, endpoint, maxResults, freshness, includeDomains = [], excludeDomains = [], locale, options = {}) {
  const houndOptions = {
    max_results: boundedInt(maxResults, 6, 1, 50),
    cache_ttl: 0
  };
  if (["day", "week", "month", "year"].includes(String(freshness || ""))) houndOptions.freshness = freshness;
  if (includeDomains.length === 1) houndOptions.site = includeDomains[0];
  if (excludeDomains.length) houndOptions.exclude_sites = excludeDomains;
  if (locale?.language) houndOptions.language = locale.language;
  if (locale?.country) houndOptions.region = locale.language ? `${locale.country}-${locale.language}` : locale.country;
  const payload = await callHoundTool(endpoint, "mcp_smart_search", {
    query,
    options: houndOptions
  }, options);
  if (!Array.isArray(payload.results)) throw new Error("hound_search_contract_failed");
  if (payload.error && !payload.results.length) throw new Error("hound_search_failed");
  const results = payload.results.filter((item) => item && typeof item.url === "string" && urlAllowed(item.url, includeDomains, excludeDomains)).slice(0, maxResults).map((item, index) => ({
    title: String(item.title || ""),
    url: item.url,
    snippet: String(item.snippet || ""),
    score: Number.isFinite(Number(item.relevance_score)) ? Number(item.relevance_score) : Number((1 - index * 0.05).toFixed(3)),
    position: Number.isFinite(Number(item.position)) ? Number(item.position) : void 0,
    source: String(item.source || ""),
    fetch_relevance: String(item.fetch_relevance || ""),
    engines_consensus: String(item.engines_consensus || "")
  }));
  return {
    provider: "hound",
    query,
    results,
    images: [],
    answer: results[0]?.snippet || "",
    metadata: {
      engines_used: cleanStrings(payload.engines_used),
      engine_blocked: cleanStrings(payload.engine_blocked),
      rerank_mode: String(payload.rerank_mode || ""),
      duration_ms: Number.isFinite(Number(payload.duration_ms)) ? Number(payload.duration_ms) : 0,
      local_sidecar: true
    }
  };
}
function fetchArguments(url, outputFormat, includeImages, renderJs, maxContentChars) {
  return {
    urls: [url],
    extraction_type: outputFormat,
    cache_ttl: 0,
    max_content_chars: maxContentChars,
    options: { include_media: includeImages },
    ...renderJs ? { force_fetcher: "stealthy" } : {}
  };
}
function singleFetchItem(payload) {
  return Array.isArray(payload.results) && payload.results.length === 1 && payload.results[0] && typeof payload.results[0] === "object" ? payload.results[0] : {};
}
function projectFetchItem(item, requestedUrl) {
  const url = typeof item.url === "string" ? item.url : requestedUrl;
  const status = Number.isFinite(Number(item.status)) ? Number(item.status) : 0;
  const content = textContent(item.content);
  if (item.error || item.content_ok !== true || status >= 400 || !content.trim()) {
    return {
      url,
      title: "",
      content: "",
      raw_content: "",
      provider: "hound",
      error: "hound_fetch_failed",
      metadata: { status }
    };
  }
  const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
  return {
    url,
    title: String(metadata.title || ""),
    content,
    raw_content: content,
    provider: "hound",
    images: cleanStrings(item.media).map((imageUrl) => ({ url: imageUrl })),
    metadata: {
      status,
      fetcher: String(item.fetcher_used || ""),
      page_type: String(item.page_type || ""),
      source_type: String(item.source_type || ""),
      is_official: item.is_official === true,
      fetched_at: String(item.fetched_at || ""),
      duration_ms: Number.isFinite(Number(item.duration_ms)) ? Number(item.duration_ms) : 0
    }
  };
}
async function extractHound(urls, endpoint, outputFormat = "markdown", includeImages = false, includeRawHtml = false, renderJs = false, options = {}) {
  const maxContentChars = boundedInt(options.maxContentChars, 4e4, 500, 2e5);
  const results = [];
  for (const requestedUrl of urls) {
    try {
      const payload = await callHoundTool(
        endpoint,
        "mcp_smart_fetch",
        fetchArguments(requestedUrl, outputFormat, includeImages, renderJs, maxContentChars),
        options
      );
      const result = projectFetchItem(singleFetchItem(payload), requestedUrl);
      if (includeRawHtml && !result.error) {
        if (outputFormat === "html") {
          result.raw_html = result.content;
        } else {
          try {
            const rawPayload = await callHoundTool(
              endpoint,
              "mcp_smart_fetch",
              fetchArguments(requestedUrl, "html", false, renderJs, maxContentChars),
              options
            );
            const rawItem = singleFetchItem(rawPayload);
            const rawStatus = Number.isFinite(Number(rawItem.status)) ? Number(rawItem.status) : 0;
            const rawContent = textContent(rawItem.content);
            if (rawItem.error || rawItem.content_ok !== true || rawStatus >= 400 || !rawContent.trim()) {
              result.raw_error = "hound_raw_html_failed";
            } else {
              result.raw_html = rawContent;
            }
          } catch {
            result.raw_error = "hound_raw_html_failed";
          }
        }
      }
      results.push(result);
    } catch {
      results.push({
        url: requestedUrl,
        title: "",
        content: "",
        raw_content: "",
        provider: "hound",
        error: "hound_fetch_failed"
      });
    }
  }
  return { provider: "hound", results };
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
  properties: {
    urls: { type: "array", items: { type: "string" }, description: "URLs to extract (required unless content_ref is supplied)" },
    content_ref: { type: "string", description: "Process-local full-content reference returned by a prior extraction; valid only while its cache entry remains live." },
    content_start: { type: "integer", minimum: 0, description: "Unicode codepoint offset at which to read a referenced full text (default 0)." },
    content_end: { type: "integer", minimum: 0, description: "Exclusive Unicode codepoint offset for a referenced full text (maximum range 60000)." },
    raw_content_start: { type: "integer", minimum: 0, description: "Unicode codepoint offset for a distinct provider raw text returned by content_ref." },
    raw_content_end: { type: "integer", minimum: 0, description: "Exclusive Unicode codepoint offset for a distinct provider raw text (maximum range 60000)." },
    provider: {
      type: "string",
      enum: ["auto", "firecrawl", "linkup", "tavily", "exa", "parallel", "you", "keenable", "serper", "hound"],
      description: "Try this provider first with extraction fallback, or use auto priority (default: auto). Use routing_override_provider for a strict single-provider call."
    },
    routing_override_provider: {
      type: "string",
      enum: ["firecrawl", "linkup", "tavily", "exa", "parallel", "you", "keenable", "serper", "hound"],
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
    keenable: runtimeConfig.keenableApiKey,
    serper: runtimeConfig.serperApiKey,
    hound: runtimeConfig.houndMcpUrl
  };
  return keyMap[provider];
}
function keylessPublicAllowed(provider, runtimeConfig) {
  return provider === "keenable" && runtimeConfig.keenableAllowPublic === true;
}
function hasAnyExtractProviderCredential(runtimeConfig) {
  return EXTRACT_PROVIDER_PRIORITY.some((provider) => Boolean(getExtractApiKey(provider, runtimeConfig)) || keylessPublicAllowed(provider, runtimeConfig));
}
function isExtractProviderAvailable(provider, runtimeConfig) {
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
async function validateExtractUrls(urls, runtimeConfig) {
  if (runtimeConfig.extractAllowPrivateUrls === true) return;
  for (const url of urls) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error(`Invalid URL: ${url}`);
    }
    const hostname = parsed.hostname.trim().toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
    if (!hostname) throw new Error(`Invalid URL \u2014 hostname is required: ${url}`);
    if (BLOCKED_EXTRACT_HOSTS.has(hostname)) throw new Error(`Extraction URL blocked: ${hostname} is private/internal`);
    if (net.isIP(hostname)) {
      if (isPrivateOrInternalIp(hostname)) throw new Error(`Extraction URL blocked: ${hostname} is private/internal`);
      continue;
    }
    const records = await dns.lookup(hostname, { all: true, verbatim: true }).catch(() => []);
    if (!records.length) throw new Error(`Extraction URL blocked: cannot resolve hostname ${hostname}`);
    for (const record of records) {
      if (isPrivateOrInternalIp(record.address)) {
        throw new Error(`Extraction URL blocked: ${hostname} resolves to private/internal IP ${record.address}`);
      }
    }
  }
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
  return { provider: "exa", results };
}
var PARALLEL_MAX_CHARS_PER_RESULT = 6e4;
var PARALLEL_MAX_CHARS_TOTAL = 12e4;
async function extractParallel(urls, apiKey, outputFormat = "markdown", _includeImages = false, includeRawHtml = false, _renderJs = false, budgets = {}, apiUrl = "https://api.parallel.ai/v1beta/tasks/extract", timeout = 30) {
  const data = await requestJson(apiUrl, {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      urls,
      max_chars_total: budgets.maxCharsTotal ?? PARALLEL_MAX_CHARS_TOTAL,
      advanced_settings: { full_content: { max_chars_per_result: budgets.maxCharsPerResult ?? PARALLEL_MAX_CHARS_PER_RESULT } }
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
    } catch (error2) {
      results.push(normalizeExtractResult("keenable", url, "", "", void 0, { error: String(error2?.message || error2) }));
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
    } catch (error2) {
      results.push(normalizeExtractResult("serper", url, "", "", void 0, { error: String(error2?.message || error2) }));
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
  } catch (error2) {
    return {
      provider: requestedProvider,
      results: [],
      error: String(error2?.message || error2),
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
  try {
    await validateExtractUrls(cleanedUrls, runtimeConfig);
  } catch (error2) {
    return {
      provider: requestedProvider,
      results: [],
      error: String(error2?.message || error2),
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
      hound_max_content_chars: runtimeConfig.houndMaxContentChars ?? null,
      deadline_seconds: deadlineSeconds
    },
    provider_policy: {
      priority: configuredPriority,
      disabled: [...disabledProviders].sort(),
      auto_allow: contextOptions.autoAllow || {},
      strict_provider: contextOptions.strictProvider === true,
      // Credential availability affects which fallback can answer, while the
      // credential values themselves never enter the identity.
      available: Object.fromEntries(EXTRACT_PROVIDER_PRIORITY.map((item) => [item, Boolean(getExtractApiKey(item, runtimeConfig)) || keylessPublicAllowed(item, runtimeConfig)]))
    },
    endpoints: { hound_mcp_url: runtimeConfig.houndMcpUrl || null },
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
        result = await extractTavily(cleanedUrls, providerCredential, outputFormat, includeImages, includeRawHtml, renderJs);
      } else if (currentProvider === "exa") {
        result = await extractExa(cleanedUrls, providerCredential, outputFormat, includeImages, includeRawHtml, renderJs);
      } else if (currentProvider === "linkup") {
        result = await extractLinkup(cleanedUrls, providerCredential, outputFormat, includeImages, includeRawHtml, renderJs);
      } else if (currentProvider === "parallel") {
        result = await extractParallel(cleanedUrls, providerCredential, outputFormat, includeImages, includeRawHtml, renderJs, {
          maxCharsPerResult: runtimeConfig.parallelMaxCharsPerResult,
          maxCharsTotal: runtimeConfig.parallelMaxCharsTotal
        });
      } else if (currentProvider === "firecrawl") {
        result = await extractFirecrawl(cleanedUrls, providerCredential, outputFormat, includeImages, includeRawHtml, renderJs);
      } else if (currentProvider === "keenable") {
        result = await extractKeenable(cleanedUrls, providerCredential, outputFormat, includeImages, includeRawHtml, renderJs, keylessAllowed);
      } else if (currentProvider === "serper") {
        result = await extractSerper(cleanedUrls, providerCredential, outputFormat, includeImages, includeRawHtml, renderJs);
      } else if (currentProvider === "hound") {
        result = await extractHound(
          cleanedUrls,
          providerCredential,
          outputFormat,
          includeImages,
          includeRawHtml,
          renderJs,
          {
            timeoutSeconds: runtimeConfig.houndTimeoutSeconds,
            maxResponseBytes: runtimeConfig.houndMaxResponseBytes,
            maxContentChars: runtimeConfig.houndMaxContentChars
          }
        );
      } else {
        result = await extractYou(cleanedUrls, providerCredential, outputFormat, includeImages, includeRawHtml, renderJs);
      }
      const resultList = Array.isArray(result.results) ? result.results : [];
      const allUrlsFailed = resultList.length > 0 && resultList.every((item) => item?.error);
      if (allUrlsFailed) {
        errors.push({ provider: currentProvider, error: "all_urls_failed", details: resultList.map((item) => item.error) });
        continue;
      }
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
      if (!contextOptions.cacheBypass && cacheableFullText) {
        extractCachePut(
          cacheKey,
          response,
          fullText,
          runtimeConfig.extractCacheMaxEntries ?? DEFAULT_EXTRACT_CACHE_MAX_ENTRIES,
          cacheMaxChars
        );
      }
      return response;
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
function withResearchDeadline(promise, remainingSeconds) {
  if (remainingSeconds == null) return promise;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("research_deadline_exceeded")), Math.max(1, remainingSeconds * 1e3));
    timer.unref?.();
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error2) => {
        clearTimeout(timer);
        reject(error2);
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
  const providerErrors = [];
  const providerAttempts = /* @__PURE__ */ new Map();
  const launched = [];
  for (const [index, provider] of researchProviders.entries()) {
    if (budgetExhausted()) {
      const error2 = "skipped: research time budget exhausted";
      providerErrors.push({ provider, error: error2 });
      providerAttempts.set(index, { provider, outcome: "skipped", result_count: 0, error: error2 });
      continue;
    }
    const elapsed = now() - start;
    const remaining = timeBudgetSeconds == null ? null : Math.max(0, timeBudgetSeconds - elapsed);
    launched.push({ index, provider, promise: withResearchDeadline(executeSearch2(provider), remaining) });
  }
  const resultsByIndex = /* @__PURE__ */ new Map();
  for (const { index, provider, promise } of launched) {
    try {
      const response = await promise;
      resultsByIndex.set(index, [provider, response]);
      providerAttempts.set(index, { provider, outcome: "success", result_count: (response.results || []).length });
    } catch (error2) {
      const deadlineExceeded = String(error2?.message || error2) === "research_deadline_exceeded";
      const message = deadlineExceeded ? "cancelled: research time budget exceeded after provider start" : String(error2?.message || error2);
      providerErrors.push({ provider, error: message });
      providerAttempts.set(index, { provider, outcome: deadlineExceeded ? "cancelled" : "failed", result_count: 0, error: message });
    }
  }
  const providerResults = [...resultsByIndex.keys()].sort((a, b) => a - b).map((index) => resultsByIndex.get(index));
  const { results: deduped, dedupCount } = deduplicateResultsAcrossProviders(providerResults, maxResults);
  const diversityRerank = options.diversityRerank ? rerankDuplicateCandidates(deduped) : { results: deduped, duplicates: [] };
  const researchResults = diversityRerank.results;
  const urls = researchResults.map((item) => item.url).filter(Boolean).slice(0, Math.max(0, maxExtractUrls));
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
    providers_queried: launched.map(({ provider }) => provider),
    provider_attempts: [...providerAttempts.entries()].sort(([left], [right]) => left - right).map(([, attempt]) => attempt),
    provider_errors: providerErrors,
    extraction_provider: extracted.provider ?? null
  };
  if (extractionError) routing.extraction_error = extractionError;
  const sourceSummaries = extracted.results || [];
  const status = providerResults.length === 0 ? "failed" : providerErrors.length > 0 || extractionError ? "degraded" : "success";
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
function recordProviderOutcome(provider, latencySeconds, resultCount2, error2, now) {
  const sample = {
    t: Math.floor(now ?? nowSeconds()),
    lat: Math.round(Math.max(0, Number(latencySeconds) || 0) * 1e3) / 1e3,
    n: Math.max(0, Math.floor(Number(resultCount2) || 0)),
    err: Boolean(error2)
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
function performanceAdjustments(providers, now) {
  const adjustments = {};
  for (const provider of providers) {
    const value = performanceAdjustment(provider, now);
    if (value !== 0) adjustments[provider] = value;
  }
  return adjustments;
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
var LOCALE_PROVIDERS = /* @__PURE__ */ new Set(["serper", "brave", "querit", "firecrawl", "you", "searxng"]);
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

// index.ts
var DEFAULT_CACHE_TTL = 3600;
var RETRY_BACKOFF_MS = [1e3, 3e3, 9e3];
var RETRY_JITTER_FRACTION = 0.5;
var DEFAULT_RESEARCH_EXTRACT_COUNT = 3;
var DEFAULT_RESEARCH_TIME_BUDGET_SECONDS = 55;
var COOLDOWN_STEPS_SECONDS = [60, 300, 1500, 3600];
var TRANSIENT_HTTP_CODES = /* @__PURE__ */ new Set([408, 425, 429, 500, 502, 503, 504]);
var FAILURE_DECAY_SECONDS = 1800;
var RATE_LIMIT_MAX_ATTEMPTS = 2;
var MAX_RETRY_AFTER_WAIT_SECONDS = 30;
var SEARCH_PROVIDER_ENUM = ["serper", "brave", "tavily", "linkup", "querit", "exa", "firecrawl", "parallel", "serpbase", "you", "searxng", "keenable", "hound", "auto"];
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
    routing_override_provider: {
      type: "string",
      enum: SEARCH_PROVIDER_ENUM.filter((provider) => provider !== "auto"),
      description: "Disable automatic search routing and force this provider for this request. Reported visibly in routing.override_provider."
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
var ALL_PROVIDERS = ["serper", "brave", "tavily", "linkup", "querit", "exa", "firecrawl", "parallel", "serpbase", "you", "searxng", "keenable", "hound"];
var ProviderConfigError = class extends Error {
};
var ProviderRequestError = class extends Error {
  statusCode;
  transient;
  retryAfter;
  constructor(message, statusCode, transient = false, retryAfter) {
    super(message);
    this.name = "ProviderRequestError";
    this.statusCode = statusCode;
    this.transient = transient;
    this.retryAfter = retryAfter;
  }
};
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
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  const orderedProviders = orderProvidersByPreference(autoProviders.length ? autoProviders : availableProviders, routingConfig);
  const analyzer = new QueryAnalyzer();
  const adaptiveAdjustments = performanceAdjustments(orderedProviders);
  const analysis = analyzer.route(query, orderedProviders, adaptiveAdjustments);
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
      adaptive_adjustments: analysis.adaptive_adjustments,
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
    you: runtimeConfig.youApiKey,
    searxng: runtimeConfig.searxngInstanceUrl,
    parallel: runtimeConfig.parallelApiKey,
    serpbase: runtimeConfig.serpbaseApiKey,
    keenable: runtimeConfig.keenableApiKey,
    hound: runtimeConfig.houndMcpUrl
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
    if (provider === "hound") throw new ProviderConfigError("Missing Hound MCP endpoint (pluginConfig.houndMcpUrl)");
    throw new ProviderConfigError(`Missing API key for ${provider}`);
  }
  return key;
}
function toTimeRange(value) {
  return value && ["hour", "day", "week", "month", "year"].includes(value) ? value : void 0;
}
var FRESHNESS_VALUES = ["day", "week", "month", "year"];
var PROVIDER_FRESHNESS_FORMATS = {
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
  // searchSerpBase: time_range query param (plugin-specific endpoint support)
  serpbase: { day: "day", week: "week", month: "month", year: "year" },
  // searchYou: freshness query param (native values match the unified ones)
  you: { day: "day", week: "week", month: "month", year: "year" },
  // searchSearxng: time_range query param
  searxng: { day: "day", week: "week", month: "month", year: "year" },
  hound: { day: "day", week: "week", month: "month", year: "year" }
};
function normalizeFreshness(value) {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  if (!FRESHNESS_VALUES.includes(normalized)) {
    throw new Error(`Invalid freshness value: ${JSON.stringify(value)}. Valid values: ${FRESHNESS_VALUES.join(", ")}`);
  }
  return normalized;
}
function freshnessMetadata(provider, requested) {
  const native = PROVIDER_FRESHNESS_FORMATS[provider]?.[requested];
  if (native != null) return { requested, applied: true, provider, native_value: native };
  return { requested, applied: false, provider, reason: `provider ${provider} does not support freshness` };
}
var SEARCH_TYPE_VALUES = ["search", "news"];
var PROVIDER_SEARCH_TYPES = {
  // searchSerper: endpoint path https://google.serper.dev/<type>
  serper: { search: "search", news: "news" }
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
      throw new ProviderRequestError(`${detail} (HTTP ${res.status})`, res.status, TRANSIENT_HTTP_CODES.has(res.status), retryAfter);
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
      adaptive_adjustments: adaptiveAdjustments,
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
      const snippet2 = item.text ? String(item.text).slice(0, 800) : (item.highlights || [])[0] || "";
      results2.push({ title: item.title || "", url: item.url || "", snippet: snippet2, score: Number((item.score || 0).toFixed(3)), published_date: item.publishedDate, author: item.author, type: "source" });
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
  const data = await httpJson("https://api.serpbase.dev/google/search", {
    method: "POST",
    headers: { "X-API-Key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ q: query, page: 1 })
  });
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
  const answer = results.slice(0, 3).map((r) => r.snippet).filter(Boolean).join(" ").slice(0, 1e3);
  return { provider: "you", query, results, news: news.slice(0, 5), images: [], answer, metadata: { search_uuid: data?.metadata?.search_uuid, latency: data?.metadata?.latency } };
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
  return { provider: "keenable", query, results, images: [], answer: results[0]?.snippet || "", metadata };
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
  const answer = Array.isArray(data.answers) && data.answers[0] ? String(data.answers[0]) : Array.isArray(data.infoboxes) && data.infoboxes[0] ? String(data.infoboxes[0].content || data.infoboxes[0].infobox || "") : results[0]?.snippet || "";
  return { provider: "searxng", query, results, images: [], answer, suggestions: data.suggestions || [], corrections: data.corrections || [], metadata: { number_of_results: data.number_of_results, engines_used: [...enginesUsed], instance_url: base } };
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
      const isRateLimited = error2.statusCode === 429;
      const attemptCap = isRateLimited ? Math.min(RETRY_BACKOFF_MS.length, RATE_LIMIT_MAX_ATTEMPTS) : RETRY_BACKOFF_MS.length;
      if (attempt >= attemptCap - 1) break;
      if (isRateLimited && error2.retryAfter != null) {
        if (error2.retryAfter > MAX_RETRY_AFTER_WAIT_SECONDS) {
          break;
        }
        await sleep(error2.retryAfter * 1e3);
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
    const query = String(params.query || "").trim();
    if (!query) return { ok: false, payload: { error: "Search failed: query is required" } };
    const count = Math.max(1, Math.min(10, Math.floor(Number(params.count || 5))));
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
    } catch (error2) {
      return { ok: false, payload: { error: `Search failed: ${String(error2?.message || error2)}` } };
    }
    const timeRange = freshness || toTimeRange(params.time_range);
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
    let exaDepthHint = "normal";
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
        const selection = selectAutoProvider(query, autoEnabledProviders, routingConfig);
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
    routingInfo = {
      ...routingInfo,
      profile: routingConfig.profile,
      ...routingOverride ? { override_provider: routingOverride, override_mode: "forced_provider" } : {},
      ...routingConfig.profile === "self_hosted" && requestedProvider !== "auto" ? { explicit_profile_override: true } : {}
    };
    if (provider === "exa" && params.depth) exaDepthHint = params.depth;
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
      const locale = providerSupportsLocale(p) ? resolveLocale(p, runtimeConfig, query) : void 0;
      if (p === "serper") return searchSerper(query, key, count, timeRange, locale, PROVIDER_SEARCH_TYPES.serper[searchType || "search"] || "search");
      if (p === "brave") return searchBrave(query, key, count, { ...braveOptions, country: locale?.country, search_lang: locale?.language, time_range: timeRange });
      if (p === "tavily") return searchTavily(query, key, count, includeDomains, excludeDomains);
      if (p === "linkup") return searchLinkup(query, key, count, includeDomains, excludeDomains);
      if (p === "querit") return searchQuerit(query, key, count, timeRange, includeDomains, excludeDomains, locale);
      if (p === "exa") {
        const exaDepth = params.depth || exaDepthHint || "normal";
        return searchExa(query, key, count, exaDepth, includeDomains, excludeDomains);
      }
      if (p === "firecrawl") return searchFirecrawl(query, key, count, timeRange, includeDomains, excludeDomains, locale);
      if (p === "parallel") return searchParallel(query, key, count, includeDomains, excludeDomains);
      if (p === "serpbase") return searchSerpBase(query, key, count, timeRange);
      if (p === "you") return searchYou(query, key, count, timeRange, locale);
      if (p === "keenable") return searchKeenable(query, key || void 0, count, timeRange, includeDomains, runtimeConfig.keenableAllowPublic === true);
      if (p === "hound") {
        if (searchType && searchType !== "search") throw new ProviderConfigError("Hound supports search_type=search only");
        return searchHound(
          query,
          key,
          count,
          timeRange,
          includeDomains,
          excludeDomains,
          void 0,
          {
            timeoutSeconds: runtimeConfig.houndTimeoutSeconds,
            maxResponseBytes: runtimeConfig.houndMaxResponseBytes
          }
        );
      }
      return searchSearxng(query, key, count, timeRange, runtimeConfig, locale);
    };
    if (params.mode === "research") {
      const providerEligibleForResearch = (p) => !routingConfig.disabled_providers.includes(p) && routingConfig.auto_allow?.[p] !== false && providerIsConfigured(p, runtimeConfig) && !providerInCooldown(p).inCooldown;
      const availableResearchProviders = new Set(configuredProviders.filter(providerEligibleForResearch));
      if (providerIsConfigured(provider, runtimeConfig) && !routingConfig.disabled_providers.includes(provider) && !providerInCooldown(provider).inCooldown) {
        availableResearchProviders.add(provider);
      }
      let researchProviders;
      if (routingOverride) {
        researchProviders = [provider];
      } else if (Array.isArray(params.research_providers) && params.research_providers.length) {
        researchProviders = [...new Set(params.research_providers.map((value) => normalizeProviderName(value)))].filter(providerEligibleForResearch);
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
          const startedAt2 = Date.now();
          try {
            const response = await executeWithRetry(() => runProvider(p));
            recordProviderOutcome(p, (Date.now() - startedAt2) / 1e3, (response.results || []).length, false);
            resetProviderHealth(p);
            return response;
          } catch (error2) {
            if (!(error2 instanceof ProviderConfigError)) {
              recordProviderOutcome(p, (Date.now() - startedAt2) / 1e3, 0, true);
              markProviderFailure(p, String(error2?.message || error2), error2?.retryAfter);
            }
            throw error2;
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
      if (freshness) {
        result2.metadata = {
          ...result2.metadata || {},
          freshness: { requested: freshness, per_provider: researchProviders.map((p) => freshnessMetadata(p, freshness)) }
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
      const startedAt2 = Date.now();
      try {
        const result2 = await executeWithRetry(() => runProvider(p));
        recordProviderOutcome(p, (Date.now() - startedAt2) / 1e3, (result2.results || []).length, false);
        resetProviderHealth(p);
        successes.push([p, result2]);
        if (strictProviderMode || (result2.results || []).length >= count || errors.length === 0) break;
      } catch (error2) {
        const message = sanitizeOutput(String(error2?.message || error2));
        const isConfigError = error2 instanceof ProviderConfigError;
        if (!isConfigError) recordProviderOutcome(p, (Date.now() - startedAt2) / 1e3, 0, true);
        const skipCooldown = strictProviderMode || isConfigError;
        const cooldown = skipCooldown ? { cooldown_seconds: 0 } : markProviderFailure(p, message, error2?.retryAfter);
        errors.push({ provider: p, error: message, ...skipCooldown ? {} : { cooldown_seconds: cooldown.cooldown_seconds } });
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
    if (freshness) {
      result.metadata = { ...result.metadata || {}, freshness: freshnessMetadata(successfulProvider, freshness) };
    }
    if (searchType && searchType !== "search") {
      result.metadata = { ...result.metadata || {}, search_type: searchTypeMetadata(successfulProvider, searchType) };
    }
    if (providerSupportsLocale(successfulProvider)) {
      result.metadata = { ...result.metadata || {}, locale: resolveLocale(successfulProvider, runtimeConfig, query).metadata };
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
  api.registerTool(
    {
      name: "web_search_health_plus",
      description: "Read-only process-local provider health from adaptive routing samples. Reports only what this host process has observed since it started; no HTTP endpoint or persisted history is used.",
      parameters: { type: "object", properties: {} },
      async execute() {
        return { content: [{ type: "text", text: JSON.stringify({ ...getProviderHealthSnapshot(ALL_PROVIDERS), shadow_quality: getShadowQualitySnapshot() }) }] };
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
      description: "Explicit opt-in extraction benchmark. Never runs automatically; makes at most max_provider_calls (1-3) direct provider calls, bypasses the response cache, and returns a process-local priority recommendation. Hound remains excluded unless auto_allow.hound=true.",
      parameters: { type: "object", required: ["urls"], properties: { urls: { type: "array", minItems: 1, maxItems: 3, items: { type: "string" } }, max_provider_calls: { type: "integer", minimum: 1, maximum: 3 } } },
      async execute(_id, params) {
        try {
          const pluginConfig = api.pluginConfig ?? {};
          const runtimeConfig = getRuntimeConfig(pluginConfig);
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
          const result = { scope: "process_local", explicit_opt_in: true, score_weights: BENCHMARK_SCORE_WEIGHTS, max_provider_calls: maxCalls, provider_calls_made: attempts.length, hound_auto_allow: routing.auto_allow.hound === true, attempts, priority_recommendation };
          saveExtractBenchmark(result);
          return { content: [{ type: "text", text: JSON.stringify(sanitizeOutput(result)) }] };
        } catch (error2) {
          return { content: [{ type: "text", text: JSON.stringify(sanitizeOutput({ error: String(error2?.message || error2) })) }] };
        }
      }
    },
    { optional: true }
  );
  api.registerTool(
    {
      name: "web_search_plus",
      description: "Search the web with source-only multi-provider routing across Serper, Brave, Tavily, Linkup, Querit, Exa, Firecrawl, Parallel, SerpBase, You.com, SearXNG, Keenable, and the local Hound MCP sidecar. Automatic routing supports canonical-source reranking, a process-local response cache, bounded transient retries, and provider fallback. mode=research can query up to three providers and extract top sources for grounding.",
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
          recordShadowQualityObservation(result.payload);
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
      description: "Show or update process-local routing preferences for web_search_plus and web_extract_plus. Updates remain in the selected in-memory namespace only until the host process restarts; no routing file is read or written.",
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
      description: "Extract URL content across configured providers, including optional local Hound MCP, with bounded automatic fallback, per-URL errors, and unified output. The aggregate context budget selects a prefix before the per-result head/tail window. Inline raw_content mirrors final budgeted content; distinct provider raw text remains available through process-local full-content references. routing_override_provider makes one strict provider attempt with no fallback.",
      parameters: EXTRACT_PARAMETERS_SCHEMA,
      checkFn() {
        const pluginConfig = api.pluginConfig ?? {};
        return hasAnyExtractProviderCredential(getRuntimeConfig(pluginConfig));
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
          const runtimeConfig = getRuntimeConfig(pluginConfig);
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
  FAILURE_DECAY_SECONDS,
  FRESHNESS_VALUES,
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
