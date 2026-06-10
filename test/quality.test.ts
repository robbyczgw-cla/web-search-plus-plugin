import test from "node:test";
import assert from "node:assert/strict";
import { QueryAnalyzer, computeRetryDelayMs, register, __resetRuntimeStateForTests } from "../index.ts";
import { CANONICAL_DOMAIN_RULES, buildAuthoritySignals, rerankResultsForIntent } from "../quality.ts";
import { __resetRoutingPreferencesForTests } from "../routing-config.ts";

function mockJsonResponse(body: any, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(body);
    },
  };
}

async function withMockedFetch(
  responder: (url: string, init?: RequestInit) => any,
  fn: () => Promise<void>,
) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const href = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
    return responder(href, init);
  }) as typeof fetch;
  try {
    await fn();
  } finally {
    globalThis.fetch = originalFetch;
    __resetRuntimeStateForTests();
    __resetRoutingPreferencesForTests();
  }
}

test("rerankResultsForIntent boosts canonical sources above demoted mirrors", () => {
  const results = [
    { title: "CVE explained on YouTube", url: "https://www.youtube.com/watch?v=abc", snippet: "video" },
    { title: "Some blog", url: "https://medium.com/@user/cve-writeup", snippet: "blog" },
    { title: "NVD entry", url: "https://nvd.nist.gov/vuln/detail/CVE-2026-1234", snippet: "official advisory" },
  ];
  const { results: reranked, metadata } = rerankResultsForIntent("CVE-2026-1234 vendor advisory", "security/cve", results);

  assert.equal(metadata.reranked, true);
  assert.equal(metadata.routing_class, "security/cve");
  assert.equal(metadata.top_domain_before, "youtube.com");
  assert.equal(metadata.top_domain_after, "nvd.nist.gov");
  assert.equal(reranked[0].url, "https://nvd.nist.gov/vuln/detail/CVE-2026-1234");
});

test("rerankResultsForIntent leaves classes without canonical rules untouched", () => {
  const results = [
    { title: "B", url: "https://b.example.com", snippet: "b" },
    { title: "A", url: "https://a.example.com", snippet: "a" },
  ];
  const { results: reranked, metadata } = rerankResultsForIntent("anything", "general", results);
  assert.equal(metadata.reranked, false);
  assert.deepEqual(reranked.map((r) => r.url), results.map((r) => r.url));
});

test("buildAuthoritySignals reports canonical and demoted domain hits", () => {
  const results = [
    { title: "SEC filing", url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany", snippet: "10-K" },
    { title: "Investor page", url: "https://investor.nvidia.com/home", snippet: "IR" },
    { title: "Reddit thread", url: "https://reddit.com/r/stocks/post", snippet: "discussion" },
  ];
  const signals = buildAuthoritySignals("finance/IR", results);

  assert.equal(signals.routing_class, "finance/IR");
  assert.equal(signals.rules_applied, true);
  assert.equal(signals.top_domain, "sec.gov");
  assert.deepEqual(signals.canonical_domain_hits, ["investor.nvidia.com", "sec.gov"]);
  assert.deepEqual(signals.demoted_domain_hits, ["reddit.com"]);
  assert.equal(signals.canonical_top_result, true);
});

test("buildAuthoritySignals marks unknown classes as rules_applied=false", () => {
  const signals = buildAuthoritySignals("general", [{ title: "x", url: "https://example.com", snippet: "s" }]);
  assert.equal(signals.rules_applied, false);
  assert.deepEqual(signals.canonical_domain_hits, []);
  assert.equal(signals.canonical_top_result, false);
});

test("every canonical rule class maps to a known routing class", () => {
  const analyzer = new QueryAnalyzer();
  const queriesByClass: Record<string, string> = {
    "official/vendor-release": "anthropic claude release notes announcement",
    "docs/api": "github openai sdk api docs",
    "official/regulatory": "EU official regulation AI Act source",
    "finance/IR": "NVIDIA investor relations annual report earnings",
    "security/cve": "CVE-2026-1234 vendor advisory patch",
  };
  for (const [routingClass, query] of Object.entries(queriesByClass)) {
    assert.ok(CANONICAL_DOMAIN_RULES[routingClass], `missing rules for ${routingClass}`);
    assert.equal(analyzer.detectRoutingClass(query), routingClass);
  }
});

test("official/vendor-release routes toward You.com and Linkup", () => {
  const routing = new QueryAnalyzer().route("openai official announcement gpt launch", ["you", "linkup", "serper", "tavily"] as any);
  assert.equal(routing.analysis_summary.routing_class, "official/vendor-release");
  assert.ok(["you", "linkup"].includes(routing.provider));
});

test("computeRetryDelayMs stays within bounded jitter window", () => {
  for (let i = 0; i < 200; i += 1) {
    const first = computeRetryDelayMs(0);
    assert.ok(first >= 1000 && first <= 1500, `attempt 0 delay out of range: ${first}`);
    const second = computeRetryDelayMs(1);
    assert.ok(second >= 3000 && second <= 4500, `attempt 1 delay out of range: ${second}`);
  }
});

test("auto-routed search applies intent rerank and authority signals end-to-end", async () => {
  await withMockedFetch(
    (url) => {
      if (url.includes("google.serper.dev/search")) {
        return mockJsonResponse({
          organic: [
            { title: "CVE video walkthrough", link: "https://www.youtube.com/watch?v=xyz", snippet: "video" },
            { title: "NVD advisory", link: "https://nvd.nist.gov/vuln/detail/CVE-2026-1234", snippet: "official record" },
          ],
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
    async () => {
      const registered = new Map<string, any>();
      register({
        registerTool(tool: any) { registered.set(tool.name, tool); },
        pluginConfig: { serperApiKey: "serper-test" },
      });

      const tool = registered.get("web_search_plus");
      const response = await tool.execute("tool-rerank", {
        query: "CVE-2026-1234 vendor advisory patch",
        provider: "auto",
        quality_report: true,
      });
      const payload = JSON.parse(response.content[0].text);

      assert.equal(payload.results[0].url, "https://nvd.nist.gov/vuln/detail/CVE-2026-1234");
      assert.equal(payload.metadata.intent_rerank.reranked, true);
      assert.equal(payload.metadata.intent_rerank.top_domain_after, "nvd.nist.gov");
      assert.equal(payload.quality_report.authority_signals.routing_class, "security/cve");
      assert.deepEqual(payload.quality_report.authority_signals.canonical_domain_hits, ["nvd.nist.gov"]);
      assert.equal(payload.quality_report.authority_signals.canonical_top_result, true);
    },
  );
});
