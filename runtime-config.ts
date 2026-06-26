const TRUTHY_VALUES = new Set(["1", "true", "yes", "on"]);

// Strict opt-in parse: only 1/true/yes/on enable, so a present-but-false value
// (e.g. KEENABLE_ALLOW_PUBLIC=0) never turns on an egress flag.
export function isTruthy(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (value == null) return false;
  return TRUTHY_VALUES.has(String(value).trim().replace(/^['"]|['"]$/g, "").toLowerCase());
}

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
  keenableApiKey?: string;
  keenableAllowPublic?: boolean;
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
    parallelApiKey: maybeString(pluginConfig?.parallelApiKey),
    serpbaseApiKey: maybeString(pluginConfig?.serpbaseApiKey),
    keenableApiKey: maybeString(pluginConfig?.keenableApiKey),
    keenableAllowPublic: isTruthy(pluginConfig?.keenableAllowPublic),
    searxngInstanceUrl: maybeString(pluginConfig?.searxngInstanceUrl),
    searxngAllowPrivate: pluginConfig?.searxngAllowPrivate === true ? true : undefined,
  };
}

// Whether Keenable may use its unauthenticated public endpoint. Off by default;
// opt in via the keenableAllowPublic plugin config (or KEENABLE_ALLOW_PUBLIC env).
export function keenablePublicAllowed(runtimeConfig: RuntimeConfig): boolean {
  return Boolean(runtimeConfig.keenableAllowPublic);
}

let keenablePublicWarned = false;

function warnKeenablePublicOnce(): void {
  if (keenablePublicWarned) return;
  keenablePublicWarned = true;
  console.warn(JSON.stringify({
    warning: "Keenable keyless public endpoint in use: queries and fetched URLs are sent " +
      "to an unauthenticated shared service (https://keenable.ai) with no SLA. " +
      "Set keenableApiKey for the authenticated endpoint.",
  }));
}

// A present key always uses the authenticated route; with no key, the keyless
// /public route is used only when isPublic is set.
export function keenableEndpoint(
  apiUrl: string,
  apiKey: string | undefined,
  isPublic: boolean,
): { url: string; headers: Record<string, string> } {
  const headers: Record<string, string> = { "X-Keenable-Title": "openclaw-web-search-plus" };
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
    return { url: apiUrl, headers };
  }
  if (isPublic) {
    warnKeenablePublicOnce();
    return { url: `${apiUrl}/public`, headers };
  }
  throw new Error("Keenable requires an API key or an enabled public endpoint");
}
