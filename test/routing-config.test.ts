import test from "node:test";
import assert from "node:assert/strict";
import { register } from "../index.ts";

type MockFetchCall = { url: string; init?: RequestInit };

function withRegistered(pluginConfig: Record<string, any> = {}) {
  const registered = new Map<string, any>();
  register({
    registerTool(tool: any) { registered.set(tool.name, tool); },
    pluginConfig,
  });
  return registered;
}

let routingConfigCounter = 0;
function makeRoutingConfigPath() {
  routingConfigCounter += 1;
  return { file: `test-routing-${routingConfigCounter}` };
}

async function withMockedFetch(
  responder: (url: string, init?: RequestInit) => any,
  fn: (calls: MockFetchCall[]) => Promise<void>,
) {
  const originalFetch = globalThis.fetch;
  const calls: MockFetchCall[] = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const href = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
    calls.push({ url: href, init });
    return responder(href, init);
  }) as typeof fetch;
  try {
    await fn(calls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function mockJsonResponse(body: any, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(body);
    },
  };
}

test("web_routing_config_plus shows defaults without leaking secrets", async () => {
  const { file } = makeRoutingConfigPath();
  const registered = withRegistered({ routingConfigPath: file, serperApiKey: "serper-secret" });
  const response = await registered.get("web_routing_config_plus").execute("cfg-show", { action: "show" });
  const payload = JSON.parse(response.content[0].text);

  assert.equal(payload.config.auto_routing, true);
  assert.equal(payload.config.default_provider, null);
  assert.equal(payload.config.confidence_threshold, 0.4);
  assert.equal(JSON.stringify(payload).includes("serper-secret"), false);
  assert.equal(payload.config_path, `memory:${file}`);
});

test("web_routing_config_plus supports set/show/reset actions", async () => {
  const { file } = makeRoutingConfigPath();
  const registered = withRegistered({ routingConfigPath: file });
  const tool = registered.get("web_routing_config_plus");

  await tool.execute("cfg-default", { action: "set_default_provider", provider: "kilo-perplexity" });
  await tool.execute("cfg-auto", { action: "set_auto_routing", enabled: false });
  await tool.execute("cfg-priority", { action: "set_provider_priority", providers: ["brave", "serper"] });
  await tool.execute("cfg-fallback", { action: "set_fallback_provider", provider: "serper" });
  await tool.execute("cfg-disable", { action: "disable_provider", provider: "brave" });
  await tool.execute("cfg-enable", { action: "enable_provider", provider: "brave" });
  await tool.execute("cfg-threshold", { action: "set_confidence_threshold", confidence_threshold: 0.75 });

  const show = JSON.parse((await tool.execute("cfg-show", { action: "show" })).content[0].text);
  assert.equal(show.config.default_provider, "kilo-perplexity");
  assert.equal(show.config.auto_routing, false);
  assert.deepEqual(show.config.provider_priority.slice(0, 3), ["brave", "serper", "tavily"]);
  assert.equal(show.config.fallback_provider, "serper");
  assert.deepEqual(show.config.disabled_providers, []);
  assert.equal(show.config.confidence_threshold, 0.75);

  const reset = JSON.parse((await tool.execute("cfg-reset", { action: "reset" })).content[0].text);
  assert.equal(reset.config.auto_routing, true);
  assert.equal(reset.backup_path, undefined);
});

test("web_routing_config_plus keeps kilo-perplexity distinct from perplexity", async () => {
  const { file } = makeRoutingConfigPath();
  const registered = withRegistered({ routingConfigPath: file });
  const tool = registered.get("web_routing_config_plus");

  await tool.execute("cfg-default-kilo", { action: "set_default_provider", provider: "kilo-perplexity" });
  await tool.execute("cfg-fallback-kilo", { action: "set_fallback_provider", provider: "kilo_perplexity" });
  await tool.execute("cfg-priority-kilo", { action: "set_provider_priority", providers: ["kilo_perplexity", "perplexity"] });

  const show = JSON.parse((await tool.execute("cfg-show-kilo", { action: "show" })).content[0].text);
  assert.equal(show.config.default_provider, "kilo-perplexity");
  assert.equal(show.config.fallback_provider, "kilo-perplexity");
  assert.deepEqual(show.config.provider_priority.slice(0, 2), ["kilo-perplexity", "perplexity"]);
});

test("web_search_plus uses strict default provider mode when auto routing is disabled", async () => {
  const { file } = makeRoutingConfigPath();
  const registered = withRegistered({ routingConfigPath: file, serperApiKey: "serper-test", braveApiKey: "brave-test" });
  await registered.get("web_routing_config_plus").execute("cfg-default", { action: "set_default_provider", provider: "serper" });
  await registered.get("web_routing_config_plus").execute("cfg-auto", { action: "set_auto_routing", enabled: false });

  await withMockedFetch(
    (url) => {
      if (url.includes("serper.dev")) {
        return mockJsonResponse({
          organic: [{ title: "Strict default result", link: "https://example.com/strict", snippet: "Strict default" }],
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
    async (calls) => {
      const response = await registered.get("web_search_plus").execute("search-1", {
        query: "weather in vienna today",
        provider: "auto",
      });
      const payload = JSON.parse(response.content[0].text);
      assert.equal(payload.provider, "serper");
      assert.equal(payload.routing.fixed_provider_mode, true);
      assert.equal(calls.length, 1);
      assert.match(calls[0].url, /serper/);
    },
  );
});

test("invalid provider config falls back to defaults", async () => {
  const { file } = makeRoutingConfigPath();
  const registered = withRegistered({ routingConfigPath: file, routingPreferences: { disabled_providers: ["bogus"] } });

  const response = await registered.get("web_routing_config_plus").execute("cfg-invalid-provider", { action: "show" });
  const payload = JSON.parse(response.content[0].text);

  assert.equal(payload.source, "default");
  assert.match(payload.warning, /validation failure/i);
  assert.equal(payload.quarantine_path, undefined);
  assert.deepEqual(payload.config.disabled_providers, []);
});

test("invalid threshold config falls back to defaults", async () => {
  const { file } = makeRoutingConfigPath();
  const registered = withRegistered({ routingConfigPath: file, routingPreferences: { confidence_threshold: 9 } });

  const response = await registered.get("web_routing_config_plus").execute("cfg-invalid-threshold", { action: "show" });
  const payload = JSON.parse(response.content[0].text);

  assert.equal(payload.source, "default");
  assert.equal(payload.quarantine_path, undefined);
  assert.equal(payload.config.confidence_threshold, 0.4);
});

test("object routing config from plugin config is applied", async () => {
  const { file } = makeRoutingConfigPath();
  const registered = withRegistered({ routingConfigPath: file, routingPreferences: { auto_routing: false, default_provider: "brave" } });

  const response = await registered.get("web_routing_config_plus").execute("cfg-object", { action: "show" });
  const payload = JSON.parse(response.content[0].text);

  assert.equal(payload.source, "plugin_config");
  assert.equal(payload.config.auto_routing, false);
  assert.equal(payload.config.default_provider, "brave");
});
