import assert from "node:assert/strict";
import test from "node:test";
import { extractPlus, fairShareAllocations } from "../extract.ts";

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
