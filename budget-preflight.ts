// Request-scoped budget admission. It intentionally has no daily quota: that
// requires a durable reservation ledger, which this plugin must not create.
export const MAX_RESEARCH_FANOUT = 3;
export const MAX_EXTRACT_DEADLINE_SECONDS = 180;
export const DEFAULT_EXTRACT_DEADLINE_SECONDS = 30;

export function preflightDeadline(requested: unknown, operatorCeiling: unknown): number {
  const requestedValue = requested == null ? undefined : Number(requested);
  const ceiling = operatorCeiling == null ? DEFAULT_EXTRACT_DEADLINE_SECONDS : Number(operatorCeiling);
  if (requestedValue != null && (!Number.isInteger(requestedValue) || requestedValue < 1)) {
    throw new Error("deadline_seconds must be a positive integer");
  }
  // RuntimeConfig normalizes extractDeadlineSeconds before this path, but
  // direct callers receive the same positive-integer contract and diagnosis.
  if (!Number.isInteger(ceiling) || ceiling < 1) {
    throw new Error("operator deadline ceiling must be a positive integer");
  }
  return Math.min(MAX_EXTRACT_DEADLINE_SECONDS, requestedValue ?? ceiling, ceiling);
}

export function preflightResearchFanout<T>(providers: T[]): { providers: T[]; omitted: number; max_fanout: number } {
  return { providers: providers.slice(0, MAX_RESEARCH_FANOUT), omitted: Math.max(0, providers.length - MAX_RESEARCH_FANOUT), max_fanout: MAX_RESEARCH_FANOUT };
}
