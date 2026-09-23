import type { ExtractFormat, ExtractResponse, ExtractResult } from "./extract.ts";
import {
  inspectDonsetchReadiness,
  runDonsetchSession,
  type DonsetchCommandRunner,
  type DonsetchReadiness,
  type DonsetchSessionOptions,
  type DonsetchToolPayload,
} from "./donsetch-transport.ts";

type JsonObject = Record<string, unknown>;

const ALLOWED_SEARCH_TYPES = new Set(["search", "news"]);
const ALLOWED_INTENTS = new Set(["auto", "web", "code", "paper", "news", "entity"]);
const MAX_URL_CHARS = 8_192;
const MAX_TITLE_CHARS = 512;
const MAX_SNIPPET_CHARS = 4_096;

export type DonsetchSearchRequest = DonsetchSessionOptions & {
  binary: string;
  query: string;
  maxResults?: number;
  searchType?: "search" | "news" | string;
  category?: string;
  freshness?: string;
  images?: boolean;
  includeDomains?: string[];
  excludeDomains?: string[];
};

export type DonsetchExtractRequest = DonsetchSessionOptions & {
  binary: string;
  urls: string[];
  outputFormat?: ExtractFormat;
  includeImages?: boolean;
  includeRawHtml?: boolean;
  renderJs?: boolean;
  maxContentChars?: number;
  tier?: "auto" | "1" | "2" | string;
};

export type DonsetchAdapter = {
  inspectReadiness(binary: string | undefined, options?: { timeoutSeconds?: number }): Promise<DonsetchReadiness>;
  search(request: DonsetchSearchRequest): Promise<JsonObject>;
  extract(request: DonsetchExtractRequest): Promise<ExtractResponse>;
};

function boundedInt(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
}

function finiteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boundedString(value: unknown, maxChars: number): string {
  return (typeof value === "string" ? value : "").slice(0, maxChars);
}

function cleanStrings(value: unknown, limit = 50, maxChars = 256): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, limit)
    .filter((item): item is string => typeof item === "string" && !!item.trim())
    .map((item) => item.trim().slice(0, maxChars));
}

function cleanDomains(value: unknown): string[] {
  return cleanStrings(value, 50, 253)
    .map((domain) => domain.toLowerCase().replace(/^\*\./, "").replace(/\.$/, ""))
    .filter((domain) => !!domain && !/[\s/@]/.test(domain));
}

function domainMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value || value.length > MAX_URL_CHARS) return null;
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) return null;
    return value;
  } catch {
    return null;
  }
}

function urlAllowed(value: unknown, includeDomains: string[], excludeDomains: string[]): string | null {
  const url = safeHttpUrl(value);
  if (!url) return null;
  const hostname = new URL(url).hostname.toLowerCase().replace(/\.$/, "");
  if (excludeDomains.some((domain) => domainMatches(hostname, domain))) return null;
  if (includeDomains.length && !includeDomains.some((domain) => domainMatches(hostname, domain))) return null;
  return url;
}

function searchIntent(request: DonsetchSearchRequest): string {
  const searchType = request.searchType || "search";
  if (!ALLOWED_SEARCH_TYPES.has(searchType)) throw new Error("donsetch_search_type_unsupported");
  if (searchType === "news") return "news";
  return request.category && ALLOWED_INTENTS.has(request.category) ? request.category : "auto";
}

function engineMetadata(structured: JsonObject): { enginesUsed: string[]; enginesBlocked: string[] } {
  const enginesUsed: string[] = [];
  const enginesBlocked: string[] = [];
  if (Array.isArray(structured.engines)) {
    for (const item of structured.engines.slice(0, 50)) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const engine = boundedString((item as JsonObject).engine, 128);
      if (!engine) continue;
      if (String((item as JsonObject).status || "").toLowerCase() === "ok") enginesUsed.push(engine);
      else enginesBlocked.push(engine);
    }
  }
  if (!enginesUsed.length) enginesUsed.push(...cleanStrings(structured.engines_used, 50, 128));
  if (!enginesBlocked.length) enginesBlocked.push(...cleanStrings(structured.engine_blocked, 50, 128));
  return { enginesUsed, enginesBlocked };
}

function resultRank(value: unknown, index: number): number {
  const rank = Number(value);
  return Number.isFinite(rank) && rank >= 1 ? Math.floor(rank) : index + 1;
}

function namespacedDebug(payload: DonsetchToolPayload, key: string): JsonObject {
  const value = payload.meta?.[`com.donsetch/${key}-debug`];
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

export function parseSearchEvidence(text: string, rows: unknown[]): Map<number, { title: string; snippet: string }> {
  const bindings = new Map<number, JsonObject>();
  rows.forEach((row, index) => {
    if (row && typeof row === "object" && !Array.isArray(row)) {
      const source = row as JsonObject;
      bindings.set(resultRank(source.rank, index), source);
    }
  });
  const evidence = new Map<number, { title: string; snippet: string }>();
  let current: { title: string; snippet: string } | undefined;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (!line.startsWith("   ") && /^(Weak results|Degraded retrieval|No results\.|\*degraded:|\*fetch results)/.test(line.trim())) {
      current = undefined;
      continue;
    }
    const header = /^(\d+)\.\s+(.+)$/.exec(line);
    if (header) {
      current = undefined;
      const rank = Number(header[1]);
      const row = bindings.get(rank);
      if (!row) continue;
      const [reference, ...rest] = header[2].trim().split(" · ");
      const url = typeof row.url === "string" ? row.url : "";
      if (reference !== row.handle && reference !== url && (!url || reference.replace(/\/+$/, "") !== url.replace(/\/+$/, ""))) continue;
      let title = rest.join(" · ").replace(/\s+·\s+⚠.*$/, "");
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

export async function searchDonsetch(
  runCommandWithTimeout: DonsetchCommandRunner,
  request: DonsetchSearchRequest,
): Promise<JsonObject> {
  const query = boundedString(request.query, 2_000).trim();
  if (!query) throw new Error("donsetch_query_required");
  if (request.freshness) throw new Error("donsetch_freshness_unsupported");
  if (request.images) throw new Error("donsetch_image_search_unsupported");

  const maxResults = boundedInt(request.maxResults, 7, 1, 12);
  const includeDomains = cleanDomains(request.includeDomains);
  const excludeDomains = cleanDomains(request.excludeDomains);
  const [payload] = await runDonsetchSession(
    runCommandWithTimeout,
    request.binary,
    [{
      tool: "web_search",
      arguments: { query, max_results: maxResults, intent: searchIntent(request) },
    }],
    {
      timeoutSeconds: request.timeoutSeconds,
      maxResponseBytes: request.maxResponseBytes,
      maxTextChars: request.maxTextChars,
    },
  );

  const upstreamResults = payload.structured.results;
  if (!Array.isArray(upstreamResults)) throw new Error("donsetch_search_contract_failed");
  const debug = namespacedDebug(payload, "search");
  const evidence = parseSearchEvidence(payload.text, upstreamResults);
  const results: JsonObject[] = [];
  for (const [index, item] of upstreamResults.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const source = item as JsonObject;
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
      source_type: "web",
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
      intent: boundedString((payload.structured.intent ?? debug.intent), 64),
      cached: (payload.structured.cached ?? debug.cached) === true,
      weak: (payload.structured.weak ?? debug.weak) === true,
      duration_ms: finiteNumber((payload.structured.elapsed_ms ?? debug.elapsed_ms)),
      local_sidecar: true,
    },
  };
}

function normalizedTier(request: DonsetchExtractRequest): "auto" | "1" | "2" {
  if (request.renderJs) return "2";
  return request.tier === "1" || request.tier === "2" ? request.tier : "auto";
}

function projectFetchItem(
  payload: DonsetchToolPayload,
  requestedUrl: string,
  includeImages: boolean,
  includeRawHtml: boolean,
): ExtractResult {
  const debug = namespacedDebug(payload, "fetch");
  const structured = { ...payload.structured };
  for (const key of ["status", "title", "quality", "site", "verdict", "tier"]) {
    if (structured[key] == null) structured[key] = debug[key];
  }
  const observedUrl = safeHttpUrl(structured.url) || requestedUrl;
  const status = boundedInt(structured.status, 0, 0, 999);
  const verdict = boundedString(structured.verdict, 32).toLowerCase();
  const contentOk = structured.content_ok ?? (verdict === "contentok" && status > 0 && status < 400);
  const failed = contentOk !== true
    || ["error", "blocked", "failed"].includes(verdict)
    || status >= 400
    || !payload.text.trim();
  if (failed) {
    return {
      url: observedUrl,
      title: "",
      content: "",
      raw_content: "",
      provider: "donsetch",
      error: "donsetch_fetch_failed",
      metadata: { status, local_sidecar: true },
    };
  }

  const result: ExtractResult = {
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
      next_offset: structured.next_offset == null ? undefined : boundedInt(structured.next_offset, 0, 0, Number.MAX_SAFE_INTEGER),
      local_sidecar: true,
    },
  };
  if (includeImages) {
    result.images = cleanStrings(structured.images ?? structured.media, 50, MAX_URL_CHARS)
      .map((url) => safeHttpUrl(url))
      .filter((url): url is string => !!url)
      .map((url) => ({ url }));
  }
  if (payload.textTruncated) {
    result.truncated = true;
    result.original_chars = payload.originalTextChars;
  }
  if (includeRawHtml) (result as JsonObject).raw_error = "donsetch_raw_html_unsupported";
  return result;
}

export async function extractDonsetch(
  runCommandWithTimeout: DonsetchCommandRunner,
  request: DonsetchExtractRequest,
): Promise<ExtractResponse> {
  if ((request.outputFormat || "markdown") !== "markdown") throw new Error("donsetch_output_format_unsupported");
  if (!Array.isArray(request.urls) || !request.urls.length || request.urls.length > 50) {
    throw new Error("donsetch_url_count_invalid");
  }
  const urls = request.urls.map((value) => safeHttpUrl(value));
  if (urls.some((url) => !url)) throw new Error("donsetch_url_invalid");
  const safeUrls = urls as string[];
  const maxContentChars = boundedInt(request.maxContentChars, 15_000, 500, 200_000);
  const payloads = await runDonsetchSession(
    runCommandWithTimeout,
    request.binary,
    safeUrls.map((url) => ({
      tool: "web_fetch" as const,
      arguments: {
        url,
        max_chars: maxContentChars,
        media: request.includeImages === true,
        tier: normalizedTier(request),
      },
    })),
    {
      timeoutSeconds: request.timeoutSeconds,
      maxResponseBytes: request.maxResponseBytes,
      maxTextChars: Math.min(maxContentChars, request.maxTextChars ?? maxContentChars),
    },
  );
  return {
    provider: "donsetch",
    results: payloads.map((payload, index) => projectFetchItem(
      payload,
      safeUrls[index],
      request.includeImages === true,
      request.includeRawHtml === true,
    )),
  };
}

export function createDonsetchAdapter(runCommandWithTimeout: DonsetchCommandRunner): DonsetchAdapter {
  return {
    inspectReadiness: (binary, options) => inspectDonsetchReadiness(runCommandWithTimeout, binary, options),
    search: (request) => searchDonsetch(runCommandWithTimeout, request),
    extract: (request) => extractDonsetch(runCommandWithTimeout, request),
  };
}
