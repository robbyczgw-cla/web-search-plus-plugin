import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dns from "dns/promises";
import net from "net";

function getPluginDir(): string {
  // When OpenClaw transpiles plugins, import.meta.url may point to a temp dir.
  // Check for the known extension path first.
  const knownPath = path.join(process.env.HOME || "/root", ".openclaw", "extensions", "web-search-plus-plugin");
  if (fs.existsSync(path.join(knownPath, "package.json"))) return knownPath;
  try {
    if (typeof __dirname !== "undefined") return __dirname;
  } catch {}
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {}
  return process.cwd();
}

const PLUGIN_DIR = getPluginDir();
const CACHE_DIR = path.join(PLUGIN_DIR, ".cache");
const PROVIDER_HEALTH_FILE = path.join(CACHE_DIR, "provider_health.json");
const DEFAULT_CACHE_TTL = 3600;
const RETRY_BACKOFF_MS = [1000, 3000, 9000];
const COOLDOWN_STEPS_SECONDS = [60, 300, 1500, 3600];
const TRANSIENT_HTTP_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

const PARAMETERS_SCHEMA = {
  type: "object",
  required: ["query"],
  properties: {
    query: { type: "string", description: "Search query" },
    provider: {
      type: "string",
      enum: ["serper", "tavily", "querit", "exa", "perplexity", "you", "searxng", "auto"],
      description: "Force a provider, or use auto routing (default: auto)",
    },
    count: { type: "number", description: "Number of results (default: 5)" },
    depth: {
      type: "string",
      enum: ["normal", "deep", "deep-reasoning"],
      description: "Exa depth when using Exa or when auto-routing chooses Exa.",
    },
    time_range: {
      type: "string",
      enum: ["day", "week", "month", "year"],
      description: "Recency filter where supported.",
    },
    include_domains: {
      type: "array",
      items: { type: "string" },
      description: "Only include results from these domains (Tavily, Exa, Querit where supported).",
    },
    exclude_domains: {
      type: "array",
      items: { type: "string" },
      description: "Exclude results from these domains (Tavily, Exa, Querit where supported).",
    },
  },
};

type Json = Record<string, any>;
type ProviderName = "serper" | "tavily" | "querit" | "exa" | "perplexity" | "you" | "searxng";
type ToolParams = {
  query: string;
  provider?: ProviderName | "auto";
  count?: number;
  depth?: "normal" | "deep" | "deep-reasoning";
  time_range?: "day" | "week" | "month" | "year";
  include_domains?: string[];
  exclude_domains?: string[];
};

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  score?: number;
  [key: string]: any;
};

type SearchResponse = {
  provider: string;
  query: string;
  results: SearchResult[];
  images?: string[];
  answer?: string;
  metadata?: Json;
  [key: string]: any;
};

class ProviderConfigError extends Error {}
class ProviderRequestError extends Error {
  statusCode?: number;
  transient: boolean;
  constructor(message: string, statusCode?: number, transient = false) {
    super(message);
    this.name = "ProviderRequestError";
    this.statusCode = statusCode;
    this.transient = transient;
  }
}

const SENSITIVE_PATTERNS: RegExp[] = [
  /\b(?:sk|pk|rk|api|tok)_[A-Za-z0-9\-_]{10,}\b/g,
  /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/gi,
  /\b(?:key|token|secret|password|api[_-]?key)\s*[:=]\s*[^\s,"'}]+/gi,
  /([?&](?:api[_-]?key|key|token|access[_-]?token|auth|authorization)=)([^&#\s]+)/gi,
  /\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g,
];

function sanitizeOutput(input: any): any {
  if (typeof input === "string") {
    let out = input;
    for (const pattern of SENSITIVE_PATTERNS) {
      out = out.replace(pattern, (_m, p1) => (p1 ? `${p1}[REDACTED]` : "[REDACTED]"));
    }
    return out;
  }
  if (Array.isArray(input)) return input.map((v) => sanitizeOutput(v));
  if (input && typeof input === "object") {
    const result: any = {};
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

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readJsonFile(file: string, fallback: any): any {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJsonFile(file: string, value: any): void {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function buildCacheKey(query: string, provider: string, maxResults: number, params?: Json): string {
  return sha256(JSON.stringify({ query, provider, maxResults, ...(params || {}) }, Object.keys({ query, provider, maxResults, ...(params || {}) }).sort())).slice(0, 32);
}

function getCachePath(cacheKey: string): string {
  return path.join(CACHE_DIR, `${cacheKey}.json`);
}

function cacheGet(query: string, provider: string, maxResults: number, ttl: number, params?: Json): any | null {
  const key = buildCacheKey(query, provider, maxResults, params);
  const file = getCachePath(key);
  try {
    const cached = JSON.parse(fs.readFileSync(file, "utf8"));
    const ts = Number(cached._cache_timestamp || 0);
    if (!ts || Date.now() / 1000 - ts > ttl) {
      try { fs.unlinkSync(file); } catch {}
      return null;
    }
    return cached;
  } catch {
    try { fs.unlinkSync(file); } catch {}
    return null;
  }
}

function cachePut(query: string, provider: string, maxResults: number, result: any, params?: Json): void {
  ensureDir(CACHE_DIR);
  const key = buildCacheKey(query, provider, maxResults, params);
  const file = getCachePath(key);
  const payload = {
    ...result,
    _cache_timestamp: Math.floor(Date.now() / 1000),
    _cache_key: key,
    _cache_query: query,
    _cache_provider: provider,
    _cache_max_results: maxResults,
    _cache_params: params || {},
  };
  writeJsonFile(file, payload);
}

function loadProviderHealth(): Json {
  return readJsonFile(PROVIDER_HEALTH_FILE, {});
}

function saveProviderHealth(state: Json): void {
  writeJsonFile(PROVIDER_HEALTH_FILE, state);
}

function providerInCooldown(provider: string): { inCooldown: boolean; remaining: number } {
  const state = loadProviderHealth();
  const cooldownUntil = Number(state?.[provider]?.cooldown_until || 0);
  const remaining = cooldownUntil - Math.floor(Date.now() / 1000);
  return { inCooldown: remaining > 0, remaining: Math.max(0, remaining) };
}

function markProviderFailure(provider: string, message: string): Json {
  const state = loadProviderHealth();
  const now = Math.floor(Date.now() / 1000);
  const failCount = Number(state?.[provider]?.failure_count || 0) + 1;
  const cooldownSeconds = COOLDOWN_STEPS_SECONDS[Math.min(failCount - 1, COOLDOWN_STEPS_SECONDS.length - 1)];
  state[provider] = {
    failure_count: failCount,
    cooldown_until: now + cooldownSeconds,
    cooldown_seconds: cooldownSeconds,
    last_error: sanitizeOutput(message),
    last_failure_at: now,
  };
  saveProviderHealth(state);
  return state[provider];
}

function resetProviderHealth(provider: string): void {
  const state = loadProviderHealth();
  if (state[provider]) {
    delete state[provider];
    saveProviderHealth(state);
  }
}

function normalizeResultUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    const pathname = u.pathname.replace(/\/$/, "");
    return `${host}${pathname}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

function deduplicateResultsAcrossProviders(resultsByProvider: Array<[string, SearchResponse]>, maxResults: number): { results: SearchResult[]; dedupCount: number } {
  const deduped: SearchResult[] = [];
  const seen = new Set<string>();
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

function loadEnvFile(envPath: string): Record<string, string> {
  if (!fs.existsSync(envPath)) return {};
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const stripped = trimmed.startsWith("export ") ? trimmed.slice(7) : trimmed;
    const idx = stripped.indexOf("=");
    if (idx < 0) continue;
    const key = stripped.slice(0, idx).trim();
    const value = stripped.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key) env[key] = value;
  }
  return env;
}

function getRuntimeEnv(pluginConfig: Record<string, string>): Record<string, string> {
  const envFiles = [path.join(PLUGIN_DIR, ".env")];
  const fileEnv = Object.assign({}, ...envFiles.map(loadEnvFile));
  const mapped: Record<string, string> = {};
  const configKeyMap: Record<string, string> = {
    serperApiKey: "SERPER_API_KEY",
    tavilyApiKey: "TAVILY_API_KEY",
    queritApiKey: "QUERIT_API_KEY",
    exaApiKey: "EXA_API_KEY",
    perplexityApiKey: "PERPLEXITY_API_KEY",
    kilocodeApiKey: "KILOCODE_API_KEY",
    youApiKey: "YOU_API_KEY",
    searxngInstanceUrl: "SEARXNG_INSTANCE_URL",
    searxngAllowPrivate: "SEARXNG_ALLOW_PRIVATE",
  };
  for (const [cfgKey, envKey] of Object.entries(configKeyMap)) {
    const val = pluginConfig?.[cfgKey];
    if (val && typeof val === "string") mapped[envKey] = val;
  }
  return { ...fileEnv, ...Object.fromEntries(Object.entries(process.env).filter(([, v]) => typeof v === "string") as any), ...mapped };
}

function getApiKey(provider: ProviderName, env: Record<string, string>): string | undefined {
  const keyMap: Record<ProviderName, string | undefined> = {
    serper: env.SERPER_API_KEY,
    tavily: env.TAVILY_API_KEY,
    querit: env.QUERIT_API_KEY,
    exa: env.EXA_API_KEY,
    perplexity: env.KILOCODE_API_KEY || env.PERPLEXITY_API_KEY,
    you: env.YOU_API_KEY || env.YOUCOM_API_KEY,
    searxng: env.SEARXNG_INSTANCE_URL || env.SEARXNG_URL,
  };
  return keyMap[provider];
}

function validateApiKey(provider: ProviderName, env: Record<string, string>): string {
  const key = getApiKey(provider, env);
  if (!key) {
    if (provider === "searxng") throw new ProviderConfigError("Missing SearXNG instance URL (SEARXNG_INSTANCE_URL or pluginConfig.searxngInstanceUrl)");
    throw new ProviderConfigError(`Missing API key for ${provider}`);
  }
  return key;
}

function toTimeRange(value?: string): string | undefined {
  return value && ["day", "week", "month", "year"].includes(value) ? value : undefined;
}

function titleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const domain = u.hostname.replace(/^www\./, "");
    const segs = u.pathname.split("/").filter(Boolean);
    const last = segs.length ? segs[segs.length - 1].replace(/[-_]/g, " ").replace(/\.\w{2,4}$/, "") : "";
    return last ? `${domain} — ${last}` : domain;
  } catch {
    return url.slice(0, 80);
  }
}

async function httpJson(url: string, init: RequestInit, timeoutMs = 30000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "User-Agent": "ClawdBot-WebSearchPlus/3.0",
        ...(init.headers || {}),
      },
      signal: controller.signal,
    });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : {}; } catch {}
    if (!res.ok) {
      const detail = data?.error || data?.message || text || res.statusText;
      throw new ProviderRequestError(`${detail} (HTTP ${res.status})`, res.status, TRANSIENT_HTTP_CODES.has(res.status));
    }
    return data ?? {};
  } catch (error: any) {
    if (error?.name === "AbortError") throw new ProviderRequestError(`Request timed out after ${timeoutMs}ms`, undefined, true);
    if (error instanceof ProviderRequestError) throw error;
    throw new ProviderRequestError(`Network error: ${String(error?.message || error)}`, undefined, true);
  } finally {
    clearTimeout(timer);
  }
}

async function validateSearxngUrl(input: string, env: Record<string, string>): Promise<string> {
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    throw new ProviderConfigError("Invalid SearXNG URL");
  }
  if (!["http:", "https:"].includes(u.protocol)) throw new ProviderConfigError(`SearXNG URL must use http or https, got ${u.protocol}`);
  if (!u.hostname) throw new ProviderConfigError("SearXNG URL must include a hostname");

  const blockedHosts = new Set(["169.254.169.254", "metadata.google.internal", "metadata.internal"]);
  if (blockedHosts.has(u.hostname)) throw new ProviderConfigError("SearXNG URL blocked: metadata endpoint");

  // WARNING: Setting SEARXNG_ALLOW_PRIVATE=true disables SSRF protection for SearXNG.
  // Only enable on fully trusted private networks.
  const allowPrivate = ["1", "true", "yes"].includes(String(env.SEARXNG_ALLOW_PRIVATE || "").trim().toLowerCase());
  if (!allowPrivate) {
    const records = await dns.lookup(u.hostname, { all: true, verbatim: true }).catch(() => [] as dns.LookupAddress[]);
    if (!records.length && net.isIP(u.hostname)) records.push({ address: u.hostname, family: net.isIP(u.hostname) as 4 | 6 });
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

const SHOPPING_SIGNALS: Record<string, number> = {
  "\\bhow much\\b": 4.0, "\\bprice of\\b": 4.0, "\\bcost of\\b": 4.0, "\\bprices?\\b": 3.0,
  "\\$\\d+|\\d+\\s*dollars?": 3.0, "€\\d+|\\d+\\s*euros?": 3.0, "£\\d+|\\d+\\s*pounds?": 3.0,
  "\\bpreis(e)?\\b": 3.5, "\\bkosten\\b": 3.0, "\\bwieviel\\b": 3.5, "\\bwie viel\\b": 3.5, "\\bwas kostet\\b": 4.0,
  "\\bbuy\\b": 3.5, "\\bpurchase\\b": 3.5, "\\border\\b(?!\\s+by)": 3.0, "\\bshopping\\b": 3.5, "\\bshop for\\b": 3.5,
  "\\bwhere to (buy|get|purchase)\\b": 4.0, "\\bkaufen\\b": 3.5, "\\bbestellen\\b": 3.5, "\\bwo kaufen\\b": 4.0,
  "\\bhändler\\b": 3.0, "\\bshop\\b": 2.5, "\\bdeal(s)?\\b": 3.0, "\\bdiscount(s)?\\b": 3.0, "\\bsale\\b": 2.5,
  "\\bcheap(er|est)?\\b": 3.0, "\\baffordable\\b": 2.5, "\\bbudget\\b": 2.5, "\\bbest price\\b": 3.5,
  "\\bcompare prices\\b": 3.5, "\\bcoupon\\b": 3.0, "\\bgünstig(er|ste)?\\b": 3.0, "\\bbillig(er|ste)?\\b": 3.0,
  "\\bangebot(e)?\\b": 3.0, "\\brabatt\\b": 3.0, "\\baktion\\b": 2.5, "\\bschnäppchen\\b": 3.0,
  "\\bvs\\.?\\b": 2.0, "\\bversus\\b": 2.0, "\\bor\\b.*\\bwhich\\b": 2.0, "\\bspecs?\\b": 2.5,
  "\\bspecifications?\\b": 2.5, "\\breview(s)?\\b": 2.0, "\\brating(s)?\\b": 2.0, "\\bunboxing\\b": 2.5,
  "\\btest\\b": 2.5, "\\bbewertung(en)?\\b": 2.5, "\\btechnische daten\\b": 3.0, "\\bspezifikationen\\b": 2.5,
};
const RESEARCH_SIGNALS: Record<string, number> = {
  "\\bhow does\\b": 4.0, "\\bhow do\\b": 3.5, "\\bwhy does\\b": 4.0, "\\bwhy do\\b": 3.5, "\\bwhy is\\b": 3.5,
  "\\bexplain\\b": 4.0, "\\bexplanation\\b": 4.0, "\\bwhat is\\b": 3.0, "\\bwhat are\\b": 3.0, "\\bdefine\\b": 3.5,
  "\\bdefinition of\\b": 3.5, "\\bmeaning of\\b": 3.0, "\\banalyze\\b": 3.5, "\\banalysis\\b": 3.5,
  "\\bcompare\\b(?!\\s*prices?)": 3.0, "\\bcomparison\\b": 3.0, "\\bstatus of\\b": 3.5, "\\bstatus\\b": 2.5,
  "\\bwhat happened with\\b": 4.0, "\\bpros and cons\\b": 4.0, "\\badvantages?\\b": 3.0, "\\bdisadvantages?\\b": 3.0,
  "\\bbenefits?\\b": 2.5, "\\bdrawbacks?\\b": 3.0, "\\bdifference between\\b": 3.5, "\\bunderstand\\b": 3.0,
  "\\blearn(ing)?\\b": 2.5, "\\btutorial\\b": 3.0, "\\bguide\\b": 2.5, "\\bhow to\\b": 2.0, "\\bstep by step\\b": 3.0,
  "\\bin[- ]depth\\b": 3.0, "\\bdetailed\\b": 2.5, "\\bcomprehensive\\b": 3.0, "\\bthorough\\b": 2.5,
  "\\bdeep dive\\b": 3.5, "\\boverall\\b": 2.0, "\\bsummary\\b": 2.0, "\\bstudy\\b": 2.5, "\\bresearch shows\\b": 3.5,
  "\\baccording to\\b": 2.5, "\\bevidence\\b": 3.0, "\\bscientific\\b": 3.0, "\\bhistory of\\b": 3.0,
  "\\bbackground\\b": 2.5, "\\bcontext\\b": 2.5, "\\bimplications?\\b": 3.0, "\\bwie funktioniert\\b": 4.0,
  "\\bwarum\\b": 3.5, "\\berklär(en|ung)?\\b": 4.0, "\\bwas ist\\b": 3.0, "\\bwas sind\\b": 3.0, "\\bbedeutung\\b": 3.0,
  "\\banalyse\\b": 3.5, "\\bvergleich(en)?\\b": 3.0, "\\bvor- und nachteile\\b": 4.0, "\\bvorteile\\b": 3.0,
  "\\bnachteile\\b": 3.0, "\\bunterschied(e)?\\b": 3.5, "\\bverstehen\\b": 3.0, "\\blernen\\b": 2.5,
  "\\banleitung\\b": 3.0, "\\bübersicht\\b": 2.5, "\\bhintergrund\\b": 2.5, "\\bzusammenfassung\\b": 2.5,
};
const DISCOVERY_SIGNALS: Record<string, number> = {
  "\\bsimilar to\\b": 5.0, "\\blike\\s+\\w+\\.com": 4.5, "\\balternatives? to\\b": 5.0, "\\bcompetitors? (of|to)\\b": 4.5,
  "\\bcompeting with\\b": 4.0, "\\brivals? (of|to)\\b": 4.0, "\\binstead of\\b": 3.0, "\\breplacement for\\b": 3.5,
  "\\bcompanies (like|that|doing|building)\\b": 4.5, "\\bstartups? (like|that|doing|building)\\b": 4.5, "\\bwho else\\b": 4.0,
  "\\bother (companies|startups|tools|apps)\\b": 3.5, "\\bfind (companies|startups|tools|examples?)\\b": 4.5,
  "\\bevents? in\\b": 4.0, "\\bthings to do in\\b": 4.5, "\\bseries [a-d]\\b": 4.0, "\\byc\\b|y combinator": 4.0,
  "\\bfund(ed|ing|raise)\\b": 3.5, "\\bventure\\b": 3.0, "\\bvaluation\\b": 3.0, "\\bresearch papers? (on|about)\\b": 4.0,
  "\\barxiv\\b": 4.5, "\\bgithub (projects?|repos?)\\b": 4.5, "\\bopen source\\b.*\\bprojects?\\b": 4.0,
  "\\btweets? (about|on)\\b": 3.5, "\\bblogs? (about|on|like)\\b": 3.0, "https?://[^\\s]+": 5.0, "\\b\\w+\\.(com|org|io|ai|co|dev)\\b": 3.5,
};
const LOCAL_NEWS_SIGNALS: Record<string, number> = {
  "\\bnear me\\b": 4.0, "\\bnearby\\b": 3.5, "\\blocal\\b": 3.0, "\\bin (my )?(city|area|town|neighborhood)\\b": 3.5,
  "\\brestaurants?\\b": 2.5, "\\bhotels?\\b": 2.5, "\\bcafes?\\b": 2.5, "\\bstores?\\b": 2.0, "\\bdirections? to\\b": 3.5,
  "\\bmap of\\b": 3.0, "\\bphone number\\b": 3.0, "\\baddress of\\b": 3.0, "\\bopen(ing)? hours\\b": 3.0,
  "\\bweather\\b": 4.0, "\\bforecast\\b": 3.5, "\\btemperature\\b": 3.0, "\\btime in\\b": 3.0,
  "\\blatest\\b": 2.5, "\\brecent\\b": 2.5, "\\btoday\\b": 2.5, "\\bbreaking\\b": 3.5, "\\bnews\\b": 2.5,
  "\\bheadlines?\\b": 3.0, "\\b202[4-9]\\b": 2.0, "\\blast (week|month|year)\\b": 2.0, "\\bin der nähe\\b": 4.0,
  "\\bin meiner nähe\\b": 4.0, "\\böffnungszeiten\\b": 3.0, "\\badresse von\\b": 3.0, "\\bweg(beschreibung)? nach\\b": 3.5,
  "\\bheute\\b": 2.5, "\\bmorgen\\b": 2.0, "\\baktuell\\b": 2.5, "\\bnachrichten\\b": 3.0,
};
const RAG_SIGNALS: Record<string, number> = {
  "\\brag\\b": 4.5, "\\bcontext for\\b": 4.0, "\\bsummarize\\b": 3.5, "\\bbrief(ly)?\\b": 3.0, "\\bquick overview\\b": 3.5,
  "\\btl;?dr\\b": 4.0, "\\bkey (points|facts|info)\\b": 3.5, "\\bmain (points|takeaways)\\b": 3.5,
  "\\b(web|online)\\s+and\\s+news\\b": 4.0, "\\ball sources\\b": 3.5, "\\bcomprehensive (search|overview)\\b": 3.5,
  "\\blatest\\s+(news|updates)\\b": 3.0, "\\bcurrent (events|situation|status)\\b": 3.5, "\\bright now\\b": 3.0,
  "\\bas of today\\b": 3.5, "\\bup.to.date\\b": 3.5, "\\breal.time\\b": 4.0, "\\blive\\b": 2.5,
  "\\bwhat'?s happening with\\b": 3.5, "\\bwhat'?s the latest\\b": 4.0, "\\bupdates?\\s+on\\b": 3.5, "\\bstatus of\\b": 3.0,
  "\\bsituation (in|with|around)\\b": 3.5,
};
const DIRECT_ANSWER_SIGNALS: Record<string, number> = {
  "\\bwhat is\\b": 3.0, "\\bwhat are\\b": 2.5, "\\bcurrent status\\b": 4.0, "\\bstatus of\\b": 3.5, "\\bstatus\\b": 2.5,
  "\\bwhat happened with\\b": 4.0, "\\bwhat'?s happening with\\b": 4.0, "\\bas of (today|now)\\b": 4.0, "\\bthis weekend\\b": 3.5,
  "\\bevents? in\\b": 3.5, "\\bthings to do in\\b": 4.0, "\\bnear me\\b": 3.0, "\\bcan you (tell me|summarize|explain)\\b": 3.5,
  "\\bwann\\b": 3.0, "\\bwer\\b": 3.0, "\\bwo\\b": 2.5, "\\bwie viele\\b": 3.0,
};
const PRIVACY_SIGNALS: Record<string, number> = {
  "\\bprivate(ly)?\\b": 4.0, "\\banonymous(ly)?\\b": 4.0, "\\bwithout tracking\\b": 4.5, "\\bno track(ing)?\\b": 4.5,
  "\\bprivacy\\b": 3.5, "\\bprivacy.?focused\\b": 4.5, "\\bprivacy.?first\\b": 4.5, "\\bduckduckgo alternative\\b": 4.5,
  "\\bprivate search\\b": 5.0, "\\bprivat\\b": 4.0, "\\banonym\\b": 4.0, "\\bohne tracking\\b": 4.5,
  "\\bdatenschutz\\b": 4.0, "\\baggregate results?\\b": 4.0, "\\bmultiple sources?\\b": 4.0, "\\bdiverse (results|perspectives|sources)\\b": 4.0,
  "\\bfrom (all|multiple|different) (engines?|sources?)\\b": 4.5, "\\bmeta.?search\\b": 5.0, "\\ball engines?\\b": 4.0,
  "\\bverschiedene quellen\\b": 4.0, "\\baus mehreren quellen\\b": 4.0, "\\balle suchmaschinen\\b": 4.5,
  "\\bfree search\\b": 3.5, "\\bno api cost\\b": 4.0, "\\bself.?hosted search\\b": 5.0, "\\bzero cost\\b": 3.5,
  "\\bbudget\\b(?!\\s*(laptop|phone|option))\\b": 2.5, "\\bkostenlos(e)?\\s+suche\\b": 3.5, "\\bkeine api.?kosten\\b": 4.0,
};
const EXA_DEEP_SIGNALS: Record<string, number> = {
  "\\bsynthesi[sz]e\\b": 5.0, "\\bdeep research\\b": 5.0, "\\bcomprehensive (analysis|report|overview|survey)\\b": 4.5,
  "\\bacross (multiple|many|several) (sources|documents|papers)\\b": 4.5, "\\baggregat(e|ing) (information|data|results)\\b": 4.0,
  "\\bcross.?referenc": 4.5, "\\bsec filings?\\b": 4.5, "\\bannual reports?\\b": 4.0, "\\bearnings (call|report|transcript)\\b": 4.5,
  "\\bfinancial analysis\\b": 4.0, "\\bliterature (review|survey)\\b": 5.0, "\\bacademic literature\\b": 4.5,
  "\\bstate of the (art|field|industry)\\b": 4.0, "\\bcompile (a |the )?(report|findings|results)\\b": 4.5,
  "\\bsummariz(e|ing) (research|papers|studies)\\b": 4.0, "\\bmultiple documents?\\b": 4.0, "\\bdossier\\b": 4.5,
  "\\bdue diligence\\b": 4.5, "\\bstructured (output|data|report)\\b": 4.0, "\\bmarket research\\b": 4.0,
  "\\bindustry (report|analysis|overview)\\b": 4.0, "\\bresearch (on|about|into)\\b": 4.0, "\\bwhitepaper\\b": 4.5,
  "\\btechnical report\\b": 4.0, "\\bsurvey of\\b": 4.5, "\\bmeta.?analysis\\b": 5.0, "\\bsystematic review\\b": 5.0,
  "\\bcase study\\b": 3.5, "\\bbenchmark(s|ing)?\\b": 3.5, "\\btiefenrecherche\\b": 5.0, "\\bumfassende (analyse|übersicht|recherche)\\b": 4.5,
  "\\baus mehreren quellen zusammenfassen\\b": 4.5, "\\bmarktforschung\\b": 4.0,
};
const EXA_DEEP_REASONING_SIGNALS: Record<string, number> = {
  "\\bdeep.?reasoning\\b": 6.0, "\\bcomplex (analysis|reasoning|research)\\b": 4.5, "\\bcontradictions?\\b": 4.5,
  "\\breconcil(e|ing)\\b": 5.0, "\\bcritical(ly)? analyz": 4.5, "\\bweigh(ing)? (the )?evidence\\b": 4.5,
  "\\bcompeting (claims|theories|perspectives)\\b": 4.5, "\\bcomplex financial\\b": 4.5, "\\bregulatory (analysis|compliance|landscape)\\b": 4.5,
  "\\blegal analysis\\b": 4.5, "\\bcomprehensive (due diligence|investigation)\\b": 5.0, "\\bpatent (landscape|analysis|search)\\b": 4.5,
  "\\bmarket intelligence\\b": 4.5, "\\bcompetitive (intelligence|landscape)\\b": 4.5, "\\btrade.?offs?\\b": 4.0,
  "\\bpros and cons of\\b": 4.0, "\\bshould I (use|choose|pick)\\b": 3.5, "\\bwhich is better\\b": 4.0,
  "\\bkomplexe analyse\\b": 4.5, "\\bwidersprüche\\b": 4.5, "\\bquellen abwägen\\b": 4.5, "\\brechtliche analyse\\b": 4.5,
  "\\bvergleich(e|en)?\\b": 3.5,
};
const BRAND_PATTERNS = [
  "\\b(apple|iphone|ipad|macbook|airpods?)\\b", "\\b(samsung|galaxy)\\b", "\\b(google|pixel)\\b", "\\b(microsoft|surface|xbox)\\b",
  "\\b(sony|playstation)\\b", "\\b(nvidia|geforce|rtx)\\b", "\\b(amd|ryzen|radeon)\\b", "\\b(intel|core i[3579])\\b",
  "\\b(dell|hp|lenovo|asus|acer)\\b", "\\b(lg|tcl|hisense)\\b", "\\b(laptop|phone|tablet|tv|monitor|headphones?|earbuds?)\\b",
  "\\b(camera|lens|drone)\\b", "\\b(watch|smartwatch|fitbit|garmin)\\b", "\\b(router|modem|wifi)\\b", "\\b(keyboard|mouse|gaming)\\b",
];

class QueryAnalyzer {
  calculateSignalScore(query: string, signals: Record<string, number>) {
    const q = query.toLowerCase();
    const matches: any[] = [];
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
  detectProductBrandCombo(query: string): number {
    const hasBrand = BRAND_PATTERNS.some((p) => new RegExp(p, "i").test(query));
    const productIndicators = ["\\b(buy|price|specs?|review|vs|compare)\\b", "\\b(pro|max|plus|mini|ultra|lite)\\b", "\\b\\d+\\s*(gb|tb|inch|mm|hz)\\b"];
    const hasProduct = productIndicators.some((p) => new RegExp(p, "i").test(query));
    if (hasBrand && hasProduct) return 3;
    if (hasBrand) return 1.5;
    return 0;
  }
  detectUrl(query: string): string | null {
    const found = query.match(/https?:\/\/[^\s]+|\b\w+\.(com|org|io|ai|co|dev|net|app)\b/i);
    return found?.[0] || null;
  }
  assessQueryComplexity(query: string) {
    const words = query.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const questionWords = (query.match(/\b(what|why|how|when|where|which|who|whose|whom)\b/gi) || []).length;
    const clauseMarkers = (query.match(/\b(and|but|or|because|since|while|although|if|when)\b/gi) || []).length;
    let complexityScore = 0;
    if (wordCount > 10) complexityScore += 1.5;
    if (wordCount > 20) complexityScore += 1.0;
    if (questionWords > 1) complexityScore += 1.0;
    if (clauseMarkers > 0) complexityScore += clauseMarkers * 0.5;
    return { word_count: wordCount, question_words: questionWords, clause_markers: clauseMarkers, complexity_score: complexityScore, is_complex: complexityScore > 2 };
  }
  detectRecencyIntent(query: string) {
    const patterns: Array<[RegExp, number]> = [
      [/\b(latest|newest|recent|current)\b/i, 2.5], [/\b(today|yesterday|this week|this month)\b/i, 3],
      [/\b(202[4-9]|2030)\b/i, 2], [/\b(breaking|live|just|now)\b/i, 3], [/\blast (hour|day|week|month)\b/i, 2.5],
    ];
    let total = 0;
    for (const [regex, weight] of patterns) if (regex.test(query)) total += weight;
    return { is_recency_focused: total > 2, score: total };
  }
  analyze(query: string) {
    const shopping = this.calculateSignalScore(query, SHOPPING_SIGNALS);
    const research = this.calculateSignalScore(query, RESEARCH_SIGNALS);
    const discovery = this.calculateSignalScore(query, DISCOVERY_SIGNALS);
    const localNews = this.calculateSignalScore(query, LOCAL_NEWS_SIGNALS);
    const rag = this.calculateSignalScore(query, RAG_SIGNALS);
    const privacy = this.calculateSignalScore(query, PRIVACY_SIGNALS);
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
      exa_deep_score: exaDeep.total,
      exa_deep_reasoning_score: exaDeepReasoning.total,
      provider_scores: {
        serper: shopping.total + localNews.total + recency.score * 0.35,
        tavily: research.total + (complexity.is_complex ? 0 : complexity.complexity_score) + recency.score * 0.2,
        querit: research.total * 0.65 + rag.total * 0.35 + recency.score * 0.45,
        exa: discovery.total + (/(\bsimilar|alternatives?|examples?)\b/i.test(query) ? 1 : 0) + exaDeep.total * 0.5 + exaDeepReasoning.total * 0.5,
        perplexity: direct.total + localNews.total * 0.4 + recency.score * 0.55,
        you: rag.total + recency.score * 0.25,
        searxng: privacy.total,
      },
      provider_matches: {
        serper: [...shopping.matches, ...localNews.matches],
        tavily: research.matches,
        querit: research.matches,
        exa: [...discovery.matches, ...exaDeep.matches, ...exaDeepReasoning.matches],
        perplexity: direct.matches,
        you: rag.matches,
        searxng: privacy.matches,
      },
    };
  }
  route(query: string, availableProviders: ProviderName[]) {
    const analysis = this.analyze(query);
    const scores = analysis.provider_scores as Record<ProviderName, number>;
    const available = Object.fromEntries(availableProviders.map((p) => [p, scores[p] ?? 0])) as Record<ProviderName, number>;
    const providers = Object.keys(available) as ProviderName[];
    if (!providers.length) {
      return { provider: "serper" as ProviderName, confidence: 0, confidence_level: "low", reason: "no_available_providers", scores: {}, top_signals: [], exa_depth: "normal" };
    }
    const maxScore = Math.max(...providers.map((p) => available[p]));
    const winners = providers.filter((p) => available[p] === maxScore);
    const priority: ProviderName[] = ["tavily", "querit", "exa", "perplexity", "serper", "you", "searxng"];
    const winner = priority.find((p) => winners.includes(p)) || winners[0];
    const secondBest = [...providers.map((p) => available[p])].sort((a, b) => b - a)[1] || 0;
    const margin = maxScore > 0 ? (maxScore - secondBest) / maxScore : 0;
    const normalizedScore = Math.min(maxScore / 15, 1);
    const confidence = maxScore === 0 ? 0 : Number((normalizedScore * 0.6 + margin * 0.4).toFixed(3));
    let exaDepth: "normal" | "deep" | "deep-reasoning" = "normal";
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
      top_signals: (analysis.provider_matches[winner] || []).sort((a: any, b: any) => b.weight - a.weight).slice(0, 5).map((s: any) => ({ matched: s.matched, weight: s.weight })),
      analysis_summary: {
        query_length: query.trim().split(/\s+/).filter(Boolean).length,
        is_complex: analysis.complexity.is_complex,
        has_url: !!analysis.detected_url,
        recency_focused: analysis.recency_focused,
      },
    };
  }
}

async function searchSerper(query: string, apiKey: string, maxResults: number, timeRange?: string): Promise<SearchResponse> {
  const body: Json = { q: query, gl: "us", hl: "en", num: maxResults, autocorrect: true };
  const tbsMap: Record<string, string> = { day: "qdr:d", week: "qdr:w", month: "qdr:m", year: "qdr:y" };
  if (timeRange && tbsMap[timeRange]) body.tbs = tbsMap[timeRange];
  const data = await httpJson("https://google.serper.dev/search", { method: "POST", headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const results = (data.organic || []).slice(0, maxResults).map((item: any, i: number) => ({ title: item.title || "", url: item.link || "", snippet: item.snippet || "", score: Number((1 - i * 0.1).toFixed(2)), date: item.date }));
  const answer = data?.answerBox?.answer || data?.answerBox?.snippet || data?.knowledgeGraph?.description || results[0]?.snippet || "";
  return { provider: "serper", query, results, images: [], answer, knowledge_graph: data.knowledgeGraph, related_searches: (data.relatedSearches || []).map((r: any) => r.query) };
}

async function searchTavily(query: string, apiKey: string, maxResults: number, includeDomains?: string[], excludeDomains?: string[]): Promise<SearchResponse> {
  const body: Json = { api_key: apiKey, query, max_results: maxResults, search_depth: "basic", topic: "general", include_images: false, include_answer: true, include_raw_content: false };
  if (includeDomains?.length) body.include_domains = includeDomains;
  if (excludeDomains?.length) body.exclude_domains = excludeDomains;
  const data = await httpJson("https://api.tavily.com/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const results = (data.results || []).slice(0, maxResults).map((item: any) => ({ title: item.title || "", url: item.url || "", snippet: item.content || "", score: Number((item.score || 0).toFixed(3)) }));
  return { provider: "tavily", query, results, images: data.images || [], answer: data.answer || "" };
}

async function searchQuerit(query: string, apiKey: string, maxResults: number, timeRange?: string, includeDomains?: string[], excludeDomains?: string[]): Promise<SearchResponse> {
  const timeMap: Record<string, string> = { day: "d1", week: "w1", month: "m1", year: "y1" };
  const filters: Json = { languages: { include: ["en"] }, geo: { countries: { include: ["US"] } } };
  if (includeDomains?.length || excludeDomains?.length) {
    filters.sites = {};
    if (includeDomains?.length) filters.sites.include = includeDomains;
    if (excludeDomains?.length) filters.sites.exclude = excludeDomains;
  }
  if (timeRange && timeMap[timeRange]) filters.timeRange = { date: timeMap[timeRange] };
  const body: Json = { query, count: maxResults, filters };
  const data = await httpJson("https://api.querit.ai/v1/search", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (data.error_msg || (data.error_code != null && ![0, 200].includes(data.error_code))) throw new ProviderRequestError(data.error_msg || `Querit request failed with error_code=${data.error_code}`);
  const raw = data?.results?.result || [];
  const results = raw.slice(0, maxResults).map((item: any, i: number) => ({ title: item.title || titleFromUrl(item.url || ""), url: item.url || "", snippet: item.snippet || item.page_age || "", score: Number((1 - i * 0.05).toFixed(3)), page_time: item.page_time, date: item.page_age, language: item.language }));
  return { provider: "querit", query, results, images: [], answer: results[0]?.snippet || "", metadata: { search_id: data.search_id, time_range: timeRange && timeMap[timeRange] } };
}

async function searchExa(query: string, apiKey: string, maxResults: number, exaDepth: "normal" | "deep" | "deep-reasoning", includeDomains?: string[], excludeDomains?: string[]): Promise<SearchResponse> {
  const isDeep = exaDepth === "deep" || exaDepth === "deep-reasoning";
  const body: Json = isDeep
    ? { query, numResults: maxResults, type: exaDepth, contents: { text: { maxCharacters: 5000, verbosity: "full" } } }
    : { query, numResults: maxResults, type: "neural", contents: { text: { maxCharacters: 2000, verbosity: "standard" }, highlights: { numSentences: 3, highlightsPerUrl: 2 } } };
  if (includeDomains?.length) body.includeDomains = includeDomains;
  if (excludeDomains?.length) body.excludeDomains = excludeDomains;
  const data = await httpJson("https://api.exa.ai/search", { method: "POST", headers: { "x-api-key": apiKey, "Content-Type": "application/json" }, body: JSON.stringify(body) }, isDeep ? 55000 : 30000);

  if (isDeep) {
    const deepOutput = data.output || {};
    const synthesis = typeof deepOutput.content === "string" ? deepOutput.content : deepOutput.content ? JSON.stringify(deepOutput.content) : "";
    const grounding: any[] = [];
    for (const field of deepOutput.grounding || []) {
      for (const cite of field.citations || []) grounding.push({ url: cite.url || "", title: cite.title || "", confidence: field.confidence, field: field.field });
    }
    const results: SearchResult[] = [];
    if (synthesis) results.push({ title: `Exa ${exaDepth.replace(/-/g, " ")} synthesis`, url: "", snippet: synthesis, full_synthesis: synthesis, score: 1, grounding: grounding.slice(0, 10), type: "synthesis" });
    for (const item of (data.results || []).slice(0, maxResults)) {
      const snippet = item.text ? String(item.text).slice(0, 800) : (item.highlights || [])[0] || "";
      results.push({ title: item.title || "", url: item.url || "", snippet, score: Number((item.score || 0).toFixed(3)), published_date: item.publishedDate, author: item.author, type: "source" });
    }
    return { provider: "exa", query, exa_depth: exaDepth, results, images: [], answer: synthesis || results[1]?.snippet || "", grounding, metadata: { synthesis_length: synthesis.length, source_count: (data.results || []).length } };
  }

  const results = (data.results || []).slice(0, maxResults).map((item: any) => ({ title: item.title || "", url: item.url || "", snippet: item.text ? String(item.text).slice(0, 800) : Array.isArray(item.highlights) ? item.highlights.slice(0, 2).join(" ... ") : "", score: Number((item.score || 0).toFixed(3)), published_date: item.publishedDate, author: item.author }));
  return { provider: "exa", query, results, images: [], answer: results[0]?.snippet || "" };
}

async function searchPerplexity(query: string, apiKey: string, maxResults: number, timeRange?: string): Promise<SearchResponse> {
  const body: Json = {
    model: "perplexity/sonar-pro",
    messages: [
      { role: "system", content: "Answer with concise factual summary and include source URLs." },
      { role: "user", content: query },
    ],
    temperature: 0.2,
  };
  if (timeRange) body.search_recency_filter = timeRange;
  const data = await httpJson("https://api.kilo.ai/api/gateway/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const answer = String(data?.choices?.[0]?.message?.content || "").trim();
  let citations = Array.isArray(data?.citations) ? data.citations : [];
  if (!citations.length) {
    const matches = answer.match(/https?:\/\/[^\s)\]}>"']+/g) || [];
    citations = [...new Set(matches)];
  }
  const results: SearchResult[] = [];
  if (answer) results.push({ title: `Perplexity Answer: ${query.slice(0, 80)}`, url: "https://www.perplexity.ai", snippet: answer.replace(/\[\d+\]/g, "").trim().slice(0, 500), score: 1.0 });
  for (const [i, citation] of citations.slice(0, Math.max(0, maxResults - 1)).entries()) {
    const url = typeof citation === "string" ? citation : citation?.url || "";
    const title = typeof citation === "string" ? titleFromUrl(url) : citation?.title || titleFromUrl(url);
    results.push({ title, url, snippet: `Source cited in Perplexity answer [citation ${i + 1}]`, score: Number((0.9 - i * 0.1).toFixed(3)) });
  }
  return { provider: "perplexity", query, results, images: [], answer, metadata: { model: body.model, usage: data.usage || {} } };
}

async function searchYou(query: string, apiKey: string, maxResults: number, timeRange?: string): Promise<SearchResponse> {
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
  const results = web.slice(0, maxResults).map((item: any, i: number) => ({ title: item.title || "", url: item.url || "", snippet: item?.snippets?.[0] || item.description || "", score: Number((1 - i * 0.05).toFixed(3)), date: item.page_age, source: "web", additional_snippets: Array.isArray(item.snippets) ? item.snippets.slice(1, 3) : undefined, thumbnail: item.thumbnail_url, favicon: item.favicon_url }));
  const answer = results.slice(0, 3).map((r) => r.snippet).filter(Boolean).join(" ").slice(0, 1000);
  return { provider: "you", query, results, news: news.slice(0, 5), images: [], answer, metadata: { search_uuid: data?.metadata?.search_uuid, latency: data?.metadata?.latency } };
}

async function searchSearxng(query: string, instanceUrl: string, maxResults: number, timeRange: string | undefined, env: Record<string, string>): Promise<SearchResponse> {
  const base = await validateSearxngUrl(instanceUrl, env);
  const url = new URL(`${base}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("language", "en");
  url.searchParams.set("safesearch", "0");
  if (timeRange) url.searchParams.set("time_range", timeRange);
  const data = await httpJson(url.toString(), { method: "GET", headers: { Accept: "application/json" } });
  const enginesUsed = new Set<string>();
  const results = (data.results || []).slice(0, maxResults).map((item: any, i: number) => {
    enginesUsed.add(item.engine || "unknown");
    return { title: item.title || "", url: item.url || "", snippet: item.content || "", score: Number((item.score ?? (1 - i * 0.05)).toFixed(3)), engine: item.engine || "unknown", category: item.category || "general", date: item.publishedDate };
  });
  const answer = Array.isArray(data.answers) && data.answers[0] ? String(data.answers[0]) : Array.isArray(data.infoboxes) && data.infoboxes[0] ? String(data.infoboxes[0].content || data.infoboxes[0].infobox || "") : results[0]?.snippet || "";
  return { provider: "searxng", query, results, images: [], answer, suggestions: data.suggestions || [], corrections: data.corrections || [], metadata: { number_of_results: data.number_of_results, engines_used: [...enginesUsed], instance_url: base } };
}

async function executeWithRetry(fn: () => Promise<SearchResponse>): Promise<SearchResponse> {
  let lastError: any;
  for (let attempt = 0; attempt < RETRY_BACKOFF_MS.length; attempt += 1) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (!(error instanceof ProviderRequestError) || !error.transient || error.statusCode === 401 || error.statusCode === 403) break;
      if (attempt < RETRY_BACKOFF_MS.length - 1) await sleep(RETRY_BACKOFF_MS[attempt]);
    }
  }
  throw lastError;
}

export default function (api: any) {
  const pluginConfig: Record<string, string> = (api.pluginConfig ?? {}) as Record<string, string>;
  const runtimeEnv = getRuntimeEnv(pluginConfig);

  api.registerTool(
    {
      name: "web_search_plus",
      description:
        "Search the web with intelligent multi-provider routing across Serper, Tavily, Querit, Exa, Perplexity, You.com, and SearXNG. Auto-selects the best provider, caches results, retries transient failures, and falls back across providers.",
      parameters: PARAMETERS_SCHEMA,
      async execute(_id: string, params: ToolParams) {
        try {
          const query = String(params.query || "").trim();
          if (!query) return { content: [{ type: "text", text: "Search failed: query is required" }] };

          const count = Math.max(1, Math.min(10, Math.floor(Number(params.count || 5))));
          const requestedProvider = (params.provider || "auto") as ProviderName | "auto";
          const timeRange = toTimeRange(params.time_range);
          const includeDomains = Array.isArray(params.include_domains) ? params.include_domains.filter(Boolean) : undefined;
          const excludeDomains = Array.isArray(params.exclude_domains) ? params.exclude_domains.filter(Boolean) : undefined;

          const allProviders: ProviderName[] = ["serper", "tavily", "querit", "exa", "perplexity", "you", "searxng"];
          const configuredProviders = allProviders.filter((p) => !!getApiKey(p, runtimeEnv));

          let routingInfo: Json;
          let provider: ProviderName;
          if (requestedProvider === "auto") {
            const analyzer = new QueryAnalyzer();
            const routing = analyzer.route(query, configuredProviders);
            provider = routing.provider;
            routingInfo = { auto_routed: true, provider, confidence: routing.confidence, confidence_level: routing.confidence_level, reason: routing.reason, top_signals: routing.top_signals, scores: routing.scores, exa_depth: routing.exa_depth };
          } else {
            provider = requestedProvider;
            routingInfo = { auto_routed: false, provider };
          }

          const priority: ProviderName[] = ["tavily", "querit", "exa", "perplexity", "serper", "you", "searxng"];
          const providersToTry: ProviderName[] = [provider, ...priority.filter((p) => p !== provider && configuredProviders.includes(p))];
          const eligibleProviders: ProviderName[] = [];
          const cooldownSkips: Json[] = [];
          for (const p of providersToTry) {
            const cooldown = providerInCooldown(p);
            if (cooldown.inCooldown) cooldownSkips.push({ provider: p, cooldown_remaining_seconds: cooldown.remaining });
            else eligibleProviders.push(p);
          }
          if (!eligibleProviders.length) eligibleProviders.push(provider);

          const cacheContext = {
            time_range: timeRange,
            include_domains: includeDomains ? [...includeDomains].sort() : null,
            exclude_domains: excludeDomains ? [...excludeDomains].sort() : null,
            exa_depth: params.depth || routingInfo.exa_depth || "normal",
          };

          const cached = cacheGet(query, provider, count, DEFAULT_CACHE_TTL, cacheContext);
          if (cached) {
            const result = { ...cached };
            for (const key of Object.keys(result)) if (key.startsWith("_cache_")) delete result[key];
            result.cached = true;
            result.cache_age_seconds = Math.floor(Date.now() / 1000 - Number(cached._cache_timestamp || 0));
            result.routing = { ...routingInfo, ...(cooldownSkips.length ? { cooldown_skips: cooldownSkips } : {}) };
            return { content: [{ type: "text", text: JSON.stringify(sanitizeOutput(result)) }] };
          }

          const errors: Json[] = [];
          const successes: Array<[string, SearchResponse]> = [];

          const runProvider = async (p: ProviderName): Promise<SearchResponse> => {
            const key = validateApiKey(p, runtimeEnv);
            if (p === "serper") return searchSerper(query, key, count, timeRange);
            if (p === "tavily") return searchTavily(query, key, count, includeDomains, excludeDomains);
            if (p === "querit") return searchQuerit(query, key, count, timeRange, includeDomains, excludeDomains);
            if (p === "exa") {
              const exaDepth = (params.depth || routingInfo.exa_depth || "normal") as "normal" | "deep" | "deep-reasoning";
              return searchExa(query, key, count, exaDepth, includeDomains, excludeDomains);
            }
            if (p === "perplexity") return searchPerplexity(query, key, count, timeRange);
            if (p === "you") return searchYou(query, key, count, timeRange);
            return searchSearxng(query, key, count, timeRange, runtimeEnv);
          };

          for (const p of eligibleProviders) {
            try {
              const result = await executeWithRetry(() => runProvider(p));
              resetProviderHealth(p);
              successes.push([p, result]);
              if ((result.results || []).length >= count || errors.length === 0) break;
            } catch (error: any) {
              const message = sanitizeOutput(String(error?.message || error));
              const cooldown = markProviderFailure(p, message);
              errors.push({ provider: p, error: message, cooldown_seconds: cooldown.cooldown_seconds });
            }
          }

          if (!successes.length) {
            return { content: [{ type: "text", text: JSON.stringify(sanitizeOutput({ error: "All providers failed", provider, query, routing: routingInfo, provider_errors: errors, cooldown_skips: cooldownSkips })) }] };
          }

          let result: SearchResponse;
          if (successes.length === 1) {
            result = successes[0][1];
          } else {
            result = { ...successes[0][1] };
            const deduped = deduplicateResultsAcrossProviders(successes, count);
            result.results = deduped.results;
            result.deduplicated = deduped.dedupCount > 0;
            result.metadata = { ...(result.metadata || {}), dedup_count: deduped.dedupCount, providers_merged: successes.map(([p]) => p) };
          }

          const successfulProvider = successes[0][0] as ProviderName;
          if (successfulProvider !== provider) {
            routingInfo = { ...routingInfo, fallback_used: true, original_provider: provider, provider: successfulProvider, fallback_errors: errors };
          }
          if (cooldownSkips.length) routingInfo.cooldown_skips = cooldownSkips;
          result.routing = routingInfo;
          result.cached = false;
          if (!(result as any).metadata) result.metadata = {};
          if ((result as any).deduplicated == null) (result as any).deduplicated = false;
          if ((result.metadata as any).dedup_count == null) (result.metadata as any).dedup_count = 0;

          cachePut(query, successfulProvider, count, result, cacheContext);

          return { content: [{ type: "text", text: JSON.stringify(sanitizeOutput(result)) }] };
        } catch (error: any) {
          return { content: [{ type: "text", text: `Search failed: ${sanitizeOutput(String(error?.message || error))}` }] };
        }
      },
    },
    { optional: true },
  );
}
