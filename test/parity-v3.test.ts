import test from "node:test";
import assert from "node:assert/strict";
import { QueryAnalyzer, register } from "../index.ts";
import { EXTRACT_PROVIDER_PRIORITY, extractPlus } from "../extract.ts";
import { DEFAULT_ROUTING_PREFERENCES, validateRoutingPreferences } from "../routing-config.ts";

async function withMockedFetch(fn: () => Promise<void>) {
  const original = globalThis.fetch;
  try {
    await fn();
  } finally {
    globalThis.fetch = original;
  }
}

test("routing v2 exposes class, language and policy diagnostics", () => {
  const routing = new QueryAnalyzer().route("arxiv retrieval augmented generation papers", ["exa", "tavily", "serper"] as any);
  assert.equal(routing.routing_policy, "routing-v2");
  assert.equal(routing.analysis_summary.routing_class, "academic/arxiv");
  assert.equal(routing.analysis_summary.language_hint, "en");
  assert.equal(routing.provider, "exa");
});

test("routing v2 golden classes prefer benchmarked provider families", () => {
  const providers = ["you", "serper", "exa", "firecrawl", "tavily", "linkup", "brave", "querit", "parallel", "serpbase"] as any;
  const cases = [
    ["aktuelle Nachrichten heute", "multilingual/current", ["querit", "brave"]],
    ["iPhone 17 Pro Preis kaufen Österreich", "local/shopping", ["serper"]],
    ["github openai sdk api docs", "docs/api", ["exa", "firecrawl"]],
    ["arxiv transformer retrieval paper", "academic/arxiv", ["exa"]],
    ["site:reddit.com best homelab router", "community/reddit", ["serper", "brave"]],
    ["CVE-2026-1234 vendor advisory patch", "security/cve", ["firecrawl"]],
    ["EU official regulation AI Act source", "official/regulatory", ["linkup"]],
    ["NVIDIA investor relations annual report earnings", "finance/IR", ["linkup", "tavily"]],
    ["weather Graz tomorrow forecast", "weather/factual", ["you"]],
    ["open source alternatives similar to Supabase", "oss-discovery", ["exa"]],
    ["synthesize explain the current AI browser market", "answer/synthesis", ["tavily", "exa"]],
  ] as const;
  for (const [query, routingClass, allowedProviders] of cases) {
    const routing = new QueryAnalyzer().route(query, providers);
    assert.equal(routing.analysis_summary.routing_class, routingClass, query);
    assert.ok(allowedProviders.includes(routing.provider as any), `${query}: ${routing.provider}`);
    if (routingClass === "answer/synthesis") assert.equal(routing.analysis_summary.answer_mode_recommended, true);
  }
});

test("guarded providers default to auto_allow false but explicit validation accepts them", () => {
  assert.equal(DEFAULT_ROUTING_PREFERENCES.auto_allow.parallel, false);
  assert.equal(DEFAULT_ROUTING_PREFERENCES.auto_allow.serpbase, false);
  const config = validateRoutingPreferences({ provider_priority: ["parallel", "serpbase"], auto_allow: { parallel: true } });
  assert.equal(config.auto_allow.parallel, true);
  assert.equal(config.auto_allow.serpbase, false);
  assert.ok(config.provider_priority.includes("parallel" as any));
});

test("registered search exposes quality_report and excludes answer tool", () => {
  const registered = new Map<string, any>();
  register({ registerTool(tool: any) { registered.set(tool.name, tool); }, pluginConfig: { serperApiKey: "serper-test" } });
  assert.ok(registered.get("web_search_plus").parameters.properties.quality_report);
  assert.equal(registered.has("web_answer_plus"), false);
});

test("Parallel search provider is explicit and normalized", async () => {
  await withMockedFetch(async () => {
    globalThis.fetch = (async (_url: any, init: any) => {
      const body = JSON.parse(String(init.body));
      assert.equal(body.objective, "parallel ai docs");
      return new Response(JSON.stringify({ search_id: "s1", results: [{ title: "Parallel", url: "https://parallel.ai", excerpts: ["fast search"] }] }), { status: 200, headers: { "content-type": "application/json" } });
    }) as any;
    const registered = new Map<string, any>();
    register({ registerTool(tool: any) { registered.set(tool.name, tool); }, pluginConfig: { parallelApiKey: "par-test" } });
    const response = await registered.get("web_search_plus").execute("tool-parallel", { query: "parallel ai docs", provider: "parallel", count: 3 });
    const payload = JSON.parse(response.content[0].text);
    assert.equal(payload.provider, "parallel");
    assert.equal(payload.results[0].snippet, "fast search");
    assert.equal(payload.metadata.search_id, "s1");
  });
});

test("SerpBase search provider is explicit and normalized", async () => {
  await withMockedFetch(async () => {
    globalThis.fetch = (async (url: any) => {
      assert.match(String(url), /api\.serpbase\.com/);
      return new Response(JSON.stringify({ status: 0, organic_results: [{ title: "Result", link: "https://example.com/?utm_source=x", snippet: "clean" }], related_searches: [{ query: "more" }] }), { status: 200, headers: { "content-type": "application/json" } });
    }) as any;
    const registered = new Map<string, any>();
    register({ registerTool(tool: any) { registered.set(tool.name, tool); }, pluginConfig: { serpbaseApiKey: "sb-test" } });
    const response = await registered.get("web_search_plus").execute("tool-serpbase", { query: "test", provider: "serpbase", count: 3 });
    const payload = JSON.parse(response.content[0].text);
    assert.equal(payload.provider, "serpbase");
    assert.equal(payload.results[0].url, "https://example.com/");
    assert.deepEqual(payload.related_searches, ["more"]);
  });
});

test("extraction auto order ends with the Keenable and Serper fallbacks", () => {
  assert.deepEqual(EXTRACT_PROVIDER_PRIORITY, ["tavily", "exa", "linkup", "parallel", "firecrawl", "you", "keenable", "serper"]);
});

test("Parallel extraction provider is normalized", async () => {
  await withMockedFetch(async () => {
    globalThis.fetch = (async (_url: any, init: any) => {
      const body = JSON.parse(String(init.body));
      assert.deepEqual(body.urls, ["https://example.com"]);
      return new Response(JSON.stringify({ results: [{ url: "https://example.com", title: "Example", excerpts: ["content"] }] }), { status: 200, headers: { "content-type": "application/json" } });
    }) as any;
    const payload = await extractPlus(["https://example.com"], "parallel" as any, "markdown", false, false, false, { parallelApiKey: "par-test" } as any);
    assert.equal(payload.provider, "parallel");
    assert.equal(payload.results[0].content, "content");
  });
});
