import test from "node:test";
import assert from "node:assert/strict";
import { register, __resetRuntimeStateForTests } from "../index.ts";
import { runResearchMode, selectResearchProviders } from "../research.ts";
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
  fn: (calls: Array<{ url: string; init?: RequestInit }>) => Promise<void>,
) {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const href = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
    calls.push({ url: href, init });
    return responder(href, init);
  }) as typeof fetch;
  try {
    await fn(calls);
  } finally {
    globalThis.fetch = originalFetch;
    __resetRuntimeStateForTests();
    __resetRoutingPreferencesForTests();
  }
}

test("selectResearchProviders prefers primary, dedupes, and caps at max", () => {
  const available = new Set(["tavily", "exa", "linkup", "serper"] as const) as Set<any>;
  const picked = selectResearchProviders("tavily" as any, ["serper", "exa"] as any, available, 3);
  assert.deepEqual(picked, ["tavily", "linkup", "exa"]);

  const fallbackToPriority = selectResearchProviders("searxng" as any, ["serpbase", "serper"] as any, new Set(["serper", "serpbase"] as any), 3);
  assert.deepEqual(fallbackToPriority, ["serper", "serpbase"]);
});

test("runResearchMode preserves submission order despite out-of-order completion", async () => {
  const resolveOrder: string[] = [];
  const result = await runResearchMode({
    query: "test",
    researchProviders: ["slow", "fast"],
    executeSearch: async (provider) => {
      if (provider === "slow") {
        await new Promise((resolve) => setTimeout(resolve, 30));
        resolveOrder.push("slow");
        return { results: [{ title: "Slow", url: "https://slow.example/one", snippet: "s" }] };
      }
      resolveOrder.push("fast");
      return { results: [{ title: "Fast", url: "https://fast.example/one", snippet: "f" }] };
    },
    extractUrls: async () => ({ provider: null, results: [] }),
    maxResults: 5,
    maxExtractUrls: 0,
  });

  assert.deepEqual(resolveOrder, ["fast", "slow"]);
  assert.deepEqual(result.metadata.providers_merged, ["slow", "fast"]);
  assert.equal(result.results[0].provider, "slow");
  assert.equal(result.mode, "research");
  assert.equal(result.provider, "research");
  assert.equal(result.status, "success");
  assert.deepEqual(result.routing.provider_attempts.map((attempt: any) => attempt.outcome), ["success", "success"]);
});

test("runResearchMode dedupes across providers and reports provider errors", async () => {
  const result = await runResearchMode({
    query: "dedupe",
    researchProviders: ["a", "b", "broken"],
    executeSearch: async (provider) => {
      if (provider === "broken") throw new Error("provider exploded");
      return {
        results: [
          { title: "Shared", url: "https://example.com/shared/", snippet: "x" },
          { title: `${provider} unique`, url: `https://example.com/${provider}`, snippet: "y" },
        ],
      };
    },
    extractUrls: async (urls) => ({ provider: "tavily", results: urls.map((url) => ({ url, title: "t", content: "c" })) }),
    maxResults: 10,
    maxExtractUrls: 2,
  });

  assert.equal(result.metadata.dedup_count, 1);
  assert.deepEqual(result.metadata.providers_merged, ["a", "b"]);
  assert.deepEqual(result.routing.provider_errors, [{ provider: "broken", error: "provider exploded" }]);
  assert.equal(result.status, "degraded");
  assert.deepEqual(result.routing.provider_attempts.map((attempt: any) => attempt.outcome), ["success", "success", "failed"]);
  assert.equal(result.routing.extraction_provider, "tavily");
  assert.equal(result.source_summaries.length, 2);
  assert.equal(result.metadata.extracted_url_count, 2);
});

test("runResearchMode optionally moves content duplicates behind the diverse head", async () => {
  const result = await runResearchMode({
    query: "diversity",
    researchProviders: ["a"],
    executeSearch: async () => ({
      results: [
        { title: "First", url: "https://one.example/first", snippet: "same words form a repeated result snippet" },
        { title: "Duplicate", url: "https://one.example/second", snippet: "same words form a repeated result snippet" },
        { title: "Diverse", url: "https://two.example/third", snippet: "fresh material from another source entirely" },
      ],
    }),
    extractUrls: async () => ({ provider: null, results: [] }),
    maxResults: 5,
    maxExtractUrls: 0,
    diversityRerank: true,
  });

  assert.deepEqual(result.results.map((item: any) => item.title), ["First", "Diverse", "Duplicate"]);
  assert.equal(result.metadata.diversity_rerank.enabled, true);
  assert.equal(result.metadata.diversity_rerank.moved_candidate_count, 1);
});

test("runResearchMode time budget skips later providers and extraction deterministically", async () => {
  let clock = 0;
  const queried: string[] = [];
  const result = await runResearchMode({
    query: "budget",
    researchProviders: ["first", "second", "third"],
    executeSearch: async (provider) => {
      queried.push(provider);
      return { results: [{ title: provider, url: `https://example.com/${provider}`, snippet: "s" }] };
    },
    extractUrls: async () => {
      throw new Error("extraction should not run");
    },
    maxResults: 5,
    maxExtractUrls: 3,
    timeBudgetSeconds: 10,
    // First check (provider "first") is under budget; every later check is over.
    nowFn: () => (clock += 6),
  });

  assert.deepEqual(queried, ["first"]);
  const skipped = result.routing.provider_errors.map((e: any) => e.provider);
  assert.deepEqual(skipped, ["second", "third"]);
  assert.match(result.routing.extraction_error, /time budget exhausted/);
  assert.deepEqual(result.source_summaries, []);
  assert.deepEqual(result.routing.provider_attempts.map((attempt: any) => attempt.outcome), ["success", "skipped", "skipped"]);
});

test("runResearchMode marks total fan-out failure as a failed envelope", async () => {
  const result = await runResearchMode({
    query: "failure",
    researchProviders: ["a", "b"],
    executeSearch: async (provider) => {
      throw new Error(`${provider} unavailable`);
    },
    extractUrls: async () => ({ provider: null, results: [] }),
    maxResults: 5,
  });

  assert.equal(result.status, "failed");
  assert.equal(result.error, "All research providers failed");
  assert.deepEqual(result.results, []);
  assert.deepEqual(result.routing.provider_attempts.map((attempt: any) => attempt.outcome), ["failed", "failed"]);
});

test("runResearchMode surfaces extraction errors without dropping search results", async () => {
  const result = await runResearchMode({
    query: "extract error",
    researchProviders: ["a"],
    executeSearch: async () => ({ results: [{ title: "One", url: "https://example.com/one", snippet: "s" }] }),
    extractUrls: async () => ({ provider: "auto", results: [], error: "All extract providers failed" }),
    maxResults: 5,
    maxExtractUrls: 3,
  });

  assert.equal(result.results.length, 1);
  assert.equal(result.routing.extraction_error, "All extract providers failed");
  assert.deepEqual(result.source_summaries, []);
});

test("registered web_search_plus mode=research merges providers and extracts top sources", async () => {
  await withMockedFetch(
    (url) => {
      if (url.includes("api.tavily.com/search")) {
        return mockJsonResponse({
          results: [
            { title: "Tavily One", url: "https://example.com/shared", content: "tavily snippet", score: 0.9 },
            { title: "Tavily Two", url: "https://example.com/tavily-only", content: "tavily snippet 2", score: 0.8 },
          ],
          answer: "tavily answer",
        });
      }
      if (url.includes("google.serper.dev/search")) {
        return mockJsonResponse({
          organic: [
            { title: "Serper Shared", link: "https://example.com/shared", snippet: "serper snippet" },
            { title: "Serper Two", link: "https://example.com/serper-only", snippet: "serper snippet 2" },
          ],
        });
      }
      if (url.includes("api.tavily.com/extract")) {
        return mockJsonResponse({
          results: [
            { url: "https://example.com/shared", title: "Shared Page", raw_content: "full text of shared page" },
          ],
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
    async () => {
      const registered = new Map<string, any>();
      register({
        registerTool(tool: any) { registered.set(tool.name, tool); },
        pluginConfig: { tavilyApiKey: "tavily-test", serperApiKey: "serper-test" },
      });

      const tool = registered.get("web_search_plus");
      const response = await tool.execute("tool-research", {
        query: "What changed in the EU AI Act enforcement timeline?",
        mode: "research",
        research_providers: ["tavily", "serper"],
        research_extract_count: 1,
        count: 5,
      });
      const payload = JSON.parse(response.content[0].text);

      assert.equal(payload.mode, "research");
      assert.equal(payload.provider, "research");
      assert.equal(payload.routing.provider, "research");
      assert.deepEqual(payload.metadata.providers_merged, ["tavily", "serper"]);
      assert.equal(payload.metadata.dedup_count, 1);
      assert.equal(payload.results.length, 3);
      assert.equal(payload.source_summaries.length, 1);
      assert.equal(payload.routing.extraction_provider, "tavily");
      assert.ok(payload.quality_report);
      assert.equal(payload.quality_report.routing_decision.provider, "research");
    },
  );
});

test("registered web_search_plus mode=research errors when no provider is usable", async () => {
  await withMockedFetch(
    () => {
      throw new Error("no network calls expected");
    },
    async () => {
      const registered = new Map<string, any>();
      register({
        registerTool(tool: any) { registered.set(tool.name, tool); },
        pluginConfig: { tavilyApiKey: "tavily-test" },
      });

      const tool = registered.get("web_search_plus");
      const response = await tool.execute("tool-research-none", {
        query: "anything",
        mode: "research",
        research_providers: ["serper"],
      });
      const payload = JSON.parse(response.content[0].text);
      assert.match(payload.error, /No configured providers available for research mode/);
    },
  );
});
