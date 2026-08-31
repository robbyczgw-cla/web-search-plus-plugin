import assert from "node:assert/strict";
import test from "node:test";
import { searchOcten } from "../octen-provider.ts";
import { ProviderConfigError, ProviderRequestError } from "../provider-http.ts";

async function withFetch(
  implementation: typeof fetch,
  run: () => Promise<void>,
): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = implementation;
  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }
}

function completedEnvelope(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    runId: "run-safe-id",
    provider: "octen",
    endpoint: "/search",
    status: "COMPLETED",
    providerResponse: { httpStatus: 200 },
    billing: { actualCost: { value: 1000, unit: "MICRO_DOLLAR", currency: "USD" } },
    output: {
      code: 0,
      request_id: "req-safe-id",
      data: {
        results: [{
          title: "Python docs",
          url: "https://docs.python.org/3/",
          highlight: "Official Python documentation.",
          authors: "Python Software Foundation",
          time_published: "2026-01-02T03:04:05Z",
          time_last_crawled: "2026-07-27T03:04:05Z",
          favicon: "https://docs.python.org/favicon.ico",
        }, { title: "Missing URL", highlight: "drop me" }],
      },
      meta: {
        usage: { num_search_queries: 1, full_content_tokens: 0 },
        latency: 64,
      },
    },
    ...overrides,
  };
}

test("searchOcten sends the fixed source-only Monid request and projects evidence", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  await withFetch((async (url, init) => {
    capturedUrl = String(url);
    capturedInit = init;
    return Response.json(completedEnvelope());
  }) as typeof fetch, async () => {
    const result = await searchOcten("octen contract query", " monid-test-key ", 3, {
      freshness: "week",
      searchType: "news",
      includeDomains: ["docs.python.org"],
      excludeDomains: ["spam.example"],
      timeoutSeconds: 17,
    });
    assert.deepEqual(result, {
      provider: "octen",
      query: "octen contract query",
      results: [{
        url: "https://docs.python.org/3/",
        title: "Python docs",
        snippet: "Official Python documentation.",
        date: "2026-01-02T03:04:05Z",
        author: "Python Software Foundation",
        favicon: "https://docs.python.org/favicon.ico",
        last_crawled: "2026-07-27T03:04:05Z",
      }],
      images: [],
      metadata: {
        monid_run_id: "run-safe-id",
        request_id: "req-safe-id",
        latency_ms: 64,
        usage: { search_queries: 1, full_content_tokens: 0 },
        cost_usd: 0.001,
      },
    });
  });

  assert.equal(capturedUrl, "https://api.monid.ai/v1/run");
  assert.equal(capturedInit?.method, "POST");
  assert.equal(capturedInit?.redirect, "error");
  assert.equal((capturedInit?.headers as Record<string, string>).Authorization, "Bearer monid-test-key");
  assert.deepEqual(JSON.parse(String(capturedInit?.body)), {
    provider: "octen",
    endpoint: "/search",
    input: {
      query: "octen contract query",
      count: 3,
      topic: "general",
      highlight: { enable: true, max_tokens: 300 },
      full_content: { enable: false },
      format: "text",
      include_domains: ["docs.python.org"],
      exclude_domains: ["spam.example"],
      time_range: "week",
    },
  });
});

test("searchOcten uses unified time range and never claims the news vertical", async () => {
  let input: Record<string, any> = {};
  await withFetch((async (_url, init) => {
    input = JSON.parse(String(init?.body)).input;
    return Response.json(completedEnvelope({
      output: { code: 0, data: { results: [] }, meta: {} },
    }));
  }) as typeof fetch, async () => {
    await searchOcten("news", "key", 5, { timeRange: "day", searchType: "news" });
  });
  assert.equal(input.topic, "general");
  assert.equal(input.time_range, "day");
  assert.equal(input.full_content.enable, false);
});

test("searchOcten classifies HTTP errors opaquely and preserves finite Retry-After", async () => {
  await withFetch((async () => new Response("private upstream detail secret-key", {
    status: 429,
    headers: { "Retry-After": "2" },
  })) as typeof fetch, async () => {
    await assert.rejects(
      searchOcten("query", "secret-key", 3),
      (error: any) => error instanceof ProviderRequestError
        && error.message === "octen_http_429"
        && error.statusCode === 429
        && error.transient === true
        && error.retryAfter === 2
        && !error.message.includes("private")
        && !error.message.includes("secret-key"),
    );
  });
});

test("searchOcten rejects confused, async, and failed provider envelopes", async () => {
  const cases: Array<[Record<string, any>, string, number | undefined, boolean]> = [
    [completedEnvelope({ provider: "other" }), "octen_monid_invalid_envelope", undefined, true],
    [completedEnvelope({ status: "RUNNING" }), "octen_monid_not_completed", undefined, true],
    [completedEnvelope({ status: "FAILED" }), "octen_monid_failed", 500, true],
    [completedEnvelope({ providerResponse: { httpStatus: 401 } }), "octen_provider_http_401", 401, false],
    [completedEnvelope({ providerResponse: { httpStatus: 503 } }), "octen_provider_http_503", 503, true],
    [completedEnvelope({ output: { code: 429 } }), "octen_api_429", 429, true],
  ];
  for (const [payload, code, statusCode, transient] of cases) {
    await withFetch((async () => Response.json(payload)) as typeof fetch, async () => {
      await assert.rejects(
        searchOcten("query", "key", 3),
        (error: any) => error instanceof ProviderRequestError
          && error.message === code
          && error.statusCode === statusCode
          && error.transient === transient,
      );
    });
  }
});

test("searchOcten enforces credentials, count, timeout, JSON, and body bounds", async () => {
  await assert.rejects(
    searchOcten("query", "", 3),
    (error: any) => error instanceof ProviderConfigError && error.message === "monid_api_key_required",
  );
  await assert.rejects(
    searchOcten("query", "key", Number.NaN),
    (error: any) => error instanceof ProviderConfigError && error.message === "octen_max_results_invalid",
  );
  await assert.rejects(
    searchOcten("query", "key", 3, { timeoutSeconds: 0 }),
    (error: any) => error instanceof ProviderConfigError && error.message === "octen_timeout_invalid",
  );

  await withFetch((async () => new Response("not-json")) as typeof fetch, async () => {
    await assert.rejects(searchOcten("query", "key", 3), /octen_invalid_response/);
  });
  await withFetch((async () => new Response("{}", {
    headers: { "content-length": String(8 * 1024 * 1024 + 1) },
  })) as typeof fetch, async () => {
    await assert.rejects(searchOcten("query", "key", 3), /octen_response_too_large/);
  });
});
