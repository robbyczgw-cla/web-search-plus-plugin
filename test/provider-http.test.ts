import assert from "node:assert/strict";
import test from "node:test";
import {
  ProviderConfigError,
  ProviderRequestError,
  boundedTimeoutSeconds,
  parseFiniteRetryAfter,
  requestBoundedJson,
} from "../provider-http.ts";

async function withFetch(
  implementation: typeof fetch,
  run: () => Promise<void>,
): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = implementation;
  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }
}

const requestOptions = {
  timeoutSeconds: 30,
  maxResponseBytes: 32,
  errorPrefix: "fixture",
  transientStatuses: new Set([429, 503]),
};

test("requestBoundedJson refuses redirects and decodes bounded JSON", async () => {
  let captured: RequestInit | undefined;
  await withFetch((async (_url, init) => {
    captured = init;
    return new Response('{"ok":true}', { status: 200 });
  }) as typeof fetch, async () => {
    const payload = await requestBoundedJson<{ ok: boolean }>(
      "https://provider.example/fixed",
      { method: "GET" },
      requestOptions,
    );
    assert.deepEqual(payload, { ok: true });
  });
  assert.equal(captured?.redirect, "error");
  assert.ok(captured?.signal instanceof AbortSignal);
});

test("requestBoundedJson enforces header and streamed response bounds", async () => {
  for (const response of [
    new Response("{}", { headers: { "content-length": "33" } }),
    new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(33));
        controller.close();
      },
    })),
  ]) {
    await withFetch((async () => response) as typeof fetch, async () => {
      await assert.rejects(
        requestBoundedJson("https://provider.example/fixed", {}, requestOptions),
        (error: any) => error instanceof ProviderRequestError
          && error.message === "fixture_response_too_large"
          && error.transient === true,
      );
    });
  }
});

test("requestBoundedJson rejects invalid UTF-8/JSON and never echoes it", async () => {
  await withFetch((async () => new Response(new Uint8Array([0xff]))) as typeof fetch, async () => {
    await assert.rejects(
      requestBoundedJson("https://provider.example/?token=secret", {}, requestOptions),
      (error: any) => error instanceof ProviderRequestError
        && error.message === "fixture_invalid_response"
        && !error.message.includes("secret"),
    );
  });
});

test("requestBoundedJson classifies HTTP errors without exposing body or URL", async () => {
  await withFetch((async () => new Response("private upstream token=secret", {
    status: 429,
    headers: { "Retry-After": "2.5" },
  })) as typeof fetch, async () => {
    await assert.rejects(
      requestBoundedJson("https://provider.example/?key=secret", {}, requestOptions),
      (error: any) => error instanceof ProviderRequestError
        && error.message === "fixture_http_429"
        && error.statusCode === 429
        && error.transient === true
        && error.retryAfter === 2.5
        && !error.message.includes("private")
        && !error.message.includes("secret"),
    );
  });
});

test("requestBoundedJson sanitizes network failures to one opaque code", async () => {
  await withFetch((async () => {
    throw new TypeError("network failed for https://provider.example/?key=secret");
  }) as typeof fetch, async () => {
    await assert.rejects(
      requestBoundedJson("https://provider.example/?key=secret", {}, requestOptions),
      (error: any) => error instanceof ProviderRequestError
        && error.message === "fixture_unavailable"
        && error.transient === true,
    );
  });
});

test("shared timeout and Retry-After parsers reject non-finite input", () => {
  assert.equal(boundedTimeoutSeconds(undefined, 30, "timeout_invalid"), 30);
  assert.equal(boundedTimeoutSeconds(17.9, 30, "timeout_invalid"), 17);
  assert.throws(
    () => boundedTimeoutSeconds(0, 30, "timeout_invalid"),
    (error: any) => error instanceof ProviderConfigError && error.message === "timeout_invalid",
  );
  assert.equal(parseFiniteRetryAfter("2.5"), 2.5);
  for (const value of ["-1", "nan", "inf", "not-a-number"]) {
    assert.equal(parseFiniteRetryAfter(value), undefined);
  }
});
