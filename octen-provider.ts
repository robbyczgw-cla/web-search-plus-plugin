import {
  ProviderConfigError,
  ProviderRequestError,
  boundedTimeoutSeconds,
  requestBoundedJson,
} from "./provider-http.ts";

type Json = Record<string, any>;

const OCTEN_API_URL = "https://api.monid.ai/v1/run";
const OCTEN_MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const OCTEN_TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504]);
const FRESHNESS_VALUES = new Set(["day", "week", "month", "year"]);

export const OCTEN_PROVIDER_METADATA = Object.freeze({
  id: "octen",
  displayName: "Octen via Monid",
  apiKeyConfig: "monidApiKey",
  autoAllowedByDefault: false,
  capabilities: ["search", "freshness"] as const,
  freeTier: "No free-tier claim; Monid API key and wallet balance required",
  signupUrl: "https://app.monid.ai/access/api-keys",
});

export type OctenSearchOptions = {
  freshness?: string;
  timeRange?: string;
  searchType?: "search" | "news";
  includeDomains?: string[];
  excludeDomains?: string[];
  timeoutSeconds?: number;
};

export type OctenSearchResponse = {
  provider: "octen";
  query: string;
  results: Array<Record<string, any> & { title: string; url: string; snippet: string }>;
  images: never[];
  metadata: Json;
};

function cleanDomains(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function finiteCount(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new ProviderConfigError("octen_max_results_invalid");
  return Math.max(1, Math.min(100, Math.floor(parsed)));
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function safeHttpUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const parsed = new URL(value);
    if (
      !["http:", "https:"].includes(parsed.protocol)
      || parsed.username
      || parsed.password
    ) return "";
    return value;
  } catch {
    return "";
  }
}

function providerFailure(code: unknown): ProviderRequestError {
  const statusCode = Number.isInteger(code) ? Number(code) : undefined;
  const suffix = statusCode == null ? "unknown" : String(statusCode);
  return new ProviderRequestError(`octen_api_${suffix}`, {
    statusCode,
    transient: statusCode != null && OCTEN_TRANSIENT_STATUSES.has(statusCode),
  });
}

function projectMetadata(envelope: Json, output: Json): Json {
  const metadata: Json = {};
  if (typeof envelope.runId === "string" && envelope.runId) metadata.monid_run_id = envelope.runId;
  if (typeof output.request_id === "string" && output.request_id) metadata.request_id = output.request_id;

  const meta = output.meta;
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    if (typeof meta.latency === "number" && Number.isFinite(meta.latency)) metadata.latency_ms = meta.latency;
    const usage = meta.usage;
    if (usage && typeof usage === "object" && !Array.isArray(usage)) {
      const projectedUsage: Json = {};
      if (Number.isInteger(usage.num_search_queries) && usage.num_search_queries >= 0) {
        projectedUsage.search_queries = usage.num_search_queries;
      }
      if (Number.isInteger(usage.full_content_tokens) && usage.full_content_tokens >= 0) {
        projectedUsage.full_content_tokens = usage.full_content_tokens;
      }
      if (Object.keys(projectedUsage).length) metadata.usage = projectedUsage;
    }
  }

  const actualCost = envelope.billing?.actualCost;
  if (
    actualCost
    && typeof actualCost === "object"
    && typeof actualCost.value === "number"
    && Number.isFinite(actualCost.value)
    && actualCost.unit === "MICRO_DOLLAR"
  ) {
    metadata.cost_usd = actualCost.value / 1_000_000;
  }
  return metadata;
}

export async function searchOcten(
  query: string,
  apiKey: string,
  maxResults: number,
  options: OctenSearchOptions = {},
): Promise<OctenSearchResponse> {
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    throw new ProviderConfigError("monid_api_key_required");
  }
  if (typeof query !== "string" || !query.trim()) {
    throw new ProviderConfigError("octen_query_invalid");
  }

  const count = finiteCount(maxResults);
  const timeoutSeconds = boundedTimeoutSeconds(
    options.timeoutSeconds,
    30,
    "octen_timeout_invalid",
  );
  const input: Json = {
    query,
    count,
    // Octen has a news topic, but this source-only adapter intentionally stays
    // on the truthful capability surface until native vertical metadata is
    // wired through the OpenClaw router.
    topic: "general",
    highlight: { enable: true, max_tokens: 300 },
    full_content: { enable: false },
    format: "text",
  };
  const includeDomains = cleanDomains(options.includeDomains);
  const excludeDomains = cleanDomains(options.excludeDomains);
  if (includeDomains.length) input.include_domains = includeDomains;
  if (excludeDomains.length) input.exclude_domains = excludeDomains;
  const freshness = FRESHNESS_VALUES.has(String(options.freshness || ""))
    ? options.freshness
    : options.timeRange;
  if (FRESHNESS_VALUES.has(String(freshness || ""))) input.time_range = freshness;

  const envelope = await requestBoundedJson<Json>(OCTEN_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ provider: "octen", endpoint: "/search", input }),
  }, {
    timeoutSeconds,
    maxResponseBytes: OCTEN_MAX_RESPONSE_BYTES,
    errorPrefix: "octen",
    transientStatuses: OCTEN_TRANSIENT_STATUSES,
  });

  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
    throw new ProviderRequestError("octen_invalid_response", { transient: true });
  }
  if (envelope.provider !== "octen" || envelope.endpoint !== "/search") {
    throw new ProviderRequestError("octen_monid_invalid_envelope", { transient: true });
  }
  if (envelope.status === "FAILED") {
    throw new ProviderRequestError("octen_monid_failed", { statusCode: 500, transient: false });
  }
  if (envelope.status !== "COMPLETED") {
    throw new ProviderRequestError("octen_monid_not_completed", { transient: true });
  }

  const providerResponse = envelope.providerResponse;
  const providerStatus = providerResponse && typeof providerResponse === "object"
    ? providerResponse.httpStatus
    : undefined;
  if (!Number.isInteger(providerStatus)) {
    throw new ProviderRequestError("octen_monid_invalid_response", { transient: true });
  }
  if (providerStatus < 200 || providerStatus >= 300) {
    throw new ProviderRequestError(`octen_provider_http_${providerStatus}`, {
      statusCode: providerStatus,
      transient: OCTEN_TRANSIENT_STATUSES.has(providerStatus),
    });
  }

  const output = envelope.output;
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    throw new ProviderRequestError("octen_monid_invalid_response", { transient: true });
  }
  if (output.code !== 0) throw providerFailure(output.code);
  if (!output.data || typeof output.data !== "object" || !Array.isArray(output.data.results)) {
    throw new ProviderRequestError("octen_invalid_response", { transient: true });
  }

  const results: OctenSearchResponse["results"] = [];
  for (const item of output.data.results.slice(0, count)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const url = safeHttpUrl(item.url);
    if (!url) continue;
    const projected: Json = {
      url,
      title: stringValue(item.title),
      snippet: stringValue(item.highlight),
    };
    const optional = {
      date: item.time_published,
      author: item.authors,
      favicon: item.favicon,
      last_crawled: item.time_last_crawled,
    };
    for (const [field, value] of Object.entries(optional)) {
      if (typeof value === "string" && value) projected[field] = value;
    }
    results.push(projected as OctenSearchResponse["results"][number]);
  }

  return {
    provider: "octen",
    query,
    results,
    images: [],
    metadata: projectMetadata(envelope, output),
  };
}
