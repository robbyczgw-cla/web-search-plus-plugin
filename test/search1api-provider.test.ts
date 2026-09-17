import assert from "node:assert/strict";
import test from "node:test";
import { ProviderConfigError, ProviderRequestError } from "../provider-http.ts";
import {
  SEARCH1API_PROVIDER_METADATA,
  extractSearch1Api,
  searchSearch1Api,
} from "../search1api-provider.ts";

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

function jsonResponse(body: Record<string, any>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("searchSearch1Api posts to the fixed origin and projects source-only results", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  await withFetch((async (url, init) => {
    capturedUrl = String(url);
    capturedInit = init;
    return jsonResponse({
      results: [
        {
          title: "Python docs",
          link: "https://docs.python.org/3/",
          snippet: "Official Python documentation.",
          date: "2026-01-02",
          source: "python.org",
          content: "must not be projected",
        },
        { title: "Missing link", snippet: "drop me" },
        { title: "Unsafe", link: "javascript:alert(1)", snippet: "drop me" },
      ],
    });
  }) as typeof fetch, async () => {
    const result = await searchSearch1Api("python docs", " s1-test-key ", 3, {
      freshness: "week",
      includeDomains: ["docs.python.org"],
      excludeDomains: ["spam.example"],
      timeoutSeconds: 17,
    });

    assert.equal(capturedUrl, "https://api.search1api.com/search");
    assert.equal(capturedInit?.method, "POST");
    assert.equal(capturedInit?.redirect, "error");
    const headers = capturedInit?.headers as Record<string, string>;
    assert.equal(headers.Authorization, "Bearer s1-test-key");
    assert.deepEqual(JSON.parse(String(capturedInit?.body)), {
      query: "python docs",
      max_results: 3,
      search_service: "google",
      crawl_results: 0,
      include_sites: ["docs.python.org"],
      exclude_sites: ["spam.example"],
      time_range: "week",
    });

    assert.equal(result.provider, "search1api");
    assert.equal(result.query, "python docs");
    assert.deepEqual(result.results, [{
      url: "https://docs.python.org/3/",
      title: "Python docs",
      snippet: "Official Python documentation.",
      date: "2026-01-02",
      source: "python.org",
    }]);
    assert.deepEqual(result.images, []);
    assert.equal(result.metadata.endpoint, "search");
    assert.equal(result.metadata.service, "google");
  });
});

test("searchSearch1Api maps the news vertical to /news with its own service", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  await withFetch((async (url, init) => {
    capturedUrl = String(url);
    capturedInit = init;
    return jsonResponse({ results: [] });
  }) as typeof fetch, async () => {
    const result = await searchSearch1Api("tech news", "key", 5, {
      searchType: "news",
      newsService: "hackernews",
    });
    assert.equal(capturedUrl, "https://api.search1api.com/news");
    assert.equal(JSON.parse(String(capturedInit?.body)).search_service, "hackernews");
    assert.equal(result.metadata.endpoint, "news");
    assert.equal(result.metadata.service, "hackernews");
  });
});

test("searchSearch1Api validates service overrides against the allowlist", async () => {
  await assert.rejects(
    () => searchSearch1Api("q", "key", 5, { searchService: "not-a-service" }),
    (error: any) => error instanceof ProviderConfigError && error.code === "search1api_search_service_invalid",
  );
  await assert.rejects(
    () => searchSearch1Api("q", "key", 5, { searchType: "news", newsService: "github" }),
    (error: any) => error instanceof ProviderConfigError && error.code === "search1api_news_service_invalid",
  );
});

test("searchSearch1Api requires a key and a bounded query", async () => {
  await assert.rejects(
    () => searchSearch1Api("q", "  ", 5),
    (error: any) => error instanceof ProviderConfigError && error.code === "search1api_key_required",
  );
  await assert.rejects(
    () => searchSearch1Api("   ", "key", 5),
    (error: any) => error instanceof ProviderConfigError && error.code === "search1api_query_invalid",
  );
});

test("searchSearch1Api classifies auth rejection and transient failures", async () => {
  await withFetch((async () => jsonResponse({}, 401)) as typeof fetch, async () => {
    await assert.rejects(
      () => searchSearch1Api("q", "bad-key", 5),
      (error: any) => error instanceof ProviderConfigError && error.code === "search1api_key_rejected",
    );
  });
  await withFetch((async () => jsonResponse({}, 503)) as typeof fetch, async () => {
    await assert.rejects(
      () => searchSearch1Api("q", "key", 5),
      (error: any) => error instanceof ProviderRequestError
        && error.code === "search1api_http_503"
        && error.transient === true,
    );
  });
  await withFetch((async () => new Response("not json", { status: 200 })) as typeof fetch, async () => {
    await assert.rejects(
      () => searchSearch1Api("q", "key", 5),
      (error: any) => error instanceof ProviderRequestError && error.code === "search1api_invalid_response",
    );
  });
});

test("extractSearch1Api crawls each URL and projects page text", async () => {
  const seen: string[] = [];
  await withFetch((async (url, init) => {
    assert.equal(String(url), "https://api.search1api.com/crawl");
    const body = JSON.parse(String(init?.body));
    seen.push(body.url);
    return jsonResponse({
      crawlParameters: { url: body.url },
      results: {
        title: "Example",
        link: body.url,
        content: "# Example\n\nBody",
        metadata: { sourceUrl: body.url },
      },
    });
  }) as typeof fetch, async () => {
    const result = await extractSearch1Api(
      ["https://example.com/a", "https://example.com/b"],
      "key",
    );
    assert.deepEqual(seen, ["https://example.com/a", "https://example.com/b"]);
    assert.equal(result.provider, "search1api");
    assert.equal(result.results[0].url, "https://example.com/a");
    assert.equal(result.results[0].title, "Example");
    assert.equal(result.results[0].content, "# Example\n\nBody");
    assert.equal(result.results[0].raw_content, "# Example\n\nBody");
    assert.equal(result.results[0].provider, "search1api");
    assert.equal(result.results[0].error, undefined);
  });
});

test("extractSearch1Api annotates raw-html requests without claiming support", async () => {
  await withFetch((async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    return jsonResponse({ results: { title: "ok", link: body.url, content: "text" } });
  }) as typeof fetch, async () => {
    const result = await extractSearch1Api(["https://example.com/"], "key", { includeRawHtml: true });
    assert.equal(result.results[0].content, "text");
    assert.equal((result.results[0] as any).raw_error, "search1api_raw_html_unsupported");
    assert.equal(result.results[0].raw_html, undefined);
  });
});

test("extractSearch1Api records deterministic per-URL failures and continues", async () => {
  await withFetch((async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    if (body.url.includes("dead")) return jsonResponse({}, 404);
    return jsonResponse({ results: { title: "ok", link: body.url, content: "text" } });
  }) as typeof fetch, async () => {
    const result = await extractSearch1Api(
      ["not a url", "https://dead.example/", "https://ok.example/"],
      "key",
    );
    assert.equal(result.results[0].error, "search1api_url_invalid");
    assert.equal(result.results[1].error, "search1api_http_404");
    assert.equal(result.results[2].content, "text");
  });
});

test("extractSearch1Api stops the batch after a transient upstream failure", async () => {
  let calls = 0;
  await withFetch((async () => {
    calls += 1;
    return jsonResponse({}, 503);
  }) as typeof fetch, async () => {
    const result = await extractSearch1Api(
      ["https://a.example/", "https://b.example/", "https://c.example/"],
      "key",
    );
    assert.equal(calls, 1);
    assert.equal(result.results.length, 1);
    assert.equal(result.results[0].error, "search1api_http_503");
  });
});

test("metadata declares explicit-only search+extract with truthful capabilities", () => {
  assert.equal(SEARCH1API_PROVIDER_METADATA.autoAllowedByDefault, false);
  assert.equal(SEARCH1API_PROVIDER_METADATA.explicitOnly, true);
  assert.equal(SEARCH1API_PROVIDER_METADATA.supportsFreshness, true);
  assert.equal(SEARCH1API_PROVIDER_METADATA.kind, "both");
  assert.equal(SEARCH1API_PROVIDER_METADATA.envVar, "SEARCH1API_KEY");
  assert.deepEqual([...SEARCH1API_PROVIDER_METADATA.capabilityLabels], ["search", "news", "extract", "freshness"]);
  assert.match(SEARCH1API_PROVIDER_METADATA.description, /does not provide, pool, proxy, or share/i);
  assert.equal(SEARCH1API_PROVIDER_METADATA.termsUrl, "https://blog.s1.dev/pages/terms");
  assert.equal(SEARCH1API_PROVIDER_METADATA.privacyPolicyUrl, "https://s1.dev/privacy");
});
