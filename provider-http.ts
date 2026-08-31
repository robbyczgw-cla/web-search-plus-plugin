type Json = Record<string, any>;

export class ProviderConfigError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "ProviderConfigError";
    this.code = code;
  }
}

export class ProviderRequestError extends Error {
  readonly code: string;
  readonly statusCode?: number;
  readonly transient: boolean;
  readonly retryAfter?: number;

  constructor(
    code: string,
    options: { statusCode?: number; transient?: boolean; retryAfter?: number } = {},
  ) {
    super(code);
    this.name = "ProviderRequestError";
    this.code = code;
    this.statusCode = options.statusCode;
    this.transient = options.transient === true;
    this.retryAfter = options.retryAfter;
  }
}

export type BoundedJsonRequestOptions = {
  timeoutSeconds: number;
  maxResponseBytes: number;
  errorPrefix: string;
  transientStatuses?: ReadonlySet<number>;
};

export function boundedTimeoutSeconds(
  value: unknown,
  fallback: number,
  errorCode: string,
): number {
  const parsed = value == null ? fallback : Number(value);
  if (!Number.isFinite(parsed)) throw new ProviderConfigError(errorCode);
  const bounded = Math.floor(parsed);
  if (bounded < 1 || bounded > 120) throw new ProviderConfigError(errorCode);
  return bounded;
}

export function parseFiniteRetryAfter(value: string | null): number | undefined {
  if (value == null || !value.trim()) return undefined;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

async function discardBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Error bodies are deliberately ignored so provider text cannot leak into
    // tool output. Failure to cancel does not change the opaque status error.
  }
}

async function readBoundedBytes(
  response: Response,
  maxResponseBytes: number,
  errorPrefix: string,
): Promise<Uint8Array> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxResponseBytes) {
    await discardBody(response);
    throw new ProviderRequestError(`${errorPrefix}_response_too_large`, { transient: true });
  }

  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maxResponseBytes) {
      throw new ProviderRequestError(`${errorPrefix}_response_too_large`, { transient: true });
    }
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > maxResponseBytes) {
        try {
          await reader.cancel();
        } catch {
          // Preserve the bounded-response error even if cancellation fails.
        }
        throw new ProviderRequestError(`${errorPrefix}_response_too_large`, { transient: true });
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const output = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

/**
 * Fetch JSON from a provider without following redirects, with a hard body
 * bound and opaque errors. Neither response bodies nor request URLs are copied
 * into thrown errors, so API keys, queries, and upstream diagnostics stay out
 * of OpenClaw tool output and logs that render `error.message`.
 */
export async function requestBoundedJson<T = Json>(
  url: string,
  init: RequestInit,
  options: BoundedJsonRequestOptions,
): Promise<T> {
  const timeoutSeconds = boundedTimeoutSeconds(
    options.timeoutSeconds,
    30,
    `${options.errorPrefix}_timeout_invalid`,
  );
  const maxResponseBytes = Math.floor(Number(options.maxResponseBytes));
  if (!Number.isFinite(maxResponseBytes) || maxResponseBytes < 1) {
    throw new ProviderConfigError(`${options.errorPrefix}_response_limit_invalid`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
  timer.unref?.();
  try {
    const response = await fetch(url, {
      ...init,
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) {
      const statusCode = response.status;
      const retryAfter = statusCode === 429
        ? parseFiniteRetryAfter(response.headers.get("retry-after"))
        : undefined;
      await discardBody(response);
      throw new ProviderRequestError(`${options.errorPrefix}_http_${statusCode}`, {
        statusCode,
        transient: options.transientStatuses?.has(statusCode) === true,
        retryAfter,
      });
    }

    const bytes = await readBoundedBytes(response, maxResponseBytes, options.errorPrefix);
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return JSON.parse(text) as T;
    } catch {
      throw new ProviderRequestError(`${options.errorPrefix}_invalid_response`, { transient: true });
    }
  } catch (error: any) {
    if (error instanceof ProviderConfigError || error instanceof ProviderRequestError) throw error;
    throw new ProviderRequestError(`${options.errorPrefix}_unavailable`, { transient: true });
  } finally {
    clearTimeout(timer);
  }
}
