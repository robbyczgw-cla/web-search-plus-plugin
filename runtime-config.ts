import type { DonsetchCommandRunner } from "./donsetch-transport.ts";

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
  parallelMode?: "turbo" | "fast" | "basic" | "advanced";
  serpbaseApiKey?: string;
  monidApiKey?: string;
  octenTimeoutSeconds?: number;
  tinyfishApiKey?: string;
  tinyfishTimeoutSeconds?: number;
  searxngInstanceUrl?: string;
  searxngAllowPrivate?: boolean;
  keenableApiKey?: string;
  // Opt-in: routes queries and fetched URLs to Keenable's unauthenticated
  // public endpoints (~1000 req/hour shared, no SLA). Off by default.
  keenableAllowPublic?: boolean;
  donsetchBin?: string;
  donsetchTimeoutSeconds?: number;
  donsetchMaxContentChars?: number;
  donsetchTier?: "auto" | 1 | 2;
  runCommandWithTimeout?: DonsetchCommandRunner;
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
  extractCacheMaxChars?: number;
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

export type RunCommandWithTimeout = DonsetchCommandRunner;

function maybeString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function getRuntimeConfig(pluginConfig: Record<string, any>, runCommandWithTimeout?: RunCommandWithTimeout): RuntimeConfig {
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
    parallelMode: normalizeParallelMode(pluginConfig?.parallelMode),
    serpbaseApiKey: maybeString(pluginConfig?.serpbaseApiKey),
    monidApiKey: maybeString(pluginConfig?.monidApiKey),
    octenTimeoutSeconds: maybeBoundedInt(pluginConfig?.octenTimeoutSeconds, 1, 120),
    tinyfishApiKey: maybeString(pluginConfig?.tinyfishApiKey),
    tinyfishTimeoutSeconds: maybeBoundedInt(pluginConfig?.tinyfishTimeoutSeconds, 1, 120),
    searxngInstanceUrl: maybeString(pluginConfig?.searxngInstanceUrl),
    searxngAllowPrivate: pluginConfig?.searxngAllowPrivate === true ? true : undefined,
    keenableApiKey: maybeString(pluginConfig?.keenableApiKey),
    keenableAllowPublic: pluginConfig?.keenableAllowPublic === true ? true : undefined,
    donsetchBin: maybeString(pluginConfig?.donsetchBin),
    donsetchTimeoutSeconds: maybeBoundedInt(pluginConfig?.donsetchTimeoutSeconds, 5, 600),
    donsetchMaxContentChars: maybeBoundedInt(pluginConfig?.donsetchMaxContentChars, 500, 200_000),
    donsetchTier: normalizeDonsetchTier(pluginConfig?.donsetchTier),
    runCommandWithTimeout,
    extractAllowPrivateUrls: pluginConfig?.extractAllowPrivateUrls === true ? true : undefined,
    extractCharLimit: Number.isFinite(Number(pluginConfig?.extractCharLimit)) && Number(pluginConfig?.extractCharLimit) > 0
      ? Math.max(1000, Math.floor(Number(pluginConfig.extractCharLimit)))
      : undefined,
    extractMaxUrls: maybePositiveInt(pluginConfig?.extractMaxUrls),
    extractMaxContextChars: maybePositiveInt(pluginConfig?.extractMaxContextChars),
    extractCacheMaxEntries: maybeBoundedInt(pluginConfig?.extractCacheMaxEntries, 1, 500),
    extractCacheMaxChars: maybeBoundedInt(pluginConfig?.extractCacheMaxChars, 1, 20_000_000),
    extractDeadlineSeconds: maybeBoundedInt(pluginConfig?.extractDeadlineSeconds, 1, 180),
    localeCountry: maybeString(pluginConfig?.localeCountry),
    localeLanguage: maybeString(pluginConfig?.localeLanguage),
    parallelMaxCharsPerResult: maybePositiveInt(pluginConfig?.parallelMaxCharsPerResult),
    parallelMaxCharsTotal: maybePositiveInt(pluginConfig?.parallelMaxCharsTotal),
    qualityDiversityRerank: pluginConfig?.qualityDiversityRerank === true ? true : undefined,
  };
}

function normalizeParallelMode(value: unknown): RuntimeConfig["parallelMode"] {
  if (value == null || String(value).trim() === "") return "fast";
  const normalized = String(value).trim().toLowerCase();
  if (["turbo", "fast", "basic", "advanced"].includes(normalized)) return normalized as RuntimeConfig["parallelMode"];
  throw new Error("parallelMode must be one of turbo, fast, basic, advanced");
}

function normalizeDonsetchTier(value: unknown): RuntimeConfig["donsetchTier"] {
  if (value == null || String(value).trim() === "") return "auto";
  if (value === 1 || value === "1") return 1;
  if (value === 2 || value === "2") return 2;
  if (String(value).trim().toLowerCase() === "auto") return "auto";
  throw new Error("donsetchTier must be auto, 1, or 2");
}

function maybePositiveInt(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

function maybeBoundedInt(value: unknown, minimum: number, maximum: number): number | undefined {
  const parsed = maybePositiveInt(value);
  return parsed == null ? undefined : Math.min(maximum, Math.max(minimum, parsed));
}
