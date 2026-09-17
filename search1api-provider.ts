import {
  ProviderConfigError,
  ProviderRequestError,
  boundedTimeoutSeconds,
  requestBoundedJson,
} from "./provider-http.ts";
import type { ExtractFormat, ExtractResponse, ExtractResult } from "./extract.ts";

type Json = Record<string, any>;

export type Search1ApiSearchOptions = {
  freshness?: string;
  timeRange?: string;
  searchType?: string;
  includeDomains?: string[];
  excludeDomains?: string[];
  searchService?: string;
  newsService?: string;
  timeoutSeconds?: number;
};

export type Search1ApiExtractOptions = {
  outputFormat?: ExtractFormat;
  includeRawHtml?: boolean;
  timeoutSeconds?: number;
};

export const SEARCH1API_PROVIDER_METADATA = Object.freeze({
  id: "search1api",
  kind: "both",
  envVar: "SEARCH1API_KEY",
  displayName: "Search1API",
  description: (
    "Direct source-only Search1API web/news search and page extraction using your own account/API key. "
    + "The plugin does not provide, pool, proxy, or share Search1API credentials. "
    + "search_type=news is served by the /news endpoint; extraction uses /crawl and returns "
    + "Markdown text only, so html/raw-html/render-js flags have no upstream effect. "
    + "Review https://blog.s1.dev/pages/terms and https://s1.dev/privacy before use. "
    + "Explicit-only by default."
  ),
  capabilityLabels: Object.freeze(["search", "news", "extract", "freshness"]),
  upstreamCapabilities: Object.freeze([
    "search",
    "news",
    "extract",
    "freshness",
    "domain-filtering",
  ]),
  autoAllowedByDefault: false,
  explicitOnly: true,
  recommended: false,
  supportsFreshness: true,
  freeTier: "Free plan: 100 credits; 1 credit per search/news/crawl call",
  signupUrl: "https://s1.dev",
  termsUrl: "https://blog.s1.dev/pages/terms",
  privacyPolicyUrl: "https://s1.dev/privacy",
});

const API_BASE = "https://api.search1api.com";
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const MAX_QUERY_CHARS = 2_000;
const MAX_URL_CHARS = 8_192;
const MAX_TITLE_CHARS = 1_000;
const MAX_SNIPPET_CHARS = 8_000;
const MAX_EXTRACT_CONTENT_CHARS = 256_000;
const MAX_COUNT = 50;
const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504]);
const FRESHNESS_VALUES = new Set(["day", "week", "month", "year"]);

const SEARCH_SERVICES = new Set([
  "google", "bing", "bingcn", "duckduckgo", "yahoo", "youtube", "x", "reddit",
  "github", "arxiv", "wechat", "bilibili", "imdb", "wikipedia", "baidu", "360",
  "quark",
]);
const NEWS_SERVICES = new Set([
  "google", "bing", "duckduckgo", "yahoo", "hackernews", "reuters",
]);
const DEFAULT_SEARCH_SERVICE = "google";
const DEFAULT_NEWS_SERVICE = "bing";

function boundedString(value: unknown, limit: number): string {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function cleanDomains(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function safeUrl(value: unknown): string {
  const url = boundedString(value, MAX_URL_CHARS);
  if (!url || !url.startsWith("http") || /\s/.test(url)) return "";
  if (!url.startsWith("https://") && !url.startsWith("http://")) return "";
  return url;
}

function boundedResultCount(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new ProviderConfigError("search1api_max_results_invalid");
  return Math.max(1, Math.min(Math.trunc(parsed), MAX_COUNT));
}

function serviceValue(value: unknown, allowed: ReadonlySet<string>, fallback: string, field: string): string {
  if (value == null) return fallback;
  if (typeof value !== "string") throw new ProviderConfigError(`search1api_${field}_invalid`);
  const normalized = value.trim().toLowerCase();
  if (!allowed.has(normalized)) throw new ProviderConfigError(`search1api_${field}_invalid`);
  return normalized;
}

async function postJson(path: string, body: Json, apiKey: string, timeoutSeconds: number): Promise<Json> {
  let payload: unknown;
  try {
    payload = await requestBoundedJson<unknown>(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    }, {
      timeoutSeconds,
      maxResponseBytes: MAX_RESPONSE_BYTES,
      errorPrefix: "search1api",
      transientStatuses: TRANSIENT_STATUSES,
    });
  } catch (error: any) {
    // Rejected credentials are configuration faults, not transient upstream
    // failures, so callers do not retry or fall back on a dead key.
    if (
      error instanceof ProviderRequestError
      && (error.statusCode === 401 || error.statusCode === 403)
    ) {
      throw new ProviderConfigError("search1api_key_rejected");
    }
    throw error;
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ProviderRequestError("search1api_invalid_response", { transient: true });
  }
  return payload as Json;
}

export async function searchSearch1Api(
  query: string,
  apiKey: string,
  maxResults: number,
  options: Search1ApiSearchOptions = {},
): Promise<Json> {
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    throw new ProviderConfigError("search1api_key_required");
  }
  const normalizedQuery = boundedString(query, MAX_QUERY_CHARS);
  if (!normalizedQuery) throw new ProviderConfigError("search1api_query_invalid");

  const count = boundedResultCount(maxResults);
  const news = options.searchType === "news";
  const service = serviceValue(
    news ? options.newsService : options.searchService,
    news ? NEWS_SERVICES : SEARCH_SERVICES,
    news ? DEFAULT_NEWS_SERVICE : DEFAULT_SEARCH_SERVICE,
    news ? "news_service" : "search_service",
  );

  const body: Json = {
    query: normalizedQuery,
    max_results: count,
    search_service: service,
    // Source-only contract: snippets stay attached to their links; inline page
    // crawling stays off so /search never returns expanded content.
    crawl_results: 0,
  };
  const includeDomains = cleanDomains(options.includeDomains);
  const excludeDomains = cleanDomains(options.excludeDomains);
  if (includeDomains.length) body.include_sites = includeDomains;
  if (excludeDomains.length) body.exclude_sites = excludeDomains;

  const freshness = FRESHNESS_VALUES.has(String(options.freshness || ""))
    ? options.freshness
    : options.timeRange;
  if (FRESHNESS_VALUES.has(String(freshness || ""))) body.time_range = freshness;

  const payload = await postJson(
    news ? "/news" : "/search",
    body,
    apiKey.trim(),
    boundedTimeoutSeconds(options.timeoutSeconds, 30, "search1api_timeout_invalid"),
  );
  if (!Array.isArray(payload.results)) {
    throw new ProviderRequestError("search1api_invalid_response", { transient: true });
  }

  const results: Json[] = [];
  for (const item of payload.results.slice(0, count)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const url = safeUrl(item.link || item.url);
    if (!url) continue;
    const result: Json = {
      url,
      title: boundedString(item.title, MAX_TITLE_CHARS),
      snippet: boundedString(item.snippet, MAX_SNIPPET_CHARS),
    };
    for (const field of ["date", "source"] as const) {
      const value = boundedString(item[field], 1_000);
      if (value) result[field] = value;
    }
    results.push(result);
  }

  return {
    provider: "search1api",
    query: normalizedQuery,
    results,
    images: [],
    metadata: { endpoint: news ? "news" : "search", service },
  };
}

export async function extractSearch1Api(
  urls: string[],
  apiKey: string,
  options: Search1ApiExtractOptions = {},
): Promise<ExtractResponse> {
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    throw new ProviderConfigError("search1api_key_required");
  }
  const timeoutSeconds = boundedTimeoutSeconds(
    options.timeoutSeconds,
    30,
    "search1api_timeout_invalid",
  );

  const results: ExtractResult[] = [];
  for (const requestedUrl of urls) {
    const url = safeUrl(requestedUrl);
    const failed = (code: string): ExtractResult => ({
      url: url || boundedString(requestedUrl, MAX_URL_CHARS),
      title: "",
      content: "",
      raw_content: "",
      provider: "search1api",
      error: code,
    });
    if (!url) {
      results.push(failed("search1api_url_invalid"));
      continue;
    }

    let payload: Json;
    try {
      payload = await postJson("/crawl", { url }, apiKey.trim(), timeoutSeconds);
    } catch (error: any) {
      if (error instanceof ProviderConfigError) throw error;
      if (error instanceof ProviderRequestError) {
        results.push(failed(error.code || "search1api_crawl_failed"));
        // A transient upstream failure is recorded per URL, then the batch
        // stops: retrying the remaining URLs against a sick endpoint burns
        // quota. Deterministic per-URL failures keep going.
        if (error.transient) break;
        continue;
      }
      throw error;
    }

    const upstream = payload.results;
    if (!upstream || typeof upstream !== "object" || Array.isArray(upstream)) {
      results.push(failed("search1api_invalid_response"));
      continue;
    }
    const content = boundedString(upstream.content, MAX_EXTRACT_CONTENT_CHARS);
    if (!content) {
      results.push(failed("search1api_empty_content"));
      continue;
    }
    const result: ExtractResult = {
      url: safeUrl(upstream.link) || url,
      title: boundedString(upstream.title, MAX_TITLE_CHARS),
      content,
      raw_content: content,
      provider: "search1api",
      metadata: { fetcher: "search1api", source_type: "web" },
    };
    if (options.includeRawHtml === true) {
      // Search1API crawl returns Markdown only; do not label it HTML.
      (result as Json).raw_error = "search1api_raw_html_unsupported";
    }
    results.push(result);
  }
  return { provider: "search1api", results };
}
