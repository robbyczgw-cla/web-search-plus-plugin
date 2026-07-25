import { callHoundTool } from "./hound-transport.ts";
import type { ExtractFormat, ExtractResponse, ExtractResult } from "./extract.ts";

type Json = Record<string, any>;

export type HoundOptions = {
  timeoutSeconds?: number;
  maxResponseBytes?: number;
  maxContentChars?: number;
};

function boundedInt(value: number | undefined, fallback: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.floor(value ?? fallback)));
}

function cleanStrings(value: unknown, limit = 20): string[] {
  return Array.isArray(value) ? value.slice(0, limit).filter((item): item is string => typeof item === "string" && !!item) : [];
}

function textContent(value: unknown): string {
  if (typeof value === "string") return value;
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").join("\n") : "";
}

function domainMatches(hostname: string, domain: string): boolean {
  const normalized = String(domain || "").trim().toLowerCase().replace(/^\*\./, "").replace(/\.$/, "");
  return !!normalized && (hostname === normalized || hostname.endsWith(`.${normalized}`));
}

function urlAllowed(url: string, includeDomains: string[], excludeDomains: string[]): boolean {
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

export async function searchHound(
  query: string,
  endpoint: string,
  maxResults: number,
  freshness?: string,
  includeDomains: string[] = [],
  excludeDomains: string[] = [],
  locale?: { country?: string; language?: string },
  options: HoundOptions = {},
): Promise<Json> {
  const houndOptions: Json = {
    max_results: boundedInt(maxResults, 6, 1, 50),
    cache_ttl: 0,
  };
  if (["day", "week", "month", "year"].includes(String(freshness || ""))) houndOptions.freshness = freshness;
  if (includeDomains.length === 1) houndOptions.site = includeDomains[0];
  if (excludeDomains.length) houndOptions.exclude_sites = excludeDomains;
  if (locale?.language) houndOptions.language = locale.language;
  if (locale?.country) houndOptions.region = locale.language ? `${locale.country}-${locale.language}` : locale.country;

  const payload = await callHoundTool(endpoint, "mcp_smart_search", {
    query,
    options: houndOptions,
  }, options);
  if (!Array.isArray(payload.results)) throw new Error("hound_search_contract_failed");
  if (payload.error && !payload.results.length) throw new Error("hound_search_failed");
  const results = payload.results
    .filter((item: any) => item && typeof item.url === "string" && urlAllowed(item.url, includeDomains, excludeDomains))
    .slice(0, maxResults)
    .map((item: any, index: number) => ({
      title: String(item.title || ""),
      url: item.url,
      snippet: String(item.snippet || ""),
      score: Number.isFinite(Number(item.relevance_score)) ? Number(item.relevance_score) : Number((1 - index * 0.05).toFixed(3)),
      position: Number.isFinite(Number(item.position)) ? Number(item.position) : undefined,
      source: String(item.source || ""),
      fetch_relevance: String(item.fetch_relevance || ""),
      engines_consensus: String(item.engines_consensus || ""),
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
      local_sidecar: true,
    },
  };
}

function fetchArguments(
  url: string,
  outputFormat: ExtractFormat,
  includeImages: boolean,
  renderJs: boolean,
  maxContentChars: number,
): Json {
  return {
    urls: [url],
    extraction_type: outputFormat,
    cache_ttl: 0,
    max_content_chars: maxContentChars,
    options: { include_media: includeImages },
    ...(renderJs ? { force_fetcher: "stealthy" } : {}),
  };
}

function singleFetchItem(payload: Json): Json {
  return Array.isArray(payload.results) && payload.results.length === 1 && payload.results[0] && typeof payload.results[0] === "object"
    ? payload.results[0]
    : {};
}

function projectFetchItem(item: Json, requestedUrl: string): ExtractResult {
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
      metadata: { status },
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
      duration_ms: Number.isFinite(Number(item.duration_ms)) ? Number(item.duration_ms) : 0,
    },
  };
}

export async function extractHound(
  urls: string[],
  endpoint: string,
  outputFormat: ExtractFormat = "markdown",
  includeImages = false,
  includeRawHtml = false,
  renderJs = false,
  options: HoundOptions = {},
): Promise<ExtractResponse> {
  const maxContentChars = boundedInt(options.maxContentChars, 40000, 500, 200000);
  const results: ExtractResult[] = [];
  for (const requestedUrl of urls) {
    try {
      const payload = await callHoundTool(
        endpoint,
        "mcp_smart_fetch",
        fetchArguments(requestedUrl, outputFormat, includeImages, renderJs, maxContentChars),
        options,
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
              options,
            );
            const rawItem = singleFetchItem(rawPayload);
            const rawStatus = Number.isFinite(Number(rawItem.status)) ? Number(rawItem.status) : 0;
            const rawContent = textContent(rawItem.content);
            if (rawItem.error || rawItem.content_ok !== true || rawStatus >= 400 || !rawContent.trim()) {
              (result as any).raw_error = "hound_raw_html_failed";
            } else {
              result.raw_html = rawContent;
            }
          } catch {
            (result as any).raw_error = "hound_raw_html_failed";
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
        error: "hound_fetch_failed",
      });
    }
  }
  return { provider: "hound", results };
}
