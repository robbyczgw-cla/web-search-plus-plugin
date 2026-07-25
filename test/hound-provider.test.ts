import assert from "node:assert/strict";
import test from "node:test";
import { extractHound, searchHound } from "../hound-provider.ts";

async function withMockHound(
  handler: (name: string, args: any) => any,
  run: (toolCalls: Array<{ name: string; args: any }>) => Promise<void>,
) {
  const originalFetch = globalThis.fetch;
  const toolCalls: Array<{ name: string; args: any }> = [];
  globalThis.fetch = (async (_url, init) => {
    if (init?.method === "DELETE") return new Response("", { status: 200 });
    const body = JSON.parse(String(init?.body));
    if (body.method === "initialize") {
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { protocolVersion: "2025-03-26" } }), {
        status: 200,
        headers: { "mcp-session-id": `session-${body.id}` },
      });
    }
    if (body.method === "notifications/initialized") return new Response("", { status: 202 });
    const call = { name: body.params.name, args: body.params.arguments };
    toolCalls.push(call);
    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      id: body.id,
      result: { structuredContent: handler(call.name, call.args) },
    }), { status: 200 });
  }) as typeof fetch;
  try {
    await run(toolCalls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("searchHound projects source results and disables the sidecar cache", async () => {
  await withMockHound(
    (_name, _args) => ({
      results: [
        { url: "https://docs.example.com/a", title: "A", snippet: "Evidence", relevance_score: 0.91, position: 1 },
        { url: "https://blocked.example.com/b", title: "Blocked", snippet: "No" },
      ],
      engines_used: ["brave", "startpage"],
      duration_ms: "15.5",
    }),
    async (calls) => {
      const result = await searchHound(
        "query",
        "http://127.0.0.1:8765/mcp",
        5,
        "week",
        ["example.com"],
        ["blocked.example.com"],
      );
      assert.equal(result.provider, "hound");
      assert.deepEqual(result.results.map((item: any) => item.url), ["https://docs.example.com/a"]);
      assert.equal(calls[0].name, "mcp_smart_search");
      assert.equal(calls[0].args.options.cache_ttl, 0);
      assert.equal(calls[0].args.options.freshness, "week");
      assert.deepEqual(calls[0].args.options.exclude_sites, ["blocked.example.com"]);
    },
  );
});

test("extractHound preserves URL cardinality and loads raw HTML only when requested", async () => {
  await withMockHound(
    (_name, args) => {
      const url = args.urls[0];
      if (url.endsWith("/bad")) return { results: [{ url, status: 500, content_ok: false, error: "upstream" }] };
      if (args.extraction_type === "html") return { results: [{ url, status: 200, content_ok: true, content: "<main>raw</main>" }] };
      return {
        results: [{
          url,
          status: 200,
          content_ok: true,
          content: ["first", "second"],
          metadata: { title: "Page" },
          media: ["https://example.com/image.png"],
        }],
      };
    },
    async (calls) => {
      const result = await extractHound(
        ["https://example.com/good", "https://example.com/bad"],
        "http://127.0.0.1:8765/mcp",
        "markdown",
        true,
        true,
        true,
        { maxContentChars: 20000 },
      );
      assert.equal(result.results.length, 2);
      assert.equal(result.results[0].content, "first\nsecond");
      assert.equal(result.results[0].raw_html, "<main>raw</main>");
      assert.equal(result.results[1].error, "hound_fetch_failed");
      assert.equal(calls.length, 3);
      assert.equal(calls.every((call) => call.args.cache_ttl === 0), true);
      assert.equal(calls[0].args.force_fetcher, "stealthy");
      assert.equal(calls[0].args.max_content_chars, 20000);
    },
  );
});
