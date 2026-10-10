/**
 * First-provider routing by query intent (Hermes Web Search Plus 5.0 table).
 *
 * The plugin keeps its own QueryAnalyzer.detectRoutingClass() classes and maps
 * them onto the eight 5.0 intents instead of porting Hermes' intent
 * classifier. Only the first provider comes from this table; the fallback
 * chain is Brave, Serper, Exa, Tavily and then provider_priority.
 */
import type { ProviderName } from "./routing-config.ts";

export type QueryIntent = "academic" | "community" | "docs" | "general" | "local" | "news" | "security" | "shopping";

// Precision over recall, as in Hermes: only clear academic/docs/security/
// shopping classes leave the Brave default.
export const INTENT_FIRST_PROVIDER: Partial<Record<QueryIntent, ProviderName>> = {
  academic: "exa",
  docs: "exa",
  security: "serper",
  shopping: "serper",
};

export const MEASURED_PROVIDER_ORDER: ProviderName[] = ["brave", "serper", "exa", "tavily"];

const SHOPPING_WORDS = /\b(buy|price|preis|kaufen|shop|shopping)\b/;

/** Map a QueryAnalyzer routing class (plus the query) onto a 5.0 intent. */
export function mapRoutingClassToIntent(routingClass: string, query: string): QueryIntent {
  switch (routingClass) {
    case "academic/arxiv": return "academic";
    case "docs/api": return "docs";
    case "security/cve": return "security";
    case "community/reddit": return "community";
    case "multilingual/current": return "news";
    case "local/shopping": return SHOPPING_WORDS.test(query.toLowerCase()) ? "shopping" : "local";
    // official/*, finance/IR, weather/factual, oss-discovery, answer/synthesis
    // and general have no measured reason to leave the Brave default.
    default: return "general";
  }
}

export type IntentRoutingDecision = {
  intent: QueryIntent;
  customOrder: boolean;
  reason: string;
  /** Preferred provider order before eligibility filtering. */
  preferred: ProviderName[];
};

export function planIntentRouting(routingClass: string, query: string, providerPriority: ProviderName[], customOrder: boolean): IntentRoutingDecision {
  const intent = mapRoutingClassToIntent(routingClass, query);
  if (customOrder) {
    return { intent, customOrder, reason: "custom_order", preferred: [...providerPriority] };
  }
  const first = INTENT_FIRST_PROVIDER[intent];
  return {
    intent,
    customOrder,
    reason: routingClass === "general" ? "no_signals_matched" : `intent_${intent}`,
    preferred: [...(first ? [first] : []), ...MEASURED_PROVIDER_ORDER, ...providerPriority],
  };
}
