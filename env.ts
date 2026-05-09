const CONFIG_KEY_MAP: Record<string, string> = {
  serperApiKey: "SERPER_API_KEY",
  braveApiKey: "BRAVE_API_KEY",
  braveSafesearch: "BRAVE_SAFESEARCH",
  tavilyApiKey: "TAVILY_API_KEY",
  linkupApiKey: "LINKUP_API_KEY",
  queritApiKey: "QUERIT_API_KEY",
  exaApiKey: "EXA_API_KEY",
  firecrawlApiKey: "FIRECRAWL_API_KEY",
  perplexityApiKey: "PERPLEXITY_API_KEY",
  kilocodeApiKey: "KILOCODE_API_KEY",
  youApiKey: "YOU_API_KEY",
  searxngInstanceUrl: "SEARXNG_INSTANCE_URL",
  searxngAllowPrivate: "SEARXNG_ALLOW_PRIVATE",
  enableWebAnswer: "WSP_ENABLE_WEB_ANSWER",
};

export function getRuntimeEnv(pluginConfig: Record<string, any>): Record<string, string> {
  const mapped: Record<string, string> = {};

  for (const [cfgKey, envKey] of Object.entries(CONFIG_KEY_MAP)) {
    const val = pluginConfig?.[cfgKey];
    if (typeof val === "string" && val) mapped[envKey] = val;
    else if (typeof val === "boolean") mapped[envKey] = String(val);
  }

  return mapped;
}
