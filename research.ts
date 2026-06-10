import type { ProviderName } from "./routing-config.ts";

type Json = Record<string, any>;

export type ResearchSearchResult = {
  title: string;
  url: string;
  snippet: string;
  [key: string]: any;
};

export type ResearchSearchResponse = {
  results: ResearchSearchResult[];
  [key: string]: any;
};

export function normalizeResultUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    const pathname = u.pathname.replace(/\/$/, "");
    return `${host}${pathname}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

export function deduplicateResultsAcrossProviders(resultsByProvider: Array<[string, ResearchSearchResponse]>, maxResults: number): { results: ResearchSearchResult[]; dedupCount: number } {
  const deduped: ResearchSearchResult[] = [];
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

export function selectResearchProviders(
  primaryProvider: ProviderName | null,
  providerPriority: ProviderName[],
  availableProviders: Set<ProviderName>,
  maxProviders = 3,
): ProviderName[] {
  const preferred: Array<ProviderName | null> = [primaryProvider, "linkup", "tavily", "exa", "firecrawl", "brave", "serper", "you", "querit"];
  const ordered: ProviderName[] = [];
  for (const provider of [...preferred, ...providerPriority]) {
    if (provider && availableProviders.has(provider) && !ordered.includes(provider)) {
      ordered.push(provider);
    }
    if (ordered.length >= maxProviders) break;
  }
  return ordered;
}

export type RunResearchModeOptions = {
  query: string;
  researchProviders: string[];
  executeSearch: (provider: string) => Promise<ResearchSearchResponse>;
  extractUrls: (urls: string[]) => Promise<{ provider?: string | null; results?: Json[]; error?: string } | null | undefined>;
  maxResults: number;
  maxExtractUrls?: number;
  timeBudgetSeconds?: number | null;
  nowFn?: () => number;
};

// Research mode is intentionally best-effort: provider/extraction failures produce
// diagnostics and partial search results instead of throwing away the whole response.
// Provider searches run concurrently so wall-clock cost tracks the slowest single
// provider rather than the sum of all of them. The optional time budget gates which
// providers are launched (checked before each launch, so a tight budget skips later
// providers deterministically) and whether extraction runs at all. Result ordering
// is preserved by provider submission order regardless of completion order, so
// deduplication stays deterministic.
export async function runResearchMode(options: RunResearchModeOptions): Promise<Json> {
  const { query, researchProviders, executeSearch, extractUrls, maxResults } = options;
  const maxExtractUrls = options.maxExtractUrls ?? 3;
  const timeBudgetSeconds = options.timeBudgetSeconds ?? null;
  const now = options.nowFn || (() => Date.now() / 1000);
  const start = now();
  const budgetExhausted = () => timeBudgetSeconds != null && now() - start >= timeBudgetSeconds;

  const providerErrors: Json[] = [];
  const launched: Array<{ index: number; provider: string; promise: Promise<ResearchSearchResponse> }> = [];
  for (const [index, provider] of researchProviders.entries()) {
    if (budgetExhausted()) {
      providerErrors.push({ provider, error: "skipped: research time budget exhausted" });
      continue;
    }
    launched.push({ index, provider, promise: executeSearch(provider) });
  }

  const resultsByIndex = new Map<number, [string, ResearchSearchResponse]>();
  for (const { index, provider, promise } of launched) {
    try {
      resultsByIndex.set(index, [provider, await promise]);
    } catch (error: any) {
      providerErrors.push({ provider, error: String(error?.message || error) });
    }
  }
  const providerResults = [...resultsByIndex.keys()].sort((a, b) => a - b).map((index) => resultsByIndex.get(index)!);

  const { results: deduped, dedupCount } = deduplicateResultsAcrossProviders(providerResults, maxResults);
  const urls = deduped.map((item) => item.url).filter(Boolean).slice(0, Math.max(0, maxExtractUrls));
  let extracted: { provider?: string | null; results?: Json[]; error?: string } = { provider: null, results: [] };
  let extractionError: string | null = null;
  if (urls.length) {
    if (budgetExhausted()) {
      extractionError = "skipped: research time budget exhausted";
    } else {
      try {
        extracted = (await extractUrls(urls)) || { provider: null, results: [] };
        if (extracted.error && !(extracted.results || []).length) {
          extractionError = String(extracted.error);
          extracted = { provider: extracted.provider ?? null, results: [] };
        }
      } catch (error: any) {
        extractionError = String(error?.message || error);
        extracted = { provider: null, results: [] };
      }
    }
  }

  const routing: Json = {
    providers_queried: providerResults.map(([provider]) => provider),
    provider_errors: providerErrors,
    extraction_provider: extracted.provider ?? null,
  };
  if (extractionError) routing.extraction_error = extractionError;

  const sourceSummaries = extracted.results || [];

  return {
    mode: "research",
    provider: "research",
    query,
    results: deduped,
    source_summaries: sourceSummaries,
    routing,
    metadata: {
      dedup_count: dedupCount,
      providers_merged: providerResults.map(([provider]) => provider),
      extracted_url_count: sourceSummaries.length,
    },
  };
}
