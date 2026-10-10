export type ProviderName = "serper" | "brave" | "tavily" | "linkup" | "querit" | "exa" | "firecrawl" | "you" | "searxng" | "parallel" | "serpbase" | "keenable" | "donsetch" | "octen" | "tinyfish";
export type ExtractProviderName = Extract<ProviderName, "tavily" | "exa" | "linkup" | "parallel" | "firecrawl" | "you" | "keenable" | "serper" | "donsetch">;

export const ALL_PROVIDER_NAMES: ProviderName[] = ["serper", "brave", "tavily", "linkup", "querit", "exa", "firecrawl", "you", "searxng", "parallel", "serpbase", "keenable", "donsetch", "octen", "tinyfish"];

// Matches Hermes 5.0's default fallback chain (Brave, Serper, Exa, Tavily, then
// the rest). Explicit-only provider modules do not enter this default order;
// they remain valid when named directly or when an operator deliberately adds
// them to a custom priority and auto_allow.
export const DEFAULT_PROVIDER_PRIORITY: ProviderName[] = ["brave", "serper", "exa", "tavily", "you", "firecrawl", "linkup", "parallel", "serpbase", "querit", "searxng", "keenable"];
// The default every 4.x release shipped (Hermes 4.0.3 Routing v2). A config
// that still holds it never chose an order, so it gets the current default.
export const PRE_5_DEFAULT_PROVIDER_PRIORITY: ProviderName[] = ["you", "serper", "exa", "firecrawl", "tavily", "linkup", "brave", "parallel", "serpbase", "querit", "searxng", "keenable"];

function sameProviderList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((provider, index) => provider === right[index]);
}

/** True when provider_priority is an order the operator chose, not a shipped default. */
export function isCustomProviderOrder(priority: readonly string[] | undefined): boolean {
  if (!priority || !priority.length) return false;
  return !sameProviderList(priority, DEFAULT_PROVIDER_PRIORITY) && !sameProviderList(priority, PRE_5_DEFAULT_PROVIDER_PRIORITY);
}
export const DEFAULT_EXTRACT_PROVIDER_PRIORITY: ExtractProviderName[] = ["tavily", "exa", "linkup", "parallel", "firecrawl", "you", "keenable", "serper", "donsetch"];

// Parallel joined the normal automatic pool in WSP 4.0.2. DonSeTch, Octen,
// TinyFish, SerpBase, and Querit remain explicit-only unless an operator opts
// them in deliberately through auto_allow.
export const GUARDED_AUTO_PROVIDERS: ProviderName[] = ["serpbase", "querit", "donsetch", "octen", "tinyfish"];

export type RoutingPreferences = {
  version: 2;
  profile: "standard" | "self_hosted";
  auto_routing: boolean;
  default_provider: ProviderName | null;
  provider_priority: ProviderName[];
  extract_provider_priority: ExtractProviderName[];
  fallback_provider: ProviderName | null;
  disabled_providers: ProviderName[];
  confidence_threshold: number;
  auto_allow: Record<ProviderName, boolean>;
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
  version: 2,
  profile: "standard",
  auto_routing: true,
  default_provider: null,
  provider_priority: [...DEFAULT_PROVIDER_PRIORITY],
  extract_provider_priority: [...DEFAULT_EXTRACT_PROVIDER_PRIORITY],
  fallback_provider: "serper",
  disabled_providers: [],
  confidence_threshold: 0.3,
  auto_allow: Object.fromEntries(ALL_PROVIDER_NAMES.map((provider) => [provider, !GUARDED_AUTO_PROVIDERS.includes(provider)])) as Record<ProviderName, boolean>,
};

const memoryRoutingPreferences = new Map<string, RoutingPreferences>();

function cloneConfig(config: RoutingPreferences): RoutingPreferences {
  return {
    ...config,
    provider_priority: [...config.provider_priority],
    extract_provider_priority: [...config.extract_provider_priority],
    disabled_providers: [...config.disabled_providers],
    auto_allow: { ...config.auto_allow },
  };
}

function cloneDefaults(): RoutingPreferences {
  return cloneConfig(DEFAULT_ROUTING_PREFERENCES);
}

export function applyRoutingProfile(config: RoutingPreferences): RoutingPreferences {
  const effective = cloneConfig(config);
  if (effective.profile !== "self_hosted") return effective;
  effective.provider_priority = [
    "searxng",
    "keenable",
    ...DEFAULT_PROVIDER_PRIORITY.filter((provider) => provider !== "searxng" && provider !== "keenable"),
  ];
  effective.extract_provider_priority = [
    "keenable",
    ...DEFAULT_EXTRACT_PROVIDER_PRIORITY.filter((provider) => provider !== "keenable"),
  ];
  effective.fallback_provider = "keenable";
  effective.auto_allow = Object.fromEntries(
    ALL_PROVIDER_NAMES.map((provider) => [provider, provider === "searxng" || provider === "keenable"]),
  ) as Record<ProviderName, boolean>;
  return effective;
}

export function normalizeProviderName(value: unknown): ProviderName {
  const normalized = String(value || "").trim().toLowerCase().replace(/_/g, "-");
  if ((ALL_PROVIDER_NAMES as string[]).includes(normalized)) return normalized as ProviderName;
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

function normalizeExtractPriority(values: unknown): ExtractProviderName[] {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("Extract provider priority must be a non-empty array");
  }
  const requested: ExtractProviderName[] = [];
  for (const value of values) {
    const provider = normalizeProviderName(value);
    if (!(DEFAULT_EXTRACT_PROVIDER_PRIORITY as ProviderName[]).includes(provider)) {
      throw new Error(`Provider does not support extraction: ${provider}`);
    }
    if (!requested.includes(provider as ExtractProviderName)) requested.push(provider as ExtractProviderName);
  }
  for (const provider of DEFAULT_EXTRACT_PROVIDER_PRIORITY) {
    if (!requested.includes(provider)) requested.push(provider);
  }
  return requested;
}

function normalizeAutoAllow(value: unknown): Record<ProviderName, boolean> {
  const defaults = { ...DEFAULT_ROUTING_PREFERENCES.auto_allow };
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  for (const [rawProvider, rawAllowed] of Object.entries(value as Record<string, unknown>)) {
    const provider = normalizeProviderName(rawProvider);
    defaults[provider] = rawAllowed === true;
  }
  return defaults;
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
  if (input.profile != null) {
    const profile = String(input.profile).trim().toLowerCase();
    if (profile !== "standard" && profile !== "self_hosted") throw new Error(`Unknown routing profile: ${String(input.profile)}`);
    config.profile = profile;
  }
  config.auto_routing = input.auto_routing == null ? config.auto_routing : Boolean(input.auto_routing);
  config.default_provider = input.default_provider == null ? config.default_provider : normalizeOptionalProvider(input.default_provider);
  config.provider_priority = input.provider_priority == null ? config.provider_priority : normalizePriority(input.provider_priority);
  // A stored 4.x default list means "no order chosen": use the 5.0 default.
  if (sameProviderList(config.provider_priority, PRE_5_DEFAULT_PROVIDER_PRIORITY)) config.provider_priority = [...DEFAULT_PROVIDER_PRIORITY];
  config.extract_provider_priority = input.extract_provider_priority == null ? config.extract_provider_priority : normalizeExtractPriority(input.extract_provider_priority);
  config.fallback_provider = input.fallback_provider == null ? config.fallback_provider : normalizeOptionalProvider(input.fallback_provider);
  config.disabled_providers = input.disabled_providers == null ? config.disabled_providers : normalizeProviderList(input.disabled_providers);
  config.confidence_threshold = input.confidence_threshold == null ? config.confidence_threshold : normalizeThreshold(input.confidence_threshold);
  config.auto_allow = input.auto_allow == null ? config.auto_allow : normalizeAutoAllow(input.auto_allow);
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
