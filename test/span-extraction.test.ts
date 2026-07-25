import assert from "node:assert/strict";
import test from "node:test";
import { extractPlus } from "../extract.ts";
import { selectSpans } from "../span-extraction.ts";

test("selectSpans returns deterministic non-overlapping NFC codepoint ranges", () => {
  const source = `Intro 😀 text.\n\nThe cafe\u0301 release includes exact audit evidence. It is deterministic.\n\nTail.`;
  const normalized = source.normalize("NFC");
  const points = Array.from(normalized);
  const first = selectSpans(source, "exact audit evidence");
  const second = selectSpans(source, "exact audit evidence");
  assert.deepEqual(first, second);
  assert.ok(first.length > 0);
  for (const span of first) {
    assert.equal(points.slice(span.start, span.end).join(""), span.text);
  }
  assert.equal(first.some((span) => span.text.includes("exact audit evidence")), true);
  assert.equal(first.every((span, index) => index === 0 || first[index - 1].end <= span.start), true);
});

test("extract spans address full text and report bounded-preview membership", async () => {
  const originalFetch = globalThis.fetch;
  const content = `${"Lead sentence. ".repeat(100)}Target evidence lives beyond the preview.`;
  globalThis.fetch = async () => new Response(JSON.stringify({
    results: [{ url: "https://example.com/doc", raw_content: content }],
  }), { status: 200, headers: { "content-type": "application/json" } });
  try {
    const response = await extractPlus(
      ["https://example.com/doc"],
      "tavily",
      "markdown",
      false,
      false,
      false,
      { tavilyApiKey: "test", extractCharLimit: 10000 },
      [],
      undefined,
      { maxContextChars: 1000, spans: true, spansQuery: "target evidence" },
    );
    const result = response.results[0];
    assert.equal(result.span_contract_version, 1);
    assert.equal(result.spans?.some((span) => span.text.toLowerCase().includes("target evidence")), true);
    assert.equal(result.spans?.find((span) => span.text.toLowerCase().includes("target evidence"))?.within_preview, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
