export type ProviderName = "serper" | "brave" | "tavily" | "linkup" | "querit" | "exa" | "firecrawl" | "perplexity" | "you" | "searxng";

export const DEFAULT_PROVIDER_PRIORITY: ProviderName[] = ["tavily", "linkup", "querit", "exa", "firecrawl", "perplexity", "brave", "serper", "you", "searxng"];

export type RoutingPreferences = {
  version: 1;
  auto_routing: boolean;
  default_provider: ProviderName | null;
  provider_priority: ProviderName[];
  fallback_provider: ProviderName | null;
  disabled_providers: ProviderName[];
  confidence_threshold: number;
};

export type RoutingConfigLoadResult = {
  config: RoutingPreferences;
  path: string;
  source: "default" | "plugin_config" | "memory";
  warning?: string;
  quarantine_path?: string;
  backup_path?: string;
};

export const DEFAULT_ROUTING_PREFERENCES: RoutingPreferences = {
  version: 1,
  auto_routing: true,
  default_provider: null,
  provider_priority: [...DEFAULT_PROVIDER_PRIORITY],
  fallback_provider: null,
  disabled_providers: [],
  confidence_threshold: 0.4,
};

const memoryRoutingPreferences = new Map<string, RoutingPreferences>();

function cloneConfig(config: RoutingPreferences): RoutingPreferences {
  return {
    ...config,
    provider_priority: [...config.provider_priority],
    disabled_providers: [...config.disabled_providers],
  };
}

function cloneDefaults(): RoutingPreferences {
  return cloneConfig(DEFAULT_ROUTING_PREFERENCES);
}

export function normalizeProviderName(value: unknown): ProviderName {
  const normalized = String(value || "").trim().toLowerCase().replace(/_/g, "-");
  if (normalized === "kilo-perplexity") return "perplexity";
  if ((DEFAULT_PROVIDER_PRIORITY as string[]).includes(normalized)) return normalized as ProviderName;
  throw new Error(`Unknown provider: ${String(value || "")}`);
}

function normalizeOptionalProvider(value: unknown): ProviderName | null {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized || ["null", "none", "default", "auto"].includes(normalized)) return null;
  return normalizeProviderName(value);
}

function normalizeProviderList(values: unknown, allowEmpty = true): ProviderName[] {
  if (!Array.isArray(values)) {
    if (allowEmpty) return [];
    throw new Error("Provider list must be an array");
  }
  const unique: ProviderName[] = [];
  const seen = new Set<ProviderName>();
  for (const value of values) {
    const provider = normalizeProviderName(value);
    if (!seen.has(provider)) {
      seen.add(provider);
      unique.push(provider);
    }
  }
  return unique;
}

function normalizePriority(values: unknown): ProviderName[] {
  const requested = normalizeProviderList(values, false);
  const seen = new Set<ProviderName>(requested);
  const completed = [...requested];
  for (const provider of DEFAULT_PROVIDER_PRIORITY) {
    if (!seen.has(provider)) completed.push(provider);
  }
  return completed;
}

function normalizeThreshold(value: unknown): number {
  const threshold = Number(value);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new Error(`Invalid confidence_threshold: ${String(value)}`);
  }
  return Number(threshold.toFixed(3));
}

export function resolveRoutingConfigPath(pluginConfig: Record<string, any> = {}): string {
  const configuredName = typeof pluginConfig?.routingConfigPath === "string" && pluginConfig.routingConfigPath.trim()
    ? pluginConfig.routingConfigPath.trim()
    : "default";
  return `memory:${configuredName}`;
}

export function validateRoutingPreferences(raw: unknown): RoutingPreferences {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Routing config must be a JSON object");
  }
  const input = raw as Record<string, unknown>;
  const config = cloneDefaults();
  config.auto_routing = input.auto_routing == null ? config.auto_routing : Boolean(input.auto_routing);
  config.default_provider = input.default_provider == null ? config.default_provider : normalizeOptionalProvider(input.default_provider);
  config.provider_priority = input.provider_priority == null ? config.provider_priority : normalizePriority(input.provider_priority);
  config.fallback_provider = input.fallback_provider == null ? config.fallback_provider : normalizeOptionalProvider(input.fallback_provider);
  config.disabled_providers = input.disabled_providers == null ? config.disabled_providers : normalizeProviderList(input.disabled_providers);
  config.confidence_threshold = input.confidence_threshold == null ? config.confidence_threshold : normalizeThreshold(input.confidence_threshold);
  return config;
}

export function loadRoutingPreferences(pluginConfig: Record<string, any> = {}): RoutingConfigLoadResult {
  const path = resolveRoutingConfigPath(pluginConfig);
  const existing = memoryRoutingPreferences.get(path);
  if (existing) return { config: cloneConfig(existing), path, source: "memory" };

  const configuredPreferences = pluginConfig?.routingPreferences;
  if (configuredPreferences != null) {
    try {
      const validated = validateRoutingPreferences(configuredPreferences);
      memoryRoutingPreferences.set(path, cloneConfig(validated));
      return { config: cloneConfig(validated), path, source: "plugin_config" };
    } catch (error: any) {
      return {
        config: cloneDefaults(),
        path,
        source: "default",
        warning: `Routing config reset to defaults after validation failure: ${String(error?.message || error)}`,
      };
    }
  }

  return { config: cloneDefaults(), path, source: "default" };
}

export function saveRoutingPreferences(pluginConfig: Record<string, any> = {}, config: unknown): RoutingConfigLoadResult {
  const path = resolveRoutingConfigPath(pluginConfig);
  const validated = validateRoutingPreferences(config);
  memoryRoutingPreferences.set(path, cloneConfig(validated));
  return { config: cloneConfig(validated), path, source: "memory" };
}

export function __resetRoutingPreferencesForTests(): void {
  memoryRoutingPreferences.clear();
}

export function resetRoutingPreferences(pluginConfig: Record<string, any> = {}): RoutingConfigLoadResult {
  const path = resolveRoutingConfigPath(pluginConfig);
  memoryRoutingPreferences.delete(path);
  const configuredPreferences = pluginConfig?.routingPreferences;
  if (configuredPreferences != null) {
    return loadRoutingPreferences(pluginConfig);
  }
  return { config: cloneDefaults(), path, source: "default" };
}
