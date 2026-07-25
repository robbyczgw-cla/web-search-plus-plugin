import assert from "node:assert/strict";
import test from "node:test";
import { callHoundTool, validateHoundEndpoint } from "../hound-transport.ts";

test("Hound endpoint accepts only an uncredentialed loopback HTTP /mcp URL", () => {
  assert.equal(validateHoundEndpoint("http://127.0.0.1:8765/mcp"), "http://127.0.0.1:8765/mcp");
  assert.equal(validateHoundEndpoint("http://[::1]:8765/mcp"), "http://[::1]:8765/mcp");
  for (const endpoint of [
    "https://127.0.0.1:8765/mcp",
    "http://localhost:8765/mcp",
    "http://10.0.0.5:8765/mcp",
    "http://127.0.0.1:8765/other",
    "http://user:pass@127.0.0.1:8765/mcp",
    "http://127.0.0.1:8765/mcp?token=secret",
    "http://127.0.0.1:8765/mcp#fragment",
  ]) {
    assert.throws(() => validateHoundEndpoint(endpoint), /hound_endpoint_invalid/);
  }
});

test("Hound transport initializes, calls a tool, disables redirects, and closes the session", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ method: string; init?: RequestInit; body?: any }> = [];
  globalThis.fetch = (async (_url, init) => {
    const method = String(init?.method || "GET");
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, init, body });
    if (method === "DELETE") return new Response("", { status: 200 });
    if (body.method === "initialize") {
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { protocolVersion: "2025-03-26" } }), {
        status: 200,
        headers: { "content-type": "application/json", "mcp-session-id": "session-test" },
      });
    }
    if (body.method === "notifications/initialized") return new Response("", { status: 202 });
    return new Response(`event: message\ndata: ${JSON.stringify({
      jsonrpc: "2.0",
      id: body.id,
      result: { structuredContent: { results: [{ url: "https://example.com" }] } },
    })}\n\n`, { status: 200, headers: { "content-type": "text/event-stream" } });
  }) as typeof fetch;
  try {
    const result = await callHoundTool(
      "http://127.0.0.1:8765/mcp",
      "mcp_smart_search",
      { query: "test" },
    );
    assert.deepEqual(result, { results: [{ url: "https://example.com" }] });
    assert.deepEqual(calls.map((call) => call.method), ["POST", "POST", "POST", "DELETE"]);
    assert.equal(calls.slice(0, 3).every((call) => call.init?.redirect === "error"), true);
    assert.equal((calls[2].init?.headers as Record<string, string>)["Mcp-Session-Id"], "session-test");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Hound transport enforces response limits and sanitizes protocol details", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("x".repeat(2048), {
    status: 200,
    headers: { "content-length": "2048" },
  })) as typeof fetch;
  try {
    await assert.rejects(
      callHoundTool("http://127.0.0.1:8765/mcp", "mcp_smart_search", {}, { maxResponseBytes: 1024 }),
      (error: any) => error?.message === "hound_mcp_unavailable" && !String(error).includes("too_large"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
