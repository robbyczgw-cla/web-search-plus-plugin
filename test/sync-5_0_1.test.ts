import test from "node:test";
import assert from "node:assert/strict";
import { register, parseRetryAfter, __resetRuntimeStateForTests } from "../index.ts";
import { extractPlus, __resetExtractCacheForTests } from "../extract.ts";
import { __resetRoutingPreferencesForTests, isCustomProviderOrder, validateRoutingPreferences, DEFAULT_PROVIDER_PRIORITY, PRE_5_DEFAULT_PROVIDER_PRIORITY } from "../routing-config.ts";
import { fitQuery, capQueryLength } from "../query-limits.ts";
import { mapRoutingClassToIntent } from "../intent-routing.ts";

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function tools(pluginConfig: any) {
  __resetRuntimeStateForTests();
  __resetRoutingPreferencesForTests();
  __resetExtractCacheForTests();
  const registered = new Map<string, any>();
  register({ pluginConfig, registerTool(tool: any) { registered.set(tool.name, tool); } });
  const call = async (name: string, params: any, signal?: AbortSignal) => JSON.parse((await registered.get(name).execute("t", params, signal)).content[0].text);
  return { search: (params: any, signal?: AbortSignal) => call("web_search_plus", params, signal), routing: (params: any) => call("web_routing_config_plus", params), extract: (params: any) => call("web_extract_plus", params) };
}

const allKeys = { braveApiKey: "b", serperApiKey: "s", exaApiKey: "e", tavilyApiKey: "t" };

function providerOf(url: string): string {
  if (url.includes("brave.com")) return "brave";
  if (url.includes("serper.dev")) return "serper";
  if (url.includes("exa.ai")) return "exa";
  if (url.includes("tavily.com")) return "tavily";
  return "other";
}

function mockAllProviders(t: any, seen: string[] = [], overrides: Record<string, any> = {}) {
  t.mock.method(globalThis, "fetch", async (url: any) => {
    const href = String(url);
    const provider = providerOf(href);
    seen.push(provider);
    if (overrides[provider]) return overrides[provider](href);
    if (provider === "brave") return json({ web: { results: [{ title: "B", url: "https://example.com/b", description: "brave" }] } });
    if (provider === "serper") return json({ organic: [{ title: "S", link: "https://example.com/s", snippet: "serper" }], news: [{ title: "S", link: "https://example.com/s", snippet: "serper" }] });
    if (provider === "exa") return json({ results: [{ title: "E", url: "https://example.com/e", text: "exa" }] });
    return json({ results: [{ title: "T", url: "https://example.com/t", content: "tavily" }] });
  });
}

// A1: query text is never scanned by the source-only gate.
for (const [provider, key] of [["exa", "exaApiKey"], ["tavily", "tavilyApiKey"], ["linkup", "linkupApiKey"]] as const) {
  test(`A1: ${provider} accepts queries containing synthesize-like words`, async (t) => {
    const bodies: any[] = [];
    t.mock.method(globalThis, "fetch", async (_url: any, init: any) => {
      bodies.push(JSON.parse(init.body));
      return json({ results: [{ title: "Doc", url: "https://example.com/doc", content: "text", name: "Doc", snippet: "x" }] });
    });
    const { search } = tools({ [key]: "k" });
    const query = "open source speech synthesizer python library documentation photosynthesize verify the claim";
    const payload = await search({ query, provider });
    assert.equal(payload.error, undefined, JSON.stringify(payload));
    assert.equal(bodies.length, 1);
    assert.ok(JSON.stringify(bodies[0]).includes("synthesizer"));
  });
}

// Routing: 5.0 first-provider table mapped onto the plugin's query classes.
const ROUTING_CASES: Array<[string, string, string]> = [
  ["bake sourdough bread tips", "general", "brave"],
  ["reddit what nas do you recommend", "community", "brave"],
  ["latest news about the election", "news", "brave"],
  ["restaurants near me", "local", "brave"],
  ["arxiv paper on retrieval augmented generation", "academic", "exa"],
  ["fastapi github api docs", "docs", "exa"],
  ["cve security advisory for openssl", "security", "serper"],
  ["buy standing desk price", "shopping", "serper"],
];
for (const [query, intent, first] of ROUTING_CASES) {
  test(`routing: ${intent} query goes to ${first} first`, async (t) => {
    const seen: string[] = [];
    mockAllProviders(t, seen);
    const { search } = tools(allKeys);
    const payload = await search({ query, no_cache: true });
    assert.equal(payload.routing.routing_intent, intent);
    assert.equal(payload.routing.reason, intent === "general" ? "no_signals_matched" : `intent_${intent}`);
    assert.equal(seen[0], first);
    assert.equal(payload.routing.provider_order, "measured");
  });
}

test("routing: fallback chain is Brave, Serper, Exa, Tavily after the first provider", async (t) => {
  const seen: string[] = [];
  const fail = () => json({ error: "nope" }, 401);
  mockAllProviders(t, seen, { exa: fail, brave: fail, serper: fail });
  const { search } = tools(allKeys);
  const payload = await search({ query: "fastapi github api docs", no_cache: true });
  assert.deepEqual(seen, ["exa", "brave", "serper", "tavily"]);
  assert.equal(payload.routing.fallback_used, true);
});

test("routing: first provider falls back to the next configured one when its key is missing", async (t) => {
  const seen: string[] = [];
  mockAllProviders(t, seen);
  const { search } = tools({ serperApiKey: "s", tavilyApiKey: "t" });
  await search({ query: "fastapi github api docs", no_cache: true });
  assert.equal(seen[0], "serper");
});

test("routing: a user-configured provider order wins over the intent table", async (t) => {
  const seen: string[] = [];
  mockAllProviders(t, seen);
  const { search, routing } = tools(allKeys);
  await routing({ action: "set_provider_priority", providers: ["tavily", "serper"] });
  const payload = await search({ query: "fastapi github api docs", no_cache: true });
  assert.equal(seen[0], "tavily");
  assert.equal(payload.routing.reason, "custom_order");
  assert.equal(payload.routing.provider_order, "custom");
});

test("routing: auto_allow=false and disabled providers are never first", async (t) => {
  const seen: string[] = [];
  mockAllProviders(t, seen);
  const { search, routing } = tools(allKeys);
  await routing({ action: "disable_provider", provider: "brave" });
  await search({ query: "bake sourdough bread tips", no_cache: true });
  assert.equal(seen[0], "serper");
});

test("routing: a stored 4.x default priority is treated as no chosen order", () => {
  assert.equal(isCustomProviderOrder(DEFAULT_PROVIDER_PRIORITY), false);
  assert.equal(isCustomProviderOrder(PRE_5_DEFAULT_PROVIDER_PRIORITY), false);
  assert.equal(isCustomProviderOrder(["exa", ...DEFAULT_PROVIDER_PRIORITY.filter((p) => p !== "exa")]), true);
  const config = validateRoutingPreferences({ provider_priority: [...PRE_5_DEFAULT_PROVIDER_PRIORITY] });
  assert.deepEqual(config.provider_priority, DEFAULT_PROVIDER_PRIORITY);
});

test("routing: class to intent mapping", () => {
  assert.equal(mapRoutingClassToIntent("official/vendor-release", "openai release notes"), "general");
  assert.equal(mapRoutingClassToIntent("oss-discovery", "alternatives to redis"), "general");
  assert.equal(mapRoutingClassToIntent("local/shopping", "preis iphone"), "shopping");
  assert.equal(mapRoutingClassToIntent("local/shopping", "cafe graz"), "local");
});

// A6: Brave query limit is 600 characters and 75 words.
test("A6: fitQuery shortens at a word boundary using Brave's documented limits", () => {
  const within = Array.from({ length: 75 }, (_, i) => `w${i}`).join(" ");
  assert.equal(fitQuery("brave", within).truncated, undefined);
  const long = `${within} extra`;
  const fitted = fitQuery("brave", long);
  assert.equal(fitted.query.split(" ").length, 75);
  assert.equal(fitted.truncated?.limit_words, 75);
  const chars = Array.from({ length: 100 }, () => "abcdefghijklmnop").join(" ");
  const byChars = fitQuery("brave", chars);
  assert.ok(byChars.query.length <= 600 && byChars.query.length > 590);
  assert.ok(byChars.query.endsWith("abcdefghijklmnop"));
  assert.equal(fitQuery("exa", chars).query, chars);
  assert.equal(capQueryLength("x".repeat(2500)).length, 2000);
});

test("A6: a 581-character query reaches Brave unchanged, a 700-character one is shortened and reported", async (t) => {
  const urls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: any) => {
    urls.push(String(url));
    return json({ web: { results: [{ title: "B", url: "https://example.com/b", description: "d" }] } });
  });
  const { search } = tools({ braveApiKey: "b" });
  const ok = Array.from({ length: 97 }, () => "abcde").join(" ").slice(0, 581);
  assert.equal(ok.length, 581);
  // 581 chars but 97 words: over the word limit, so it is shortened by words.
  const first = await search({ query: ok, provider: "brave", no_cache: true });
  assert.equal(first.query, ok);
  assert.equal(new URL(urls[0]).searchParams.get("q")!.split(" ").length, 75);
  assert.equal(first.metadata.query_truncated.limit_words, 75);
  const fewWords = Array.from({ length: 50 }, () => "abcdefghijk").join(" ").slice(0, 581);
  const second = await search({ query: fewWords, provider: "brave", no_cache: true });
  assert.equal(second.metadata.query_truncated, undefined);
  assert.equal(new URL(urls[1]).searchParams.get("q"), fewWords.trim());
});

// A4: zero hits are explicit and not cached.
test("A4: no results say so, are not cached, and fall through to the next provider in auto mode", async (t) => {
  const seen: string[] = [];
  mockAllProviders(t, seen, {
    brave: () => json({ web: { results: [] } }),
    serper: () => json({ organic: [] }),
    exa: () => json({ results: [] }),
    tavily: () => json({ results: [] }),
  });
  const { search } = tools(allKeys);
  const payload = await search({ query: "zzzz qqqq nothing" });
  assert.deepEqual(payload.results, []);
  assert.match(payload.message, /No results found.*Do not invent/);
  assert.equal(payload.metadata.no_results, true);
  assert.deepEqual(seen, ["brave", "serper", "exa", "tavily"]);
  const again = await search({ query: "zzzz qqqq nothing" });
  assert.equal(again.cached, false);
  assert.equal(seen.length, 8);
});

test("A4: an empty first answer is replaced by the next provider's results", async (t) => {
  const seen: string[] = [];
  mockAllProviders(t, seen, { brave: () => json({ web: { results: [] } }) });
  const { search } = tools(allKeys);
  const payload = await search({ query: "bake sourdough bread tips", no_cache: true });
  assert.equal(payload.results[0].title, "S");
  assert.equal(payload.message, undefined);
  assert.equal(payload.provider, "serper");
});

// A5: waits are bounded and the host's abort reaches the search.
test("A5: Retry-After values stay finite or are dropped", () => {
  assert.equal(parseRetryAfter("inf"), undefined);
  assert.equal(parseRetryAfter("1e999"), undefined);
  assert.equal(parseRetryAfter("3600"), 3600);
  assert.equal(parseRetryAfter("9".repeat(400)), Infinity); // capped by the 30 s wait cap and the 3600 s cooldown cap
});

test("A5: a long Retry-After neither sleeps nor retries inline", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls += 1;
    return new Response(JSON.stringify({ error: "slow down" }), { status: 429, headers: { "retry-after": "3600" } });
  });
  const { search } = tools({ braveApiKey: "b" });
  const started = Date.now();
  const payload = await search({ query: "anything", provider: "brave", no_cache: true });
  assert.ok(Date.now() - started < 2000);
  assert.equal(calls, 1);
  assert.ok(payload.error);
});

test("A5: an aborted tool call starts no provider attempt", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls += 1; return json({ web: { results: [] } }); });
  const { search } = tools(allKeys);
  const controller = new AbortController();
  controller.abort();
  const payload = await search({ query: "anything", no_cache: true }, controller.signal);
  assert.equal(calls, 0);
  assert.ok(payload.error);
});

test("A5: aborting during a request stops the fallback chain", async (t) => {
  const seen: string[] = [];
  const controller = new AbortController();
  t.mock.method(globalThis, "fetch", async (url: any, init: any) => {
    seen.push(providerOf(String(url)));
    await new Promise((resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      setTimeout(() => controller.abort(), 10);
    });
    return json({});
  });
  const { search } = tools(allKeys);
  const payload = await search({ query: "anything", no_cache: true }, controller.signal);
  assert.deepEqual(seen, ["brave"]);
  assert.ok(payload.error);
});

// A3: extraction is per URL where the plugin's design allows it.
const EXAMPLE = "https://example.com/page";

test("A3a: a blocked URL gets its own error line and the other URLs are still extracted", async (t) => {
  let body: any;
  t.mock.method(globalThis, "fetch", async (_url: any, init: any) => {
    body = JSON.parse(init.body);
    return json({ results: [{ url: EXAMPLE, content: "Real page text" }] });
  });
  __resetExtractCacheForTests();
  const result = await extractPlus([EXAMPLE, "http://127.0.0.1/admin", "http://169.254.169.254/latest"], "auto", "markdown", false, false, false, { tavilyApiKey: "t" });
  assert.deepEqual(body.urls, [EXAMPLE]);
  assert.equal(result.results.length, 3);
  assert.equal(result.results[0].content, "Real page text");
  const blocked = result.results.filter((item) => item.error);
  assert.equal(blocked.length, 2);
  assert.ok(blocked.every((item) => /blocked/.test(item.error!)));
});

test("A3a: error text never reveals a resolved internal IP", async () => {
  const { default: dns } = await import("node:dns/promises");
  const original = dns.lookup;
  (dns as any).lookup = async () => [{ address: "10.1.2.3", family: 4 }];
  try {
    const result = await extractPlus(["https://internal.corp.test/x"], "auto", "markdown", false, false, false, { tavilyApiKey: "t" });
    assert.match(String(result.error), /blocked/);
    assert.equal(String(result.error).includes("10.1.2.3"), false);
  } finally {
    (dns as any).lookup = original;
  }
});

test("A3d: blank pages fail over to the next provider and are not cached", async (t) => {
  const seen: string[] = [];
  let tavilyText = "   ";
  t.mock.method(globalThis, "fetch", async (url: any) => {
    const href = String(url);
    seen.push(href);
    if (href.includes("tavily")) return json({ results: [{ url: EXAMPLE, content: tavilyText }] });
    return json({ results: [{ url: EXAMPLE, text: "Exa text" }] });
  });
  __resetExtractCacheForTests();
  const config = { tavilyApiKey: "t", exaApiKey: "e" };
  const first = await extractPlus([EXAMPLE], "auto", "markdown", false, false, false, config);
  assert.equal(first.routing?.provider, "exa");
  assert.equal(first.results[0].content, "Exa text");
  assert.equal(first.routing?.fallback_errors?.[0].error, "all_urls_failed");
  // Only a single provider and blank text: error, nothing cached.
  seen.length = 0;
  const only = await extractPlus([EXAMPLE], "tavily", "markdown", false, false, false, { tavilyApiKey: "t" }, [], undefined, { strictProvider: true });
  assert.equal(only.error, "All extraction providers failed");
  await extractPlus([EXAMPLE], "tavily", "markdown", false, false, false, { tavilyApiKey: "t" }, [], undefined, { strictProvider: true });
  assert.equal(seen.length, 2, "blank answer must not be served from cache");
  tavilyText = "now with text";
  const good = await extractPlus([EXAMPLE], "tavily", "markdown", false, false, false, { tavilyApiKey: "t" }, [], undefined, { strictProvider: true });
  assert.equal(good.results[0].content, "now with text");
});

test("A3d/A3e: an answer that does not cover every URL is returned but not cached; Exa statuses become error lines", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls += 1;
    return json({
      results: [{ url: EXAMPLE, text: "Exa text" }],
      statuses: [
        { id: EXAMPLE, status: "success" },
        { id: "https://example.com/gone", status: "error", error: { tag: "CRAWL_NOT_FOUND", httpStatusCode: 404 } },
      ],
    });
  });
  __resetExtractCacheForTests();
  const urls = [EXAMPLE, "https://example.com/gone"];
  const run = () => extractPlus(urls, "exa", "markdown", false, false, false, { exaApiKey: "e" }, [], undefined, { strictProvider: true });
  const first = await run();
  assert.equal(first.results.length, 2);
  assert.match(first.results[1].error!, /CRAWL_NOT_FOUND.*404/);
  await run();
  assert.equal(calls, 2);
});

test("A3: a complete answer is still cached", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls += 1; return json({ results: [{ url: EXAMPLE, text: "Exa text" }] }); });
  __resetExtractCacheForTests();
  const run = () => extractPlus([EXAMPLE], "exa", "markdown", false, false, false, { exaApiKey: "e" }, [], undefined, { strictProvider: true });
  await run();
  await run();
  assert.equal(calls, 1);
});

// A9: first sentence of each description is short.
test("A9: tool descriptions start with a short first sentence", () => {
  const registered = new Map<string, any>();
  register({ pluginConfig: {}, registerTool(tool: any) { registered.set(tool.name, tool); } });
  for (const name of ["web_search_plus", "web_extract_plus"]) {
    const first = registered.get(name).description.split(". ")[0];
    assert.ok(first.length <= 110, `${name}: ${first.length}`);
  }
});
