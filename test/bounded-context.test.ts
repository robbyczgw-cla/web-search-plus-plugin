import assert from "node:assert/strict";
import test from "node:test";
import {
  __resetExtractCacheForTests,
  extractPlus,
  fairShareAllocations,
  readCachedExtractContent,
} from "../extract.ts";

test("fairShareAllocations redistributes unused shares deterministically", () => {
  assert.deepEqual(fairShareAllocations([100, 900, 900], 1000), [100, 450, 450]);
  assert.deepEqual(fairShareAllocations([10, 10], 21), [10, 10]);
});

test("extractPlus caps URL fan-out before provider execution", async () => {
  const originalFetch = globalThis.fetch;
  let submittedUrls: string[] = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    submittedUrls = body.urls;
    return new Response(JSON.stringify({
      results: body.urls.map((url: string) => ({ url, raw_content: "content" })),
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const urls = Array.from({ length: 12 }, (_unused, index) => `https://example.com/${index}`);
    const response = await extractPlus(
      urls,
      "tavily",
      "markdown",
      false,
      false,
      false,
      { tavilyApiKey: "test", extractMaxUrls: 3 },
      [],
      undefined,
      { maxUrls: 8 },
    );
    assert.deepEqual(submittedUrls, urls.slice(0, 3));
    assert.equal(response.status, "degraded");
    assert.equal(response.limits_applied?.extract.requested_url_count, 12);
    assert.equal(response.limits_applied?.extract.omitted_url_count, 9);
    assert.deepEqual(response.limits_applied?.extract.processed_urls, urls.slice(0, 3));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("extractPlus applies one fair aggregate Unicode context budget", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({
      results: body.urls.map((url: string) => ({ url, raw_content: `${"e\u0301".repeat(900)}${"😀".repeat(900)}` })),
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const response = await extractPlus(
      ["https://example.com/a", "https://example.com/b"],
      "tavily",
      "markdown",
      false,
      false,
      false,
      { tavilyApiKey: "test", extractCharLimit: 10000 },
      [],
      undefined,
      { maxContextChars: 1000 },
    );
    assert.equal(response.status, "degraded");
    assert.equal(response.results.every((item) => item.truncated), true);
    assert.equal(response.results.every((item) => item.content.normalize("NFC") === item.content), true);
    assert.equal(response.limits_applied?.extract.max_context_chars, 1000);
    assert.equal(response.limits_applied?.extract.truncated, true);
    assert.ok((response.limits_applied?.extract.context_chars_returned || 0) <= 1400);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("inline raw_content mirrors budgeted content while its distinct full text stays referenceable", async () => {
  __resetExtractCacheForTests();
  const originalFetch = globalThis.fetch;
  const content = "C".repeat(120_000);
  const rawContent = "R".repeat(130_000);
  globalThis.fetch = async () => new Response(JSON.stringify({
    results: [{ url: "https://example.com/long", content, raw_content: rawContent }],
  }), { status: 200, headers: { "content-type": "application/json" } });
  try {
    const response = await extractPlus(
      ["https://example.com/long"],
      "tavily",
      "markdown",
      false,
      false,
      false,
      { tavilyApiKey: "test", extractAllowPrivateUrls: true, extractCharLimit: 10_000 },
      [],
      undefined,
      { maxContextChars: 1000 },
    );
    const item = response.results[0];
    assert.equal(item.content.length, 1000);
    assert.equal(item.raw_content, item.content);
    assert.equal(
      response.results.reduce((sum, result) => sum + Array.from(result.content).length, 0),
      response.limits_applied?.extract.context_chars_returned,
    );

    const referenced = readCachedExtractContent(item.full_content_ref!, 119_999, 120_000, 129_999, 130_000);
    assert.equal(referenced.content, "C");
    assert.equal(referenced.range.total_chars, 120_000);
    assert.equal(referenced.raw_content, "R");
    assert.equal(referenced.raw_content_range.total_chars, 130_000);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("aggregate truncation runs before the per-result head-tail window", async () => {
  __resetExtractCacheForTests();
  const originalFetch = globalThis.fetch;
  const content = `${"H".repeat(1000)}${"M".repeat(4800)}${"T".repeat(200)}${"Z".repeat(4000)}`;
  globalThis.fetch = async () => new Response(JSON.stringify({
    results: [{ url: "https://example.com/two-limits", raw_content: content }],
  }), { status: 200, headers: { "content-type": "application/json" } });
  try {
    const response = await extractPlus(
      ["https://example.com/two-limits"],
      "tavily",
      "markdown",
      false,
      false,
      false,
      { tavilyApiKey: "test", extractAllowPrivateUrls: true, extractCharLimit: 1000 },
      [],
      undefined,
      { maxContextChars: 6000 },
    );
    const item = response.results[0];
    assert.match(item.content, new RegExp(`^${"H".repeat(666)}`));
    assert.match(item.content, new RegExp(`${"T".repeat(200)}\\n`));
    assert.doesNotMatch(item.content, /Z/);
    assert.match(
      item.content,
      /\[Content truncated: original 6000 chars; omitted middle 5134 chars; showing head and tail\.\]/,
    );
    assert.equal(item.raw_content, item.content);
    assert.equal(response.limits_applied?.extract.context_chars_returned, Array.from(item.content).length);
    assert.equal(response.limits_applied?.extract.truncated, true);
    assert.ok(response.warnings?.some((warning) => warning.code === "wsp.content.truncated"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("content below the per-result limit stays unchanged", async () => {
  __resetExtractCacheForTests();
  const originalFetch = globalThis.fetch;
  const content = "short-content-".repeat(60);
  globalThis.fetch = async () => new Response(JSON.stringify({
    results: [{ url: "https://example.com/short", raw_content: content }],
  }), { status: 200, headers: { "content-type": "application/json" } });
  try {
    const response = await extractPlus(
      ["https://example.com/short"],
      "tavily",
      "markdown",
      false,
      false,
      false,
      { tavilyApiKey: "test", extractAllowPrivateUrls: true, extractCharLimit: 1000 },
      [],
      undefined,
      { maxContextChars: 6000 },
    );
    assert.equal(response.results[0].content, content);
    assert.equal(response.results[0].raw_content, content);
    assert.equal(response.results[0].truncated, undefined);
    assert.equal(response.limits_applied?.extract.context_chars_returned, Array.from(content).length);
    assert.equal(response.limits_applied?.extract.truncated, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
