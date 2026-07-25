type ResultLike = {
  url?: string;
  snippet?: string;
  description?: string;
  provider?: string;
  [key: string]: any;
};

export type DuplicateCandidate = {
  kind: "url" | "content";
  kept: number;
  dropped_candidate: number;
};

const MULTI_LABEL_SUFFIXES = new Set([
  "ac.at", "ac.jp", "ac.nz", "ac.uk", "asn.au", "co.at", "co.in", "co.jp", "co.nz", "co.uk",
  "com.au", "com.br", "com.cn", "com.hk", "com.mx", "com.my", "com.sg", "com.tr", "edu.au",
  "edu.cn", "edu.hk", "edu.in", "edu.my", "edu.sg", "ed.jp", "firm.in", "gen.in", "go.jp",
  "gov.au", "gov.cn", "gov.hk", "gov.in", "gov.uk", "govt.nz", "gv.at", "id.au", "ind.in",
  "ltd.uk", "me.uk", "ne.jp", "net.au", "net.cn", "net.in", "net.nz", "or.at", "or.jp",
  "org.au", "org.cn", "org.hk", "org.in", "org.nz", "org.uk", "plc.uk", "priv.at", "sch.uk",
]);

const TRACKING_PARAMETERS = new Set([
  "dclid", "fbclid", "gclid", "igshid", "mc_cid", "mc_eid", "mkt_tok", "msclkid",
  "oly_anon_id", "oly_enc_id", "ref", "vero_id", "yclid", "_ga",
]);

function parsedUrl(value: string): URL | null {
  if (!value || /\s/.test(value)) return null;
  try {
    return new URL(value.includes("://") ? value : `http://${value}`);
  } catch {
    return null;
  }
}

export function registrableDomain(value: string): string {
  const parsed = parsedUrl(value);
  if (!parsed) return "";
  const host = parsed.hostname.replace(/\.$/, "").toLowerCase();
  if (!host || host.includes(":") || /^\d+(?:\.\d+){3}$/.test(host)) return host;
  const labels = host.split(".").filter(Boolean);
  if (labels.length < 2) return host;
  const suffix = labels.slice(-2).join(".");
  return MULTI_LABEL_SUFFIXES.has(suffix) && labels.length >= 3
    ? labels.slice(-3).join(".")
    : suffix;
}

export function canonicalDiversityUrl(value: string): string {
  const parsed = parsedUrl(value);
  if (!parsed) return "";
  parsed.hash = "";
  parsed.hostname = parsed.hostname.replace(/\.$/, "").toLowerCase();
  if ((parsed.protocol === "http:" && parsed.port === "80") || (parsed.protocol === "https:" && parsed.port === "443")) parsed.port = "";
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  const kept = [...parsed.searchParams.entries()]
    .filter(([name]) => !name.toLowerCase().startsWith("utm_") && !TRACKING_PARAMETERS.has(name.toLowerCase()))
    .sort(([leftName, leftValue], [rightName, rightValue]) => leftName.localeCompare(rightName) || leftValue.localeCompare(rightValue));
  parsed.search = "";
  for (const [name, valuePart] of kept) parsed.searchParams.append(name, valuePart);
  return parsed.toString().replace(/\/$/, "");
}

function wordTrigrams(value: string): Set<string> {
  const words = [...String(value || "").toLocaleLowerCase().matchAll(/[\p{L}\p{N}]+/gu)].map((match) => match[0]);
  return new Set(words.slice(0, -2).map((word, index) => `${word}\0${words[index + 1]}\0${words[index + 2]}`));
}

export function snippetSimilarity(left: string, right: string): number {
  const leftTrigrams = wordTrigrams(left);
  const rightTrigrams = wordTrigrams(right);
  if (!leftTrigrams.size || !rightTrigrams.size) return 0;
  const intersection = [...leftTrigrams].filter((value) => rightTrigrams.has(value)).length;
  return intersection / new Set([...leftTrigrams, ...rightTrigrams]).size;
}

function snippet(item: ResultLike): string {
  return String(item.snippet || item.description || "");
}

function duplicateAnalysis(results: ResultLike[], threshold = 0.6): { duplicates: DuplicateCandidate[]; urlDuplicates: number; nearDuplicatePairs: number } {
  const canonicalSeen = new Map<string, number>();
  const urlDuplicates = new Map<number, number>();
  results.forEach((item, index) => {
    const canonical = canonicalDiversityUrl(String(item.url || ""));
    if (!canonical) return;
    const prior = canonicalSeen.get(canonical);
    if (prior == null) canonicalSeen.set(canonical, index);
    else urlDuplicates.set(index, prior);
  });
  const contentDuplicates = new Map<number, number>();
  let nearDuplicatePairs = 0;
  results.forEach((item, index) => {
    for (let prior = 0; prior < index; prior += 1) {
      if (snippetSimilarity(snippet(results[prior]), snippet(item)) >= threshold) {
        nearDuplicatePairs += 1;
        if (!contentDuplicates.has(index)) contentDuplicates.set(index, prior);
      }
    }
  });
  const duplicates: DuplicateCandidate[] = [];
  results.forEach((_item, index) => {
    if (urlDuplicates.has(index)) duplicates.push({ kind: "url", kept: urlDuplicates.get(index)!, dropped_candidate: index });
    if (contentDuplicates.has(index)) duplicates.push({ kind: "content", kept: contentDuplicates.get(index)!, dropped_candidate: index });
  });
  return { duplicates, urlDuplicates: urlDuplicates.size, nearDuplicatePairs };
}

function rounded(value: number): number {
  return Number(value.toFixed(4));
}

export function scoreDiversity(results: ResultLike[], threshold = 0.6) {
  const count = results.length;
  if (!count) {
    return {
      score: 0,
      components: { domain_diversity: 0, url_duplication: 0, content_diversity: 0, provider_mix: 0 },
      duplicates: [],
      dominant_domain: null,
    };
  }
  const domains = results.map((item) => registrableDomain(String(item.url || ""))).filter(Boolean);
  const domainCounts = new Map<string, number>();
  for (const domain of domains) domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
  const dominant = [...domainCounts.entries()].sort(([leftDomain, leftCount], [rightDomain, rightCount]) => rightCount - leftCount || leftDomain.localeCompare(rightDomain))[0];
  const analysis = duplicateAnalysis(results, threshold);
  const pairCount = count * (count - 1) / 2;
  const providers = results.map((item) => String(item.provider || "").trim()).filter(Boolean);
  const providerCounts = new Map<string, number>();
  for (const provider of providers) providerCounts.set(provider, (providerCounts.get(provider) || 0) + 1);
  let providerMix = 1;
  if (providerCounts.size > 1) {
    const entropy = [...providerCounts.values()].reduce((sum, providerCount) => {
      const share = providerCount / providers.length;
      return sum - share * Math.log(share);
    }, 0);
    providerMix = entropy / Math.log(providerCounts.size);
  }
  const components = {
    domain_diversity: rounded(domainCounts.size / count),
    url_duplication: rounded(Math.max(0, 1 - analysis.urlDuplicates / count)),
    content_diversity: rounded(pairCount ? Math.max(0, 1 - analysis.nearDuplicatePairs / pairCount) : 1),
    provider_mix: rounded(Math.max(0, providerMix)),
  };
  return {
    score: rounded(Math.max(0, Math.min(1,
      0.4 * components.domain_diversity
      + 0.3 * components.url_duplication
      + 0.2 * components.content_diversity
      + 0.1 * components.provider_mix,
    ))),
    components,
    duplicates: analysis.duplicates,
    dominant_domain: dominant ? { domain: dominant[0], share: rounded(dominant[1] / count) } : null,
  };
}

export function rerankDuplicateCandidates(results: ResultLike[], threshold = 0.6): { results: ResultLike[]; duplicates: DuplicateCandidate[] } {
  const analysis = duplicateAnalysis(results, threshold);
  const duplicateIndices = new Set(analysis.duplicates.map((item) => item.dropped_candidate));
  return {
    results: [
      ...results.filter((_item, index) => !duplicateIndices.has(index)),
      ...results.filter((_item, index) => duplicateIndices.has(index)),
    ],
    duplicates: analysis.duplicates,
  };
}
