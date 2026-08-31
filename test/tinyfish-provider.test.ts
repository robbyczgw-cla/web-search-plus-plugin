import assert from "node:assert/strict";
import test from "node:test";
import { ProviderConfigError, ProviderRequestError } from "../provider-http.ts";
import {
  TINYFISH_PROVIDER_METADATA,
  searchTinyFish,
} from "../tinyfish-provider.ts";

async function withMockFetch<T>(
  mock: typeof fetch,
  run: () => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("searchTinyFish sends a fixed-origin GET and projects source-only results", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  await withMockFetch(async (input, init) => {
    capturedUrl = String(input);
    capturedInit = init;
    return new Response(JSON.stringify({
      query: "ignored upstream query",
      results: [
        {
          position: 1,
          site_name: "docs.python.org",
          publisher: "Python Software Foundation",
          title: "Python docs",
          snippet: "Official Python documentation.",
          url: "https://docs.python.org/3/",
          date: "2026-07-01",
          content: "must not be projected",
        },
        {
          position: 2,
          site_name: "example.com",
          title: "Example",
          snippet: "Example source.",
          url: "https://example.com/source",
        },
        {
          position: 3,
          title: "Excluded",
          snippet: "No",
          url: "https://spam.example/private",
        },
      ],
      total_results: 3,
      page: 0,
      answer: "must not be projected",
    }), { status: 200, headers: { "content-type": "application/json" } });
  }, async () => {
    const result = await searchTinyFish("  tinyfish contract query  ", "  tinyfish-test-key  ", 3, {
      freshness: "week",
      searchType: "news",
      includeDomains: ["Docs.Python.org.", "docs.python.org", "*.Example.COM"],
      excludeDomains: ["spam.example"],
      country: "at",
      language: "DE",
      timeoutSeconds: 17,
    });

    assert.deepEqual(result, {
      provider: "tinyfish",
      query: "tinyfish contract query",
      results: [
        {
          url: "https://docs.python.org/3/",
          title: "Python docs",
          snippet: "Official Python documentation.",
          date: "2026-07-01",
          source: "docs.python.org",
          author: "Python Software Foundation",
          position: 1,
        },
        {
          url: "https://example.com/source",
          title: "Example",
          snippet: "Example source.",
          source: "example.com",
          position: 2,
        },
      ],
      images: [],
      metadata: { total_results: 3, page: 0 },
    });
    assert.equal("answer" in result, false);
    assert.equal("content" in result.results[0], false);
  });

  const url = new URL(capturedUrl);
  assert.equal(url.origin, "https://api.search.tinyfish.ai");
  assert.equal(url.pathname, "/");
  assert.equal(capturedInit?.method, "GET");
  assert.equal(capturedInit?.redirect, "error");
  const headers = new Headers(capturedInit?.headers);
  assert.equal(headers.get("x-api-key"), "tinyfish-test-key");
  assert.equal(headers.get("accept"), "application/json");
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    query: "tinyfish contract query",
    location: "AT",
    language: "de",
    include_domains: "docs.python.org,*.example.com",
    exclude_domains: "spam.example",
    domain_type: "news",
    recency_minutes: "10080",
  });
  for (const omitted of ["fetch", "purpose", "include_thumbnail", "limit"]) {
    assert.equal(url.searchParams.has(omitted), false);
  }
});

test("searchTinyFish enforces query, key, timeout, domain, and encoded-request bounds", async () => {
  let fetchCalls = 0;
  await withMockFetch(async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({ results: [] }));
  }, async () => {
    const invalidCalls: Array<[() => Promise<unknown>, string]> = [
      [() => searchTinyFish("query", " ", 3), "tinyfish_api_key_required"],
      [() => searchTinyFish(" ", "key", 3), "tinyfish_query_invalid"],
      [() => searchTinyFish("x".repeat(2_001), "key", 3), "tinyfish_query_invalid"],
      [() => searchTinyFish("query", "key", Number.NaN), "tinyfish_max_results_invalid"],
      [() => searchTinyFish("query", "key", 3, { timeoutSeconds: 0 }), "tinyfish_timeout_invalid"],
      [() => searchTinyFish("query", "key", 3, { includeDomains: ["faß.de"] }), "tinyfish_domains_invalid"],
      [() => searchTinyFish("query", "key", 3, { includeDomains: ["https://example.com"] }), "tinyfish_domains_invalid"],
      [() => searchTinyFish("query", "key", 3, { includeDomains: Array(21).fill("example.com") }), "tinyfish_domains_invalid"],
      [() => searchTinyFish("é".repeat(2_000), "key", 3), "tinyfish_request_too_large"],
    ];
    for (const [call, code] of invalidCalls) {
      await assert.rejects(call, (error: unknown) => (
        error instanceof ProviderConfigError && error.code === code
      ));
    }
  });
  assert.equal(fetchCalls, 0);
});

test("searchTinyFish rejects unsafe result URLs and bounds untrusted text", async () => {
  const title = `\u202e${"T".repeat(1_020)}`;
  const snippet = `\u009b${"S".repeat(8_020)}`;
  await withMockFetch(async () => new Response(JSON.stringify({
    results: [
      null,
      { url: "javascript:alert(1)", title: "scheme" },
      { url: "https://user:pass@example.com/private", title: "credentials" },
      { url: "https://faß.de/source", title: "raw Unicode hostname" },
      { url: "https://bad_domain.example/source", title: "bad hostname" },
      { url: "https://safe.example:99999/source", title: "bad port" },
      { url: "https://safe.example/white space", title: "whitespace" },
      { url: "https://safe.example/\u202ereversed", title: "control" },
      {
        url: "https://xn--fa-hia.de/source",
        title,
        snippet,
        position: true,
      },
    ],
  })), async () => {
    const result = await searchTinyFish("safe", "key", 1);
    assert.equal(result.results.length, 1);
    assert.equal(result.results[0].url, "https://xn--fa-hia.de/source");
    assert.equal(result.results[0].title, "T".repeat(1_000));
    assert.equal(result.results[0].snippet, "S".repeat(8_000));
    assert.equal("position" in result.results[0], false);
  });
});

test("searchTinyFish keeps HTTP failures opaque and classifies only listed transient statuses", async () => {
  for (const [status, transient] of [[401, false], [429, true], [500, true]] as const) {
    await withMockFetch(async () => new Response(
      "upstream detail with must-not-leak-query and secret-key",
      {
        status,
        headers: status === 429 ? { "retry-after": "2.5" } : undefined,
      },
    ), async () => {
      await assert.rejects(
        () => searchTinyFish("must-not-leak-query", "secret-key", 3),
        (error: unknown) => {
          assert.equal(error instanceof ProviderRequestError, true);
          const providerError = error as ProviderRequestError;
          assert.equal(providerError.code, `tinyfish_http_${status}`);
          assert.equal(providerError.statusCode, status);
          assert.equal(providerError.transient, transient);
          assert.equal(providerError.retryAfter, status === 429 ? 2.5 : undefined);
          assert.equal(String(error).includes("must-not-leak-query"), false);
          assert.equal(String(error).includes("upstream detail"), false);
          assert.equal(String(error).includes("secret-key"), false);
          return true;
        },
      );
    });
  }
});

test("searchTinyFish refuses redirects and bounds successful response bodies at 2 MiB", async () => {
  await withMockFetch(async (_input, init) => {
    assert.equal(init?.redirect, "error");
    return new Response("x", {
      status: 200,
      headers: { "content-length": String(2 * 1024 * 1024 + 1) },
    });
  }, async () => {
    await assert.rejects(
      () => searchTinyFish("bounded", "key", 3),
      (error: unknown) => (
        error instanceof ProviderRequestError
        && error.code === "tinyfish_response_too_large"
        && error.transient
      ),
    );
  });
});

test("TinyFish metadata makes explicit-only privacy and BYOK constraints visible", () => {
  assert.equal(TINYFISH_PROVIDER_METADATA.autoAllowedByDefault, false);
  assert.equal(TINYFISH_PROVIDER_METADATA.explicitOnly, true);
  assert.equal(TINYFISH_PROVIDER_METADATA.supportsFreshness, true);
  assert.match(TINYFISH_PROVIDER_METADATA.description, /your own account\/API key/i);
  assert.match(TINYFISH_PROVIDER_METADATA.description, /does not provide, pool, proxy, or share/i);
  assert.match(TINYFISH_PROVIDER_METADATA.description, /training/i);
  assert.match(TINYFISH_PROVIDER_METADATA.description, /fine-tuning/i);
  assert.equal(TINYFISH_PROVIDER_METADATA.termsUrl, "https://www.tinyfish.ai/terms");
});
