// Passive quality observations. They are calculated from an already completed
// request and never influence routing or response content.
type Json = Record<string, any>;
const startedAt = Date.now();
let observations = 0;
let resultCount = 0;
let domainCount = 0;
let thinSnippets = 0;
let degraded = 0;

export function recordShadowQualityObservation(payload: Json): void {
  const results = Array.isArray(payload?.results) ? payload.results : [];
  const domains = new Set<string>();
  for (const result of results) {
    try { domains.add(new URL(String(result?.url || "")).hostname.replace(/^www\./, "").toLowerCase()); } catch { /* malformed provider URL has no domain */ }
    if (String(result?.snippet || "").length < 40) thinSnippets += 1;
  }
  observations += 1;
  resultCount += results.length;
  domainCount += domains.size;
  if (payload?.status === "degraded" || payload?.status === "failed") degraded += 1;
}

export function getShadowQualitySnapshot(): Json {
  return {
    scope: "process_local",
    process_started_at: new Date(startedAt).toISOString(),
    observations,
    aggregate: {
      average_result_count: observations ? Number((resultCount / observations).toFixed(3)) : 0,
      average_domain_count: observations ? Number((domainCount / observations).toFixed(3)) : 0,
      thin_snippet_rate: resultCount ? Number((thinSnippets / resultCount).toFixed(3)) : 0,
      degraded_or_failed_rate: observations ? Number((degraded / observations).toFixed(3)) : 0,
    },
    note: "Passive observations only; they do not alter routing or results.",
  };
}

export function __resetShadowQualityForTests(): void {
  observations = 0;
  resultCount = 0;
  domainCount = 0;
  thinSnippets = 0;
  degraded = 0;
}
