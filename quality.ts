type Json = Record<string, any>;

type RerankableResult = {
  title?: string;
  url?: string;
  snippet?: string;
  description?: string;
  [key: string]: any;
};

function resultDomain(url: string): string {
  try {
    return new URL(url || "").hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function normalizeUrlForRule(url: string): string {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    const pathname = u.pathname.replace(/\/$/, "");
    return `${host}${pathname}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

// Canonical-source rules for routing classes where source authority beats snippet
// luck. Rules ending with "." match domain prefixes (docs., investor.), rules with
// a "/" match URL prefixes, everything else matches the domain or its subdomains.
export const CANONICAL_DOMAIN_RULES: Record<string, { boost: string[]; demote: string[] }> = {
  "official/vendor-release": {
    boost: [
      "mistral.ai", "anthropic.com", "openai.com", "googleblog.com",
      "blog.google", "ai.google.dev", "meta.com", "ai.meta.com",
      "nvidia.com", "developer.nvidia.com", "apple.com", "microsoft.com",
    ],
    demote: ["youtube.com", "youtu.be", "medium.com", "aizolo.com", "reddit.com"],
  },
  "docs/api": {
    boost: ["docs.", "developer.", "github.com", "readthedocs.io", "modelcontextprotocol.io"],
    demote: ["medium.com", "dev.to", "reddit.com", "stackoverflow.com", "youtube.com"],
  },
  "official/regulatory": {
    boost: ["europa.eu", "ec.europa.eu", "nist.gov", "nvlpubs.nist.gov", "oecd.org", "who.int", "gov.uk", "federalregister.gov"],
    demote: ["scribd.com", "researchgate.net", "universityofcalifornia.edu", "slideshare.net"],
  },
  "finance/IR": {
    boost: ["investor.", "ir.", "nvidia.com", "sec.gov", "nasdaq.com"],
    demote: ["reddit.com", "fool.com", "seekingalpha.com", "youtube.com"],
  },
  "security/cve": {
    boost: ["nvd.nist.gov", "cve.org", "github.com", "github.com/advisories", "security.", "cert.europa.eu", "kb.cert.org"],
    demote: ["youtube.com", "medium.com", "reddit.com"],
  },
};

function domainMatchesRule(domain: string, rule: string): boolean {
  return domain === rule || domain.endsWith(`.${rule}`) || domain.startsWith(rule);
}

function urlMatchesRule(url: string, rule: string): boolean {
  const domain = resultDomain(url);
  if (!rule.includes("/")) return domainMatchesRule(domain, rule);
  const normalized = normalizeUrlForRule(url);
  const normalizedRule = rule.toLowerCase().trim().replace(/\/+$/, "");
  return normalized === normalizedRule || normalized.startsWith(`${normalizedRule}/`);
}

export function rerankResultsForIntent(query: string, routingClass: string, results: RerankableResult[]): { results: RerankableResult[]; metadata: Json } {
  const rules = CANONICAL_DOMAIN_RULES[routingClass];
  if (!results.length || !rules) {
    return { results, metadata: { reranked: false, routing_class: routingClass } };
  }

  const q = query.toLowerCase();
  const scored = results.map((item, idx) => {
    const url = item.url || "";
    const domain = resultDomain(url);
    const title = String(item.title || "").toLowerCase();
    const snippet = String(item.snippet || item.description || "").toLowerCase();
    let score = (results.length - idx) * 0.01;
    if (rules.boost.some((rule) => urlMatchesRule(url, rule))) score += 10;
    if (rules.demote.some((rule) => urlMatchesRule(url, rule))) score -= 6;
    if (routingClass === "official/vendor-release" && ["mistral", "anthropic", "openai", "nvidia", "google", "meta"].some((term) => domain.includes(term))) score += 3;
    if (routingClass === "official/regulatory" && (url.toLowerCase().endsWith(".pdf") || title.includes("pdf"))) score += 2;
    if (q.includes("official") && (title.includes("official") || snippet.includes("official"))) score += 1;
    return { score, idx, item };
  });

  const reranked = [...scored].sort((a, b) => b.score - a.score || a.idx - b.idx).map(({ item }) => ({ ...item }));
  const changed = results.some((item, idx) => (item.url || "") !== (reranked[idx]?.url || ""));
  return {
    results: reranked,
    metadata: {
      reranked: changed,
      routing_class: routingClass,
      top_domain_before: results.length ? resultDomain(results[0].url || "") : null,
      top_domain_after: reranked.length ? resultDomain(reranked[0].url || "") : null,
    },
  };
}

export function buildAuthoritySignals(routingClass: string, results: RerankableResult[]): Json {
  const rules = CANONICAL_DOMAIN_RULES[routingClass] || { boost: [], demote: [] };
  const urls = results.map((item) => item.url || "").filter(Boolean);
  const domains = urls.map((url) => resultDomain(url));
  const boostedDomains: string[] = [];
  const demotedDomains: string[] = [];
  const boostedFlags: boolean[] = [];
  for (const [i, url] of urls.entries()) {
    const boosted = rules.boost.some((rule) => urlMatchesRule(url, rule));
    const demoted = rules.demote.some((rule) => urlMatchesRule(url, rule));
    boostedFlags.push(boosted);
    if (boosted) boostedDomains.push(domains[i]);
    if (demoted) demotedDomains.push(domains[i]);
  }

  return {
    routing_class: routingClass,
    rules_applied: !!CANONICAL_DOMAIN_RULES[routingClass],
    top_domain: domains[0] || null,
    canonical_domain_hits: [...new Set(boostedDomains)].sort(),
    demoted_domain_hits: [...new Set(demotedDomains)].sort(),
    canonical_top_result: boostedFlags.length > 0 && boostedFlags[0],
  };
}
