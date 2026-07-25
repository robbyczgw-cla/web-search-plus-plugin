import test from "node:test";
import assert from "node:assert/strict";
import {
  QueryAnalyzer,
  buildCacheKey,
  chooseTieWinner,
  deduplicateResultsAcrossProviders,
  register,
  searchBrave,
  __resetRuntimeStateForTests,
} from "../index.ts";
import { __resetRoutingPreferencesForTests } from "../routing-config.ts";

type MockFetchCall = { url: string; init?: RequestInit };

function clearPluginCache() {
  __resetRuntimeStateForTests();
  __resetRoutingPreferencesForTests();
}

function parseJsonBody(body: RequestInit["body"]) {
  if (typeof body !== "string") return null;
  return JSON.parse(body);
}

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
  fn: (calls: MockFetchCall[]) => Promise<void>,
) {
  const originalFetch = globalThis.fetch;
  const calls: MockFetchCall[] = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const href = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
    calls.push({ url: href, init });
    return responder(href, init);
  }) as typeof fetch;
  try {
    await fn(calls);
  } finally {
    globalThis.fetch = originalFetch;
    clearPluginCache();
  }
}

test("QueryAnalyzer routes research-heavy queries to tavily", () => {
  const analyzer = new QueryAnalyzer();
  const route = analyzer.route("Explain the history, evidence, and implications of CRISPR gene editing", ["tavily", "serper", "linkup"]);
  assert.equal(route.provider, "tavily");
  assert.ok(route.scores.tavily > route.scores.serper);
  assert.ok(route.top_signals.length > 0);
});

test("chooseTieWinner is deterministic for the same query and distributes across ties", () => {
  const winners = ["serper", "you"] as const;
  const priority = ["tavily", "linkup", "querit", "exa", "firecrawl", "brave", "serper", "you", "searxng"];

  const first = chooseTieWinner("plain ambiguous query", [...winners], [...priority]);
  for (let i = 0; i < 20; i += 1) {
    assert.equal(chooseTieWinner("plain ambiguous query", [...winners], [...priority]), first);
  }

  const picks = new Set<string>();
  for (let i = 0; i < 200; i += 1) {
    picks.add(chooseTieWinner(`plain ambiguous query ${i}`, [...winners], [...priority]));
  }
  assert.deepEqual([...picks].sort(), ["serper", "you"]);
});

test("QueryAnalyzer route uses deterministic Brave/Serper tie-breaking for neutral queries", () => {
  const analyzer = new QueryAnalyzer();
  const first = analyzer.route("utterly neutral words", ["brave", "serper", "you"]);
  const second = analyzer.route("utterly neutral words", ["brave", "serper", "you"]);
  assert.equal(first.provider, second.provider);
  assert.ok(["brave", "serper"].includes(first.provider));
  assert.equal(first.reason, "no_signals_matched");
});

test("buildCacheKey is stable across param key order and changes for nested value changes", () => {
  const first = buildCacheKey("cache me", "serper", 5, {
    include_domains: ["example.com"],
    filters: { b: 2, a: 1 },
    time_range: "week",
  });
  const second = buildCacheKey("cache me", "serper", 5, {
    time_range: "week",
    filters: { a: 1, b: 2 },
    include_domains: ["example.com"],
  });
  const changed = buildCacheKey("cache me", "serper", 5, {
    time_range: "week",
    filters: { a: 1, b: 3 },
    include_domains: ["example.com"],
  });

  assert.equal(first, second);
  assert.notEqual(first, changed);
});

test("deduplicateResultsAcrossProviders keeps first result, normalizes URLs, and counts duplicates", () => {
  const deduped = deduplicateResultsAcrossProviders([
    ["serper", { provider: "serper", query: "q", results: [{ title: "One", url: "https://www.example.com/path/", snippet: "a" }] }],
    ["tavily", {
      provider: "tavily",
      query: "q",
      results: [
        { title: "Duplicate", url: "https://example.com/path", snippet: "b" },
        { title: "Two", url: "https://example.com/other", snippet: "c" },
      ],
    }],
  ], 5);

  assert.equal(deduped.dedupCount, 1);
  assert.equal(deduped.results.length, 2);
  assert.equal(deduped.results[0].provider, "serper");
  assert.equal(deduped.results[1].provider, "tavily");
});

test("searchBrave parses Brave web results and request params", async () => {
  await withMockedFetch(
    () => mockJsonResponse({
      web: {
        results: [{
          title: "Brave Result",
          url: "https://example.com/brave",
          description: "Primary snippet",
          extra_snippets: ["Extra one", "Extra two"],
          age: "2 days ago",
        }],
      },
      infobox: { description: "Brave infobox answer" },
      mixed: { type: "web" },
    }),
    async (calls) => {
      const result = await searchBrave("weather in vienna today", "brave-test", 3, {
        country: "at",
        search_lang: "de",
        safesearch: "off",
        time_range: "week",
      });

      assert.equal(result.provider, "brave");
      assert.equal(result.answer, "Brave infobox answer");
      assert.equal(result.results[0].snippet, "Primary snippet ... Extra one ... Extra two");
      assert.equal(result.results[0].age, "2 days ago");
      assert.match(calls[0].url, /country=AT/);
      assert.match(calls[0].url, /search_lang=de/);
      assert.match(calls[0].url, /safesearch=off/);
      assert.match(calls[0].url, /freshness=pw/);
      assert.equal((calls[0].init?.headers as Record<string, string>)["X-Subscription-Token"], "brave-test");
    },
  );
});

test("registered web_search_plus supports explicit provider=brave", async () => {
  await withMockedFetch(
    () => mockJsonResponse({
      web: { results: [{ title: "Brave explicit", url: "https://example.com/brave-explicit", description: "Found via Brave" }] },
    }),
    async (calls) => {
      const registered = new Map<string, any>();
      register({
        registerTool(tool: any) { registered.set(tool.name, tool); },
        pluginConfig: { braveApiKey: "brave-test" },
      });

      const tool = registered.get("web_search_plus");
      assert.ok(tool.parameters.properties.provider.enum.includes("brave"));

      const response = await tool.execute("tool-brave", {
        query: "brave explicit provider query",
        provider: "brave",
        count: 3,
      });
      const payload = JSON.parse(response.content[0].text);

      assert.equal(payload.provider, "brave");
      assert.equal(payload.routing.provider, "brave");
      assert.equal(payload.results[0].title, "Brave explicit");
      assert.match(calls[0].url, /api\.search\.brave\.com/);
    },
  );
});

test("registered web_search_plus excludes answer-style providers from the source-only schema", async () => {
  const registered = new Map<string, any>();
  register({
    registerTool(tool: any) { registered.set(tool.name, tool); },
    pluginConfig: {},
  });

  const providers = registered.get("web_search_plus").parameters.properties.provider.enum;
  assert.equal(providers.includes("perplexity"), false);
  assert.equal(providers.includes("kilo-perplexity"), false);
  assert.equal(providers.includes("kilo_perplexity"), false);
});

test("QueryAnalyzer auto routing deterministically picks brave or serper for generic current query", () => {
  const analyzer = new QueryAnalyzer();
  const first = analyzer.route("weather in vienna today", ["brave", "serper"]);
  const second = analyzer.route("weather in vienna today", ["brave", "serper"]);
  assert.equal(first.provider, second.provider);
  assert.ok(["brave", "serper"].includes(first.provider));
});

test("registered web_search_plus keeps explicit provider mode strict when the provider fails", async () => {
  await withMockedFetch(
    (url) => {
      if (url.includes("firecrawl.dev")) {
        return mockJsonResponse({ success: false, error: "primary provider failed" });
      }
      if (url.includes("serper.dev")) {
        return mockJsonResponse({
          organic: [{ title: "Fallback result", link: "https://example.com/fallback", snippet: "Recovered via fallback" }],
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
    async (calls) => {
      const registered = new Map<string, any>();
      register({
        registerTool(tool: any) { registered.set(tool.name, tool); },
        pluginConfig: { firecrawlApiKey: "fc-test", serperApiKey: "serper-test" },
      });

      const response = await registered.get("web_search_plus").execute("tool-1", {
        query: "fallback regression query",
        provider: "firecrawl",
        count: 3,
      });
      const payload = JSON.parse(response.content[0].text);

      assert.equal(payload.error, "All providers failed");
      assert.equal(payload.routing.provider, "firecrawl");
      assert.equal(payload.routing.fixed_provider_mode, true);
      assert.equal(calls.length, 1);
      assert.match(calls[0].url, /firecrawl/);
      assert.equal(calls.some((call) => /serper/.test(call.url)), false);
    },
  );
});

test("registered web_search_plus still falls back in auto mode using routing preferences", async () => {
  await withMockedFetch(
    (url) => {
      if (url.includes("firecrawl.dev")) {
        return mockJsonResponse({ success: false, error: "primary provider failed" });
      }
      if (url.includes("api.search.brave.com")) {
        return mockJsonResponse({
          web: { results: [{ title: "Brave fallback", url: "https://example.com/brave-fallback", description: "Recovered via Brave" }] },
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
    async (calls) => {
      const routingConfigPath = "search-test-routing-fallback";
      const registered = new Map<string, any>();
      register({
        registerTool(tool: any) { registered.set(tool.name, tool); },
        pluginConfig: { firecrawlApiKey: "fc-test", braveApiKey: "brave-test", routingConfigPath },
      });

      await registered.get("web_routing_config_plus").execute("cfg-1", {
        action: "set_default_provider",
        provider: "firecrawl",
      });
      await registered.get("web_routing_config_plus").execute("cfg-2", {
        action: "set_confidence_threshold",
        confidence_threshold: 1,
      });
      await registered.get("web_routing_config_plus").execute("cfg-3", {
        action: "set_fallback_provider",
        provider: "brave",
      });

      const response = await registered.get("web_search_plus").execute("tool-2", {
        query: "fallback to brave query",
        provider: "auto",
        count: 3,
      });
      const payload = JSON.parse(response.content[0].text);

      assert.equal(payload.provider, "brave");
      assert.equal(payload.routing.fallback_used, true);
      assert.equal(payload.routing.original_provider, "firecrawl");
      assert.equal(payload.routing.provider, "brave");
      assert.equal(payload.results[0].title, "Brave fallback");
      assert.ok(calls.some((call) => /api\.search\.brave\.com/.test(call.url)));
    },
  );
});
