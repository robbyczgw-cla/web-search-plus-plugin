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

test("query-matching Markdown heading keeps its body and stops before a sibling", () => {
  const document = [
    "# Alpine Reservoirs",
    "",
    "This body deliberately uses only neutral prose and measurement details.",
    "",
    "# Other Notes",
    "",
    "Unrelated material follows.",
  ].join("\n");

  const [span] = selectSpans(document, "alpine reservoirs", { maxSpans: 1 });
  assert.equal(span.text.startsWith("# Alpine Reservoirs"), true);
  assert.equal(span.text.includes("neutral prose and measurement details"), true);
  assert.equal(span.text.includes("Other Notes"), false);
});

test("Markdown section stops at a same-or-shallower heading and includes deeper headings", () => {
  const document = [
    "# Parent Background",
    "",
    "Parent-only context stays outside the target subsection.",
    "",
    "## Orbital Calibration",
    "",
    "Neutral calibration prose deliberately omits the query vocabulary.",
    "",
    "### Packing Notes",
    "",
    "Bring insulated layers and a tripod.",
    "",
    "# Sibling Appendix",
    "",
    "Sibling-only context must never leak in.",
  ].join("\n");

  const [span] = selectSpans(document, "orbital", { maxSpans: 1 });
  assert.equal(span.text.startsWith("## Orbital Calibration"), true);
  assert.equal(span.text.includes("### Packing Notes"), true);
  assert.equal(span.text.includes("Bring insulated layers"), true);
  assert.equal(span.text.includes("Parent Background"), false);
  assert.equal(span.text.includes("Sibling Appendix"), false);
});

test("Markdown heading sections use an independent 1,200-codepoint budget", () => {
  const document = `# Mineral Atlas\n\n${"neutral body text ".repeat(100)}\n\n# Later\n\nIgnored.`;

  const [span] = selectSpans(document, "mineral atlas", { maxSpans: 1, maxSpanChars: 10_000 });
  assert.equal(span.text.startsWith("# Mineral Atlas"), true);
  assert.equal(span.text.includes("neutral body text"), true);
  assert.ok(span.end - span.start <= 1_200);
  assert.equal(span.text.includes("Later"), false);
});

test("non-heading span selection remains unchanged", () => {
  const document = [
    "Astronomy notes describe telescope mirrors and distant galaxies.",
    "",
    "Cooking notes explain sourdough starter and bread fermentation.",
  ].join("\n");

  const [span] = selectSpans(document, "telescope galaxies", { maxSpans: 1 });
  assert.equal(span.text, "Astronomy notes describe telescope mirrors and distant galaxies.");
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
