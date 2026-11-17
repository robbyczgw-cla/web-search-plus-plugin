import {
  ProviderConfigError,
  ProviderRequestError,
  boundedTimeoutSeconds,
  requestBoundedJson,
} from "./provider-http.ts";

type Json = Record<string, any>;

export type SpecStreamSearchOptions = {
  freshness?: string;
  timeRange?: string;
  searchType?: string;
  includeDomains?: string[];
  excludeDomains?: string[];
  country?: string;
  language?: string;
  timeoutSeconds?: number;
};

export const SPECSTREAM_PROVIDER_METADATA = Object.freeze({
  id: "specstream",
  kind: "search",
  envVar: "SPECSTREAM_API_KEY",
  displayName: "SpecStream Search",
  description: (
    "Direct source-only SpecStream web search using your own account/API key. "
    + "The plugin does not provide, pool, proxy, or share SpecStream credentials. "
    + "Review https://specstream.ai/terms and https://specstream.ai/privacy before use. "
    + "Explicit-only by default."
  ),
  capabilityLabels: Object.freeze(["search", "privacy-warning"]),
  upstreamCapabilities: Object.freeze([
    "search",
  ]),
  autoAllowedByDefault: false,
  explicitOnly: true,
  recommended: false,
  supportsFreshness: false,
  freeTier: "Fast tier $1/1000",
  signupUrl: "https://specstream.ai",
  termsUrl: "https://specstream.ai/terms",
  privacyPolicyUrl: "https://specstream.ai/privacy",
});

const API_URL = "https://api.specstream.ai/v1/web-search";
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_QUERY_CHARS = 2_000;
const TRANSIENT_STATUSES = new Set([429, 500, 503]);

function boundedResultCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ProviderConfigError("specstream_max_results_invalid");
  }
  return Math.max(1, Math.min(Math.trunc(value), 100));
}

export async function searchSpecStream(
  query: string,
  apiKey: string,
  maxResults: number,
  options: SpecStreamSearchOptions = {},
): Promise<Json> {
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    throw new ProviderConfigError("specstream_api_key_required");
  }
  if (typeof query !== "string") throw new ProviderConfigError("specstream_query_invalid");
  const normalizedQuery = query.trim();
  if (!normalizedQuery || normalizedQuery.length > MAX_QUERY_CHARS) {
    throw new ProviderConfigError("specstream_query_invalid");
  }

  const count = boundedResultCount(maxResults);
  const timeoutSeconds = boundedTimeoutSeconds(
    options.timeoutSeconds,
    30,
    "specstream_timeout_invalid",
  );

  const params = new URLSearchParams({ query: normalizedQuery, count: String(count) });
  const requestUrl = `${API_URL}?${params.toString()}`;

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
    errorPrefix: "specstream",
    transientStatuses: TRANSIENT_STATUSES,
  });

  if (
    !payload
    || typeof payload !== "object"
    || Array.isArray(payload)
    || !Array.isArray((payload as Json).results)
  ) {
    throw new ProviderRequestError("specstream_invalid_response", { transient: true });
  }

  const body = payload as Json;
  return {
    provider: "specstream",
    query: normalizedQuery,
    results: body.results,
    images: [],
    metadata: {
      total_results: body.total_results,
    },
  };
}
