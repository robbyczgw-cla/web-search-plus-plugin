import test from "node:test";
import assert from "node:assert/strict";
import {
  QueryAnalyzer,
  FAILURE_DECAY_SECONDS,
  MAX_RETRY_AFTER_WAIT_SECONDS,
  RATE_LIMIT_MAX_ATTEMPTS,
  parseRetryAfter,
  register,
  __resetRuntimeStateForTests,
} from "../index.ts";
import {
  SPAM_MIRROR_DOMAINS,
  extractDomainConstraints,
  filterSpamResults,
  rerankDomainDiversity,
} from "../quality.ts";
import {
  MIN_SAMPLES_FOR_ADJUSTMENT,
  MAX_SCORE_ADJUSTMENT,
  performanceAdjustment,
  performanceAdjustments,
  getProviderHealthSnapshot,
  recordProviderOutcome,
  __resetProviderStatsForTests,
} from "../provider-stats.ts";
import { extractPlus } from "../extract.ts";
import { __resetShadowQualityForTests, getShadowQualitySnapshot, recordShadowQualityObservation } from "../shadow-quality.ts";
import { __resetRoutingPreferencesForTests } from "../routing-config.ts";

function makeApi(pluginConfig: Record<string, any>) {
  const tools: any[] = [];
  const api = {
    pluginConfig,
    registerTool(tool: any) {
      tools.push(tool);
    },
  };
  return { api, tools };
}

function searchTool(pluginConfig: Record<string, any>) {
  const { api, tools } = makeApi(pluginConfig);
  register(api);
  return tools.find((tool) => tool.name === "web_search_plus");
}

test.beforeEach(() => {
  __resetRuntimeStateForTests();
  __resetRoutingPreferencesForTests();
});

test("filterSpamResults drops mirror domains but keeps exact/subdomain semantics", () => {
  const results = [
    { title: "so", url: "https://stackoverflow.com/q/1", snippet: "x" },
    { title: "mirror", url: "https://newbedev.com/q/1", snippet: "x" },
    { title: "sub mirror", url: "https://de.newbedev.com/q/1", snippet: "x" },
    { title: "lookalike", url: "https://newbedev.com.evil.test/q/1", snippet: "x" },
  ];
  const { results: kept, removedDomains } = filterSpamResults(results);
  assert.deepEqual(kept.map((r) => r.title), ["so", "lookalike"]);
  assert.deepEqual(removedDomains, ["de.newbedev.com", "newbedev.com"]);
});

test("filterSpamResults honors extra blocked and allowed rescues", () => {
  const results = [
    { url: "https://blocked.example/x" },
    { url: "https://w3cub.com/docs" },
  ];
  const blockedExtra = filterSpamResults(results, ["blocked.example"]);
  assert.deepEqual(blockedExtra.results.map((r) => r.url), []);
  const rescued = filterSpamResults(results, ["blocked.example"], ["w3cub.com"]);
  assert.deepEqual(rescued.results.map((r) => r.url), ["https://w3cub.com/docs"]);
});

test("rerankDomainDiversity demotes overflow results but keeps them", () => {
  const results = [
    { url: "https://a.com/1" },
    { url: "https://a.com/2" },
    { url: "https://a.com/3" },
    { url: "https://b.com/1" },
    { url: "https://a.com/4" },
  ];
  const { results: reranked, demotedCount } = rerankDomainDiversity(results, 2);
  assert.equal(demotedCount, 2);
  assert.deepEqual(reranked.map((r) => r.url), [
    "https://a.com/1",
    "https://a.com/2",
    "https://b.com/1",
    "https://a.com/3",
    "https://a.com/4",
  ]);
});

test("extractDomainConstraints reads site: operators and include_domains", () => {
  assert.deepEqual(
    extractDomainConstraints("errors site:stackoverflow.com site:GitHub.com.", ["Example.org "]),
    ["example.org", "github.com", "stackoverflow.com"],
  );
  assert.deepEqual(extractDomainConstraints("plain query"), []);
});

test("SPAM_MIRROR_DOMAINS matches the Hermes blocklist shape", () => {
  assert.ok(SPAM_MIRROR_DOMAINS.includes("newbedev.com"));
  assert.ok(SPAM_MIRROR_DOMAINS.includes("githubmemory.com"));
  assert.ok(SPAM_MIRROR_DOMAINS.includes("w3cub.com"));
});

test("performanceAdjustment stays 0 below the sample threshold and bounded after", () => {
  __resetProviderStatsForTests();
  for (let i = 0; i < MIN_SAMPLES_FOR_ADJUSTMENT - 1; i += 1) {
    recordProviderOutcome("tavily", 0.5, 5, false);
  }
  assert.equal(performanceAdjustment("tavily"), 0);
  recordProviderOutcome("tavily", 0.5, 5, false);
  const good = performanceAdjustment("tavily");
  assert.ok(good > 0 && good <= MAX_SCORE_ADJUSTMENT);

  for (let i = 0; i < 10; i += 1) recordProviderOutcome("exa", 9, 0, true);
  const bad = performanceAdjustment("exa");
  assert.ok(bad < 0 && bad >= -MAX_SCORE_ADJUSTMENT);

  const adjustments = performanceAdjustments(["tavily", "exa", "brave"]);
  assert.deepEqual(Object.keys(adjustments).sort(), ["exa", "tavily"]);
});

test("provider health snapshot is explicitly scoped to this process", () => {
  __resetProviderStatsForTests();
  recordProviderOutcome("tavily", 0.2, 3, false);
  const snapshot = getProviderHealthSnapshot(["tavily", "exa"]);
  assert.equal(snapshot.scope, "process_local");
  assert.match(snapshot.process_started_at, /T/);
  assert.equal(snapshot.providers.tavily.samples, 1);
  assert.equal(snapshot.providers.exa.samples, 0);
});

test("shadow quality aggregates observations without becoming a routing input", () => {
  __resetShadowQualityForTests();
  recordShadowQualityObservation({ status: "degraded", results: [{ url: "https://example.com/a", snippet: "short" }, { url: "https://other.example/b", snippet: "a sufficiently detailed snippet for the quality aggregate" }] });
  const snapshot = getShadowQualitySnapshot();
  assert.equal(snapshot.scope, "process_local");
  assert.equal(snapshot.observations, 1);
  assert.equal(snapshot.aggregate.average_domain_count, 2);
  assert.equal(snapshot.aggregate.thin_snippet_rate, 0.5);
});

test("stale samples no longer influence the adjustment", () => {
  __resetProviderStatsForTests();
  const old = Date.now() / 1000 - 8 * 24 * 3600;
  for (let i = 0; i < 10; i += 1) recordProviderOutcome("brave", 9, 0, true, old);
  assert.equal(performanceAdjustment("brave"), 0);
});

test("adaptive adjustments can break routing ties without overriding class winners", () => {
  __resetProviderStatsForTests();
  const analyzer = new QueryAnalyzer();
  const neutralQuery = "zxqv wvutn";
  const base = analyzer.route(neutralQuery, ["tavily", "exa"]);
  const boosted = analyzer.route(neutralQuery, ["tavily", "exa"], { exa: 0.9 });
  assert.equal(boosted.provider, "exa");
  assert.deepEqual(boosted.adaptive_adjustments, { exa: 0.9 });
  void base;

  const classQuery = "reddit discussion about mechanical keyboards";
  const classWinner = analyzer.route(classQuery, ["serper", "exa"], { exa: 1.0, serper: -1.0 });
  assert.equal(classWinner.provider, "serper");
});

test("parseRetryAfter handles delta-seconds and HTTP dates", () => {
  assert.equal(parseRetryAfter("17"), 17);
  const inFuture = new Date(Date.now() + 20000).toUTCString();
  const parsed = parseRetryAfter(inFuture);
  assert.ok(parsed != null && parsed >= 18 && parsed <= 21);
  assert.equal(parseRetryAfter("bogus"), undefined);
  assert.equal(parseRetryAfter(null), undefined);
  assert.ok(RATE_LIMIT_MAX_ATTEMPTS === 2);
  assert.ok(MAX_RETRY_AFTER_WAIT_SECONDS === 30);
  assert.ok(FAILURE_DECAY_SECONDS === 1800);
});

test("429 responses stop retrying after the rate-limit attempt cap", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls += 1;
    return new Response(JSON.stringify({ error: "slow down" }), {
      status: 429,
      headers: { "retry-after": "0" },
    });
  });
  const tool = searchTool({ serperApiKey: "k" });
  const output = await tool.execute("id", { query: "hello", provider: "serper" });
  const payload = JSON.parse(output.content[0].text);
  assert.match(String(payload.provider_errors?.[0]?.error || payload.error), /429/);
  assert.equal(calls, RATE_LIMIT_MAX_ATTEMPTS);
});

test("provider config errors do not mark provider cooldowns", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    return new Response(JSON.stringify({ results: [{ title: "t", url: "https://ok.example/a", content: "c" }] }), { status: 200 });
  });
  const tool = searchTool({ tavilyApiKey: "k", routingPreferences: { provider_priority: ["serper", "tavily"] } });
  // serper has no key configured; auto routing should fall through to tavily
  // without a cooldown entry for serper.
  const output = await tool.execute("id", { query: "site:example.com test", provider: "auto" });
  const payload = JSON.parse(output.content[0].text);
  assert.equal(payload.provider, "tavily");
  const second = await tool.execute("id", { query: "another query" });
  const secondPayload = JSON.parse(second.content[0].text);
  assert.ok(!(secondPayload.routing?.cooldown_skips || []).some((s: any) => s.provider === "serper"));
});

test("spam results are filtered and metadata reports the removals", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    return new Response(JSON.stringify({
      results: [
        { title: "mirror", url: "https://newbedev.com/q", content: "copy" },
        { title: "real", url: "https://stackoverflow.com/q", content: "answer" },
      ],
    }), { status: 200 });
  });
  const tool = searchTool({ tavilyApiKey: "k" });
  const output = await tool.execute("id", { query: "how to fix" , provider: "tavily" });
  const payload = JSON.parse(output.content[0].text);
  assert.deepEqual(payload.results.map((r: any) => r.url), ["https://stackoverflow.com/q"]);
  assert.deepEqual(payload.metadata.result_filter.spam_removed_domains, ["newbedev.com"]);
});

test("site: constraints bypass spam filtering and diversity rerank", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    return new Response(JSON.stringify({
      results: [
        { title: "m1", url: "https://newbedev.com/1", content: "c" },
        { title: "m2", url: "https://newbedev.com/2", content: "c" },
        { title: "m3", url: "https://newbedev.com/3", content: "c" },
      ],
    }), { status: 200 });
  });
  const tool = searchTool({ tavilyApiKey: "k" });
  const output = await tool.execute("id", { query: "site:newbedev.com fix", provider: "tavily" });
  const payload = JSON.parse(output.content[0].text);
  assert.equal(payload.results.length, 3);
  assert.deepEqual(payload.metadata.result_filter.domain_constraints, ["newbedev.com"]);
  assert.equal(payload.metadata.result_filter.diversity_demoted_count, 0);
});

test("domain diversity demotes single-domain floods in unconstrained searches", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    return new Response(JSON.stringify({
      results: [
        { title: "a1", url: "https://one.example/1", content: "c" },
        { title: "a2", url: "https://one.example/2", content: "c" },
        { title: "a3", url: "https://one.example/3", content: "c" },
        { title: "b1", url: "https://two.example/1", content: "c" },
      ],
    }), { status: 200 });
  });
  const tool = searchTool({ tavilyApiKey: "k" });
  const output = await tool.execute("id", { query: "generic question", provider: "tavily" });
  const payload = JSON.parse(output.content[0].text);
  assert.deepEqual(payload.results.map((r: any) => r.url), [
    "https://one.example/1",
    "https://one.example/2",
    "https://two.example/1",
    "https://one.example/3",
  ]);
  assert.equal(payload.metadata.result_filter.diversity_demoted_count, 1);
});

test("extractPlus skips providers disabled in routing preferences", async (t) => {
  const requestedUrls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: any) => {
    requestedUrls.push(String(url));
    return new Response(JSON.stringify({ results: [{ url: "https://example.com", text: "content" }] }), { status: 200 });
  });
  const runtimeConfig = { tavilyApiKey: "t", exaApiKey: "e" };
  const result = await extractPlus(["https://example.com"], "auto", "markdown", false, false, false, runtimeConfig, ["tavily"]);
  assert.equal(result.provider, "exa");
  assert.ok(requestedUrls.every((url) => !url.includes("tavily")));
});

test("explicitly requested extract provider is tried even when disabled", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    return new Response(JSON.stringify({ results: [{ url: "https://example.com", raw_content: "content" }] }), { status: 200 });
  });
  const runtimeConfig = { tavilyApiKey: "t" };
  const result = await extractPlus(["https://example.com"], "tavily", "markdown", false, false, false, runtimeConfig, ["tavily"]);
  assert.equal(result.provider, "tavily");
});
