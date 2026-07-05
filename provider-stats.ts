// Rolling provider performance memory for adaptive routing.
//
// Routing v2 scores are benchmarked but static: a provider that has been slow
// or returning empty results for days keeps its full score. This module records
// the real outcome of every provider call (latency, result count, errors) in a
// small rolling window and turns it into a bounded score adjustment, so routing
// gently prefers providers that are currently fast and productive — without
// ever overriding strong query-class signals.
//
// Unlike the Hermes original this state is process-local memory only: the
// packaged OpenClaw plugin performs no filesystem reads or writes.

type ProviderSample = {
  t: number;
  lat: number;
  n: number;
  err: boolean;
};

// Rolling window: keep this many most-recent samples per provider.
export const MAX_SAMPLES_PER_PROVIDER = 50;
// Ignore samples older than this; stale history should not steer routing.
export const SAMPLE_MAX_AGE_SECONDS = 7 * 24 * 3600;
// Providers need this many fresh samples before stats influence routing.
export const MIN_SAMPLES_FOR_ADJUSTMENT = 5;
// Hard bound on routing-score influence. Query-class signals weigh 1.0-4.0
// per match, so performance can break ties and nudge close calls but never
// overrule a clear content-based winner.
export const MAX_SCORE_ADJUSTMENT = 1.0;
// Median latency at or above this counts as fully slow (speed factor 0).
export const LATENCY_CEILING_SECONDS = 8.0;
// Neutral point: providers performing at this combined level get adjustment 0.
export const PERFORMANCE_BASELINE = 0.75;

const providerSamples = new Map<string, ProviderSample[]>();

function nowSeconds(): number {
  return Date.now() / 1000;
}

export function recordProviderOutcome(
  provider: string,
  latencySeconds: number,
  resultCount: number,
  error: boolean,
  now?: number,
): void {
  const sample: ProviderSample = {
    t: Math.floor(now ?? nowSeconds()),
    lat: Math.round(Math.max(0, Number(latencySeconds) || 0) * 1000) / 1000,
    n: Math.max(0, Math.floor(Number(resultCount) || 0)),
    err: Boolean(error),
  };
  const samples = providerSamples.get(provider) || [];
  samples.push(sample);
  providerSamples.set(provider, samples.slice(-MAX_SAMPLES_PER_PROVIDER));
}

function freshSamples(provider: string, now: number): ProviderSample[] {
  const cutoff = now - SAMPLE_MAX_AGE_SECONDS;
  return (providerSamples.get(provider) || []).filter((sample) => sample.t >= cutoff);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function getProviderPerformance(provider: string, now?: number): {
  samples: number;
  success_rate: number;
  empty_rate: number;
  median_latency_seconds: number | null;
} | null {
  const nowTs = now ?? nowSeconds();
  const samples = freshSamples(provider, nowTs);
  if (!samples.length) return null;
  const successes = samples.filter((s) => !s.err);
  const empty = successes.filter((s) => s.n === 0);
  const latencies = successes.map((s) => s.lat);
  return {
    samples: samples.length,
    success_rate: Number((successes.length / samples.length).toFixed(3)),
    empty_rate: successes.length ? Number((empty.length / successes.length).toFixed(3)) : 0,
    median_latency_seconds: latencies.length ? Number(median(latencies).toFixed(3)) : null,
  };
}

// Bounded routing-score adjustment from recent real-world performance.
// Combines reliability (success rate, discounted by empty-result rate) and
// speed (median latency vs. LATENCY_CEILING_SECONDS) into
// [-MAX_SCORE_ADJUSTMENT, +MAX_SCORE_ADJUSTMENT]. Returns 0 until
// MIN_SAMPLES_FOR_ADJUSTMENT fresh samples exist.
export function performanceAdjustment(provider: string, now?: number): number {
  const perf = getProviderPerformance(provider, now);
  if (!perf || perf.samples < MIN_SAMPLES_FOR_ADJUSTMENT) return 0;
  const reliability = perf.success_rate * (1 - 0.5 * perf.empty_rate);
  const speed = perf.median_latency_seconds == null
    ? 0
    : Math.max(0, Math.min(1, 1 - perf.median_latency_seconds / LATENCY_CEILING_SECONDS));
  const combined = 0.6 * reliability + 0.4 * speed;
  const adjustment = (combined - PERFORMANCE_BASELINE) * 2 * MAX_SCORE_ADJUSTMENT;
  return Number(Math.max(-MAX_SCORE_ADJUSTMENT, Math.min(MAX_SCORE_ADJUSTMENT, adjustment)).toFixed(3));
}

// Adjustments for several providers; providers without impact are omitted.
export function performanceAdjustments(providers: string[], now?: number): Record<string, number> {
  const adjustments: Record<string, number> = {};
  for (const provider of providers) {
    const value = performanceAdjustment(provider, now);
    if (value !== 0) adjustments[provider] = value;
  }
  return adjustments;
}

export function __resetProviderStatsForTests(): void {
  providerSamples.clear();
}
