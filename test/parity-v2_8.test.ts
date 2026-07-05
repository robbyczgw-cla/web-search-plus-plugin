import test from "node:test";
import assert from "node:assert/strict";
import {
  FRESHNESS_VALUES,
  PROVIDER_FRESHNESS_FORMATS,
  freshnessMetadata,
  normalizeFreshness,
  register,
  __resetRuntimeStateForTests,
} from "../index.ts";
import {
  DEFAULT_EXTRACT_CHAR_LIMIT,
  extractPlus,
  formatTruncatedExtractContent,
  sanitizeExtractContent,
} from "../extract.ts";
import { rerankResultsForIntent } from "../quality.ts";
import { __resetRoutingPreferencesForTests } from "../routing-config.ts";

function searchTool(pluginConfig: Record<string, any>) {
  const tools: any[] = [];
  register({ pluginConfig, registerTool: (tool: any) => tools.push(tool) });
  return tools.find((tool) => tool.name === "web_search_plus");
}

test.beforeEach(() => {
  __resetRuntimeStateForTests();
  __resetRoutingPreferencesForTests();
});

test("normalizeFreshness accepts unified values and rejects junk", () => {
  assert.deepEqual(FRESHNESS_VALUES, ["day", "week", "month", "year"]);
  assert.equal(normalizeFreshness(" Week "), "week");
  assert.equal(normalizeFreshness(null), null);
  assert.equal(normalizeFreshness(""), null);
  assert.throws(() => normalizeFreshness("fortnight"), /Invalid freshness value/);
});

test("freshnessMetadata reports native mapping or non-application", () => {
  assert.deepEqual(freshnessMetadata("serper", "week"), { requested: "week", applied: true, provider: "serper", native_value: "qdr:w" });
  assert.equal(freshnessMetadata("brave", "month").native_value, "pm");
  const unsupported = freshnessMetadata("tavily", "week");
  assert.equal(unsupported.applied, false);
  assert.match(unsupported.reason, /does not support freshness/);
  assert.ok(!("tavily" in PROVIDER_FRESHNESS_FORMATS));
  assert.ok(!("exa" in PROVIDER_FRESHNESS_FORMATS));
});

test("freshness maps natively for serper and lands in metadata", async (t) => {
  const bodies: any[] = [];
  t.mock.method(globalThis, "fetch", async (_url: any, init: any) => {
    bodies.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify({ organic: [{ title: "t", link: "https://example.com/a", snippet: "s" }] }), { status: 200 });
  });
  const tool = searchTool({ serperApiKey: "k" });
  const payload = JSON.parse((await tool.execute("id", { query: "news", provider: "serper", freshness: "week" })).content[0].text);
  assert.equal(bodies[0].tbs, "qdr:w");
  assert.deepEqual(payload.metadata.freshness, { requested: "week", applied: true, provider: "serper", native_value: "qdr:w" });
});

test("freshness on an unsupported provider reports applied=false and runs normally", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    return new Response(JSON.stringify({ results: [{ title: "t", url: "https://example.com/a", content: "c" }] }), { status: 200 });
  });
  const tool = searchTool({ tavilyApiKey: "k" });
  const payload = JSON.parse((await tool.execute("id", { query: "q", provider: "tavily", freshness: "month" })).content[0].text);
  assert.equal(payload.results.length, 1);
  assert.equal(payload.metadata.freshness.applied, false);
});

test("invalid freshness values fail loudly", async () => {
  const tool = searchTool({ tavilyApiKey: "k" });
  const payload = JSON.parse((await tool.execute("id", { query: "q", freshness: "fortnight" })).content[0].text);
  assert.match(payload.error, /Invalid freshness value/);
});

test("look-alike domains no longer inherit authority boosts", () => {
  const results = [
    { title: "fake", url: "https://openai.com.evil.example/announcement", snippet: "official" },
    { title: "real", url: "https://openai.com/blog/release", snippet: "official" },
  ];
  const { results: reranked } = rerankResultsForIntent("openai official release", "official/vendor-release", results);
  assert.equal(reranked[0].url, "https://openai.com/blog/release");
});

test("sanitizeExtractContent replaces base64 images but keeps http images", () => {
  const md = "intro ![diagram](data:image/png;base64,AAAA) mid ![logo](https://example.com/logo.png) end";
  const cleaned = sanitizeExtractContent(md);
  assert.match(cleaned, /\[IMAGE: diagram\]/);
  assert.match(cleaned, /https:\/\/example\.com\/logo\.png/);
  const html = '<p><img src="data:image/jpeg;base64,BBBB" alt="chart"></p>';
  assert.match(sanitizeExtractContent(html), /\[IMAGE: chart\]/);
});

test("formatTruncatedExtractContent returns short pages untouched and windows long ones", () => {
  const short = formatTruncatedExtractContent("hello world", 1000);
  assert.equal(short.content, "hello world");
  assert.equal(short.truncated, false);

  const long = "A".repeat(5000) + "MIDDLE" + "Z".repeat(5000);
  const result = formatTruncatedExtractContent(long, 2000);
  assert.equal(result.truncated, true);
  assert.equal(result.originalChars, long.length);
  assert.match(result.content, /^A+/);
  assert.match(result.content, /Z+\n/);
  assert.match(result.content, /Content truncated: original 10006 chars/);
  assert.doesNotMatch(result.content, /MIDDLE/);
});

test("extractPlus truncates oversized pages with the configured inline budget", async (t) => {
  const midContent = "word ".repeat(2000); // 10k chars: over a 2k budget, under the 15k default
  assert.ok(midContent.length < DEFAULT_EXTRACT_CHAR_LIMIT);
  t.mock.method(globalThis, "fetch", async () => {
    return new Response(JSON.stringify({ results: [{ url: "https://example.com", raw_content: midContent }] }), { status: 200 });
  });
  const result = await extractPlus(["https://example.com"], "tavily", "markdown", false, false, false, { tavilyApiKey: "k", extractCharLimit: 2000 });
  const item = result.results[0];
  assert.equal((item as any).truncated, true);
  assert.ok(item.content.length < midContent.length);
  assert.match(item.content, /Content truncated/);

  const untouched = await extractPlus(["https://example.com"], "tavily", "markdown", false, false, false, { tavilyApiKey: "k" });
  assert.equal((untouched.results[0] as any).truncated, undefined);
  assert.equal(untouched.results[0].content, midContent);
});
