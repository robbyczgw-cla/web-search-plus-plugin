import assert from "node:assert/strict";
import test from "node:test";
import {
  createDonsetchAdapter,
  extractDonsetch,
  searchDonsetch,
} from "../donsetch-provider.ts";
import {
  DONSETCH_MCP_PROTOCOL_VERSION,
  type DonsetchCommandRunner,
} from "../donsetch-transport.ts";

type JsonObject = Record<string, any>;

function sessionRunner(
  handler: (tool: string, args: JsonObject, index: number) => JsonObject,
  invocations: Array<{ argv: string[]; messages: JsonObject[] }>,
): DonsetchCommandRunner {
  return async (argv, options) => {
    const messages = String(options.input).trim().split("\n").map((line) => JSON.parse(line));
    invocations.push({ argv, messages });
    const calls = messages.filter((message) => message.method === "tools/call");
    return {
      stdout: [
        JSON.stringify({ jsonrpc: "2.0", id: 1, result: { protocolVersion: DONSETCH_MCP_PROTOCOL_VERSION } }),
        ...calls.map((message, index) => JSON.stringify({
          jsonrpc: "2.0",
          id: message.id,
          result: handler(message.params.name, message.params.arguments, index),
        })),
      ].join("\n"),
      stderr: "",
      code: 0,
      signal: null,
      killed: false,
      termination: "exit",
    };
  };
}

test("searchDonsetch projects bounded source-only results and domain filters", async () => {
  const invocations: Array<{ argv: string[]; messages: JsonObject[] }> = [];
  const runner = sessionRunner((tool, args) => {
    assert.equal(tool, "web_search");
    assert.deepEqual(args, { query: "release evidence", max_results: 5, intent: "news" });
    return {
      structuredContent: {
        results: [
          {
            url: "https://docs.example.com/release",
            title: "T".repeat(700),
            snippet: "Evidence",
            score: "0.91",
            engines: ["brave", "startpage"],
            consensus: "strong",
          },
          { url: "https://blocked.example.com/no", title: "Blocked", snippet: "No" },
          { url: "https://user:password@docs.example.com/secret", title: "Credentials", snippet: "No" },
          { url: "javascript:alert(1)", title: "Invalid", snippet: "No" },
        ],
        engines: [
          { engine: "brave", status: "ok" },
          { engine: "broken", status: "blocked" },
        ],
        intent: "news",
        cached: false,
        weak: false,
        elapsed_ms: "12.5",
        answer: "upstream synthesis must not escape",
        synthesis: "upstream synthesis must not escape",
      },
      content: [{ type: "text", text: "ignored search summary" }],
    };
  }, invocations);

  const result = await searchDonsetch(runner, {
    binary: "/opt/donsetch",
    query: "release evidence",
    maxResults: 5,
    searchType: "news",
    includeDomains: ["example.com"],
    excludeDomains: ["blocked.example.com"],
  });
  assert.equal(invocations.length, 1);
  assert.deepEqual(invocations[0].argv, ["/opt/donsetch", "mcp"]);
  assert.equal((result.results as JsonObject[]).length, 1);
  assert.equal((result.results as JsonObject[])[0].url, "https://docs.example.com/release");
  assert.equal(String((result.results as JsonObject[])[0].title).length, 512);
  for (const synthesisField of ["answer", "answer_text", "summary", "synthesis", "generated_answer"]) {
    assert.equal(Object.hasOwn(result, synthesisField), false, `unexpected synthesis field: ${synthesisField}`);
  }
  assert.ok(!JSON.stringify(result).includes("upstream synthesis must not escape"));
  assert.deepEqual((result.metadata as JsonObject).engines_used, ["brave"]);
  assert.deepEqual((result.metadata as JsonObject).engine_blocked, ["broken"]);
  assert.equal((result.metadata as JsonObject).duration_ms, 12.5);
});

test("extractDonsetch reuses one session for multiple URLs and bounds content", async () => {
  const invocations: Array<{ argv: string[]; messages: JsonObject[] }> = [];
  const runner = sessionRunner((tool, args, index) => {
    assert.equal(tool, "web_fetch");
    assert.equal(args.max_chars, 500);
    assert.equal(args.media, true);
    assert.equal(args.tier, "2");
    if (index === 1) {
      return {
        structuredContent: {
          url: args.url,
          status: 503,
          content_ok: false,
          verdict: "Failed",
        },
        content: [{ type: "text", text: "upstream detail must not escape" }],
      };
    }
    return {
      structuredContent: {
        url: args.url,
        status: 200,
        content_ok: true,
        title: "Page",
        content_kind: "markdown",
        quality: "0.8",
        lang: "en",
        site: "example.com",
        images: ["https://example.com/image.png", "javascript:bad"],
      },
      content: [{ type: "text", text: "a".repeat(600) }],
    };
  }, invocations);

  const result = await extractDonsetch(runner, {
    binary: "/opt/donsetch",
    urls: ["https://example.com/good", "https://example.com/bad"],
    outputFormat: "markdown",
    includeImages: true,
    includeRawHtml: true,
    renderJs: true,
    maxContentChars: 500,
  });
  assert.equal(invocations.length, 1);
  const toolCalls = invocations[0].messages.filter((message) => message.method === "tools/call");
  assert.equal(toolCalls.length, 2);
  assert.deepEqual(toolCalls.map((message) => message.params.arguments.url), [
    "https://example.com/good",
    "https://example.com/bad",
  ]);
  assert.equal(result.results.length, 2);
  assert.equal(result.results[0].content.length, 500);
  assert.equal(result.results[0].truncated, true);
  assert.equal(result.results[0].original_chars, 600);
  assert.deepEqual(result.results[0].images, [{ url: "https://example.com/image.png" }]);
  assert.equal((result.results[0] as JsonObject).raw_error, "donsetch_raw_html_unsupported");
  assert.equal(result.results[1].error, "donsetch_fetch_failed");
  assert.ok(!JSON.stringify(result.results[1]).includes("upstream detail"));
});

test("unsupported DonSeTch capabilities fail before a child process is launched", async (t) => {
  let calls = 0;
  const runner: DonsetchCommandRunner = async () => {
    calls += 1;
    throw new Error("must not run");
  };

  await t.test("freshness", async () => {
    await assert.rejects(
      searchDonsetch(runner, { binary: "/opt/donsetch", query: "test", freshness: "week" }),
      /donsetch_freshness_unsupported/,
    );
  });
  await t.test("images search", async () => {
    await assert.rejects(
      searchDonsetch(runner, { binary: "/opt/donsetch", query: "test", images: true }),
      /donsetch_image_search_unsupported/,
    );
  });
  await t.test("html extraction", async () => {
    await assert.rejects(
      extractDonsetch(runner, { binary: "/opt/donsetch", urls: ["https://example.com"], outputFormat: "html" }),
      /donsetch_output_format_unsupported/,
    );
  });
  assert.equal(calls, 0);
});

test("createDonsetchAdapter binds the injected OpenClaw runner", async () => {
  const invocations: Array<{ argv: string[]; messages: JsonObject[] }> = [];
  const runner = sessionRunner(() => ({
    structuredContent: { results: [] },
    content: [],
  }), invocations);
  const adapter = createDonsetchAdapter(runner);
  const result = await adapter.search({ binary: "/opt/donsetch", query: "test" });
  assert.equal(result.provider, "donsetch");
  assert.equal(invocations.length, 1);
});

test("compact search binds evidence and namespaced diagnostics before domain filtering", async () => {
  const runner = sessionRunner(() => ({
    structuredContent: { results: [
      { rank: 1, handle: "ref1", url: "https://example.net/dropped" },
      { rank: 3, handle: "ref3", url: "https://example.com/kept" },
      { rank: 4, handle: "ref4", url: "https://example.com/mismatch" },
    ] },
    content: [{ type: "text", text: "1. ref1 · Dropped : example.net\n   Wrong snippet\n3. ref3 · Kept: colon title : example.com · ⚠ warning\n   Bound snippet\n   More evidence\n4. ref3 · Mismatched : example.com\n   Must not attach\nWeak results footer\n   Not evidence" }],
    _meta: { "com.donsetch/search-debug": { intent: "news", elapsed_ms: 12, cached: true, weak: true,
      engines: [{ engine: "first", status: "ok" }, { engine: "second", status: "blocked" }],
      results: [{ score: 0.1 }, { score: 0.9, engines: ["first"], consensus: "strong", secret: "must not leak" }],
      secret: "must not leak" }, secret: "must not leak" },
  }), []);
  const result = await searchDonsetch(runner, { binary: "/opt/donsetch", query: "evidence", includeDomains: ["example.com"] }) as JsonObject;
  assert.equal(result.results[0].position, 3);
  assert.equal(result.results[0].title, "Kept: colon title");
  assert.equal(result.results[0].snippet, "Bound snippet\nMore evidence");
  assert.equal(result.results[0].score, 0.9);
  assert.deepEqual(result.results[0].engines, ["first"]);
  assert.equal(result.results[1].snippet, "");
  assert.equal(result.metadata.cached, true);
  assert.equal(result.metadata.weak, true);
  assert.equal(result.metadata.intent, "news");
  assert.equal(result.metadata.duration_ms, 12);
  assert.deepEqual(result.metadata.engine_blocked, ["second"]);
  assert.ok(!JSON.stringify(result).includes("must not leak"));
});

test("compact fetch uses whitelisted debug fields and respects legacy field precedence", async () => {
  for (const legacy of [false, true]) {
    const runner = sessionRunner(() => ({
      structuredContent: { url: "https://example.com/page", ...(legacy ? { title: "Legacy title", status: 200, content_ok: true } : {}) },
      content: [{ type: "text", text: "Source evidence" }],
      _meta: { "com.donsetch/fetch-debug": { title: "Compact title", status: legacy ? 503 : 200, verdict: "ContentOk", quality: 0.8, site: "example.com", secret: "must not leak" } },
    }), []);
    const result = await extractDonsetch(runner, { binary: "/opt/donsetch", urls: ["https://example.com/page"] });
    assert.equal(result.results[0].error, undefined);
    assert.equal(result.results[0].title, legacy ? "Legacy title" : "Compact title");
    assert.equal(result.results[0].metadata?.quality, 0.8);
    assert.ok(!JSON.stringify(result).includes("must not leak"));
  }
});

test("compact fetch rejects blocked and failed diagnostic verdicts", async () => {
  const runner = sessionRunner(() => ({
    structuredContent: {}, content: [{ type: "text", text: "Blocked page" }],
    _meta: { "com.donsetch/fetch-debug": { status: 403, verdict: "Blocked" } },
  }), []);
  const result = await extractDonsetch(runner, { binary: "/opt/donsetch", urls: ["https://example.com/page"] });
  assert.equal(result.results[0].error, "donsetch_fetch_failed");
});
