import { createHash } from "node:crypto";
import type { ProviderName } from "./routing-config.ts";
import { rerankDuplicateCandidates } from "./diversity.ts";

type Json = Record<string, any>;

const SNIPPET_SEPARATOR = "\n\n";
const MAX_AGGREGATED_SNIPPET_CODEPOINTS = 600;
const RESULT_GRACE_MILLISECONDS = 250;
const DEFAULT_QUORUM_RESULT_TARGET_CAP = 5;
const DEFAULT_QUORUM_MIN_UNIQUE_DOMAINS = 3;
const AUTHORITATIVE_SOURCE_TYPES = new Set(["docs", "paper", "repo", "reference"]);

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

export type ResearchSourceType = {
  value: "repo" | "paper" | "docs" | "reference" | "forum" | "news" | "blog" | "other";
  method: "url_heuristic" | "provider_hint_normalized";
  method_version: "1";
  confidence: "high" | "medium" | "low";
};

export type ResearchFetchPriority = {
  tier: "high" | "medium" | "low";
  reason_codes: [string, string, string];
};

type ResearchObservation = {
  observation_id: string;
  provider: string;
  provider_submission_index: number;
  provider_result_index: number;
  item: ResearchSearchResult;
};

type ResultCluster = {
  key: string;
  representative: ResearchObservation;
  observations: ResearchObservation[];
};

type SnippetFragment = {
  observation_id: string;
  provider: string;
  provider_result_index: number;
  source_field: "snippet";
  text: string;
  transformations: string[];
};

function stableId(prefix: string, ...parts: unknown[]): string {
  const raw = parts.map((part) => String(part)).join("\x1f");
  return `${prefix}_${createHash("sha256").update(raw).digest("hex").slice(0, 16)}`;
}

function positiveInteger(value: unknown, fallback: number, minimum = 1): number {
  if (typeof value === "boolean") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.floor(parsed)) : fallback;
}

function codePointLength(value: string): number {
  return Array.from(value).length;
}

function takeCodePoints(value: string, count: number): string {
  return Array.from(value).slice(0, Math.max(0, count)).join("");
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareObservations(left: ResearchObservation, right: ResearchObservation): number {
  return compareStrings(left.provider, right.provider)
    || left.provider_result_index - right.provider_result_index
    || compareStrings(left.observation_id, right.observation_id);
}

function sourceType(url: string, rawHint: unknown): ResearchSourceType {
  let host = "";
  let path = "";
  try {
    const parsed = new URL(url);
    host = parsed.hostname.toLowerCase();
    path = parsed.pathname.toLowerCase();
  } catch {
    // Invalid URLs remain usable as ordinary results, but receive no authority boost.
  }

  if (["github.com", "gitlab.com", "bitbucket.org"].includes(host)) {
    return { value: "repo", method: "url_heuristic", method_version: "1", confidence: "high" };
  }
  if (["arxiv.org", "doi.org", "semanticscholar.org", "pubmed.ncbi.nlm.nih.gov"].includes(host) || path.endsWith(".pdf")) {
    return { value: "paper", method: "url_heuristic", method_version: "1", confidence: "high" };
  }
  if (host.startsWith("docs.") || path.includes("/docs") || path.includes("/documentation")) {
    return { value: "docs", method: "url_heuristic", method_version: "1", confidence: "high" };
  }
  if (["wikipedia.org", "en.wikipedia.org", "developer.mozilla.org"].includes(host)) {
    return { value: "reference", method: "url_heuristic", method_version: "1", confidence: "high" };
  }
  if (["reddit.", "stackoverflow.", "discourse.", "forum.", "community."].some((token) => host.includes(token))) {
    return { value: "forum", method: "url_heuristic", method_version: "1", confidence: "high" };
  }
  if (host.startsWith("news.") || path.includes("/news")) {
    return { value: "news", method: "url_heuristic", method_version: "1", confidence: "medium" };
  }
  if (host.startsWith("blog.") || path.includes("/blog")) {
    return { value: "blog", method: "url_heuristic", method_version: "1", confidence: "medium" };
  }

  const hintValue = rawHint && typeof rawHint === "object" && "value" in rawHint
    ? (rawHint as { value?: unknown }).value
    : rawHint;
  const hint = String(hintValue || "").toLowerCase().replace(/_/g, "-");
  const hintMap: Record<string, ResearchSourceType["value"]> = {
    "official-docs": "docs",
    docs: "docs",
    documentation: "docs",
    paper: "paper",
    repository: "repo",
    repo: "repo",
    blog: "blog",
    forum: "forum",
    reference: "reference",
    news: "news",
  };
  if (hintMap[hint]) {
    return { value: hintMap[hint], method: "provider_hint_normalized", method_version: "1", confidence: "medium" };
  }
  return { value: "other", method: "url_heuristic", method_version: "1", confidence: "low" };
}

function fetchPriority(engineRank: number, observations: ResearchObservation[], classifiedSource: ResearchSourceType): ResearchFetchPriority {
  const consensus = new Set(observations.map((observation) => observation.provider)).size >= 2;
  return fetchPriorityFromSignals(engineRank, consensus, classifiedSource);
}

function fetchPriorityFromSignals(engineRank: number, consensus: boolean, classifiedSource: ResearchSourceType): ResearchFetchPriority {
  const authoritative = AUTHORITATIVE_SOURCE_TYPES.has(classifiedSource.value);
  const reasonCodes: [string, string, string] = [
    consensus ? "cluster_consensus" : "cluster_single_observation",
    engineRank <= 3 ? "rank_top_3" : "rank_beyond_top_3",
    authoritative ? "source_type_authoritative" : "source_type_general",
  ];
  const score = (consensus ? 2 : 0) + (engineRank <= 3 ? 1 : 0) + (authoritative ? 1 : 0);
  return { tier: score >= 3 ? "high" : score >= 1 ? "medium" : "low", reason_codes: reasonCodes };
}

function aggregateSnippet(observations: ResearchObservation[]): { text: string; provenance: Json } | null {
  const candidates = observations.filter((observation) => typeof observation.item.snippet === "string" && observation.item.snippet.length > 0);
  if (!candidates.length) return null;

  const normalizedSnippet = (observation: ResearchObservation) => String(observation.item.snippet)
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const retained: ResearchObservation[] = [];
  const retainedNormalized: string[] = [];
  for (const candidate of [...candidates].sort((left, right) => {
    const lengthDifference = codePointLength(normalizedSnippet(right)) - codePointLength(normalizedSnippet(left));
    return lengthDifference || compareObservations(left, right);
  })) {
    const normalized = normalizedSnippet(candidate);
    if (!normalized) continue;
    if (retainedNormalized.some((existing) => normalized.includes(existing) || existing.includes(normalized))) continue;
    retained.push(candidate);
    retainedNormalized.push(normalized);
  }
  retained.sort(compareObservations);

  const fragments: SnippetFragment[] = [];
  let usedCodePoints = 0;
  for (const observation of retained) {
    const separatorLength = fragments.length ? codePointLength(SNIPPET_SEPARATOR) : 0;
    const remaining = MAX_AGGREGATED_SNIPPET_CODEPOINTS - usedCodePoints - separatorLength;
    if (remaining <= 0) break;
    const sourceText = String(observation.item.snippet).normalize("NFC");
    const text = takeCodePoints(sourceText, remaining);
    const transformations = ["mechanical_segmentation"];
    if (codePointLength(text) < codePointLength(sourceText)) transformations.push("deterministic_truncation");
    fragments.push({
      observation_id: observation.observation_id,
      provider: observation.provider,
      provider_result_index: observation.provider_result_index,
      source_field: "snippet",
      text,
      transformations,
    });
    usedCodePoints += codePointLength(text) + separatorLength;
    if (codePointLength(text) < codePointLength(sourceText)) break;
  }
  if (!fragments.length) return null;

  const text = fragments.map((fragment) => fragment.text).join(SNIPPET_SEPARATOR);
  const provenance = observations.length > 1
    ? { aggregation: "concat", separator: SNIPPET_SEPARATOR, fragments }
    : { ...fragments[0] };
  return { text, provenance };
}

function enrichCluster(cluster: ResultCluster, engineRank: number): ResearchSearchResult {
  const representative = cluster.representative;
  const observations = [...cluster.observations].sort(compareObservations);
  const classifiedSource = sourceType(representative.item.url || "", representative.item.source_type);
  const snippet = aggregateSnippet(observations);
  const result: ResearchSearchResult = {
    ...representative.item,
    // The actual adapter is authoritative; a provider-returned provider label must
    // not be able to misattribute the result or its snippet fragments.
    provider: representative.provider,
    representative_observation_id: representative.observation_id,
    observation_ids: observations.map((observation) => observation.observation_id),
    source_observations: observations.map((observation) => {
      const rawSnippet = typeof observation.item.snippet === "string" ? observation.item.snippet.normalize("NFC") : "";
      return {
        observation_id: observation.observation_id,
        provider: observation.provider,
        provider_result_index: observation.provider_result_index,
        url: String(observation.item.url || ""),
        title: String(observation.item.title || ""),
        ...(rawSnippet ? {
          snippet_sha256: createHash("sha256").update(rawSnippet).digest("hex"),
          snippet_codepoint_length: codePointLength(rawSnippet),
        } : {}),
      };
    }),
    dedup_cluster_id: stableId("cluster", cluster.key),
    source_type: classifiedSource,
    fetch_priority: fetchPriority(engineRank, observations, classifiedSource),
  };
  if (snippet) {
    result.snippet = snippet.text;
    result.snippet_origin = observations.length > 1 ? "engine" : "provider";
    result.snippet_provenance = snippet.provenance;
  }
  return result;
}

export function normalizeResultUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    // URL.host retains meaningful non-default ports; merging distinct origins
    // would falsely manufacture cross-provider consensus and lose a result.
    const host = u.host.replace(/^www\./i, "").toLowerCase();
    const pathname = u.pathname.replace(/\/$/, "");
    return `${host}${pathname}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

// Keep the long-standing flat deduplication contract for ordinary auto-fallback
// callers. Research enrichment is intentionally separate: silently replacing a
// classic result's representative snippet with cross-provider text would make a
// non-research response look as though the first provider authored every fragment.
export function deduplicateResultsAcrossProviders(resultsByProvider: Array<[string, ResearchSearchResponse]>, maxResults: number): { results: ResearchSearchResult[]; dedupCount: number } {
  const deduped: ResearchSearchResult[] = [];
  const seen = new Set<string>();
  let dedupCount = 0;
  for (const [provider, data] of resultsByProvider) {
    for (const item of data.results || []) {
      if (!item || typeof item !== "object") continue;
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

export function mergeResearchResultsAcrossProviders(resultsByProvider: Array<[string, ResearchSearchResponse]>, maxResults: number): { results: ResearchSearchResult[]; dedupCount: number } {
  const clusters: ResultCluster[] = [];
  const clustersByKey = new Map<string, ResultCluster>();
  let dedupCount = 0;
  for (const [providerSubmissionIndex, [provider, data]] of resultsByProvider.entries()) {
    for (const [providerResultIndex, item] of (data.results || []).entries()) {
      if (!item || typeof item !== "object") continue;
      const norm = normalizeResultUrl(item.url || "");
      const key = norm || `missing-url:${providerSubmissionIndex}:${providerResultIndex}`;
      const observation: ResearchObservation = {
        observation_id: stableId(
          "obs",
          provider,
          providerSubmissionIndex,
          providerResultIndex,
          norm,
          String(item.title || ""),
          String(item.snippet || "").normalize("NFC"),
        ),
        provider,
        provider_submission_index: providerSubmissionIndex,
        provider_result_index: providerResultIndex,
        item,
      };
      const existing = clustersByKey.get(key);
      if (existing) {
        existing.observations.push(observation);
        dedupCount += 1;
        continue;
      }
      const cluster = { key, representative: observation, observations: [observation] };
      clusters.push(cluster);
      clustersByKey.set(key, cluster);
    }
  }
  const limit = Number.isFinite(maxResults) ? Math.max(0, Math.floor(maxResults)) : 0;
  return {
    results: clusters.slice(0, limit).map((cluster, index) => enrichCluster(cluster, index + 1)),
    dedupCount,
  };
}

export function researchQuorumSnapshot(
  resultsByProvider: Array<[string, ResearchSearchResponse]>,
): { deduplicatedResultCount: number; uniqueDomainCount: number; contributingProviders: string[] } {
  const seenUrls = new Set<string>();
  const domains = new Set<string>();
  const contributingProviders: string[] = [];
  let deduplicatedResultCount = 0;
  for (const [provider, payload] of resultsByProvider) {
    let contributed = false;
    for (const item of payload.results || []) {
      if (!item || typeof item !== "object" || typeof item.url !== "string" || !item.url.trim()) continue;
      const normalized = normalizeResultUrl(item.url);
      if (!normalized || seenUrls.has(normalized)) continue;
      seenUrls.add(normalized);
      deduplicatedResultCount += 1;
      contributed = true;
      try {
        const domain = new URL(item.url).hostname.replace(/^www\./i, "").toLowerCase();
        if (domain) domains.add(domain);
      } catch {
        // Invalid URLs cannot contribute domain-diversity evidence.
      }
    }
    if (contributed) contributingProviders.push(provider);
  }
  return { deduplicatedResultCount, uniqueDomainCount: domains.size, contributingProviders };
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
  executeSearch: (provider: string, signal?: AbortSignal) => Promise<ResearchSearchResponse>;
  extractUrls: (urls: string[]) => Promise<{ provider?: string | null; results?: Json[]; error?: string } | null | undefined>;
  maxResults: number;
  maxExtractUrls?: number;
  timeBudgetSeconds?: number | null;
  nowFn?: () => number;
  diversityRerank?: boolean;
  quorumEnabled?: boolean;
  quorumMinContributingProviders?: number;
  quorumResultTargetCap?: number;
  quorumMinUniqueDomains?: number;
};

type ResearchAttempt = {
  provider: string;
  outcome: "success" | "failed" | "skipped" | "cancelled";
  result_count: number;
  error?: string;
};

function withResearchDeadline<T>(
  promise: Promise<T>,
  remainingSeconds: number | null,
  onTimeout?: () => void,
  graceMilliseconds = 0,
): Promise<T> {
  if (remainingSeconds == null) return promise;
  return new Promise<T>((resolve, reject) => {
    let graceTimer: ReturnType<typeof setTimeout> | undefined;
    const rejectForDeadline = () => {
      onTimeout?.();
      reject(new Error("research_deadline_exceeded"));
    };
    const timer = setTimeout(() => {
      if (graceMilliseconds > 0) {
        graceTimer = setTimeout(rejectForDeadline, graceMilliseconds);
        graceTimer.unref?.();
      } else {
        rejectForDeadline();
      }
    }, Math.max(1, remainingSeconds * 1000));
    timer.unref?.();
    promise.then(
      (value) => {
        clearTimeout(timer);
        if (graceTimer) clearTimeout(graceTimer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        if (graceTimer) clearTimeout(graceTimer);
        reject(error);
      },
    );
  });
}

// Research mode is intentionally best-effort: provider/extraction failures produce
// diagnostics and partial search results instead of throwing away the whole response.
// Provider searches run concurrently and are harvested in completion order, so a
// blocked early submission cannot hide later useful results. Final results, attempts,
// and diagnostics are restored to submission order. A conservative quality quorum
// can preempt only still-pending work after multiple providers, enough unique URLs,
// and enough unique domains have all contributed.
export async function runResearchMode(options: RunResearchModeOptions): Promise<Json> {
  const { query, researchProviders, executeSearch, extractUrls, maxResults } = options;
  const maxExtractUrls = options.maxExtractUrls ?? 3;
  const timeBudgetSeconds = options.timeBudgetSeconds ?? null;
  const now = options.nowFn || (() => Date.now() / 1000);
  const start = now();
  const budgetExhausted = () => timeBudgetSeconds != null && now() - start >= timeBudgetSeconds;

  const quorumEnabled = options.quorumEnabled !== false;
  const quorumMinContributingProviders = Math.max(2, positiveInteger(options.quorumMinContributingProviders, 2));
  const quorumResultTargetCap = positiveInteger(options.quorumResultTargetCap, DEFAULT_QUORUM_RESULT_TARGET_CAP);
  const quorumResultTarget = Math.min(Math.max(1, positiveInteger(maxResults, 1)), quorumResultTargetCap);
  const quorumMinUniqueDomains = Math.min(
    quorumResultTarget,
    positiveInteger(options.quorumMinUniqueDomains, DEFAULT_QUORUM_MIN_UNIQUE_DOMAINS),
  );

  const providerErrors: Array<{ index: number; provider: string; error: string }> = [];
  const providerAttempts = new Map<number, ResearchAttempt>();
  const launched = new Map<number, { provider: string; controller: AbortController }>();
  type Completion = {
    index: number;
    provider: string;
    response?: ResearchSearchResponse;
    error?: unknown;
  };
  const completionQueue: Completion[] = [];
  let wakeCompletion: (() => void) | null = null;
  const publishCompletion = (completion: Completion) => {
    completionQueue.push(completion);
    const wake = wakeCompletion;
    wakeCompletion = null;
    wake?.();
  };
  const waitForCompletion = async () => {
    if (completionQueue.length) return;
    await new Promise<void>((resolve) => { wakeCompletion = resolve; });
  };

  for (const [index, provider] of researchProviders.entries()) {
    if (budgetExhausted()) {
      const error = "skipped: research time budget exhausted";
      providerErrors.push({ index, provider, error });
      providerAttempts.set(index, { provider, outcome: "skipped", result_count: 0, error });
      continue;
    }
    const elapsed = now() - start;
    const remaining = timeBudgetSeconds == null ? null : Math.max(0, timeBudgetSeconds - elapsed);
    const controller = new AbortController();
    launched.set(index, { provider, controller });
    const providerPromise = Promise.resolve().then(() => executeSearch(provider, controller.signal));
    void withResearchDeadline(
      providerPromise,
      remaining,
      () => controller.abort("research_deadline_exceeded"),
      RESULT_GRACE_MILLISECONDS,
    ).then(
      (response) => publishCompletion({ index, provider, response }),
      (error) => publishCompletion({ index, provider, error }),
    );
  }

  const resultsByIndex = new Map<number, [string, ResearchSearchResponse]>();
  const pending = new Set(launched.keys());
  let quorumTriggered = false;
  const providerResultsInSubmissionOrder = () => [...resultsByIndex.keys()]
    .sort((left, right) => left - right)
    .map((index) => resultsByIndex.get(index)!);
  const quorumSnapshot = () => researchQuorumSnapshot(providerResultsInSubmissionOrder());
  const quorumReached = () => {
    if (!quorumEnabled) return false;
    const snapshot = quorumSnapshot();
    return snapshot.contributingProviders.length >= quorumMinContributingProviders
      && snapshot.deduplicatedResultCount >= quorumResultTarget
      && snapshot.uniqueDomainCount >= quorumMinUniqueDomains;
  };

  const harvestCompletion = (completion: Completion) => {
    if (!pending.delete(completion.index)) return;
    const { index, provider } = completion;
    if (completion.error == null) {
      const response = completion.response;
      if (!response || typeof response !== "object" || Array.isArray(response)) {
        const error = "provider returned a non-object result";
        providerErrors.push({ index, provider, error });
        providerAttempts.set(index, { provider, outcome: "failed", result_count: 0, error });
        return;
      }
      resultsByIndex.set(index, [provider, response]);
      providerAttempts.set(index, { provider, outcome: "success", result_count: Array.isArray(response.results) ? response.results.length : 0 });
      return;
    }
    const rawMessage = String((completion.error as any)?.message || completion.error);
    const deadlineExceeded = rawMessage === "research_deadline_exceeded";
    const error = deadlineExceeded
      ? "cancelled: research time budget exceeded after provider start"
      : rawMessage;
    providerErrors.push({ index, provider, error });
    providerAttempts.set(index, { provider, outcome: deadlineExceeded ? "cancelled" : "failed", result_count: 0, error });
  };

  while (pending.size) {
    await waitForCompletion();
    // Let any settlements already queued in the same turn publish before the
    // quorum check, then harvest the entire observable completion batch.
    await Promise.resolve();
    while (completionQueue.length) harvestCompletion(completionQueue.shift()!);
    if (!pending.size) break;
    if (quorumReached()) {
      // A completed async function can still be a few promise reactions away from
      // publishing its tagged completion. Give the current event-loop turn one
      // final chance to publish, then drain again before labelling anything pending.
      await new Promise<void>((resolve) => setImmediate(resolve));
      while (completionQueue.length) harvestCompletion(completionQueue.shift()!);
      if (!pending.size) break;
    }
    if (quorumReached()) {
      for (const index of [...pending].sort((left, right) => left - right)) {
        const launchedProvider = launched.get(index)!;
        launchedProvider.controller.abort("preempted_after_quorum");
        const error = "preempted_after_quorum";
        providerErrors.push({ index, provider: launchedProvider.provider, error });
        providerAttempts.set(index, { provider: launchedProvider.provider, outcome: "cancelled", result_count: 0, error });
        pending.delete(index);
      }
      quorumTriggered = true;
      break;
    }
  }
  const providerResults = providerResultsInSubmissionOrder();
  const publicProviderErrors = providerErrors
    .sort((left, right) => left.index - right.index || compareStrings(left.error, right.error))
    .map(({ provider, error }) => ({ provider, error }));

  const { results: deduped, dedupCount } = mergeResearchResultsAcrossProviders(providerResults, maxResults);
  const diversityRerank = options.diversityRerank
    ? rerankDuplicateCandidates(deduped)
    : { results: deduped, duplicates: [] };
  const researchResults = (diversityRerank.results as ResearchSearchResult[]).map((item, index) => {
    const classifiedSource = item.source_type as ResearchSourceType;
    const consensus = item.fetch_priority?.reason_codes?.[0] === "cluster_consensus";
    return {
      ...item,
      fetch_priority: fetchPriorityFromSignals(index + 1, consensus, classifiedSource),
    };
  });
  const urls = researchResults.map((item) => item.url).filter(Boolean).slice(0, Math.max(0, maxExtractUrls));
  let extracted: { provider?: string | null; results?: Json[]; error?: string } = { provider: null, results: [] };
  let extractionError: string | null = null;
  if (urls.length) {
    if (budgetExhausted()) {
      extractionError = "skipped: research time budget exhausted";
    } else {
      try {
        const remaining = timeBudgetSeconds == null ? null : Math.max(0, timeBudgetSeconds - (now() - start));
        extracted = (await withResearchDeadline(extractUrls(urls), remaining)) || { provider: null, results: [] };
        if (extracted.error && !(extracted.results || []).length) {
          extractionError = String(extracted.error);
          extracted = { provider: extracted.provider ?? null, results: [] };
        }
      } catch (error: any) {
        extractionError = String(error?.message || error) === "research_deadline_exceeded"
          ? "timed out: research time budget exhausted"
          : String(error?.message || error);
        extracted = { provider: null, results: [] };
      }
    }
  }

  const routing: Json = {
    providers_queried: providerResults.map(([provider]) => provider),
    provider_attempts: [...providerAttempts.entries()].sort(([left], [right]) => left - right).map(([, attempt]) => attempt),
    provider_errors: publicProviderErrors,
    extraction_provider: extracted.provider ?? null,
  };
  if (extractionError) routing.extraction_error = extractionError;

  const sourceSummaries = extracted.results || [];
  const materialProviderErrors = publicProviderErrors.filter((entry) => entry.error !== "preempted_after_quorum");
  const finalQuorumSnapshot = quorumSnapshot();
  const status = providerResults.length === 0
    ? "failed"
    : materialProviderErrors.length > 0 || extractionError
      ? "degraded"
      : "success";

  return {
    status,
    mode: "research",
    provider: "research",
    query,
    results: researchResults,
    source_summaries: sourceSummaries,
    ...(status === "failed" ? { error: "All research providers failed" } : {}),
    routing,
    metadata: {
      dedup_count: dedupCount,
      diversity_rerank: {
        enabled: options.diversityRerank === true,
        moved_candidate_count: new Set(diversityRerank.duplicates.map((item) => item.dropped_candidate)).size,
        duplicates: diversityRerank.duplicates,
      },
      providers_merged: providerResults.map(([provider]) => provider),
      extracted_url_count: sourceSummaries.length,
      research_quorum: {
        enabled: quorumEnabled,
        triggered: quorumTriggered,
        min_contributing_providers: quorumMinContributingProviders,
        result_target: quorumResultTarget,
        min_unique_domains: quorumMinUniqueDomains,
        contributing_providers: finalQuorumSnapshot.contributingProviders,
        deduplicated_result_count: finalQuorumSnapshot.deduplicatedResultCount,
        unique_domain_count: finalQuorumSnapshot.uniqueDomainCount,
      },
    },
  };
}
