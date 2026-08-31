import {
  ProviderConfigError,
  ProviderRequestError,
  boundedTimeoutSeconds,
  requestBoundedJson,
} from "./provider-http.ts";

type Json = Record<string, any>;

export type TinyFishSearchOptions = {
  freshness?: string;
  timeRange?: string;
  searchType?: string;
  includeDomains?: string[];
  excludeDomains?: string[];
  country?: string;
  language?: string;
  timeoutSeconds?: number;
};

export const TINYFISH_PROVIDER_METADATA = Object.freeze({
  id: "tinyfish",
  kind: "search",
  envVar: "TINYFISH_API_KEY",
  displayName: "TinyFish Search",
  description: (
    "Direct source-only TinyFish web/news search using your own account/API key. "
    + "The plugin does not provide, pool, proxy, or share TinyFish credentials. "
    + "Domain filters and result hosts are accepted only as ASCII/Punycode hostnames. "
    + "Privacy warning: TinyFish's standard Terms permit Customer Data to be used for "
    + "model training and fine-tuning; review https://www.tinyfish.ai/terms and "
    + "https://www.tinyfish.ai/privacy-policy before use. Explicit-only by default."
  ),
  capabilityLabels: Object.freeze(["search", "news", "freshness", "privacy-warning"]),
  upstreamCapabilities: Object.freeze([
    "search",
    "news",
    "research-paper",
    "freshness",
    "domain-filtering",
  ]),
  autoAllowedByDefault: false,
  explicitOnly: true,
  recommended: false,
  supportsFreshness: true,
  freeTier: "Search does not consume credits; API access required (30 rpm Free/PAYG)",
  signupUrl: "https://agent.tinyfish.ai/api-keys",
  termsUrl: "https://www.tinyfish.ai/terms",
  privacyPolicyUrl: "https://www.tinyfish.ai/privacy-policy",
});

const API_URL = "https://api.search.tinyfish.ai/";
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_QUERY_CHARS = 2_000;
const MAX_DOMAIN_COUNT = 20;
const MAX_DOMAIN_CHARS = 253;
const MAX_DOMAIN_LIST_CHARS = 2_048;
const MAX_REQUEST_URL_CHARS = 8_192;
const MAX_URL_CHARS = 8_192;
const MAX_TITLE_CHARS = 1_000;
const MAX_SNIPPET_CHARS = 8_000;
const TRANSIENT_STATUSES = new Set([429, 500, 503]);
const FRESHNESS_MINUTES: Readonly<Record<string, number>> = Object.freeze({
  day: 24 * 60,
  week: 7 * 24 * 60,
  month: 30 * 24 * 60,
  year: 365 * 24 * 60,
});

const OTHER_CHARACTER = /\p{C}/u;
const WHITE_SPACE = /\p{White_Space}/u;
const DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function codePoints(value: string): string[] {
  return Array.from(value);
}

function codePointLength(value: string): number {
  return codePoints(value).length;
}

function hasWhitespaceOrOther(value: string): boolean {
  return codePoints(value).some((character) => (
    WHITE_SPACE.test(character) || OTHER_CHARACTER.test(character)
  ));
}

function canonicalHostname(hostname: string): string {
  if (!hostname || hostname.endsWith("..") || hasWhitespaceOrOther(hostname)) return "";
  const token = hostname.endsWith(".") ? hostname.slice(0, -1) : hostname;
  if (codePoints(token).some((character) => character.codePointAt(0)! > 0x7f)) return "";
  const canonical = token.toLowerCase();
  const labels = canonical.split(".");
  if (
    !canonical
    || canonical.length > MAX_DOMAIN_CHARS
    || labels.length < 2
    || labels.some((label) => !DOMAIN_LABEL.test(label))
  ) return "";
  return canonical;
}

function cleanDomains(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  if (value.length > MAX_DOMAIN_COUNT) throw new ProviderConfigError("tinyfish_domains_invalid");

  const rawItems: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !item || hasWhitespaceOrOther(item)) {
      throw new ProviderConfigError("tinyfish_domains_invalid");
    }
    const rootDotAllowance = item.endsWith(".") ? 1 : 0;
    if (codePointLength(item) > MAX_DOMAIN_CHARS + rootDotAllowance) {
      throw new ProviderConfigError("tinyfish_domains_invalid");
    }
    rawItems.push(item);
  }
  if (rawItems.join(",").length > MAX_DOMAIN_LIST_CHARS) {
    throw new ProviderConfigError("tinyfish_domains_invalid");
  }

  const domains: string[] = [];
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

function rawAuthority(url: string): string {
  const match = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/i.exec(url);
  return match?.[1] ?? "";
}

function rawHostname(authority: string): string {
  if (!authority || authority.includes("@") || authority.startsWith("[")) return "";
  const firstColon = authority.indexOf(":");
  if (firstColon < 0) return authority;
  if (firstColon !== authority.lastIndexOf(":")) return "";
  const portToken = authority.slice(firstColon + 1);
  if (portToken && (!/^\d+$/.test(portToken) || Number(portToken) < 1 || Number(portToken) > 65_535)) {
    return "";
  }
  return authority.slice(0, firstColon);
}

function safeUrl(value: unknown): string {
  if (
    typeof value !== "string"
    || !value
    || codePointLength(value) > MAX_URL_CHARS
    || hasWhitespaceOrOther(value)
  ) return "";

  const authority = rawAuthority(value);
  const canonical = canonicalHostname(rawHostname(authority));
  if (!canonical) return "";
  try {
    const parsed = new URL(value);
    if (
      !["http:", "https:"].includes(parsed.protocol)
      || parsed.username
      || parsed.password
    ) return "";
  } catch {
    return "";
  }
  return value;
}

function boundedString(value: unknown, limit: number): string {
  if (typeof value !== "string") return "";
  const cleaned = codePoints(value)
    .filter((character) => (
      character === " "
      || character === "\n"
      || character === "\t"
      || (!OTHER_CHARACTER.test(character) && !WHITE_SPACE.test(character))
    ))
    .join("")
    .trim();
  return codePoints(cleaned).slice(0, limit).join("");
}

function domainMatches(hostname: string, domain: string): boolean {
  let normalized = domain.trim().toLowerCase().replace(/\.$/, "");
  if (normalized.startsWith("*.")) normalized = normalized.slice(2);
  return !!normalized && (hostname === normalized || hostname.endsWith(`.${normalized}`));
}

function urlAllowedByDomains(url: string, includeDomains: string[], excludeDomains: string[]): boolean {
  const hostname = canonicalHostname(rawHostname(rawAuthority(url)));
  if (!hostname || excludeDomains.some((domain) => domainMatches(hostname, domain))) return false;
  return !includeDomains.length || includeDomains.some((domain) => domainMatches(hostname, domain));
}

function boundedResultCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ProviderConfigError("tinyfish_max_results_invalid");
  }
  return Math.max(1, Math.min(Math.trunc(value), 100));
}

function queryParams(
  options: TinyFishSearchOptions,
  query: string,
  includeDomains: string[],
  excludeDomains: string[],
): URLSearchParams {
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

  const freshness = options.freshness && FRESHNESS_MINUTES[options.freshness] != null
    ? options.freshness
    : options.timeRange;
  if (freshness && FRESHNESS_MINUTES[freshness] != null) {
    params.set("recency_minutes", String(FRESHNESS_MINUTES[freshness]));
  }
  return params;
}

function projectResults(
  rawResults: unknown[],
  count: number,
  includeDomains: string[],
  excludeDomains: string[],
): Json[] {
  const projected: Json[] = [];
  for (const item of rawResults) {
    if (projected.length >= count) break;
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const source = item as Json;
    const url = safeUrl(source.url);
    if (!url || !urlAllowedByDomains(url, includeDomains, excludeDomains)) continue;

    const result: Json = {
      url,
      title: boundedString(source.title, MAX_TITLE_CHARS),
      snippet: boundedString(source.snippet, MAX_SNIPPET_CHARS),
    };
    for (const [field, value] of [
      ["date", source.date],
      ["source", source.site_name],
      ["author", source.publisher],
    ] as const) {
      const projectedValue = boundedString(value, 1_000);
      if (projectedValue) result[field] = projectedValue;
    }
    if (Number.isInteger(source.position) && source.position >= 1) result.position = source.position;
    projected.push(result);
  }
  return projected;
}

export async function searchTinyFish(
  query: string,
  apiKey: string,
  maxResults: number,
  options: TinyFishSearchOptions = {},
): Promise<Json> {
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    throw new ProviderConfigError("tinyfish_api_key_required");
  }
  if (typeof query !== "string") throw new ProviderConfigError("tinyfish_query_invalid");
  const normalizedQuery = query.trim();
  if (!normalizedQuery || codePointLength(normalizedQuery) > MAX_QUERY_CHARS) {
    throw new ProviderConfigError("tinyfish_query_invalid");
  }

  const count = boundedResultCount(maxResults);
  const includeDomains = cleanDomains(options.includeDomains);
  const excludeDomains = cleanDomains(options.excludeDomains);
  const timeoutSeconds = boundedTimeoutSeconds(
    options.timeoutSeconds,
    30,
    "tinyfish_timeout_invalid",
  );
  const params = queryParams(options, normalizedQuery, includeDomains, excludeDomains);
  const requestUrl = `${API_URL}?${params.toString()}`;
  if (requestUrl.length > MAX_REQUEST_URL_CHARS) {
    throw new ProviderConfigError("tinyfish_request_too_large");
  }

  const payload = await requestBoundedJson<unknown>(requestUrl, {
    method: "GET",
    headers: {
      "X-API-Key": apiKey.trim(),
      Accept: "application/json",
    },
    redirect: "error",
  }, {
    timeoutSeconds,
    maxResponseBytes: MAX_RESPONSE_BYTES,
    errorPrefix: "tinyfish",
    transientStatuses: TRANSIENT_STATUSES,
  });
  if (
    !payload
    || typeof payload !== "object"
    || Array.isArray(payload)
    || !Array.isArray((payload as Json).results)
  ) {
    throw new ProviderRequestError("tinyfish_invalid_response", { transient: true });
  }

  const body = payload as Json;
  const metadata: Json = {};
  for (const field of ["total_results", "page"] as const) {
    const value = body[field];
    if (Number.isInteger(value) && value >= 0) metadata[field] = value;
  }
  return {
    provider: "tinyfish",
    query: normalizedQuery,
    results: projectResults(body.results, count, includeDomains, excludeDomains),
    images: [],
    metadata,
  };
}
