import test from "node:test";
import assert from "node:assert/strict";
import { register, __resetRuntimeStateForTests } from "../index.ts";
import { extractKeenable, extractPlus, isPrivateOrInternalIp, validateExtractUrls, EXTRACT_PROVIDER_PRIORITY } from "../extract.ts";
import { DEFAULT_PROVIDER_PRIORITY } from "../routing-config.ts";
import { __resetRoutingPreferencesForTests } from "../routing-config.ts";

function searchTool(pluginConfig: Record<string, any>) {
  const tools: any[] = [];
  register({ pluginConfig, registerTool: (tool: any) => tools.push(tool) });
  return tools.find((tool) => tool.name === "web_search_plus");
}

test.beforeEach(() => {
  __resetRuntimeStateForTests();
  __resetRoutingPreferencesForTests();
});

test("hound extends the low-priority provider tails without displacing keenable", () => {
  assert.deepEqual(DEFAULT_PROVIDER_PRIORITY.slice(-2), ["keenable", "hound"]);
  // Hound is guarded and comes after the existing Keenable/Serper extraction fallbacks.
  assert.deepEqual(EXTRACT_PROVIDER_PRIORITY.slice(-3), ["keenable", "serper", "hound"]);
});

test("keyed keenable search uses the authenticated endpoint", async (t) => {
  const calls: Array<{ url: string; init: any }> = [];
  t.mock.method(globalThis, "fetch", async (url: any, init: any) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({
      results: [{ title: "Hit", url: "https://example.com/a", snippet: "s", published_at: "2026-01-01" }],
      number_of_results: 1,
    }), { status: 200 });
  });
  const tool = searchTool({ keenableApiKey: "kk" });
  const output = await tool.execute("id", { query: "test", provider: "keenable", time_range: "week" });
  const payload = JSON.parse(output.content[0].text);
  assert.equal(payload.provider, "keenable");
  assert.equal(payload.results[0].url, "https://example.com/a");
  assert.equal(calls[0].url, "https://api.keenable.ai/v1/search");
  assert.equal((calls[0].init.headers as any)["X-API-Key"], "kk");
  assert.equal(JSON.parse(calls[0].init.body).published_after, "7d");
});

test("keyless keenable requires the opt-in public tier", async (t) => {
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: any) => {
    calls.push(String(url));
    return new Response(JSON.stringify({ results: [{ title: "Hit", url: "https://example.com/a", snippet: "s" }] }), { status: 200 });
  });

  const withoutOptIn = searchTool({});
  const denied = JSON.parse((await withoutOptIn.execute("id", { query: "q", provider: "keenable" })).content[0].text);
  assert.match(String(denied.error), /Keenable requires an API key/);
  assert.equal(calls.length, 0);

  __resetRuntimeStateForTests();
  const withOptIn = searchTool({ keenableAllowPublic: true });
  const allowed = JSON.parse((await withOptIn.execute("id", { query: "q", provider: "keenable" })).content[0].text);
  assert.equal(allowed.provider, "keenable");
  assert.equal(calls[0], "https://api.keenable.ai/v1/search/public");
  assert.equal(allowed.metadata.public_endpoint, true);
});

test("extractKeenable loops per URL with per-URL error items", async (t) => {
  let call = 0;
  t.mock.method(globalThis, "fetch", async (url: any) => {
    call += 1;
    if (call === 1) {
      assert.match(String(url), /^https:\/\/api\.keenable\.ai\/v1\/fetch\?url=/);
      return new Response(JSON.stringify({ url: "https://ok.example/x", title: "T", content: "body" }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: "boom" }), { status: 500 });
  });
  const result = await extractKeenable(["https://ok.example/x", "https://fail.example/y"], "key");
  assert.equal(result.results[0].content, "body");
  assert.ok(result.results[1].error);
});

test("isPrivateOrInternalIp classifies the changelog ranges", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255"]) {
    assert.equal(isPrivateOrInternalIp(ip), true, ip);
  }
  for (const ip of ["::1", "::", "fc00::1", "fd12::1", "fe80::1", "ff02::1", "::ffff:10.0.0.1"]) {
    assert.equal(isPrivateOrInternalIp(ip), true, ip);
  }
  for (const ip of ["8.8.8.8", "93.184.216.34", "2606:4700::1111", "::ffff:8.8.8.8"]) {
    assert.equal(isPrivateOrInternalIp(ip), false, ip);
  }
});

test("extractPlus rejects private/internal target URLs by default", async (t) => {
  let fetched = 0;
  t.mock.method(globalThis, "fetch", async () => {
    fetched += 1;
    return new Response("{}", { status: 200 });
  });
  const runtimeConfig = { tavilyApiKey: "t" };
  for (const url of ["http://127.0.0.1/admin", "http://localhost/x", "http://169.254.169.254/latest/meta-data", "http://[::1]/x", "http://10.0.0.5/x"]) {
    const result = await extractPlus([url], "auto", "markdown", false, false, false, runtimeConfig);
    assert.match(String(result.error), /blocked/i, url);
    assert.equal(result.results.length, 0);
  }
  assert.equal(fetched, 0);
});

test("extractAllowPrivateUrls opts into trusted intranet extraction", async () => {
  await validateExtractUrls(["http://127.0.0.1/x"], { extractAllowPrivateUrls: true });
  await assert.rejects(() => validateExtractUrls(["http://127.0.0.1/x"], {}), /blocked/);
});

test("keenable joins auto extraction as last fallback when opted in", async (t) => {
  const urlsRequested: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: any) => {
    urlsRequested.push(String(url));
    if (String(url).includes("keenable")) {
      return new Response(JSON.stringify({ url: "https://example.com", title: "T", content: "body" }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: "down" }), { status: 500 });
  });
  const result = await extractPlus(["https://example.com"], "auto", "markdown", false, false, false, { tavilyApiKey: "t", keenableAllowPublic: true });
  assert.equal(result.provider, "keenable");
  assert.ok(urlsRequested.some((u) => u.includes("api.keenable.ai/v1/fetch/public")));
});
