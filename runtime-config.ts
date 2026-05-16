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
  searxngInstanceUrl?: string;
  searxngAllowPrivate?: boolean;
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
    searxngInstanceUrl: maybeString(pluginConfig?.searxngInstanceUrl),
    searxngAllowPrivate: pluginConfig?.searxngAllowPrivate === true ? true : undefined,
  };
}
