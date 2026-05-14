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
  const priority = ["tavily", "linkup", "querit", "exa", "firecrawl", "perplexity", "brave", "serper", "you", "searxng"];

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

test("registered web_search_plus uses direct Perplexity API for provider=perplexity", async () => {
  await withMockedFetch(
    () => mockJsonResponse({
      choices: [{ message: { content: "Direct answer with https://example.com/direct" } }],
      citations: ["https://example.com/direct"],
      usage: { total_tokens: 42 },
    }),
    async (calls) => {
      const registered = new Map<string, any>();
      register({
        registerTool(tool: any) { registered.set(tool.name, tool); },
        pluginConfig: { perplexityApiKey: "perplexity-test" },
      });

      const tool = registered.get("web_search_plus");
      assert.ok(tool.parameters.properties.provider.enum.includes("perplexity"));

      const response = await tool.execute("tool-perplexity", {
        query: "direct perplexity query",
        provider: "perplexity",
        count: 3,
      });
      const payload = JSON.parse(response.content[0].text);
      const requestBody = parseJsonBody(calls[0].init?.body);

      assert.equal(payload.provider, "perplexity");
      assert.equal(payload.routing.provider, "perplexity");
      assert.equal(calls[0].url, "https://api.perplexity.ai/chat/completions");
      assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, "Bearer perplexity-test");
      assert.equal(requestBody.model, "sonar-pro");
      assert.equal(payload.metadata.model, "sonar-pro");
    },
  );
});

test("registered web_search_plus uses Kilo gateway for provider=kilo-perplexity", async () => {
  await withMockedFetch(
    () => mockJsonResponse({
      choices: [{ message: { content: "Gateway answer with https://example.com/gateway" } }],
      citations: ["https://example.com/gateway"],
      usage: { total_tokens: 84 },
    }),
    async (calls) => {
      const registered = new Map<string, any>();
      register({
        registerTool(tool: any) { registered.set(tool.name, tool); },
        pluginConfig: { kilocodeApiKey: "kilo-test" },
      });

      const tool = registered.get("web_search_plus");
      assert.ok(tool.parameters.properties.provider.enum.includes("kilo-perplexity"));
      assert.ok(tool.parameters.properties.provider.enum.includes("kilo_perplexity"));

      const response = await tool.execute("tool-kilo", {
        query: "gateway perplexity query",
        provider: "kilo-perplexity",
        count: 3,
      });
      const payload = JSON.parse(response.content[0].text);
      const requestBody = parseJsonBody(calls[0].init?.body);

      assert.equal(payload.provider, "kilo-perplexity");
      assert.equal(payload.routing.provider, "kilo-perplexity");
      assert.equal(calls[0].url, "https://api.kilo.ai/api/gateway/chat/completions");
      assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, "Bearer kilo-test");
      assert.equal(requestBody.model, "perplexity/sonar-pro");
      assert.equal(payload.metadata.model, "perplexity/sonar-pro");
    },
  );
});

test("registered web_search_plus normalizes provider=kilo_perplexity to kilo-perplexity", async () => {
  await withMockedFetch(
    () => mockJsonResponse({
      choices: [{ message: { content: "Alias answer with https://example.com/alias" } }],
      citations: ["https://example.com/alias"],
    }),
    async () => {
      const registered = new Map<string, any>();
      register({
        registerTool(tool: any) { registered.set(tool.name, tool); },
        pluginConfig: { kilocodeApiKey: "kilo-test" },
      });

      const response = await registered.get("web_search_plus").execute("tool-kilo-alias", {
        query: "kilo alias query",
        provider: "kilo_perplexity",
        count: 3,
      });
      const payload = JSON.parse(response.content[0].text);

      assert.equal(payload.provider, "kilo-perplexity");
      assert.equal(payload.routing.provider, "kilo-perplexity");
    },
  );
});

test("registered web_search_plus does not alias kilo-perplexity to direct perplexity", async () => {
  await withMockedFetch(
    (url) => {
      if (url === "https://api.kilo.ai/api/gateway/chat/completions") {
        return mockJsonResponse({
          choices: [{ message: { content: "Kilo result https://example.com/kilo-only" } }],
          citations: ["https://example.com/kilo-only"],
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
    async (calls) => {
      const registered = new Map<string, any>();
      register({
        registerTool(tool: any) { registered.set(tool.name, tool); },
        pluginConfig: { kilocodeApiKey: "kilo-only-test" },
      });

      const response = await registered.get("web_search_plus").execute("tool-kilo-only", {
        query: "kilo only query",
        provider: "kilo-perplexity",
        count: 3,
      });
      const payload = JSON.parse(response.content[0].text);

      assert.equal(payload.provider, "kilo-perplexity");
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, "https://api.kilo.ai/api/gateway/chat/completions");
    },
  );
});

test("registered web_search_plus reports the correct env var for missing Perplexity credentials", async () => {
  const registered = new Map<string, any>();
  register({
    registerTool(tool: any) { registered.set(tool.name, tool); },
    pluginConfig: {},
  });

  const response = await registered.get("web_search_plus").execute("tool-perplexity-missing", {
    query: "missing direct perplexity key",
    provider: "perplexity",
    count: 3,
  });

  assert.match(response.content[0].text, /PERPLEXITY_API_KEY/);
  assert.doesNotMatch(response.content[0].text, /KILOCODE_API_KEY/);
});

test("registered web_search_plus reports the correct env var for missing Kilo credentials", async () => {
  const registered = new Map<string, any>();
  register({
    registerTool(tool: any) { registered.set(tool.name, tool); },
    pluginConfig: {},
  });

  const response = await registered.get("web_search_plus").execute("tool-kilo-missing", {
    query: "missing kilo key",
    provider: "kilo-perplexity",
    count: 3,
  });

  assert.match(response.content[0].text, /KILOCODE_API_KEY/);
  assert.doesNotMatch(response.content[0].text, /PERPLEXITY_API_KEY/);
});

test("QueryAnalyzer auto routing deterministically picks brave or serper for generic current query", () => {
  const analyzer = new QueryAnalyzer();
  const first = analyzer.route("weather in vienna today", ["brave", "serper", "perplexity"]);
  const second = analyzer.route("weather in vienna today", ["brave", "serper", "perplexity"]);
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

test("registered web_answer_plus is gated and defaults freshness to none", async () => {
  await withMockedFetch(
    (url) => {
      if (url.includes("serper.dev")) {
        return mockJsonResponse({
          organic: [
            { title: "Alpha", link: "https://example.com/a", snippet: "Alpha snippet" },
            { title: "Beta", link: "https://example.com/b", snippet: "Beta snippet" },
          ],
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
    async () => {
      const disabled = new Map<string, any>();
      register({
        registerTool(tool: any) { disabled.set(tool.name, tool); },
        pluginConfig: { serperApiKey: "serper-test" },
      });
      assert.equal(disabled.get("web_answer_plus").checkFn(), false);

      const registered = new Map<string, any>();
      register({
        registerTool(tool: any) { registered.set(tool.name, tool); },
        pluginConfig: { serperApiKey: "serper-test", enableWebAnswer: true },
      });

      const tool = registered.get("web_answer_plus");
      assert.ok(tool);
      assert.equal(tool.checkFn(), true);

      const response = await tool.execute("tool-answer-default", {
        query: "summarize this topic",
        output: "json",
      });
      const payload = JSON.parse(response.content[0].text);

      assert.equal(payload.beta, true);
      assert.equal(payload.freshness.requested, "none");
      assert.equal(payload.freshness.applied, "none");
      assert.equal(payload.extraction.snippet_only, true);
      assert.match(payload.warnings[0], /snippet/i);
    },
  );
});

test("registered web_answer_plus caps extraction and uses Linkup when configured", async () => {
  await withMockedFetch(
    (url, init) => {
      if (url.includes("serper.dev")) {
        return mockJsonResponse({
          organic: Array.from({ length: 6 }, (_, i) => ({
            title: `Result ${i + 1}`,
            link: `https://docs.example.com/page-${i + 1}`,
            snippet: `Snippet ${i + 1}`,
          })),
        });
      }
      if (url.includes("api.linkup.so/v1/fetch")) {
        const body = JSON.parse(String(init?.body || "{}"));
        return mockJsonResponse({
          markdown: `Fetched content for ${body.url}`,
          metadata: { title: `Fetched ${body.url}` },
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
    async (calls) => {
      const registered = new Map<string, any>();
      register({
        registerTool(tool: any) { registered.set(tool.name, tool); },
        pluginConfig: { serperApiKey: "serper-test", linkupApiKey: "linkup-test", enableWebAnswer: true },
      });

      const response = await registered.get("web_answer_plus").execute("tool-answer-cap", {
        query: "write a cited synthesis",
        output: "json",
        sources: 6,
        max_extracts: 99,
      });
      const payload = JSON.parse(response.content[0].text);

      assert.equal(payload.extraction.provider, "linkup");
      assert.equal(payload.extraction.requested_urls.length, 5);
      assert.equal(payload.cost_estimate.extract_cap, 5);
      assert.equal(payload.extraction.successful, 5);
      assert.ok(payload.sources.slice(0, 5).every((item: any) => item.extracted_status === "extracted"));
      assert.ok(payload.warnings.some((item: string) => /capped at 5/.test(item)));
      assert.equal(calls.filter((call) => call.url.includes("api.linkup.so/v1/fetch")).length, 5);
    },
  );
});
