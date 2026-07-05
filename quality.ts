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
  if (rule.endsWith(".")) {
    // Label-prefix rules such as "docs." / "investor." / "ir." match a
    // leading host label (docs.python.org), never a bare domain (notdocs.com).
    return domain.startsWith(rule);
  }
  // Exact domain or true subdomain only. A bare startsWith would let
  // look-alike registrations such as openai.com.evil.example inherit
  // authority boosts (same reasoning as blockedDomainMatches below).
  return domain === rule || domain.endsWith(`.${rule}`);
}

// Known content mirrors and SEO scraper sites that republish Stack Overflow,
// GitHub, and documentation content. These add no information over the
// canonical source and frequently outrank it; they are removed from results
// rather than merely demoted. Operators can extend via pluginConfig
// qualityBlockedDomains or rescue a domain via qualityAllowedDomains.
export const SPAM_MIRROR_DOMAINS: string[] = [
  // Stack Overflow / Q&A scrapers
  "newbedev.com",
  "stackoom.com",
  "stackovergo.com",
  "syntaxfix.com",
  "copyprogramming.com",
  "devcodef1.com",
  "exceptionshub.com",
  "code-examples.net",
  "i-harness.com",
  "fixmycodeerror.com",
  "stacklesson.com",
  // GitHub issue/readme mirrors
  "githubmemory.com",
  "gitmemory.com",
  "issueexplorer.com",
  "bleepcoder.com",
  "gitanswer.com",
  // Documentation mirrors
  "w3cub.com",
  // Generic AI/SEO content farms already demoted by the intent reranker
  "aizolo.com",
];

// Strict matcher for domain block/allow lists: only the exact domain or true
// subdomains match (newbedev.com, de.newbedev.com). No startsWith clause, so
// look-alike registrations such as newbedev.com.evil.example do NOT match.
function blockedDomainMatches(domain: string, rule: string): boolean {
  return domain === rule || domain.endsWith(`.${rule}`);
}

const SITE_OPERATOR_RE = /\bsite:([a-z0-9][a-z0-9.-]*)/gi;

// Domains the user explicitly constrained the search to: site: operators in the
// query plus include_domains. Explicit constraints express intent — constrained
// domains are exempt from spam filtering, and domain-diversity reranking is
// skipped entirely.
export function extractDomainConstraints(query: string, includeDomains?: string[]): string[] {
  const domains: string[] = [];
  for (const match of String(query || "").matchAll(SITE_OPERATOR_RE)) {
    domains.push(match[1].toLowerCase().replace(/\.+$/, ""));
  }
  for (const entry of includeDomains || []) {
    if (entry && entry.trim()) domains.push(entry.toLowerCase().trim());
  }
  return [...new Set(domains)].sort();
}

// Drop results from known mirror/SEO-spam domains. Returns the kept results and
// the sorted unique domains that were removed. `allowed` rescues a domain from
// both the builtin and extra blocklists.
export function filterSpamResults(
  results: RerankableResult[],
  extraBlocked?: string[],
  allowed?: string[],
): { results: RerankableResult[]; removedDomains: string[] } {
  const blockedRules = [...SPAM_MIRROR_DOMAINS, ...(extraBlocked || []).map((d) => String(d || "").toLowerCase().trim()).filter(Boolean)];
  const allowedRules = (allowed || []).map((d) => String(d || "").toLowerCase().trim()).filter(Boolean);
  const kept: RerankableResult[] = [];
  const removedDomains: string[] = [];
  for (const item of results) {
    const domain = resultDomain(item.url || "");
    if (
      domain
      && !allowedRules.some((rule) => blockedDomainMatches(domain, rule))
      && blockedRules.some((rule) => blockedDomainMatches(domain, rule))
    ) {
      removedDomains.push(domain);
      continue;
    }
    kept.push(item);
  }
  return { results: kept, removedDomains: [...new Set(removedDomains)].sort() };
}

// Stable rerank that stops one domain from crowding out the result list. The
// first maxPerDomain results per domain keep their original order; overflow
// results are moved behind the diverse head (also in original order) instead of
// being dropped.
export function rerankDomainDiversity(
  results: RerankableResult[],
  maxPerDomain = 2,
): { results: RerankableResult[]; demotedCount: number } {
  if (maxPerDomain < 1 || results.length < 3) return { results, demotedCount: 0 };
  const head: RerankableResult[] = [];
  const overflow: RerankableResult[] = [];
  const perDomain = new Map<string, number>();
  for (const item of results) {
    const domain = resultDomain(item.url || "");
    const count = perDomain.get(domain) || 0;
    if (domain && count >= maxPerDomain) {
      overflow.push(item);
      continue;
    }
    perDomain.set(domain, count + 1);
    head.push(item);
  }
  return { results: [...head, ...overflow], demotedCount: overflow.length };
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
