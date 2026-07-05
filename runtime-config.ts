export type RuntimeConfig = {
  serperApiKey?: string;
  braveApiKey?: string;
  braveSafesearch?: string;
  tavilyApiKey?: string;
  linkupApiKey?: string;
  queritApiKey?: string;
  exaApiKey?: string;
  firecrawlApiKey?: string;
  perplexityApiKey?: string;
  kilocodeApiKey?: string;
  youApiKey?: string;
  parallelApiKey?: string;
  serpbaseApiKey?: string;
  searxngInstanceUrl?: string;
  searxngAllowPrivate?: boolean;
  keenableApiKey?: string;
  // Opt-in: routes queries and fetched URLs to Keenable's unauthenticated
  // public endpoints (~1000 req/hour shared, no SLA). Off by default.
  keenableAllowPublic?: boolean;
  // Opt-in: allow web_extract_plus to target private/internal URLs (trusted
  // intranet extraction). Off by default.
  extractAllowPrivateUrls?: boolean;
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
    perplexityApiKey: maybeString(pluginConfig?.perplexityApiKey),
    kilocodeApiKey: maybeString(pluginConfig?.kilocodeApiKey),
    youApiKey: maybeString(pluginConfig?.youApiKey),
    parallelApiKey: maybeString(pluginConfig?.parallelApiKey),
    serpbaseApiKey: maybeString(pluginConfig?.serpbaseApiKey),
    searxngInstanceUrl: maybeString(pluginConfig?.searxngInstanceUrl),
    searxngAllowPrivate: pluginConfig?.searxngAllowPrivate === true ? true : undefined,
    keenableApiKey: maybeString(pluginConfig?.keenableApiKey),
    keenableAllowPublic: pluginConfig?.keenableAllowPublic === true ? true : undefined,
    extractAllowPrivateUrls: pluginConfig?.extractAllowPrivateUrls === true ? true : undefined,
  };
}
