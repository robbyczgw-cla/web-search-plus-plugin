import test from "node:test";
import assert from "node:assert/strict";
import {
  PROVIDER_SEARCH_TYPES,
  normalizeSearchType,
  register,
  searchTypeMetadata,
  __resetRuntimeStateForTests,
} from "../index.ts";
import {
  PARALLEL_MAX_CHARS_PER_RESULT,
  PARALLEL_MAX_CHARS_TOTAL,
  extractPlus,
  extractSerper,
} from "../extract.ts";
import {
  detectLocationCountry,
  inferQueryLanguage,
  providerSupportsLocale,
  resolveLocale,
} from "../search-locale.ts";
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

test("normalizeSearchType accepts search|news and rejects junk", () => {
  assert.equal(normalizeSearchType(" News "), "news");
  assert.equal(normalizeSearchType(null), null);
  assert.throws(() => normalizeSearchType("videos"), /Invalid search_type value/);
  assert.deepEqual(PROVIDER_SEARCH_TYPES.serper, { search: "search", news: "news" });
});

test("serper serves the news vertical natively and parses the news field", async (t) => {
  const calls: Array<{ url: string; body: any }> = [];
  t.mock.method(globalThis, "fetch", async (url: any, init: any) => {
    calls.push({ url: String(url), body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify({
      news: [
        { title: "Headline", link: "https://news.example/a", snippet: "s", date: "1 hour ago", source: "News Example", imageUrl: "https://news.example/thumb.jpg", position: 1 },
      ],
    }), { status: 200 });
  });
  const tool = searchTool({ serperApiKey: "k" });
  const payload = JSON.parse((await tool.execute("id", { query: "breaking", provider: "serper", search_type: "news", freshness: "day" })).content[0].text);
  assert.equal(calls[0].url, "https://google.serper.dev/news");
  assert.equal(calls[0].body.tbs, "qdr:d");
  assert.equal(payload.results.length, 1);
  assert.equal(payload.results[0].source, "News Example");
  assert.equal(payload.results[0].thumbnail, "https://news.example/thumb.jpg");
  assert.equal(payload.results[0].position, 1);
  assert.deepEqual(payload.metadata.search_type, { requested: "news", applied: true, provider: "serper", native_value: "news" });
});

test("search_type=news on a non-serper provider reports applied=false", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    return new Response(JSON.stringify({ results: [{ title: "t", url: "https://example.com/a", content: "c" }] }), { status: 200 });
  });
  const tool = searchTool({ tavilyApiKey: "k" });
  const payload = JSON.parse((await tool.execute("id", { query: "q", provider: "tavily", search_type: "news" })).content[0].text);
  assert.equal(payload.results.length, 1);
  assert.equal(payload.metadata.search_type.applied, false);
  assert.deepEqual(searchTypeMetadata("tavily", "news").applied, false);
});

test("extractSerper posts to the scraper per URL with per-URL errors", async (t) => {
  let call = 0;
  t.mock.method(globalThis, "fetch", async (url: any, init: any) => {
    call += 1;
    assert.equal(String(url), "https://scrape.serper.dev");
    assert.equal((init.headers as any)["X-API-KEY"], "k");
    const body = JSON.parse(String(init.body));
    assert.equal(body.includeMarkdown, true);
    if (call === 1) {
      return new Response(JSON.stringify({ text: "plain", markdown: "# md", metadata: { title: "Page" }, credits: 1 }), { status: 200 });
    }
    return new Response(JSON.stringify({ message: "nope" }), { status: 400 });
  });
  const result = await extractSerper(["https://a.example", "https://b.example"], "k");
  assert.equal(result.results[0].content, "# md");
  assert.equal(result.results[0].title, "Page");
  assert.ok(result.results[1].error);
});

test("serper joins auto extraction as the last-resort fallback", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: any) => {
    if (String(url) === "https://scrape.serper.dev") {
      return new Response(JSON.stringify({ text: "scraped" }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: "down" }), { status: 500 });
  });
  const result = await extractPlus(["https://example.com"], "auto", "markdown", false, false, false, { tavilyApiKey: "t", serperApiKey: "k" });
  assert.equal(result.provider, "serper");
  assert.equal(result.results[0].content, "scraped");
});

test("language inference is conservative and single-winner", () => {
  assert.equal(inferQueryLanguage("Wiener Kaffeehaus Öffnungszeiten heute"), "de");
  assert.equal(inferQueryLanguage("mejores restaurantes cerca de la playa"), "es");
  assert.equal(inferQueryLanguage("PostgreSQL 17 release notes"), null);
  assert.equal(inferQueryLanguage("DAC R2R NOS"), null);
  assert.equal(inferQueryLanguage(""), null);
});

test("location hints resolve only when unambiguous", () => {
  assert.equal(detectLocationCountry("mejores restaurantes Madrid"), "es");
  assert.equal(detectLocationCountry("beste Restaurants in Graz"), "at");
  assert.equal(detectLocationCountry("Paris vs Madrid city break"), null);
  assert.equal(detectLocationCountry("generic query"), null);
});

test("resolveLocale follows hint > config > fallback for country and config/auto for language", () => {
  const defaults = resolveLocale("serper", {}, "plain query");
  assert.deepEqual([defaults.country, defaults.language], ["us", "en"]);
  assert.deepEqual(defaults.metadata.source, { country: "fallback", language: "fallback" });

  const configured = resolveLocale("serper", { localeCountry: "AT", localeLanguage: "de" }, "plain query");
  assert.deepEqual([configured.country, configured.language], ["at", "de"]);
  assert.deepEqual(configured.metadata.source, { country: "config", language: "config" });

  const hinted = resolveLocale("serper", { localeCountry: "at", localeLanguage: "auto" }, "mejores restaurantes Madrid");
  assert.equal(hinted.country, "es");
  assert.equal(hinted.metadata.source.country, "hint");
  assert.equal(hinted.language, "es");
  assert.equal(hinted.metadata.source.language, "inferred");

  // Query language never implies a country.
  const german = resolveLocale("serper", { localeLanguage: "auto" }, "beste günstige Kopfhörer heute");
  assert.equal(german.language, "de");
  assert.equal(german.country, "us");
});

test("locale flows into serper request params and result metadata", async (t) => {
  const bodies: any[] = [];
  t.mock.method(globalThis, "fetch", async (_url: any, init: any) => {
    bodies.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify({ organic: [{ title: "t", link: "https://example.com/a", snippet: "s" }] }), { status: 200 });
  });
  const tool = searchTool({ serperApiKey: "k", localeCountry: "at", localeLanguage: "auto" });
  const payload = JSON.parse((await tool.execute("id", { query: "beste vegane Restaurants heute", provider: "serper" })).content[0].text);
  assert.equal(bodies[0].gl, "at");
  assert.equal(bodies[0].hl, "de");
  assert.equal(payload.metadata.locale.country, "at");
  assert.equal(payload.metadata.locale.language, "de");
  assert.deepEqual(payload.metadata.locale.source, { country: "config", language: "inferred" });
});

test("without locale config providers keep exact us/en defaults", async (t) => {
  const bodies: any[] = [];
  t.mock.method(globalThis, "fetch", async (_url: any, init: any) => {
    bodies.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify({ organic: [{ title: "t", link: "https://example.com/a", snippet: "s" }] }), { status: 200 });
  });
  const tool = searchTool({ serperApiKey: "k" });
  await tool.execute("id", { query: "plain technical query", provider: "serper" });
  assert.equal(bodies[0].gl, "us");
  assert.equal(bodies[0].hl, "en");
  assert.equal(providerSupportsLocale("tavily"), false);
  assert.equal(providerSupportsLocale("serper"), true);
});

test("parallel extraction uses the raised full_content budgets with config overrides", async (t) => {
  const bodies: any[] = [];
  t.mock.method(globalThis, "fetch", async (_url: any, init: any) => {
    bodies.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify({ results: [{ url: "https://example.com", title: "T", excerpts: ["content"] }] }), { status: 200 });
  });
  assert.equal(PARALLEL_MAX_CHARS_PER_RESULT, 60000);
  assert.equal(PARALLEL_MAX_CHARS_TOTAL, 120000);

  await extractPlus(["https://example.com"], "parallel", "markdown", false, false, false, { parallelApiKey: "p" });
  assert.equal(bodies[0].max_chars_total, 120000);
  assert.equal(bodies[0].advanced_settings.full_content.max_chars_per_result, 60000);

  await extractPlus(["https://example.com"], "parallel", "markdown", false, false, false, { parallelApiKey: "p", parallelMaxCharsPerResult: 6000, parallelMaxCharsTotal: 20000 });
  assert.equal(bodies[1].max_chars_total, 20000);
  assert.equal(bodies[1].advanced_settings.full_content.max_chars_per_result, 6000);
});
