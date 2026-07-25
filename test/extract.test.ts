import test from "node:test";
import assert from "node:assert/strict";
import {
  extractFirecrawl,
  extractLinkup,
  extractTavily,
  extractExa,
  extractYou,
  extractPlus,
  hasAnyExtractProviderCredential,
  __resetExtractCacheForTests,
  buildExtractCacheKey,
  readCachedExtractContent,
} from "../extract.ts";
import { register } from "../index.ts";

type MockFetchCall = { url: string; init?: RequestInit };

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
  }
}

function parseBody(call: MockFetchCall) {
  return JSON.parse(String(call.init?.body || "{}"));
}

test("extractFirecrawl parses markdown", async () => {
  await withMockedFetch(
    () => mockJsonResponse({
      success: true,
      data: {
        markdown: "# Example\nFirecrawl content",
        html: "<h1>Example</h1>",
        metadata: { title: "Example Page", sourceURL: "https://example.com" },
      },
    }),
    async (calls) => {
      const result = await extractFirecrawl(["https://example.com"], "fc-test", "markdown");
      assert.equal(result.provider, "firecrawl");
      assert.equal(result.results[0].title, "Example Page");
      assert.equal(result.results[0].content, "# Example\nFirecrawl content");
      assert.equal(result.results[0].raw_content, "# Example\nFirecrawl content");
      assert.equal(calls[0].url, "https://api.firecrawl.dev/v2/scrape");
      assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, "Bearer fc-test");
      assert.deepEqual(parseBody(calls[0]), { url: "https://example.com", formats: ["markdown"] });
    },
  );
});

test("extractLinkup fetches each url", async () => {
  await withMockedFetch(
    () => mockJsonResponse({
      markdown: "# Linkup page\nFetched content",
      rawHtml: "<h1>Linkup page</h1>",
      images: [{ alt: "Logo", url: "https://example.com/logo.png" }],
    }),
    async (calls) => {
      const result = await extractLinkup(["https://example.com"], "linkup-test", "markdown", true, true, true);
      assert.equal(result.provider, "linkup");
      assert.equal(result.results[0].content, "# Linkup page\nFetched content");
      assert.equal(result.results[0].raw_html, "<h1>Linkup page</h1>");
      assert.equal(result.results[0].images?.[0].alt, "Logo");
      assert.equal(calls[0].url, "https://api.linkup.so/v1/fetch");
      assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, "Bearer linkup-test");
      assert.deepEqual(parseBody(calls[0]), {
        url: "https://example.com",
        extractImages: true,
        includeRawHtml: true,
        renderJs: true,
      });
    },
  );
});

test("extractTavily parses raw_content", async () => {
  await withMockedFetch(
    () => mockJsonResponse({
      results: [{ url: "https://example.com", title: "Tavily Page", raw_content: "Tavily extracted content" }],
    }),
    async (calls) => {
      const result = await extractTavily(["https://example.com"], "tvly-test");
      assert.equal(result.provider, "tavily");
      assert.equal(result.results[0].title, "Tavily Page");
      assert.equal(result.results[0].content, "Tavily extracted content");
      assert.equal(calls[0].url, "https://api.tavily.com/extract");
      assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, "Bearer tvly-test");
      assert.deepEqual(parseBody(calls[0]), { urls: ["https://example.com"], include_images: false });
    },
  );
});

test("extractExa parses contents text", async () => {
  await withMockedFetch(
    () => mockJsonResponse({
      results: [{
        title: "Exa Page",
        url: "https://example.com",
        text: "Exa extracted markdown",
        summary: "Short summary",
        highlights: ["Important excerpt"],
        image: "https://example.com/cover.png",
      }],
    }),
    async (calls) => {
      const result = await extractExa(["https://example.com"], "exa-test", "markdown", true);
      assert.equal(result.provider, "exa");
      assert.equal(result.results[0].title, "Exa Page");
      assert.equal(result.results[0].content, "Exa extracted markdown");
      assert.equal(result.results[0].metadata?.summary, "Short summary");
      assert.deepEqual(result.results[0].images, [{ alt: "image", url: "https://example.com/cover.png" }]);
      assert.equal(calls[0].url, "https://api.exa.ai/contents");
      assert.equal((calls[0].init?.headers as Record<string, string>)["x-api-key"], "exa-test");
      assert.deepEqual(parseBody(calls[0]), { urls: ["https://example.com"], text: true });
    },
  );
});

test("extractYou parses contents markdown", async () => {
  await withMockedFetch(
    () => mockJsonResponse([
      {
        url: "https://example.com",
        title: "You Page",
        markdown: "You.com extracted markdown",
        html: "<h1>You Page</h1>",
        metadata: { siteName: "Example" },
      },
    ]),
    async (calls) => {
      const result = await extractYou(["https://example.com"], "you-test", "markdown", false, true);
      assert.equal(result.provider, "you");
      assert.equal(result.results[0].title, "You Page");
      assert.equal(result.results[0].content, "You.com extracted markdown");
      assert.equal(result.results[0].raw_html, "<h1>You Page</h1>");
      assert.deepEqual(result.results[0].metadata, { siteName: "Example" });
      assert.equal(calls[0].url, "https://ydc-index.io/v1/contents");
      assert.equal((calls[0].init?.headers as Record<string, string>)["X-API-Key"], "you-test");
      assert.deepEqual(parseBody(calls[0]), {
        urls: ["https://example.com"],
        formats: ["markdown", "html", "metadata"],
        crawl_timeout: 30,
      });
    },
  );
});

test("extractPlus auto prefers linkup when available (Tavily > Exa > Linkup > Firecrawl order)", async () => {
  await withMockedFetch(
    () => mockJsonResponse({ results: [{ url: "https://example.com", content: "linkup content" }] }),
    async (calls) => {
      const result = await extractPlus(["https://example.com"], "auto", "markdown", false, false, false, {
        firecrawlApiKey: "fc-test",
        linkupApiKey: "linkup-test",
      });
      assert.equal(result.provider, "linkup");
      assert.equal(result.routing?.requested_provider, "auto");
      assert.equal(calls.length, 1);
    },
  );
});

test("extractPlus auto uses exa when only exa is available", async () => {
  await withMockedFetch(
    () => mockJsonResponse({ results: [{ url: "https://example.com", text: "exa content" }] }),
    async (calls) => {
      const result = await extractPlus(["https://example.com"], "auto", "markdown", false, false, false, {
        exaApiKey: "exa-test",
      });
      assert.equal(result.provider, "exa");
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, "https://api.exa.ai/contents");
    },
  );
});

test("extract cache preserves complete response data and uses request-exact identity", async () => {
  __resetExtractCacheForTests();
  const identityA = buildExtractCacheKey({ cache_version: 1, urls: ["https://example.com/a"], budgets: { max: 10 }, controls: { render_js: false } });
  const identityB = buildExtractCacheKey({ controls: { render_js: true }, budgets: { max: 10 }, urls: ["https://example.com/a"], cache_version: 1 });
  assert.notEqual(identityA, identityB);

  await withMockedFetch(
    () => mockJsonResponse({ results: [{ url: "https://example.com/cache", title: "Cached", raw_content: "complete provider content", metadata: { source: "provider" } }] }),
    async (calls) => {
      const config = { tavilyApiKey: "tvly-test", extractCacheMaxEntries: 2 };
      const first = await extractPlus(["https://example.com/cache"], "tavily", "markdown", false, false, false, config);
      const second = await extractPlus(["https://example.com/cache"], "tavily", "markdown", false, false, false, config);
      assert.equal(calls.length, 1);
      assert.deepEqual(second, first);
      assert.equal(second.results[0].content, "complete provider content");
      assert.equal(second.results[0].raw_content, "complete provider content");
      assert.equal(second.results[0].provider, "tavily");
      assert.deepEqual(second.results[0].metadata, { source: "provider" });
    },
  );
});

test("extract full-content references page the cached full text and expire with eviction", async () => {
  __resetExtractCacheForTests();
  await withMockedFetch(
    () => mockJsonResponse({ results: [{ url: "https://example.com/full", raw_content: "abcdefghij" }] }),
    async () => {
      const response = await extractPlus(["https://example.com/full"], "tavily", "markdown", false, false, false, {
        tavilyApiKey: "tvly-test", extractCharLimit: 5, extractCacheMaxEntries: 1,
      });
      assert.equal(response.results[0].truncated, true);
      const reference = response.results[0].full_content_ref!;
      assert.deepEqual(readCachedExtractContent(reference, 2, 7), {
        content_ref: reference,
        range: { start: 2, end: 7, total_chars: 10 },
        content: "cdefg",
        raw_content: "cdefg",
        provider: "tavily",
      });
      await extractPlus(["https://example.com/evict"], "tavily", "markdown", false, false, false, { tavilyApiKey: "tvly-test", extractCacheMaxEntries: 1 });
      assert.throws(() => readCachedExtractContent(reference), /expired/);
    },
  );
});

test("extract cache evicts the least-recent full text when its character budget is exceeded", async () => {
  __resetExtractCacheForTests();
  let responseIndex = 0;
  await withMockedFetch(
    () => mockJsonResponse({ results: [{ url: "https://example.com", raw_content: ["aa", "bb", "cc"][responseIndex++] }] }),
    async () => {
      const config = { tavilyApiKey: "tvly-test", extractCacheMaxEntries: 10, extractCacheMaxChars: 4 };
      const first = await extractPlus(["https://example.com/a"], "tavily", "markdown", false, false, false, config);
      const second = await extractPlus(["https://example.com/b"], "tavily", "markdown", false, false, false, config);
      await extractPlus(["https://example.com/c"], "tavily", "markdown", false, false, false, config);
      assert.throws(() => readCachedExtractContent(first.results[0].full_content_ref!), /expired/);
      assert.equal(readCachedExtractContent(second.results[0].full_content_ref!).content, "bb");
    },
  );
});

test("extract cache access refreshes LRU order before character-budget eviction", async () => {
  __resetExtractCacheForTests();
  let responseIndex = 0;
  await withMockedFetch(
    () => mockJsonResponse({ results: [{ url: "https://example.com", raw_content: ["aa", "bb", "cc"][responseIndex++] }] }),
    async () => {
      const config = { tavilyApiKey: "tvly-test", extractCacheMaxEntries: 10, extractCacheMaxChars: 4 };
      const first = await extractPlus(["https://example.com/a"], "tavily", "markdown", false, false, false, config);
      const second = await extractPlus(["https://example.com/b"], "tavily", "markdown", false, false, false, config);
      await extractPlus(["https://example.com/a"], "tavily", "markdown", false, false, false, config);
      await extractPlus(["https://example.com/c"], "tavily", "markdown", false, false, false, config);
      assert.equal(readCachedExtractContent(first.results[0].full_content_ref!).content, "aa");
      assert.throws(() => readCachedExtractContent(second.results[0].full_content_ref!), /expired/);
    },
  );
});

test("extract cache skips a full-text entry larger than its character budget", async () => {
  __resetExtractCacheForTests();
  let responseIndex = 0;
  await withMockedFetch(
    () => mockJsonResponse({ results: [{ url: "https://example.com", raw_content: ["abc", "abcde", "abcde"][responseIndex++] }] }),
    async (calls) => {
      const config = { tavilyApiKey: "tvly-test", extractCacheMaxChars: 4 };
      const cached = await extractPlus(["https://example.com/small"], "tavily", "markdown", false, false, false, config);
      const first = await extractPlus(["https://example.com/large"], "tavily", "markdown", false, false, false, config);
      const second = await extractPlus(["https://example.com/large"], "tavily", "markdown", false, false, false, config);
      assert.equal(first.results[0].full_content_ref, undefined);
      assert.equal(second.results[0].full_content_ref, undefined);
      assert.equal(readCachedExtractContent(cached.results[0].full_content_ref!).content, "abc");
      assert.equal(calls.length, 3);
    },
  );
});

test("extract cache counts provider content without raw_content only once", async () => {
  __resetExtractCacheForTests();
  await withMockedFetch(
    (url) => mockJsonResponse({ results: [{ url, raw_content: "abc" }] }),
    async (calls) => {
      const config = { tavilyApiKey: "tvly-test", extractCacheMaxChars: 3 };
      const first = await extractPlus(["https://example.com/no-raw-duplicate"], "tavily", "markdown", false, false, false, config);
      const second = await extractPlus(["https://example.com/no-raw-duplicate"], "tavily", "markdown", false, false, false, config);
      assert.equal(calls.length, 1);
      assert.equal(readCachedExtractContent(first.results[0].full_content_ref!).raw_content, "abc");
      assert.equal(second.results[0].full_content_ref, first.results[0].full_content_ref);
    },
  );
});

test("extractFirecrawl include_images parses markdown and og image", async () => {
  await withMockedFetch(
    () => mockJsonResponse({
      success: true,
      data: {
        markdown: "# Example\n![Hero](https://example.com/hero.png)\n![Hero again](https://example.com/hero.png)",
        metadata: { title: "Example Page", sourceURL: "https://example.com", ogImage: "https://example.com/og.png" },
      },
    }),
    async () => {
      const result = await extractFirecrawl(["https://example.com"], "fc-test", "markdown", true);
      assert.deepEqual(result.results[0].images?.[0], { alt: "og:image", url: "https://example.com/og.png" });
      assert.ok(result.results[0].images?.some((image) => image.url === "https://example.com/hero.png"));
      assert.equal(result.results[0].images?.filter((image) => image.url === "https://example.com/hero.png").length, 1);
    },
  );
});

test("extractPlus falls back when primary returns only errors", async () => {
  await withMockedFetch(
    (url) => {
      if (url.includes("firecrawl.dev")) {
        return mockJsonResponse({ success: false, error: "fetch failed" });
      }
      return mockJsonResponse({ markdown: "fallback content" });
    },
    async (calls) => {
      const result = await extractPlus(["https://example.com"], "firecrawl", "markdown", false, false, false, {
        firecrawlApiKey: "fc-test",
        linkupApiKey: "linkup-test",
      });
      assert.equal(result.provider, "linkup");
      assert.equal(result.results[0].content, "fallback content");
      assert.equal(result.routing?.fallback_used, true);
      assert.equal(result.routing?.fallback_errors?.[0].error, "all_urls_failed");
      assert.equal(calls.length, 2);
    },
  );
});

test("extractPlus empty urls returns clean error without provider calls", async () => {
  await withMockedFetch(
    () => {
      throw new Error("fetch should not be called");
    },
    async (calls) => {
      const result = await extractPlus([], "firecrawl", "markdown", false, false, false, { firecrawlApiKey: "fc-test" });
      assert.deepEqual(result.results, []);
      assert.equal(result.error, "No URLs provided");
      assert.equal(calls.length, 0);
    },
  );
});

test("extractPlus invalid urls return clean error without fallback", async () => {
  await withMockedFetch(
    () => {
      throw new Error("fetch should not be called");
    },
    async (calls) => {
      const result = await extractPlus(["foo-bar"], "firecrawl", "markdown", false, false, false, {
        firecrawlApiKey: "fc-test",
        linkupApiKey: "linkup-test",
      });
      assert.deepEqual(result.results, []);
      assert.match(String(result.error), /Invalid URL\(s\)/);
      assert.equal(calls.length, 0);
    },
  );
});

test("extractPlus returns clean all providers failed error when no extract provider key exists", async () => {
  await withMockedFetch(
    () => {
      throw new Error("fetch should not be called");
    },
    async () => {
      const result = await extractPlus(["https://example.com"], "auto", "markdown", false, false, false, {});
      assert.equal(result.error, "All extraction providers failed");
      assert.equal(result.routing?.requested_provider, "auto");
      assert.equal(result.fallback_errors?.[0].error, "missing_api_key");
    },
  );
});

test("extractPlus includes requested_provider when explicit provider succeeds", async () => {
  await withMockedFetch(
    () => mockJsonResponse({ markdown: "linkup content" }),
    async () => {
      const result = await extractPlus(["https://example.com"], "linkup", "markdown", false, false, false, {
        linkupApiKey: "linkup-test",
      });
      assert.equal(result.provider, "linkup");
      assert.equal(result.routing?.requested_provider, "linkup");
      assert.equal(result.routing?.fallback_used, false);
    },
  );
});

test("register exposes web_extract_plus tool", () => {
  const registered = new Map<string, any>();
  register({ registerTool(tool: any) { registered.set(tool.name, tool); }, pluginConfig: {} });
  assert.ok(registered.has("web_search_plus"));
  assert.ok(registered.has("web_extract_plus"));
  assert.ok(registered.has("web_extract_benchmark_plus"));
  const schema = registered.get("web_extract_plus").parameters;
  // URLs and a full-content reference are alternate inputs to the same tool.
  assert.equal(schema.required, undefined);
  assert.ok(schema.properties.content_ref);
  assert.ok(schema.properties.provider.enum.includes("firecrawl"));
  assert.ok(schema.properties.provider.enum.includes("linkup"));
  assert.ok(schema.properties.provider.enum.includes("exa"));
  assert.ok(schema.properties.provider.enum.includes("you"));
});

test("extract benchmark ranks by content yield, not by latency alone", async () => {
  const registered = new Map<string, any>();
  register({ registerTool(tool: any) { registered.set(tool.name, tool); }, pluginConfig: { tavilyApiKey: "tvly-test", exaApiKey: "exa-test" } });
  const thin = "x";
  const rich = "y".repeat(6000);
  await withMockedFetch(
    (url) => (url.includes("exa.ai")
      ? mockJsonResponse({ results: [{ url: "https://example.com/bench", text: rich }] })
      : mockJsonResponse({ results: [{ url: "https://example.com/bench", raw_content: thin }] })),
    async () => {
      const payload = JSON.parse((await registered.get("web_extract_benchmark_plus").execute("bench-score", { urls: ["https://example.com/bench"], max_provider_calls: 2 })).content[0].text);
      assert.equal(payload.provider_calls_made, 2);
      assert.deepEqual(payload.score_weights, { success_rate: 0.6, latency: 0.2, content_yield: 0.2 });
      const tavily = payload.attempts.find((attempt: any) => attempt.provider === "tavily");
      const exa = payload.attempts.find((attempt: any) => attempt.provider === "exa");
      assert.equal(tavily.success_rate, 1);
      assert.equal(exa.success_rate, 1);
      assert.ok(exa.returned_chars > tavily.returned_chars);
      assert.ok(exa.score > tavily.score, `expected exa ${exa.score} > tavily ${tavily.score}`);
      assert.equal(payload.priority_recommendation[0], "exa");
    },
  );
});

test("extract benchmark is explicit, capped, and keeps Hound behind auto_allow", async () => {
  const registered = new Map<string, any>();
  register({ registerTool(tool: any) { registered.set(tool.name, tool); }, pluginConfig: { tavilyApiKey: "tvly-test", houndMcpUrl: "http://127.0.0.1:3000/mcp" } });
  await withMockedFetch(
    () => mockJsonResponse({ results: [{ url: "https://example.com/bench", raw_content: "benchmark content" }] }),
    async (calls) => {
      const payload = JSON.parse((await registered.get("web_extract_benchmark_plus").execute("bench", { urls: ["https://example.com/bench"], max_provider_calls: 1 })).content[0].text);
      assert.equal(payload.explicit_opt_in, true);
      assert.equal(payload.provider_calls_made, 1);
      assert.equal(payload.hound_auto_allow, false);
      assert.equal(calls.length, 1);
    },
  );
});

test("web_extract_plus checkFn requires extract-capable provider", () => {
  const registered = new Map<string, any>();
  register({ registerTool(tool: any) { registered.set(tool.name, tool); }, pluginConfig: { braveApiKey: "brave-test" } });
  assert.equal(registered.get("web_extract_plus").checkFn(), false);

  // Serper is an extraction provider since the v2.9 sync (scrape.serper.dev).
  registered.clear();
  register({ registerTool(tool: any) { registered.set(tool.name, tool); }, pluginConfig: { serperApiKey: "serper-test" } });
  assert.equal(registered.get("web_extract_plus").checkFn(), true);

  registered.clear();
  register({ registerTool(tool: any) { registered.set(tool.name, tool); }, pluginConfig: { firecrawlApiKey: "fc-test" } });
  assert.equal(registered.get("web_extract_plus").checkFn(), true);
  assert.equal(hasAnyExtractProviderCredential({ firecrawlApiKey: "fc-test" }), true);
});

test("registered web_extract_plus execute returns JSON payload", async () => {
  await withMockedFetch(
    () => mockJsonResponse({ markdown: "registered content" }),
    async () => {
      const registered = new Map<string, any>();
      register({ registerTool(tool: any) { registered.set(tool.name, tool); }, pluginConfig: { linkupApiKey: "linkup-test" } });
      const response = await registered.get("web_extract_plus").execute("tool-1", {
        urls: ["https://example.com"],
        provider: "linkup",
        include_raw_html: false,
        include_images: false,
        render_js: false,
      });
      const payload = JSON.parse(response.content[0].text);
      assert.equal(payload.provider, "linkup");
      assert.equal(payload.results[0].content, "registered content");
      assert.equal(payload.routing.requested_provider, "linkup");
    },
  );
});
