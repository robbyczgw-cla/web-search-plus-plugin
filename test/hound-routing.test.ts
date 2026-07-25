import assert from "node:assert/strict";
import test from "node:test";
import { register, __resetRuntimeStateForTests } from "../index.ts";
import { __resetRoutingPreferencesForTests } from "../routing-config.ts";

test("Hound is explicit-only until auto_allow is enabled", async () => {
  const originalFetch = globalThis.fetch;
  const tools = new Map<string, any>();
  let networkCalls = 0;
  register({
    pluginConfig: {
      houndMcpUrl: "http://127.0.0.1:8765/mcp",
      routingConfigPath: "hound-routing-test",
    },
    registerTool(tool: any) { tools.set(tool.name, tool); },
  });
  globalThis.fetch = (async (_url, init) => {
    networkCalls += 1;
    if (init?.method === "DELETE") return new Response("", { status: 200 });
    const body = JSON.parse(String(init?.body));
    if (body.method === "initialize") {
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { protocolVersion: "2025-03-26" } }), {
        status: 200,
        headers: { "mcp-session-id": "hound-routing-session" },
      });
    }
    if (body.method === "notifications/initialized") return new Response("", { status: 202 });
    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      id: body.id,
      result: {
        structuredContent: {
          results: [{ url: "https://example.com/source", title: "Source", snippet: "Evidence" }],
        },
      },
    }), { status: 200 });
  }) as typeof fetch;
  try {
    const search = tools.get("web_search_plus");
    const blocked = JSON.parse((await search.execute("hound-auto-blocked", {
      query: "query",
      provider: "auto",
    })).content[0].text);
    assert.match(blocked.error, /no configured providers are allowed/);
    assert.equal(networkCalls, 0);

    const config = tools.get("web_routing_config_plus");
    const enabled = JSON.parse((await config.execute("hound-auto-enable", {
      action: "set_auto_allow",
      provider: "hound",
      enabled: true,
    })).content[0].text);
    assert.equal(enabled.config.auto_allow.hound, true);

    const automatic = JSON.parse((await search.execute("hound-auto-enabled", {
      query: "query",
      provider: "auto",
    })).content[0].text);
    assert.equal(automatic.provider, "hound");
    assert.equal(automatic.routing.requested_provider, "auto");
    assert.ok(networkCalls > 0);
  } finally {
    globalThis.fetch = originalFetch;
    __resetRuntimeStateForTests();
    __resetRoutingPreferencesForTests();
  }
});
