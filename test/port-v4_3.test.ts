import test from "node:test";
import assert from "node:assert/strict";
import { register, __resetRuntimeStateForTests, effectiveSearchCacheTtl, freshnessMetadata } from "../index.ts";
import { getProviderPerformance } from "../provider-stats.ts";
import { runResearchMode } from "../research.ts";
import { extractPlus } from "../extract.ts";
import { selectSpans } from "../span-extraction.ts";

function search(config: any = {}) {
  __resetRuntimeStateForTests();
  const tools = new Map<string, any>();
  register({ pluginConfig: config, registerTool(tool: any) { tools.set(tool.name, tool); } });
  const tool = tools.get("web_search_plus");
  return { tool, run: async (params: any) => JSON.parse((await tool.execute("test", params)).content[0].text) };
}

const hit = { title: "Source", url: "https://example.com/source", content: "Evidence", text: "Leading text", highlights: [null, "", "Query evidence", "Second highlight"] };
function mockProvider(t: any, bodies: any[], response: any = { results: [hit] }) {
  t.mock.method(globalThis, "fetch", async (_url: any, init: any) => {
    bodies.push(JSON.parse(init.body));
    return new Response(JSON.stringify(response));
  });
}

for (const query of ["--help", "-site:example.com", "--", "-q=other", "日本語 query"]) {
  test(`query remains data: ${query}`, async (t) => {
    const bodies: any[] = [];
    mockProvider(t, bodies);
    const { run } = search({ tavilyApiKey: "test" });
    assert.equal((await run({ query, provider: "tavily" })).query, query);
    assert.equal(bodies[0].query, query);
    const [span] = selectSpans("Ordinary material.\n\nhelp example other query evidence.", query, { maxSpans: 1 });
    assert.ok(span.text);
  });
}

test("Parallel sends count and domain policy without changing query", async (t) => {
  const bodies: any[] = [];
  mockProvider(t, bodies);
  const { run } = search({ parallelApiKey: "test" });
  await run({ query: "literal query", provider: "parallel", count: 9, include_domains: ["example.com"], exclude_domains: ["example.net"] });
  assert.deepEqual(bodies[0], { objective: "literal query", search_queries: ["literal query"], mode: "fast", advanced_settings: { max_results: 9, source_policy: { include_domains: ["example.com"], exclude_domains: ["example.net"] } } });
});

for (const mode of ["normal", "research"]) {
  test(`Exa highlights and exact hour receipt in ${mode}`, async (t) => {
    const bodies: any[] = [];
    mockProvider(t, bodies);
    const { run } = search({ exaApiKey: "test" });
    const payload = await run({ query: "evidence", provider: "exa", mode, research_providers: ["exa"], research_extract_count: 0, time_range: "hour", freshness: "year" });
    assert.equal(payload.results[0].snippet, "Query evidence ... Second highlight");
    const receipt = mode === "research" ? payload.metadata.freshness.per_provider[0] : payload.metadata.freshness;
    assert.equal(receipt.requested, "hour");
    assert.deepEqual(receipt.native_value, { startPublishedDate: bodies[0].startPublishedDate, endPublishedDate: bodies[0].endPublishedDate });
    assert.equal(Date.parse(bodies[0].endPublishedDate) - Date.parse(bodies[0].startPublishedDate), 3600000);
  });
}

test("Exa falls back to leading text when highlights are empty", async (t) => {
  const bodies: any[] = [];
  mockProvider(t, bodies, { results: [{ ...hit, highlights: [null, " "] }] });
  const { run } = search({ exaApiKey: "test" });
  assert.equal((await run({ query: "fallback", provider: "exa" })).results[0].snippet, "Leading text");
});

test("Tavily time_range wins and receipt matches body, including freshness-only calls", async (t) => {
  const bodies: any[] = [];
  mockProvider(t, bodies);
  const { run } = search({ tavilyApiKey: "test" });
  for (const params of [{ freshness: "month" }, { time_range: "week", freshness: "day" }, { time_range: "year" }]) {
    const payload = await run({ query: "filter", provider: "tavily", ...params });
    assert.equal(payload.metadata.freshness.native_value, bodies.at(-1).time_range);
    assert.equal(bodies.at(-1).time_range, params.time_range || params.freshness);
  }
});

test("search TTL caps explicit durations by recency", () => {
  for (const [query, recency, ttl] of [["neutral", "hour", 60], ["neutral", "day", 300], ["neutral", "week", 1800], ["live scores", undefined, 60], ["latest findings", undefined, 300], ["neutral", "month", 3600]] as const) {
    assert.equal(effectiveSearchCacheTtl(query, recency, 86400), ttl);
    assert.equal(effectiveSearchCacheTtl(query, recency, 10), 10);
  }
});

test("cache age, no_cache reads and writes, TTL override and time_range precedence", async (t) => {
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  const bodies: any[] = [];
  mockProvider(t, bodies);
  const { tool, run } = search({ tavilyApiKey: "test" });
  assert.equal(tool.parameters.properties.no_cache.type, "boolean");
  assert.equal(tool.parameters.properties.cache_ttl.type, "integer");
  const params = { query: "neutral", provider: "tavily", time_range: "week", freshness: "day" };
  await run(params);
  now += 301000;
  const cached = await run(params);
  assert.equal(cached.cached, true);
  assert.equal(cached.cache_age_seconds, 301);
  assert.equal(cached.recency_query, true);
  assert.equal(getProviderPerformance("tavily")?.samples, 1);
  await run({ ...params, no_cache: true });
  assert.equal(bodies.length, 2);
  assert.equal((await run(params)).cache_age_seconds, 301);
  await run({ ...params, cache_ttl: 10 });
  assert.equal(bodies.length, 3);
  now += 1801000;
  assert.equal((await run(params)).cached, false);
  const fresh = { query: "uncached", provider: "tavily", no_cache: true };
  await run(fresh);
  assert.equal((await run({ ...fresh, no_cache: false })).cached, false);
});

test("research summaries select query evidence after a long prefix and keep 500 chars", async () => {
  const result = await runResearchMode({ query: "orbital calibration", researchProviders: ["exa"], maxResults: 1,
    executeSearch: async () => ({ results: [hit] }),
    extractUrls: async () => ({ results: [{ url: hit.url, content: "Background material. ".repeat(80) + "\n\nOrbital calibration requires a reference measurement." }] }),
  });
  assert.match(result.source_summaries[0].content, /Orbital calibration/);
  assert.ok(result.source_summaries[0].content.length <= 500);
  assert.equal(result.source_summaries[0].summary_truncated, true);
});

for (const mode of ["normal", "research"]) {
  test(`each retry records one outcome in ${mode}`, async (t) => {
    let calls = 0;
    t.mock.method(globalThis, "fetch", async () => {
      calls++;
      return calls === 1 ? new Response("", { status: 503 }) : new Response(JSON.stringify({ results: [hit] }));
    });
    const { run } = search({ tavilyApiKey: "test" });
    const result = await run({ query: "retry", provider: "tavily", mode, research_providers: ["tavily"], research_extract_count: 0 });
    assert.equal(result.results.length, 1);
    const perf = getProviderPerformance("tavily")!;
    assert.equal(perf.samples, 2);
    assert.equal(perf.success_rate, 0.5);
    assert.ok(perf.median_latency_seconds! >= 0);
  });
}

test("configuration errors create no provider sample and concurrent calls retain every sample", async (t) => {
  const bodies: any[] = [];
  mockProvider(t, bodies);
  const { run } = search({ tavilyApiKey: "test" });
  await run({ query: "missing key", provider: "exa" });
  assert.equal(getProviderPerformance("exa"), null);
  await Promise.all(Array.from({ length: 20 }, (_, i) => run({ query: `sample ${i}`, provider: "tavily", no_cache: true })));
  assert.equal(getProviderPerformance("tavily")?.samples, 20);
});

test("configured default count reaches adapter, explicit count wins and clamps 1–20", async (t) => {
  const bodies: any[] = [];
  mockProvider(t, bodies);
  const { tool, run } = search({ tavilyApiKey: "test", defaults: { max_results: 12 } });
  assert.equal(tool.parameters.properties.count.maximum, 20);
  assert.equal(tool.parameters.properties.count.default, undefined);
  for (const [count, expected] of [[undefined, 12], [3, 3], [0, 1], [100, 20]]) {
    await run({ query: "counts", provider: "tavily", count, no_cache: true });
    assert.equal(bodies.at(-1).max_results, expected);
  }
});


test("Exa receipts do not fabricate dates when no wire bounds exist", () => {
  assert.deepEqual(freshnessMetadata("exa", "day"), { requested: "day", provider: "exa", applied: false, native_value: {} });
});

test("DonSeTch pre-dispatch configuration failures do not train routing", async () => {
  __resetRuntimeStateForTests();
  const tools = new Map<string, any>();
  let calls = 0;
  register({ pluginConfig: { donsetchBin: "relative-binary" },
    runtime: { system: { runCommandWithTimeout: async () => { calls++; throw new Error("must not launch"); } } },
    registerTool(tool: any) { tools.set(tool.name, tool); },
  });
  for (const extra of [{}, { freshness: "day" }]) {
    const response = await tools.get("web_search_plus").execute("test", { query: "configuration", provider: "donsetch", ...extra });
    assert.ok(JSON.parse(response.content[0].text).error);
  }
  assert.equal(calls, 0);
  assert.equal(getProviderPerformance("donsetch"), null);
});


test("extraction span queries remain data through the public extraction function", async (t) => {
  const content = "Ordinary opening.\n\nTarget evidence about release flags.";
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ results: [{ url: "https://example.com/flags", raw_content: content }] })));
  for (const spansQuery of ["--help", "-target", "--", "", "-q=release"]) {
    const response = await extractPlus(["https://example.com/flags"], "tavily", "markdown", false, false, false,
      { tavilyApiKey: "test" }, [], undefined, { spans: true, spansQuery, cacheBypass: true });
    assert.equal(response.results[0].error, undefined);
    assert.deepEqual(response.results[0].spans?.map(({ text }) => text), selectSpans(content, spansQuery).map(({ text }) => text));
  }
});

test("each research member records its own result count including empty responses", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: any) => new Response(JSON.stringify({ results: String(url).includes("exa") ? [] : [hit] })));
  const { run } = search({ exaApiKey: "test", tavilyApiKey: "test" });
  await run({ query: "members", provider: "tavily", mode: "research", research_providers: ["tavily", "exa"], research_extract_count: 0 });
  assert.equal(getProviderPerformance("tavily")?.samples, 1);
  assert.equal(getProviderPerformance("tavily")?.empty_rate, 0);
  assert.equal(getProviderPerformance("exa")?.samples, 1);
  assert.equal(getProviderPerformance("exa")?.empty_rate, 1);
  assert.equal(getProviderPerformance("exa")?.success_rate, 1);
});
