import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalDiversityUrl,
  registrableDomain,
  rerankDuplicateCandidates,
  scoreDiversity,
  snippetSimilarity,
} from "../diversity.ts";

test("diversity URL and registrable-domain normalization is conservative", () => {
  assert.equal(registrableDomain("https://news.example.co.uk/story"), "example.co.uk");
  assert.equal(registrableDomain("https://docs.example.com/story"), "example.com");
  assert.equal(
    canonicalDiversityUrl("https://EXAMPLE.com:443/story/?utm_source=x&b=2&a=1#part"),
    "https://example.com/story?a=1&b=2",
  );
});

test("scoreDiversity reports duplicate explanations and weighted components", () => {
  const repeated = "alpha beta gamma delta epsilon zeta";
  const report = scoreDiversity([
    { url: "https://a.example.com/doc?utm_source=x", snippet: repeated, provider: "one" },
    { url: "https://a.example.com/doc", snippet: repeated, provider: "two" },
    { url: "https://other.net/unique", snippet: "entirely different source material here", provider: "two" },
  ]);
  assert.equal(report.duplicates.some((item) => item.kind === "url" && item.dropped_candidate === 1), true);
  assert.equal(report.duplicates.some((item) => item.kind === "content" && item.dropped_candidate === 1), true);
  assert.equal(report.dominant_domain?.domain, "example.com");
  assert.ok(report.score > 0 && report.score < 1);
  assert.equal(snippetSimilarity(repeated, repeated), 1);
});

test("duplicate rerank preserves every result and moves only later candidates", () => {
  const input = [
    { url: "https://one.example/a", snippet: "same words form a repeated result snippet" },
    { url: "https://one.example/b", snippet: "same words form a repeated result snippet" },
    { url: "https://two.example/c", snippet: "fresh material from another source entirely" },
  ];
  const output = rerankDuplicateCandidates(input);
  assert.deepEqual(output.results.map((item) => item.url), [input[0].url, input[2].url, input[1].url]);
  assert.equal(output.results.length, input.length);
});
