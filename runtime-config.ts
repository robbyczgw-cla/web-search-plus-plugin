export type RuntimeConfig = {
  serperApiKey?: string;
  braveApiKey?: string;
  braveSafesearch?: string;
  tavilyApiKey?: string;
  linkupApiKey?: string;
  queritApiKey?: string;
  exaApiKey?: string;
  firecrawlApiKey?: string;
  youApiKey?: string;
  parallelApiKey?: string;
  serpbaseApiKey?: string;
  searxngInstanceUrl?: string;
  searxngAllowPrivate?: boolean;
  keenableApiKey?: string;
  // Opt-in: routes queries and fetched URLs to Keenable's unauthenticated
  // public endpoints (~1000 req/hour shared, no SLA). Off by default.
  keenableAllowPublic?: boolean;
  houndMcpUrl?: string;
  houndTimeoutSeconds?: number;
  houndMaxResponseBytes?: number;
  houndMaxContentChars?: number;
  // Opt-in: allow web_extract_plus to target private/internal URLs (trusted
  // intranet extraction). Off by default.
  extractAllowPrivateUrls?: boolean;
  // Inline character budget per extracted page before head/tail truncation
  // (default 15000, minimum 1000).
  extractCharLimit?: number;
  // Operator ceilings for extraction fan-out and the aggregate inline
  // context returned by one call.
  extractMaxUrls?: number;
  extractMaxContextChars?: number;
  // Process-local extraction LRU capacity. No entries survive a host restart.
  extractCacheMaxEntries?: number;
  extractDeadlineSeconds?: number;
  // Default search locale (ISO 3166-1 alpha-2 country, ISO 639-1 language or
  // "auto" for conservative query language inference). Without these the
  // locale-capable providers keep their us/en defaults.
  localeCountry?: string;
  localeLanguage?: string;
  // Parallel extraction full_content character budgets.
  parallelMaxCharsPerResult?: number;
  parallelMaxCharsTotal?: number;
  // Opt-in: move near-duplicate research results behind the diverse head.
  qualityDiversityRerank?: boolean;
};

function maybeString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function getRuntimeConfig(pluginConfig: Record<string, any>): RuntimeConfig {
  return {
    serperApiKey: maybeString(pluginConfig?.serperApiKey),
    braveApiKey: maybeString(pluginConfig?.braveApiKey),
    braveSafesearch: maybeString(pluginConfig?.braveSafesearch),
    tavilyApiKey: maybeString(pluginConfig?.tavilyApiKey),
    linkupApiKey: maybeString(pluginConfig?.linkupApiKey),
    queritApiKey: maybeString(pluginConfig?.queritApiKey),
    exaApiKey: maybeString(pluginConfig?.exaApiKey),
    firecrawlApiKey: maybeString(pluginConfig?.firecrawlApiKey),
    youApiKey: maybeString(pluginConfig?.youApiKey),
    parallelApiKey: maybeString(pluginConfig?.parallelApiKey),
    serpbaseApiKey: maybeString(pluginConfig?.serpbaseApiKey),
    searxngInstanceUrl: maybeString(pluginConfig?.searxngInstanceUrl),
    searxngAllowPrivate: pluginConfig?.searxngAllowPrivate === true ? true : undefined,
    keenableApiKey: maybeString(pluginConfig?.keenableApiKey),
    keenableAllowPublic: pluginConfig?.keenableAllowPublic === true ? true : undefined,
    houndMcpUrl: maybeString(pluginConfig?.houndMcpUrl),
    houndTimeoutSeconds: maybePositiveInt(pluginConfig?.houndTimeoutSeconds),
    houndMaxResponseBytes: maybePositiveInt(pluginConfig?.houndMaxResponseBytes),
    houndMaxContentChars: maybePositiveInt(pluginConfig?.houndMaxContentChars),
    extractAllowPrivateUrls: pluginConfig?.extractAllowPrivateUrls === true ? true : undefined,
    extractCharLimit: Number.isFinite(Number(pluginConfig?.extractCharLimit)) && Number(pluginConfig?.extractCharLimit) > 0
      ? Math.max(1000, Math.floor(Number(pluginConfig.extractCharLimit)))
      : undefined,
    extractMaxUrls: maybePositiveInt(pluginConfig?.extractMaxUrls),
    extractMaxContextChars: maybePositiveInt(pluginConfig?.extractMaxContextChars),
    extractCacheMaxEntries: maybeBoundedInt(pluginConfig?.extractCacheMaxEntries, 1, 500),
    extractDeadlineSeconds: maybeBoundedInt(pluginConfig?.extractDeadlineSeconds, 1, 180),
    localeCountry: maybeString(pluginConfig?.localeCountry),
    localeLanguage: maybeString(pluginConfig?.localeLanguage),
    parallelMaxCharsPerResult: maybePositiveInt(pluginConfig?.parallelMaxCharsPerResult),
    parallelMaxCharsTotal: maybePositiveInt(pluginConfig?.parallelMaxCharsTotal),
    qualityDiversityRerank: pluginConfig?.qualityDiversityRerank === true ? true : undefined,
  };
}

function maybePositiveInt(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

function maybeBoundedInt(value: unknown, minimum: number, maximum: number): number | undefined {
  const parsed = maybePositiveInt(value);
  return parsed == null ? undefined : Math.min(maximum, Math.max(minimum, parsed));
}
