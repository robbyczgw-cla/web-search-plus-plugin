import dns from "dns/promises";
import net from "net";
import type { RuntimeConfig } from "./runtime-config.ts";
import { DEFAULT_EXTRACT_PROVIDER_PRIORITY, type ExtractProviderName } from "./routing-config.ts";
import { selectSpans, type SemanticSpan } from "./span-extraction.ts";
import { extractHound } from "./hound-provider.ts";

type Json = Record<string, any>;

export type { ExtractProviderName } from "./routing-config.ts";
export type ExtractFormat = "markdown" | "html";

export type ExtractImage = {
  alt?: string;
  url: string;
};

export type ExtractResult = {
  url: string;
  title: string;
  content: string;
  raw_content: string;
  provider: ExtractProviderName;
  images?: ExtractImage[];
  raw_html?: string;
  metadata?: Json;
  error?: string;
  truncated?: boolean;
  original_chars?: number;
  span_contract_version?: 1;
  spans?: Array<SemanticSpan & { within_preview: boolean }>;
};

export type ExtractResponse = {
  provider: string;
  results: ExtractResult[];
  status?: "success" | "degraded" | "failed";
  warnings?: Json[];
  limits_applied?: {
    extract: {
      requested_url_count: number;
      processed_urls: string[];
      omitted_urls: string[];
      omitted_url_count: number;
      max_urls: number;
      max_context_chars: number;
      context_chars_returned: number;
      truncated: boolean;
    };
  };
  error?: string;
  fallback_errors?: Json[];
  routing?: {
    provider?: string;
    requested_provider: string;
    fallback_used?: boolean;
    fallback_errors?: Json[];
  };
};

// Extraction fallback order: Tavily-first stays; Keenable is a low-priority
// fallback and Serper's webpage scraper is a last-resort fallback at the end.
export const EXTRACT_PROVIDER_PRIORITY: ExtractProviderName[] = [...DEFAULT_EXTRACT_PROVIDER_PRIORITY];
export const EXTRACT_PARAMETERS_SCHEMA = {
  type: "object",
  required: ["urls"],
  properties: {
    urls: { type: "array", items: { type: "string" }, description: "URLs to extract" },
    provider: {
      type: "string",
      enum: ["auto", "firecrawl", "linkup", "tavily", "exa", "parallel", "you", "keenable", "serper", "hound"],
      description: "Force a provider, or use auto fallback routing (default: auto)",
    },
    format: {
      type: "string",
      enum: ["markdown", "html"],
      description: "Output format for extracted content (default: markdown)",
    },
    include_images: { type: "boolean", description: "Include image metadata when supported" },
    include_raw_html: { type: "boolean", description: "Include raw HTML when supported" },
    render_js: { type: "boolean", description: "Render JavaScript before extraction when supported" },
    max_urls: {
      type: "integer",
      minimum: 1,
      maximum: 50,
      description: "Maximum URLs to process in request order (default/operator ceiling: 10)",
    },
    max_context_chars: {
      type: "integer",
      minimum: 1000,
      maximum: 200000,
      description: "Aggregate inline content budget in Unicode codepoints (default/operator ceiling: 60000)",
    },
    spans: {
      type: "boolean",
      description: "Return deterministic query-conditioned passages with Unicode codepoint offsets",
    },
    spans_query: {
      type: "string",
      description: "Optional ranking query for spans; lexical-density ranking is used when omitted",
    },
  },
};

function titleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const lastSegment = parsed.pathname.split("/").filter(Boolean).pop();
    return lastSegment || parsed.hostname || url;
  } catch {
    return url;
  }
}

function normalizeExtractResult(
  provider: ExtractProviderName,
  url: string,
  title = "",
  content = "",
  rawContent?: string,
  extra: Partial<Omit<ExtractResult, "url" | "title" | "content" | "raw_content" | "provider">> = {},
): ExtractResult {
  const result: ExtractResult = {
    url,
    title: title || titleFromUrl(url),
    content: content || "",
    raw_content: rawContent ?? content ?? "",
    provider,
  };
  for (const [key, value] of Object.entries(extra)) {
    if (value != null) (result as any)[key] = value;
  }
  return result;
}

function normalizeImages(images: any): ExtractImage[] | undefined {
  if (!Array.isArray(images)) return undefined;
  const normalized = images
    .map((image) => {
      if (!image) return null;
      if (typeof image === "string") return { url: image };
      if (typeof image.url === "string" && image.url) {
        return { alt: typeof image.alt === "string" ? image.alt : undefined, url: image.url };
      }
      return null;
    })
    .filter(Boolean) as ExtractImage[];
  return normalized.length ? normalized : undefined;
}

async function requestJson(url: string, init: RequestInit, timeout = 30): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, timeout) * 1000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let data: any = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        // Decode failures are provider errors, not crashes: surface a clear
        // message so retry/fallback and per-URL error items stay meaningful.
        if (response.ok) throw new Error(`Provider returned invalid JSON (HTTP ${response.status})`);
      }
    }
    if (!response.ok) {
      const message = data?.error || data?.message || data?.detail || data?.warning || `HTTP ${response.status}`;
      throw new Error(String(message));
    }
    return data;
  } catch (error: any) {
    if (error?.name === "AbortError") throw new Error(`Request timed out after ${timeout}s`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function getExtractApiKey(provider: ExtractProviderName, runtimeConfig: RuntimeConfig): string | undefined {
  const keyMap: Record<ExtractProviderName, string | undefined> = {
    firecrawl: runtimeConfig.firecrawlApiKey,
    linkup: runtimeConfig.linkupApiKey,
    tavily: runtimeConfig.tavilyApiKey,
    exa: runtimeConfig.exaApiKey,
    you: runtimeConfig.youApiKey,
    parallel: runtimeConfig.parallelApiKey,
    keenable: runtimeConfig.keenableApiKey,
    serper: runtimeConfig.serperApiKey,
    hound: runtimeConfig.houndMcpUrl,
  };
  return keyMap[provider];
}

// Keenable can run keyless when the operator opted into the public tier.
function keylessPublicAllowed(provider: ExtractProviderName, runtimeConfig: RuntimeConfig): boolean {
  return provider === "keenable" && runtimeConfig.keenableAllowPublic === true;
}

export function hasAnyExtractProviderCredential(runtimeConfig: RuntimeConfig): boolean {
  return EXTRACT_PROVIDER_PRIORITY.some((provider) => Boolean(getExtractApiKey(provider, runtimeConfig)) || keylessPublicAllowed(provider, runtimeConfig));
}

// --- Private/internal extraction target guard (SSRF) -----------------------
// Rejects target URLs that point at loopback, RFC1918, CGNAT/shared-address,
// link-local, ULA, mapped-private, multicast, unspecified, or cloud-metadata
// destinations before any provider (remote or operator-local) fetches them.
// Operator-configured provider endpoints are intentionally not checked here;
// this guard only covers user/agent-controlled target URLs. Trusted intranet
// extraction can be opted into with pluginConfig.extractAllowPrivateUrls=true.

const BLOCKED_EXTRACT_HOSTS = new Set(["localhost", "metadata.google.internal", "metadata.internal"]);

export function isPrivateOrInternalIp(value: string): boolean {
  const family = net.isIP(value);
  if (family === 4) {
    const octets = value.split(".").map(Number);
    const [a, b] = octets;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT / shared address space
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 192 && b === 0 && octets[2] === 0) return true; // IETF protocol assignments
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
    if (a >= 224) return true; // multicast + reserved + broadcast
    return false;
  }
  if (family === 6) {
    const lower = value.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
    if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true; // link-local
    if (lower.startsWith("ff")) return true; // multicast
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateOrInternalIp(mapped[1]);
    return false;
  }
  return false;
}

export async function validateExtractUrls(urls: string[], runtimeConfig: RuntimeConfig): Promise<void> {
  if (runtimeConfig.extractAllowPrivateUrls === true) return;
  for (const url of urls) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error(`Invalid URL: ${url}`);
    }
    const hostname = parsed.hostname.trim().toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
    if (!hostname) throw new Error(`Invalid URL — hostname is required: ${url}`);
    if (BLOCKED_EXTRACT_HOSTS.has(hostname)) throw new Error(`Extraction URL blocked: ${hostname} is private/internal`);
    if (net.isIP(hostname)) {
      if (isPrivateOrInternalIp(hostname)) throw new Error(`Extraction URL blocked: ${hostname} is private/internal`);
      continue;
    }
    const records = await dns.lookup(hostname, { all: true, verbatim: true }).catch(() => [] as dns.LookupAddress[]);
    if (!records.length) throw new Error(`Extraction URL blocked: cannot resolve hostname ${hostname}`);
    for (const record of records) {
      if (isPrivateOrInternalIp(record.address)) {
        throw new Error(`Extraction URL blocked: ${hostname} resolves to private/internal IP ${record.address}`);
      }
    }
  }
}

export async function extractFirecrawl(
  urls: string[],
  apiKey: string,
  outputFormat: ExtractFormat = "markdown",
  includeImages = false,
  includeRawHtml = false,
  renderJs = false,
  apiUrl = "https://api.firecrawl.dev/v2/scrape",
  timeout = 60,
): Promise<ExtractResponse> {
  const formats = outputFormat === "html" ? ["html"] : ["markdown"];
  if (includeRawHtml && !formats.includes("html")) formats.push("html");

  const results: ExtractResult[] = [];
  for (const url of urls) {
    try {
      const body: Json = { url, formats };
      if (renderJs) body.waitFor = 1000;
      const data = await requestJson(apiUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }, timeout);

      if (data?.success === false) {
        results.push(normalizeExtractResult("firecrawl", url, "", "", undefined, { error: String(data.error || data.warning || "Firecrawl scrape failed") }));
        continue;
      }

      const payload = data?.data && typeof data.data === "object" ? data.data : data;
      const metadata = payload?.metadata && typeof payload.metadata === "object" ? payload.metadata : {};
      const finalUrl = metadata.sourceURL || metadata.url || url;
      const title = metadata.title || "";
      const markdown = String(payload?.markdown || "");
      const html = String(payload?.html || payload?.rawHtml || "");
      const content = outputFormat === "html" ? html : markdown || html;

      let images: ExtractImage[] | undefined;
      if (includeImages) {
        const seen = new Set<string>();
        const parsedImages: ExtractImage[] = [];
        const ogImage = metadata.ogImage || metadata["og:image"];
        if (typeof ogImage === "string" && ogImage && !seen.has(ogImage)) {
          parsedImages.push({ alt: "og:image", url: ogImage });
          seen.add(ogImage);
        }
        for (const match of markdown.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) {
          const imageUrl = match[2];
          if (!imageUrl || seen.has(imageUrl)) continue;
          parsedImages.push({ alt: match[1] || undefined, url: imageUrl });
          seen.add(imageUrl);
        }
        images = parsedImages.length ? parsedImages : undefined;
      }

      results.push(normalizeExtractResult("firecrawl", finalUrl, title, content, content, {
        raw_html: html || undefined,
        images,
        metadata,
      }));
    } catch (error: any) {
      results.push(normalizeExtractResult("firecrawl", url, "", "", undefined, { error: String(error?.message || error) }));
    }
  }

  return { provider: "firecrawl", results };
}

export async function extractLinkup(
  urls: string[],
  apiKey: string,
  outputFormat: ExtractFormat = "markdown",
  includeImages = false,
  includeRawHtml = false,
  renderJs = false,
  apiUrl = "https://api.linkup.so/v1/fetch",
  timeout = 30,
): Promise<ExtractResponse> {
  const results: ExtractResult[] = [];
  for (const url of urls) {
    try {
      const data = await requestJson(apiUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          extractImages: includeImages,
          includeRawHtml: includeRawHtml || outputFormat === "html",
          renderJs,
        }),
      }, timeout);

      if (data?.error) {
        results.push(normalizeExtractResult("linkup", url, "", "", undefined, { error: String(data.error) }));
        continue;
      }

      const markdown = String(data?.markdown || "");
      const rawHtml = String(data?.rawHtml || data?.raw_html || "");
      const content = outputFormat === "html" ? rawHtml : markdown || rawHtml;
      results.push(normalizeExtractResult("linkup", url, "", content, content, {
        raw_html: rawHtml || undefined,
        images: includeImages ? normalizeImages(data?.images) : undefined,
        metadata: data?.metadata && typeof data.metadata === "object" ? data.metadata : undefined,
      }));
    } catch (error: any) {
      results.push(normalizeExtractResult("linkup", url, "", "", undefined, { error: String(error?.message || error) }));
    }
  }
  return { provider: "linkup", results };
}

export async function extractTavily(
  urls: string[],
  apiKey: string,
  outputFormat: ExtractFormat = "markdown",
  includeImages = false,
  _includeRawHtml = false,
  _renderJs = false,
  apiUrl = "https://api.tavily.com/extract",
  timeout = 30,
): Promise<ExtractResponse> {
  void outputFormat;
  const data = await requestJson(apiUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ urls, include_images: includeImages }),
  }, timeout);

  const results: ExtractResult[] = [];
  for (const item of Array.isArray(data?.results) ? data.results : []) {
    const url = String(item?.url || "");
    const content = String(item?.raw_content || item?.content || "");
    results.push(normalizeExtractResult("tavily", url, String(item?.title || ""), content, content, {
      images: includeImages ? normalizeImages(item?.images) : undefined,
      metadata: item?.metadata && typeof item.metadata === "object" ? item.metadata : undefined,
    }));
  }
  for (const failed of Array.isArray(data?.failed_results) ? data.failed_results : []) {
    results.push(normalizeExtractResult("tavily", String(failed?.url || ""), "", "", undefined, {
      error: String(failed?.error || "Tavily extract failed"),
    }));
  }

  return { provider: "tavily", results };
}

export async function extractExa(
  urls: string[],
  apiKey: string,
  outputFormat: ExtractFormat = "markdown",
  includeImages = false,
  _includeRawHtml = false,
  _renderJs = false,
  apiUrl = "https://api.exa.ai/contents",
  timeout = 30,
): Promise<ExtractResponse> {
  void outputFormat;
  const data = await requestJson(apiUrl, {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ urls, text: true }),
  }, timeout);

  const results = (Array.isArray(data?.results) ? data.results : []).map((item: any) => {
    const url = String(item?.url || item?.id || "");
    const content = String(item?.text || item?.summary || "");
    const metadata: Json = {};
    if (item?.summary != null) metadata.summary = item.summary;
    if (item?.highlights != null) metadata.highlights = item.highlights;
    if (item?.publishedDate != null) metadata.published_date = item.publishedDate;
    if (item?.author != null) metadata.author = item.author;
    if (item?.favicon != null) metadata.favicon = item.favicon;
    return normalizeExtractResult("exa", url, String(item?.title || ""), content, content, {
      images: includeImages && item?.image ? [{ alt: "image", url: String(item.image) }] : undefined,
      metadata: Object.keys(metadata).length ? metadata : undefined,
    });
  });

  return { provider: "exa", results };
}

// Default Parallel full_content budgets: high enough that long pages are
// evaluated fairly against other extraction providers instead of being
// silently capped. Operators can lower them via
// pluginConfig.parallelMaxCharsPerResult / parallelMaxCharsTotal.
export const PARALLEL_MAX_CHARS_PER_RESULT = 60000;
export const PARALLEL_MAX_CHARS_TOTAL = 120000;

export async function extractParallel(
  urls: string[],
  apiKey: string,
  outputFormat: ExtractFormat = "markdown",
  _includeImages = false,
  includeRawHtml = false,
  _renderJs = false,
  budgets: { maxCharsPerResult?: number; maxCharsTotal?: number } = {},
  apiUrl = "https://api.parallel.ai/v1beta/tasks/extract",
  timeout = 30,
): Promise<ExtractResponse> {
  const data = await requestJson(apiUrl, {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      urls,
      max_chars_total: budgets.maxCharsTotal ?? PARALLEL_MAX_CHARS_TOTAL,
      advanced_settings: { full_content: { max_chars_per_result: budgets.maxCharsPerResult ?? PARALLEL_MAX_CHARS_PER_RESULT } },
    }),
  }, timeout);

  const rawItems = Array.isArray(data?.results) ? data.results : Array.isArray(data?.data) ? data.data : [];
  const results = rawItems.map((item: any) => {
    const url = String(item?.url || item?.source_url || "");
    const excerpts = Array.isArray(item?.excerpts) ? item.excerpts : Array.isArray(item?.snippets) ? item.snippets : [];
    const markdown = String(item?.markdown || item?.content || item?.text || excerpts.join("\n\n") || "");
    const html = String(item?.html || item?.raw_html || "");
    const content = outputFormat === "html" ? html || markdown : markdown || html;
    return normalizeExtractResult("parallel", url, String(item?.title || ""), content, content, {
      raw_html: includeRawHtml ? html || undefined : undefined,
      metadata: { search_id: data?.search_id, session_id: data?.session_id },
    });
  });
  return { provider: "parallel", results };
}

export async function extractYou(
  urls: string[],
  apiKey: string,
  outputFormat: ExtractFormat = "markdown",
  includeImages = false,
  includeRawHtml = false,
  _renderJs = false,
  apiUrl = "https://ydc-index.io/v1/contents",
  timeout = 30,
): Promise<ExtractResponse> {
  void includeImages;
  const formats = [outputFormat === "html" ? "html" : "markdown"];
  if (includeRawHtml && !formats.includes("html")) formats.push("html");
  if (!formats.includes("metadata")) formats.push("metadata");
  const data = await requestJson(apiUrl, {
    method: "POST",
    headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ urls, formats, crawl_timeout: Math.max(1, Math.min(timeout, 60)) }),
  }, timeout);

  const rawItems = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : Array.isArray(data?.data) ? data.data : [];
  const results = rawItems.map((item: any) => {
    const url = String(item?.url || "");
    const markdown = String(item?.markdown || "");
    const html = String(item?.html || "");
    const content = outputFormat === "html" ? html : markdown || html;
    return normalizeExtractResult("you", url, String(item?.title || ""), content, content, {
      raw_html: html || undefined,
      metadata: item?.metadata && typeof item.metadata === "object" ? item.metadata : undefined,
    });
  });

  return { provider: "you", results };
}

// --- Truncate-and-sanitize output handling (Hermes v2.8 parity) ------------
// Hermes stores the full cleaned text under cache/web and pages it on demand;
// this plugin is scanner-safe with no filesystem writes, so long pages return
// a head/tail window plus an explanatory footer instead of a page-on-demand
// pointer. Inline base64 image data is replaced with [IMAGE: alt] placeholders
// before measuring content, preventing data-URI token bombs while preserving
// normal http(s) image links.

const BASE64_MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\(\s*data:image\/[^)]+\)/gi;
const BASE64_HTML_IMAGE_RE = /<img\b(?=[^>]*\bsrc=["']data:image\/)[^>]*>/gi;
export const DEFAULT_EXTRACT_CHAR_LIMIT = 15000;
export const DEFAULT_EXTRACT_MAX_URLS = 10;
export const HARD_EXTRACT_MAX_URLS = 50;
export const DEFAULT_EXTRACT_MAX_CONTEXT_CHARS = 60000;
export const MIN_EXTRACT_MAX_CONTEXT_CHARS = 1000;
export const HARD_EXTRACT_MAX_CONTEXT_CHARS = 200000;

export type ExtractContextOptions = {
  maxUrls?: number;
  maxContextChars?: number;
  spans?: boolean;
  spansQuery?: string;
  autoAllow?: Partial<Record<ExtractProviderName, boolean>>;
};

function normalizedCodepoints(content: string): string[] {
  return Array.from(content.normalize("NFC"));
}

function codepointLength(content: string): number {
  return normalizedCodepoints(content).length;
}

export function sanitizeExtractContent(content: string): string {
  let out = content.replace(BASE64_MARKDOWN_IMAGE_RE, (_match, alt) => `[IMAGE: ${String(alt || "image").trim() || "image"}]`);
  out = out.replace(BASE64_HTML_IMAGE_RE, (tag: string) => {
    const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
    const alt = (altMatch?.[1] || "image").trim() || "image";
    return `[IMAGE: ${alt}]`;
  });
  return out;
}

function splitExtractContent(content: string, limit: number): { head: string; tail: string; omittedChars: number } {
  const codepoints = normalizedCodepoints(content);
  const headChars = Math.min(Math.max(1, Math.floor((limit * 2) / 3)), Math.max(1, limit - 1));
  const tailChars = Math.min(Math.max(1, Math.floor(limit * 0.2)), Math.max(1, limit - headChars));
  if (headChars + tailChars >= codepoints.length) return { head: codepoints.join(""), tail: "", omittedChars: 0 };
  const head = codepoints.slice(0, headChars).join("").replace(/\s+$/, "");
  const tail = codepoints.slice(-tailChars).join("").replace(/^\s+/, "");
  return { head, tail, omittedChars: Math.max(0, codepoints.length - codepointLength(head) - codepointLength(tail)) };
}

// Return inline-safe extract content: sanitized, and truncated to a head/tail
// window when it exceeds the limit.
export function formatTruncatedExtractContent(content: string, limit: number): { content: string; truncated: boolean; originalChars: number } {
  const cleaned = sanitizeExtractContent(content).normalize("NFC");
  const originalChars = codepointLength(cleaned);
  if (originalChars <= limit) return { content: cleaned, truncated: false, originalChars };
  const { head, tail, omittedChars } = splitExtractContent(cleaned, limit);
  const footer = [
    "",
    "---",
    `[Content truncated: original ${originalChars} chars; omitted middle ${omittedChars} chars; showing head and tail.]`,
    "Raise pluginConfig.extractCharLimit for a larger inline budget, or extract a more specific URL for the omitted section.",
  ].join("\n");
  return { content: `${head}\n\n[... omitted middle ...]\n\n${tail}\n${footer}`, truncated: true, originalChars };
}

// Stable water-filling: short documents return unused allocation to longer
// peers, and indivisible remainder goes to earlier results.
export function fairShareAllocations(lengths: number[], budget: number): number[] {
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

function boundedInteger(value: number | undefined, fallback: number, minimum: number, maximum: number): number {
  if (value == null) return fallback;
  if (!Number.isInteger(value)) throw new Error("Extraction context limits must be integers");
  return Math.min(maximum, Math.max(minimum, value));
}

// A present key always uses the authenticated route; with no key, the keyless
// /public route is used when the public tier is enabled.
function keenableExtractEndpoint(apiUrl: string, apiKey: string | undefined, publicAllowed: boolean): { url: string; headers: Json } {
  const headers: Json = { "X-Keenable-Title": "web-search-plus-plugin" };
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
    return { url: apiUrl, headers };
  }
  if (publicAllowed) return { url: `${apiUrl}/public`, headers };
  throw new Error("Keenable requires an API key or an enabled public endpoint");
}

export async function extractKeenable(
  urls: string[],
  apiKey: string | undefined,
  _outputFormat: ExtractFormat = "markdown",
  _includeImages = false,
  _includeRawHtml = false,
  _renderJs = false,
  publicAllowed = false,
  apiUrl = "https://api.keenable.ai/v1/fetch",
  timeout = 30,
): Promise<ExtractResponse> {
  const endpoint = keenableExtractEndpoint(apiUrl, apiKey, publicAllowed);
  const results: ExtractResult[] = [];
  for (const url of urls) {
    try {
      const data = await requestJson(`${endpoint.url}?url=${encodeURIComponent(url)}`, {
        method: "GET",
        headers: endpoint.headers,
      }, timeout);
      const content = String(data?.content || "");
      const metadata: Json = {};
      if (data?.author != null) metadata.author = data.author;
      if (data?.description != null) metadata.description = data.description;
      results.push(normalizeExtractResult("keenable", String(data?.url || url), String(data?.title || ""), content, content, {
        metadata: Object.keys(metadata).length ? metadata : undefined,
      }));
    } catch (error: any) {
      results.push(normalizeExtractResult("keenable", url, "", "", undefined, { error: String(error?.message || error) }));
    }
  }
  return { provider: "keenable", results };
}

// Extract page content via Serper's webpage scraper. POST
// {"url": ..., "includeMarkdown": true} with the X-API-KEY header; the answer
// carries "text" plus optional "markdown", "metadata", "jsonld" and "credits".
// The endpoint accepts one URL per call, so multi-URL requests loop with
// per-URL error items. The scraper returns no raw HTML; html/raw-html/render-js
// options are accepted for tool compatibility but have no upstream effect.
export async function extractSerper(
  urls: string[],
  apiKey: string,
  _outputFormat: ExtractFormat = "markdown",
  _includeImages = false,
  _includeRawHtml = false,
  _renderJs = false,
  apiUrl = "https://scrape.serper.dev",
  timeout = 30,
): Promise<ExtractResponse> {
  const results: ExtractResult[] = [];
  for (const url of urls) {
    try {
      const data = await requestJson(apiUrl, {
        method: "POST",
        headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ url, includeMarkdown: true }),
      }, timeout);
      if (data?.error) {
        results.push(normalizeExtractResult("serper", url, "", "", undefined, { error: String(data.error) }));
        continue;
      }
      // Field names are parsed tolerantly in case Serper renames them.
      const markdown = String(data?.markdown || "");
      const text = String(data?.text || data?.content || "");
      const content = markdown || text;
      const metadata = data?.metadata && typeof data.metadata === "object" ? data.metadata : {};
      const title = String(metadata.title || data?.title || "");
      const extra: Json = { metadata: Object.keys(metadata).length ? metadata : undefined };
      if (data?.jsonld != null) extra.jsonld = data.jsonld;
      if (data?.credits != null) extra.credits = data.credits;
      results.push(normalizeExtractResult("serper", url, title, content, content, extra));
    } catch (error: any) {
      results.push(normalizeExtractResult("serper", url, "", "", undefined, { error: String(error?.message || error) }));
    }
  }
  return { provider: "serper", results };
}

export async function extractPlus(
  urls: string[],
  provider: ExtractProviderName | "auto" = "auto",
  outputFormat: ExtractFormat = "markdown",
  includeImages = false,
  includeRawHtml = false,
  renderJs = false,
  runtimeConfig: RuntimeConfig = {},
  disabledProviders: string[] = [],
  providerPriority: readonly ExtractProviderName[] = EXTRACT_PROVIDER_PRIORITY,
  contextOptions: ExtractContextOptions = {},
): Promise<ExtractResponse> {
  const requestedProvider = provider || "auto";
  if (!Array.isArray(urls) || urls.length === 0) {
    return {
      provider: requestedProvider,
      results: [],
      error: "No URLs provided",
      routing: { requested_provider: requestedProvider },
    };
  }

  let requestedMaxUrls: number;
  let requestedMaxContextChars: number;
  try {
    requestedMaxUrls = boundedInteger(contextOptions.maxUrls, DEFAULT_EXTRACT_MAX_URLS, 1, HARD_EXTRACT_MAX_URLS);
    requestedMaxContextChars = boundedInteger(
      contextOptions.maxContextChars,
      runtimeConfig.extractMaxContextChars ?? DEFAULT_EXTRACT_MAX_CONTEXT_CHARS,
      MIN_EXTRACT_MAX_CONTEXT_CHARS,
      HARD_EXTRACT_MAX_CONTEXT_CHARS,
    );
  } catch (error: any) {
    return {
      provider: requestedProvider,
      results: [],
      error: String(error?.message || error),
      routing: { requested_provider: requestedProvider },
    };
  }
  const operatorMaxUrls = Math.min(HARD_EXTRACT_MAX_URLS, Math.max(1, runtimeConfig.extractMaxUrls ?? DEFAULT_EXTRACT_MAX_URLS));
  const operatorMaxContextChars = Math.min(
    HARD_EXTRACT_MAX_CONTEXT_CHARS,
    Math.max(MIN_EXTRACT_MAX_CONTEXT_CHARS, runtimeConfig.extractMaxContextChars ?? DEFAULT_EXTRACT_MAX_CONTEXT_CHARS),
  );
  const maxUrls = Math.min(requestedMaxUrls, operatorMaxUrls);
  const maxContextChars = Math.min(requestedMaxContextChars, operatorMaxContextChars);
  const allCleanedUrls = urls.map((url) => (typeof url === "string" ? url.trim() : url));
  const cleanedUrls = allCleanedUrls.slice(0, maxUrls);
  const omittedUrls = allCleanedUrls.slice(maxUrls) as string[];
  const invalidUrls = cleanedUrls.filter((url) => typeof url !== "string" || !/^https?:\/\//.test(url));
  if (invalidUrls.length) {
    return {
      provider: requestedProvider,
      results: [],
      error: `Invalid URL(s) — must start with http:// or https://: ${JSON.stringify(invalidUrls)}`,
      routing: { requested_provider: requestedProvider },
    };
  }

  try {
    await validateExtractUrls(cleanedUrls as string[], runtimeConfig);
  } catch (error: any) {
    return {
      provider: requestedProvider,
      results: [],
      error: String(error?.message || error),
      routing: { requested_provider: requestedProvider },
    };
  }

  const configuredPriority = [
    ...providerPriority.filter((item) => EXTRACT_PROVIDER_PRIORITY.includes(item)),
    ...EXTRACT_PROVIDER_PRIORITY.filter((item) => !providerPriority.includes(item)),
  ];
  const baseProviders = requestedProvider === "auto"
    ? configuredPriority
    : [requestedProvider, ...configuredPriority.filter((item) => item !== requestedProvider)] as ExtractProviderName[];
  // Routing preferences' disabled_providers also apply to extraction fallback;
  // an explicitly requested provider is still tried first, matching search semantics.
  const providers = baseProviders.filter((item) =>
    (item === requestedProvider || !disabledProviders.includes(item))
    && (requestedProvider !== "auto" || contextOptions.autoAllow?.[item] !== false)
  );

  const errors: Json[] = [];
  for (const currentProvider of providers) {
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
      let result: ExtractResponse;
      if (currentProvider === "tavily") {
        result = await extractTavily(cleanedUrls as string[], providerCredential, outputFormat, includeImages, includeRawHtml, renderJs);
      } else if (currentProvider === "exa") {
        result = await extractExa(cleanedUrls as string[], providerCredential, outputFormat, includeImages, includeRawHtml, renderJs);
      } else if (currentProvider === "linkup") {
        result = await extractLinkup(cleanedUrls as string[], providerCredential, outputFormat, includeImages, includeRawHtml, renderJs);
      } else if (currentProvider === "parallel") {
        result = await extractParallel(cleanedUrls as string[], providerCredential!, outputFormat, includeImages, includeRawHtml, renderJs, {
          maxCharsPerResult: runtimeConfig.parallelMaxCharsPerResult,
          maxCharsTotal: runtimeConfig.parallelMaxCharsTotal,
        });
      } else if (currentProvider === "firecrawl") {
        result = await extractFirecrawl(cleanedUrls as string[], providerCredential!, outputFormat, includeImages, includeRawHtml, renderJs);
      } else if (currentProvider === "keenable") {
        result = await extractKeenable(cleanedUrls as string[], providerCredential, outputFormat, includeImages, includeRawHtml, renderJs, keylessAllowed);
      } else if (currentProvider === "serper") {
        result = await extractSerper(cleanedUrls as string[], providerCredential!, outputFormat, includeImages, includeRawHtml, renderJs);
      } else if (currentProvider === "hound") {
        result = await extractHound(
          cleanedUrls as string[],
          providerCredential!,
          outputFormat,
          includeImages,
          includeRawHtml,
          renderJs,
          {
            timeoutSeconds: runtimeConfig.houndTimeoutSeconds,
            maxResponseBytes: runtimeConfig.houndMaxResponseBytes,
            maxContentChars: runtimeConfig.houndMaxContentChars,
          },
        );
      } else {
        result = await extractYou(cleanedUrls as string[], providerCredential!, outputFormat, includeImages, includeRawHtml, renderJs);
      }

      const resultList = Array.isArray(result.results) ? result.results : [];
      const allUrlsFailed = resultList.length > 0 && resultList.every((item) => item?.error);
      if (allUrlsFailed) {
        errors.push({ provider: currentProvider, error: "all_urls_failed", details: resultList.map((item) => item.error) });
        continue;
      }

      const charLimit = runtimeConfig.extractCharLimit ?? DEFAULT_EXTRACT_CHAR_LIMIT;
      const contentItems = resultList.filter((item) => !item?.error && typeof item?.content === "string");
      const sanitizedContent = contentItems.map((item) => sanitizeExtractContent(item.content).normalize("NFC"));
      const selectedSpans = contextOptions.spans
        ? sanitizedContent.map((content) => selectSpans(content, contextOptions.spansQuery))
        : [];
      const allocations = fairShareAllocations(
        sanitizedContent.map((content) => codepointLength(content)),
        maxContextChars,
      );
      let truncated = false;
      contentItems.forEach((item, index) => {
        const originalContent = item.content;
        const fullContent = sanitizedContent[index];
        const fullLength = codepointLength(fullContent);
        const globallyTruncated = fullLength > allocations[index];
        const formatted = globallyTruncated
          ? {
              content: normalizedCodepoints(fullContent).slice(0, allocations[index]).join(""),
              truncated: true,
              originalChars: fullLength,
            }
          : formatTruncatedExtractContent(fullContent, charLimit);
        item.content = formatted.content;
        if (formatted.truncated) {
          item.truncated = true;
          item.original_chars = formatted.originalChars;
          truncated = true;
        }
        if (item.raw_content) {
          item.raw_content = item.raw_content === originalContent
            ? item.content
            : globallyTruncated
              ? normalizedCodepoints(sanitizeExtractContent(item.raw_content)).slice(0, allocations[index]).join("")
              : formatTruncatedExtractContent(item.raw_content, charLimit).content;
        }
        if (contextOptions.spans) {
          item.span_contract_version = 1;
          item.spans = selectedSpans[index].map((span) => ({
            ...span,
            within_preview: item.content.includes(span.text),
          }));
        }
      });
      const warnings: Json[] = [...(result.warnings || [])];
      if (omittedUrls.length) {
        warnings.push({
          code: "wsp.extract.urls_omitted",
          message: "One or more requested URLs were omitted by the extraction fan-out cap.",
          details: { omitted_url_count: omittedUrls.length },
        });
      }
      if (truncated) {
        warnings.push({
          code: "wsp.content.truncated",
          message: "Inline extracted content was deterministically truncated to the call budget.",
          details: { truncated_result_count: contentItems.filter((item) => item.truncated).length },
        });
      }

      return {
        ...result,
        status: omittedUrls.length || truncated ? "degraded" : result.status || "success",
        warnings,
        limits_applied: {
          extract: {
            requested_url_count: allCleanedUrls.length,
            processed_urls: cleanedUrls as string[],
            omitted_urls: omittedUrls,
            omitted_url_count: omittedUrls.length,
            max_urls: maxUrls,
            max_context_chars: maxContextChars,
            context_chars_returned: contentItems.reduce((sum, item) => sum + codepointLength(item.content), 0),
            truncated,
          },
        },
        routing: {
          provider: currentProvider,
          requested_provider: requestedProvider,
          fallback_used: errors.length > 0,
          fallback_errors: errors,
        },
      };
    } catch (error: any) {
      errors.push({ provider: currentProvider, error: String(error?.message || error) });
    }
  }

  return {
    provider: requestedProvider,
    results: [],
    error: "All extraction providers failed",
    fallback_errors: errors,
    routing: { requested_provider: requestedProvider, fallback_used: errors.length > 0, fallback_errors: errors },
  };
}
