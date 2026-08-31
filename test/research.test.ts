import test from "node:test";
import assert from "node:assert/strict";
import { register, __resetRuntimeStateForTests } from "../index.ts";
import {
  deduplicateResultsAcrossProviders,
  mergeResearchResultsAcrossProviders,
  researchQuorumSnapshot,
  runResearchMode,
  selectResearchProviders,
} from "../research.ts";
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

test("runResearchMode harvests completion order and preempts only pending work after quality quorum", async () => {
  let releaseSlow!: () => void;
  const slowGate = new Promise<void>((resolve) => { releaseSlow = resolve; });
  let releaseFastA!: () => void;
  const fastAGate = new Promise<void>((resolve) => { releaseFastA = resolve; });
  let slowSignal: AbortSignal | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const run = runResearchMode({
      query: "completion-order quorum",
      researchProviders: ["slow", "fast-a", "fast-b"],
      executeSearch: async (provider, signal) => {
        if (provider === "slow") {
          slowSignal = signal;
          await slowGate;
          return { results: [{ title: "Slow", url: "https://slow.example/a", snippet: "slow" }] };
        }
        if (provider === "fast-a") {
          await fastAGate;
          return { results: [
            { title: "One", url: "https://one.example/a", snippet: "one" },
            { title: "Two", url: "https://two.example/a", snippet: "two" },
          ] };
        }
        releaseFastA();
        return { results: [
          { title: "Three", url: "https://three.example/b", snippet: "three" },
          { title: "Four", url: "https://four.example/b", snippet: "four" },
        ] };
      },
      extractUrls: async () => ({ provider: null, results: [] }),
      maxResults: 3,
      maxExtractUrls: 0,
      timeBudgetSeconds: 2,
    });
    const guard = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error("research quorum did not return early")), 500);
    });
    const result = await Promise.race([run, guard]);

    assert.deepEqual(result.routing.providers_queried, ["fast-a", "fast-b"]);
    assert.deepEqual(result.results.map((item: any) => item.url), [
      "https://one.example/a",
      "https://two.example/a",
      "https://three.example/b",
    ]);
    assert.deepEqual(result.routing.provider_errors, [{ provider: "slow", error: "preempted_after_quorum" }]);
    assert.deepEqual(result.routing.provider_attempts.map((attempt: any) => attempt.outcome), ["cancelled", "success", "success"]);
    assert.equal(result.metadata.research_quorum.triggered, true);
    assert.deepEqual(result.metadata.research_quorum.contributing_providers, ["fast-a", "fast-b"]);
    assert.equal(result.status, "success");
    assert.equal(slowSignal?.aborted, true);
  } finally {
    if (timeout) clearTimeout(timeout);
    releaseSlow();
  }
});

test("research quorum evidence scans all completed results beyond the public page cap", () => {
  const firstResults = Array.from({ length: 5 }, (_, index) => ({
    title: `First ${index}`,
    url: `https://first-${index}.example/a`,
    snippet: "first",
  }));
  const snapshot = researchQuorumSnapshot([
    ["first", { results: firstResults }],
    ["second", { results: [{ title: "Second", url: "https://second.example/a", snippet: "second" }] }],
  ]);

  assert.deepEqual(snapshot, {
    deduplicatedResultCount: 6,
    uniqueDomainCount: 6,
    contributingProviders: ["first", "second"],
  });
});

test("runResearchMode does not let one prolific provider form a quorum", async () => {
  let secondCompleted = false;
  const result = await runResearchMode({
    query: "one provider is not consensus",
    researchProviders: ["prolific", "second"],
    executeSearch: async (provider) => {
      if (provider === "second") {
        await new Promise((resolve) => setTimeout(resolve, 20));
        secondCompleted = true;
        return { results: [{ title: "Second", url: "https://second.example/a", snippet: "second" }] };
      }
      return { results: Array.from({ length: 5 }, (_, index) => ({
        title: `Prolific ${index}`,
        url: `https://prolific-${index}.example/a`,
        snippet: "prolific",
      })) };
    },
    extractUrls: async () => ({ provider: null, results: [] }),
    maxResults: 5,
    maxExtractUrls: 0,
  });

  assert.equal(secondCompleted, true);
  assert.equal(result.metadata.research_quorum.triggered, false);
  assert.deepEqual(result.metadata.research_quorum.contributing_providers, ["prolific", "second"]);
  assert.deepEqual(result.routing.provider_errors, []);
});

test("runResearchMode preserves recall when completed evidence lacks domain diversity", async () => {
  let slowCompleted = false;
  const result = await runResearchMode({
    query: "domain diversity",
    researchProviders: ["fast-a", "fast-b", "slow"],
    executeSearch: async (provider) => {
      if (provider === "slow") {
        await new Promise((resolve) => setTimeout(resolve, 25));
        slowCompleted = true;
        return { results: [{ title: "Slow", url: "https://other.example/a", snippet: "slow" }] };
      }
      return { results: [
        { title: `${provider} one`, url: `https://same.example/${provider}/one`, snippet: "one" },
        { title: `${provider} two`, url: `https://same.example/${provider}/two`, snippet: "two" },
      ] };
    },
    extractUrls: async () => ({ provider: null, results: [] }),
    maxResults: 3,
    maxExtractUrls: 0,
  });

  assert.equal(slowCompleted, true);
  assert.equal(result.metadata.research_quorum.triggered, false);
  assert.deepEqual(result.metadata.providers_merged, ["fast-a", "fast-b", "slow"]);
  assert.deepEqual(result.routing.provider_errors, []);
});

test("runResearchMode keeps reverse-completion failures in submission order", async () => {
  const result = await runResearchMode({
    query: "stable diagnostics",
    researchProviders: ["first", "second"],
    executeSearch: async (provider) => {
      await new Promise((resolve) => setTimeout(resolve, provider === "first" ? 25 : 1));
      throw new Error(`${provider} failed`);
    },
    extractUrls: async () => ({ provider: null, results: [] }),
    maxResults: 3,
    maxExtractUrls: 0,
  });

  assert.deepEqual(result.routing.provider_errors, [
    { provider: "first", error: "first failed" },
    { provider: "second", error: "second failed" },
  ]);
  assert.deepEqual(result.routing.provider_attempts.map((attempt: any) => attempt.provider), ["first", "second"]);
});

test("runResearchMode drains already-finishing promise chains before quorum preemption", async () => {
  let thirdWorkFinished = false;
  const result = await runResearchMode({
    query: "same-turn completion drain",
    researchProviders: ["fast-a", "fast-b", "finishing"],
    executeSearch: async (provider) => {
      if (provider === "finishing") {
        for (let step = 0; step < 8; step += 1) await Promise.resolve();
        thirdWorkFinished = true;
        return { results: [{ title: "Finishing", url: "https://finishing.example/a", snippet: "finishing" }] };
      }
      return { results: [{ title: provider, url: `https://${provider}.example/a`, snippet: provider }] };
    },
    extractUrls: async () => ({ provider: null, results: [] }),
    maxResults: 2,
    maxExtractUrls: 0,
  });

  assert.equal(thirdWorkFinished, true);
  assert.deepEqual(result.metadata.providers_merged, ["fast-a", "fast-b", "finishing"]);
  assert.deepEqual(result.routing.provider_errors, []);
  assert.equal(result.metadata.research_quorum.triggered, false);
});

test("runResearchMode harvests a provider that settles inside the bounded deadline grace", async () => {
  const result = await runResearchMode({
    query: "deadline edge",
    researchProviders: ["edge"],
    executeSearch: async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return { results: [{ title: "Edge", url: "https://edge.example/a", snippet: "edge" }] };
    },
    extractUrls: async () => ({ provider: null, results: [] }),
    maxResults: 1,
    maxExtractUrls: 0,
    timeBudgetSeconds: 0.01,
  });

  assert.deepEqual(result.metadata.providers_merged, ["edge"]);
  assert.deepEqual(result.routing.provider_errors, []);
  assert.equal(result.routing.provider_attempts[0].outcome, "success");
});

test("research dedup aggregates attributed snippets and derives source type and fetch priority", () => {
  const merged = mergeResearchResultsAcrossProviders([
    ["alpha", { results: [{ title: "Project", url: "https://github.com/example/project", snippet: "Short statement." }] }],
    ["beta", { results: [{ title: "Project docs", url: "https://github.com/example/project", snippet: "Short statement. Additional verified detail." }] }],
    ["gamma", { results: [{ title: "Project notes", url: "https://github.com/example/project", snippet: "Independent operational detail." }] }],
  ], 3);

  assert.equal(merged.dedupCount, 2);
  assert.equal(merged.results.length, 1);
  const result = merged.results[0] as any;
  assert.equal(result.snippet, "Short statement. Additional verified detail.\n\nIndependent operational detail.");
  assert.equal(result.observation_ids.length, 3);
  assert.ok(result.observation_ids.includes(result.representative_observation_id));
  assert.deepEqual(result.source_observations.map((observation: any) => observation.observation_id), result.observation_ids);
  assert.equal(result.snippet_origin, "engine");
  assert.deepEqual(result.snippet_provenance.fragments.map((fragment: any) => ({
    provider: fragment.provider,
    observation_id: fragment.observation_id,
    text: fragment.text,
  })), [
    { provider: "beta", observation_id: result.observation_ids[1], text: "Short statement. Additional verified detail." },
    { provider: "gamma", observation_id: result.observation_ids[2], text: "Independent operational detail." },
  ]);
  assert.deepEqual(result.source_type, {
    value: "repo",
    method: "url_heuristic",
    method_version: "1",
    confidence: "high",
  });
  assert.deepEqual(result.fetch_priority, {
    tier: "high",
    reason_codes: ["cluster_consensus", "rank_top_3", "source_type_authoritative"],
  });
});

test("research snippet aggregation truncates at 600 Unicode code points with named provenance", () => {
  const merged = mergeResearchResultsAcrossProviders([
    ["alpha", { results: [{ title: "Long", url: "https://example.com/long", snippet: "😀".repeat(700) }] }],
    ["beta", { results: [{ title: "Other", url: "https://example.com/long", snippet: "independent" }] }],
  ], 1);
  const result = merged.results[0] as any;

  assert.equal(Array.from(result.snippet).length, 600);
  assert.equal(result.snippet_provenance.fragments.length, 1);
  assert.deepEqual(result.snippet_provenance.fragments[0].transformations, [
    "mechanical_segmentation",
    "deterministic_truncation",
  ]);
  assert.equal(result.snippet_provenance.fragments[0].provider, "alpha");
});

test("research enrichment keeps distinct ports separate and makes observation IDs content-sensitive", () => {
  const first = mergeResearchResultsAcrossProviders([
    ["alpha", { results: [
      { title: "Default", url: "https://host.example/a", snippet: "first version" },
      { title: "Alternate", url: "https://host.example:8443/a", snippet: "alternate origin" },
    ] }],
  ], 5);
  const changed = mergeResearchResultsAcrossProviders([
    ["alpha", { results: [{ title: "Default", url: "https://host.example/a", snippet: "changed version" }] }],
  ], 5);

  assert.equal(first.dedupCount, 0);
  assert.equal(first.results.length, 2);
  assert.notEqual(first.results[0].observation_ids[0], changed.results[0].observation_ids[0]);
});

test("diversity rerank refreshes fetch-priority rank reasons after moving candidates", async () => {
  const repeated = "same words form a repeated result snippet";
  const result = await runResearchMode({
    query: "refresh ranks",
    researchProviders: ["alpha"],
    executeSearch: async () => ({ results: [
      { title: "First", url: "https://one.example/1", snippet: repeated },
      { title: "Duplicate", url: "https://two.example/2", snippet: repeated },
      { title: "Third", url: "https://three.example/3", snippet: "unique evidence from the third candidate" },
      { title: "Fourth", url: "https://four.example/4", snippet: "another independent fourth source" },
    ] }),
    extractUrls: async () => ({ provider: null, results: [] }),
    maxResults: 5,
    maxExtractUrls: 0,
    diversityRerank: true,
  });

  assert.deepEqual(result.results.map((item: any) => item.title), ["First", "Third", "Fourth", "Duplicate"]);
  assert.deepEqual(result.results.map((item: any) => item.fetch_priority.reason_codes[1]), [
    "rank_top_3",
    "rank_top_3",
    "rank_top_3",
    "rank_beyond_top_3",
  ]);
});

test("classic dedup keeps the representative snippet unchanged", () => {
  const merged = deduplicateResultsAcrossProviders([
    ["alpha", { results: [{ title: "A", url: "https://example.com/a", snippet: "alpha text" }] }],
    ["beta", { results: [{ title: "B", url: "https://example.com/a", snippet: "beta text" }] }],
  ], 5);

  assert.equal(merged.results[0].snippet, "alpha text");
  assert.equal(merged.results[0].snippet_provenance, undefined);
  assert.equal(merged.results[0].source_type, undefined);
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
