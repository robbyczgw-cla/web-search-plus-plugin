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
  assert.deepEqual(payload.config.extract_provider_priority.slice(0, 3), ["tavily", "exa", "linkup"]);
  assert.equal(payload.config.confidence_threshold, 0.4);
  assert.equal(JSON.stringify(payload).includes("serper-secret"), false);
  assert.equal(payload.config_path, `memory:${file}`);
});

test("web_routing_config_plus supports set/show/reset actions", async () => {
  const { file } = makeRoutingConfigPath();
  const registered = withRegistered({ routingConfigPath: file });
  const tool = registered.get("web_routing_config_plus");

  await tool.execute("cfg-default", { action: "set_default_provider", provider: "tavily" });
  await tool.execute("cfg-auto", { action: "set_auto_routing", enabled: false });
  await tool.execute("cfg-priority", { action: "set_provider_priority", providers: ["brave", "serper"] });
  await tool.execute("cfg-extract-priority", { action: "set_extract_provider_priority", providers: ["serper", "linkup"] });
  await tool.execute("cfg-fallback", { action: "set_fallback_provider", provider: "serper" });
  await tool.execute("cfg-disable", { action: "disable_provider", provider: "brave" });
  await tool.execute("cfg-enable", { action: "enable_provider", provider: "brave" });
  await tool.execute("cfg-threshold", { action: "set_confidence_threshold", confidence_threshold: 0.75 });

  const show = JSON.parse((await tool.execute("cfg-show", { action: "show" })).content[0].text);
  assert.equal(show.config.default_provider, "tavily");
  assert.equal(show.config.auto_routing, false);
  assert.deepEqual(show.config.provider_priority.slice(0, 3), ["brave", "serper", "tavily"]);
  assert.deepEqual(show.config.extract_provider_priority.slice(0, 4), ["serper", "linkup", "tavily", "exa"]);
  assert.equal(show.config.fallback_provider, "serper");
  assert.deepEqual(show.config.disabled_providers, []);
  assert.equal(show.config.confidence_threshold, 0.75);

  const reset = JSON.parse((await tool.execute("cfg-reset", { action: "reset" })).content[0].text);
  assert.equal(reset.config.auto_routing, true);
  assert.equal(reset.backup_path, undefined);
});

test("self_hosted profile derives local auto routing and preserves explicit overrides", async () => {
  const { file } = makeRoutingConfigPath();
  const registered = withRegistered({
    routingConfigPath: file,
    keenableAllowPublic: true,
    serperApiKey: "serper-test",
  });
  const configTool = registered.get("web_routing_config_plus");
  const profileResponse = JSON.parse((await configTool.execute("cfg-profile", {
    action: "set_profile",
    profile: "self_hosted",
  })).content[0].text);
  assert.equal(profileResponse.config.profile, "self_hosted");
  assert.deepEqual(profileResponse.effective_config.provider_priority.slice(0, 2), ["searxng", "keenable"]);
  assert.equal(profileResponse.effective_config.auto_allow.serper, false);

  await withMockedFetch(
    (url) => {
      if (url.includes("api.keenable.ai/v1/search/public")) {
        return mockJsonResponse({ results: [{ title: "Local", url: "https://example.com/local", snippet: "local result" }] });
      }
      if (url.includes("google.serper.dev")) {
        return mockJsonResponse({ organic: [{ title: "Explicit", link: "https://example.com/explicit", snippet: "explicit result" }] });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
    async (calls) => {
      const search = registered.get("web_search_plus");
      const automatic = JSON.parse((await search.execute("self-hosted-auto", {
        query: "local-first query",
        provider: "auto",
      })).content[0].text);
      assert.equal(automatic.provider, "keenable");
      assert.equal(automatic.routing.profile, "self_hosted");

      const explicit = JSON.parse((await search.execute("self-hosted-explicit", {
        query: "explicit query",
        provider: "serper",
      })).content[0].text);
      assert.equal(explicit.provider, "serper");
      assert.equal(explicit.routing.explicit_profile_override, true);
      assert.equal(calls.length, 2);
    },
  );
});

test("self_hosted profile fails auto mode clearly when no local provider is ready", async () => {
  const { file } = makeRoutingConfigPath();
  const registered = withRegistered({ routingConfigPath: file, serperApiKey: "serper-test" });
  await registered.get("web_routing_config_plus").execute("cfg-profile-empty", {
    action: "set_profile",
    profile: "self_hosted",
  });
  const payload = JSON.parse((await registered.get("web_search_plus").execute("self-hosted-empty", {
    query: "must stay local",
    provider: "auto",
  })).content[0].text);
  assert.match(payload.error, /self_hosted profile requires/);
  assert.equal(payload.routing.profile, "self_hosted");
});

test("web_routing_config_plus rejects search-only providers in extract priority", async () => {
  const { file } = makeRoutingConfigPath();
  const tool = withRegistered({ routingConfigPath: file }).get("web_routing_config_plus");
  const response = await tool.execute("cfg-extract-invalid", {
    action: "set_extract_provider_priority",
    providers: ["brave"],
  });
  assert.match(response.content[0].text, /does not support extraction: brave/);
});

test("web_routing_config_plus rejects removed answer-style providers", async () => {
  const { file } = makeRoutingConfigPath();
  const registered = withRegistered({ routingConfigPath: file });
  const tool = registered.get("web_routing_config_plus");

  const direct = await tool.execute("cfg-default-answer", { action: "set_default_provider", provider: "perplexity" });
  const gateway = await tool.execute("cfg-default-kilo", { action: "set_default_provider", provider: "kilo-perplexity" });
  assert.match(direct.content[0].text, /Unknown provider: perplexity/);
  assert.match(gateway.content[0].text, /Unknown provider: kilo-perplexity/);
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
