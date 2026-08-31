import assert from "node:assert/strict";
import test from "node:test";
import {
  DONSETCH_MCP_PROTOCOL_VERSION,
  DonsetchTransportError,
  donsetchVersionCompatibility,
  inspectDonsetchReadiness,
  runDonsetchSession,
  sanitizeDonsetchDiagnostic,
  type DonsetchCommandRunner,
} from "../donsetch-transport.ts";

function completed(stdout: string, stderr = "") {
  return {
    stdout,
    stderr,
    code: 0,
    signal: null,
    killed: false,
    termination: "exit" as const,
  };
}

test("runDonsetchSession uses one host command and one initialized MCP session for all calls", async () => {
  const originalSecret = process.env.SERPER_API_KEY;
  const originalCache = process.env.DONSETCH_CACHE_DIR;
  process.env.SERPER_API_KEY = "must-not-reach-child";
  process.env.DONSETCH_CACHE_DIR = "/tmp/donsetch-cache";
  let invocations = 0;
  const runner: DonsetchCommandRunner = async (argv, options) => {
    invocations += 1;
    assert.deepEqual(argv, ["/opt/donsetch", "mcp"]);
    assert.equal(options.env?.SERPER_API_KEY, undefined);
    assert.equal(options.env?.DONSETCH_CACHE_DIR, "/tmp/donsetch-cache");
    assert.ok(options.timeoutMs >= 5_000);
    assert.deepEqual(options.maxOutputBytes, { stdout: 4 * 1024 * 1024, stderr: 8 * 1024 });
    assert.equal(options.maxCombinedOutputBytes, 4 * 1024 * 1024 + 8 * 1024);
    assert.equal(options.killProcessTree, true);
    assert.equal(options.terminateOnOutputLimit, true);
    const messages = String(options.input).trim().split("\n").map((line) => JSON.parse(line));
    assert.equal(messages.length, 4);
    assert.equal(messages[0].method, "initialize");
    assert.equal(messages[0].params.protocolVersion, DONSETCH_MCP_PROTOCOL_VERSION);
    assert.equal(messages[1].method, "notifications/initialized");
    assert.deepEqual(messages.slice(2).map((message) => message.params.name), ["web_fetch", "web_fetch"]);
    return completed([
      JSON.stringify({ jsonrpc: "2.0", id: 1, result: { protocolVersion: DONSETCH_MCP_PROTOCOL_VERSION } }),
      "non-json startup text is ignored",
      JSON.stringify({ jsonrpc: "2.0", id: 2, result: { structuredContent: { url: "https://a.example" }, content: [{ type: "text", text: "alpha" }] } }),
      JSON.stringify({ jsonrpc: "2.0", id: 3, result: { structured_content: { url: "https://b.example" }, content: [{ type: "text", text: "beta" }] } }),
    ].join("\n"));
  };

  try {
    const payloads = await runDonsetchSession(runner, "/opt/donsetch", [
      { tool: "web_fetch", arguments: { url: "https://a.example" } },
      { tool: "web_fetch", arguments: { url: "https://b.example" } },
    ]);
    assert.equal(invocations, 1);
    assert.deepEqual(payloads.map((payload) => payload.text), ["alpha", "beta"]);
    assert.deepEqual(payloads.map((payload) => payload.structured.url), ["https://a.example", "https://b.example"]);
  } finally {
    if (originalSecret === undefined) delete process.env.SERPER_API_KEY;
    else process.env.SERPER_API_KEY = originalSecret;
    if (originalCache === undefined) delete process.env.DONSETCH_CACHE_DIR;
    else process.env.DONSETCH_CACHE_DIR = originalCache;
  }
});

test("runDonsetchSession rejects oversized output without exposing raw stderr", async () => {
  const runner: DonsetchCommandRunner = async () => completed(
    "x".repeat(2_048),
    "api_key=super-secret /home/alice/private bearer another-secret",
  );
  await assert.rejects(
    runDonsetchSession(
      runner,
      "/opt/donsetch",
      [{ tool: "web_search", arguments: { query: "test" } }],
      { maxResponseBytes: 1_024 },
    ),
    (error: unknown) => {
      assert.ok(error instanceof DonsetchTransportError);
      assert.equal(error.message, "donsetch_response_too_large");
      assert.ok(error.diagnostic?.includes("[redacted]"));
      assert.ok(!error.diagnostic?.includes("super-secret"));
      assert.ok(!error.diagnostic?.includes("another-secret"));
      assert.ok(!error.diagnostic?.includes("alice"));
      return true;
    },
  );
});

test("runDonsetchSession maps timeout and MCP tool errors to stable codes", async (t) => {
  await t.test("timeout", async () => {
    const runner: DonsetchCommandRunner = async () => ({
      ...completed(""),
      code: null,
      killed: true,
      termination: "timeout",
    });
    await assert.rejects(
      runDonsetchSession(runner, "/opt/donsetch", [{ tool: "web_search", arguments: { query: "test" } }]),
      (error: unknown) => error instanceof DonsetchTransportError && error.code === "donsetch_timeout",
    );
  });

  await t.test("tool error", async () => {
    const runner: DonsetchCommandRunner = async () => completed([
      JSON.stringify({ jsonrpc: "2.0", id: 1, result: { protocolVersion: DONSETCH_MCP_PROTOCOL_VERSION } }),
      JSON.stringify({ jsonrpc: "2.0", id: 2, result: { isError: true, content: [{ type: "text", text: "token=raw-secret" }] } }),
    ].join("\n"));
    await assert.rejects(
      runDonsetchSession(runner, "/opt/donsetch", [{ tool: "web_search", arguments: { query: "test" } }]),
      (error: unknown) => error instanceof DonsetchTransportError
        && error.code === "donsetch_tool_error"
        && !String(error).includes("raw-secret"),
    );
  });

  await t.test("host output limit", async () => {
    const runner: DonsetchCommandRunner = async () => ({
      ...completed("partial"),
      code: null,
      killed: true,
      termination: "output-limit",
      outputLimitExceeded: true,
    });
    await assert.rejects(
      runDonsetchSession(runner, "/opt/donsetch", [{ tool: "web_search", arguments: { query: "test" } }]),
      (error: unknown) => error instanceof DonsetchTransportError
        && error.code === "donsetch_response_too_large",
    );
  });
});

test("inspectDonsetchReadiness reports tested, compatible, incompatible, and timeout states", async (t) => {
  await t.test("missing", async () => {
    let called = false;
    const runner: DonsetchCommandRunner = async () => {
      called = true;
      return completed("");
    };
    assert.deepEqual(await inspectDonsetchReadiness(runner, ""), {
      state: "missing",
      version: null,
      testedVersion: "3.2.1",
      compatibility: "unknown",
      binaryConfigured: false,
    });
    assert.equal(called, false);
  });

  await t.test("version", async () => {
    const runner: DonsetchCommandRunner = async (argv, options) => {
      assert.deepEqual(argv, ["/opt/donsetch", "--version"]);
      assert.equal(options.input, undefined);
      assert.deepEqual(options.maxOutputBytes, { stdout: 32 * 1024, stderr: 8 * 1024 });
      assert.equal(options.maxCombinedOutputBytes, 40 * 1024);
      assert.equal(options.killProcessTree, true);
      assert.equal(options.terminateOnOutputLimit, true);
      return completed("DonSeTch 3.2.1\n");
    };
    const report = await inspectDonsetchReadiness(runner, "/opt/donsetch");
    assert.equal(report.state, "executable");
    assert.equal(report.version, "3.2.1");
    assert.equal(report.compatibility, "tested");
  });

  await t.test("timeout diagnostic", async () => {
    const runner: DonsetchCommandRunner = async () => ({
      ...completed("", "password=raw-secret /root/work"),
      code: null,
      killed: true,
      termination: "no-output-timeout",
      noOutputTimedOut: true,
    });
    const report = await inspectDonsetchReadiness(runner, "/opt/donsetch");
    assert.equal(report.state, "timeout");
    assert.ok(report.diagnostic?.includes("[redacted]"));
    assert.ok(!report.diagnostic?.includes("raw-secret"));
    assert.ok(!report.diagnostic?.includes("/root"));
  });

  assert.equal(donsetchVersionCompatibility("3.0.0"), "compatible_unverified");
  assert.equal(donsetchVersionCompatibility("2.3.1"), "incompatible_major");
  assert.equal(donsetchVersionCompatibility(null), "unknown");
});

test("DonSeTch host commands reject non-absolute binaries before launch", async () => {
  let launched = 0;
  const runner: DonsetchCommandRunner = async () => {
    launched += 1;
    throw new Error("must not launch");
  };
  for (const binary of ["donsetch", "./donsetch", "opt/donsetch", "/opt/../tmp/donsetch", "/opt/./donsetch"]) {
    await assert.rejects(
      runDonsetchSession(runner, binary, [{ tool: "web_search", arguments: { query: "test" } }]),
      (error: unknown) => error instanceof DonsetchTransportError && error.code === "donsetch_binary_not_configured",
    );
    const report = await inspectDonsetchReadiness(runner, binary);
    assert.equal(report.binaryConfigured, false);
    assert.equal(report.state, "missing");
  }
  assert.equal(launched, 0);
});

test("sanitizeDonsetchDiagnostic bounds and redacts common secret forms", () => {
  const safe = sanitizeDonsetchDiagnostic(
    "authorization: abc token=def https://user:pass@example.com /Users/alice/private " + "x".repeat(100),
    96,
  );
  assert.ok(safe.length <= 97);
  assert.ok(!safe.includes("abc"));
  assert.ok(!safe.includes("def"));
  assert.ok(!safe.includes("user:pass"));
  assert.ok(!safe.includes("alice"));
});
