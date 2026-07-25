type Json = Record<string, any>;

export class HoundTransportError extends Error {
  constructor(code = "hound_mcp_unavailable") {
    super(code);
    this.name = "HoundTransportError";
  }
}

export function validateHoundEndpoint(value: string): string {
  const endpoint = String(value || "").trim();
  if (!endpoint || endpoint.includes("?") || endpoint.includes("#")) throw new Error("hound_endpoint_invalid");
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error("hound_endpoint_invalid");
  }
  if (
    parsed.protocol !== "http:"
    || !["127.0.0.1", "[::1]"].includes(parsed.hostname)
    || !parsed.port
    || parsed.pathname !== "/mcp"
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
  ) {
    throw new Error("hound_endpoint_invalid");
  }
  return endpoint;
}

function parseWirePayload(text: string): Json {
  const candidates = text
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);
  const payloadText = candidates.length ? candidates[candidates.length - 1] : text.trim();
  if (!payloadText) return {};
  const payload = JSON.parse(payloadText);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("invalid_mcp_payload");
  return payload;
}

async function readBoundedResponse(response: Response, maxResponseBytes: number): Promise<Json> {
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > maxResponseBytes) throw new Error("hound_response_too_large");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maxResponseBytes) throw new Error("hound_response_too_large");
  if (!response.ok && response.status !== 202) throw new Error(`hound_http_${response.status}`);
  return parseWirePayload(new TextDecoder().decode(bytes));
}

function toolPayload(result: Json): Json {
  if (result.isError === true) throw new Error("hound_mcp_call_failed");
  if (result.structuredContent && typeof result.structuredContent === "object" && !Array.isArray(result.structuredContent)) {
    return result.structuredContent;
  }
  for (const item of Array.isArray(result.content) ? result.content : []) {
    if (item?.type !== "text" || typeof item.text !== "string") continue;
    try {
      const parsed = JSON.parse(item.text);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      // A later content item may carry the structured JSON projection.
    }
  }
  throw new Error("hound_mcp_contract_failed");
}

export async function callHoundTool(
  endpointValue: string,
  tool: string,
  argumentsValue: Json,
  options: { timeoutSeconds?: number; maxResponseBytes?: number } = {},
): Promise<Json> {
  const endpoint = validateHoundEndpoint(endpointValue);
  const timeoutSeconds = Math.min(180, Math.max(5, Math.floor(options.timeoutSeconds ?? 120)));
  const maxResponseBytes = Math.min(16 * 1024 * 1024, Math.max(1024, Math.floor(options.maxResponseBytes ?? 2 * 1024 * 1024)));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
  timer.unref?.();
  let sessionId = "";
  let requestId = 1;

  const request = async (body: Json, includeSession = false): Promise<Json> => {
    const headers: Record<string, string> = {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
    };
    if (includeSession && sessionId) {
      headers["Mcp-Session-Id"] = sessionId;
      headers["MCP-Protocol-Version"] = "2025-03-26";
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      redirect: "error",
      signal: controller.signal,
    });
    const returnedSession = response.headers.get("mcp-session-id");
    if (returnedSession) sessionId = returnedSession;
    return readBoundedResponse(response, maxResponseBytes);
  };

  try {
    const initialized = await request({
      jsonrpc: "2.0",
      id: requestId++,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "web-search-plus", version: "3.2.0" },
      },
    });
    if (initialized.error || !initialized.result) throw new Error("hound_mcp_initialize_failed");
    await request({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }, true);
    const called = await request({
      jsonrpc: "2.0",
      id: requestId,
      method: "tools/call",
      params: { name: tool, arguments: argumentsValue },
    }, true);
    if (called.error || !called.result || typeof called.result !== "object") throw new Error("hound_mcp_call_failed");
    return toolPayload(called.result);
  } catch (error: any) {
    if (error instanceof HoundTransportError) throw error;
    throw new HoundTransportError();
  } finally {
    clearTimeout(timer);
    if (sessionId) {
      try {
        await fetch(endpoint, {
          method: "DELETE",
          headers: {
            "Mcp-Session-Id": sessionId,
            "MCP-Protocol-Version": "2025-03-26",
          },
          redirect: "error",
        });
      } catch {
        // Session cleanup is best-effort and never changes the tool outcome.
      }
    }
  }
}
