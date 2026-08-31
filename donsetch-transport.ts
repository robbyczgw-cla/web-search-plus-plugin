type JsonObject = Record<string, unknown>;

export const DONSETCH_TESTED_VERSION = "3.2.1";
export const DONSETCH_MCP_PROTOCOL_VERSION = "2025-11-25";

const DEFAULT_TIMEOUT_SECONDS = 180;
const DEFAULT_MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const DEFAULT_MAX_TEXT_CHARS = 200_000;
const MAX_TOOL_CALLS_PER_SESSION = 50;
const STDERR_EXCERPT_CHARS = 2_048;
const RUNNER_STDERR_LIMIT_BYTES = 8 * 1_024;
const READINESS_STDOUT_LIMIT_BYTES = 32 * 1_024;

const VERSION_RE = /(\d+)\.(\d+)\.(\d+)/;
const SECRET_ASSIGNMENT_RE = /\b(api[_-]?key|token|secret|password|authorization)\b(\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi;
const BEARER_RE = /\bbearer\s+[^\s,;]+/gi;
const URL_CREDENTIALS_RE = /\b(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi;
const HOME_PATH_RE = /(?:\/root|\/home\/[^/\s]+|\/Users\/[^/\s]+)(?=\/|\b)/gi;

/** The narrow command surface supplied by api.runtime.system. */
export type DonsetchCommandRunner = (
  argv: string[],
  options: {
    timeoutMs: number;
    input?: string;
    env?: Record<string, string | undefined>;
    noOutputTimeoutMs?: number;
    /** Supported by newer OpenClaw buffered runners; ignored by 2026.5.2. */
    maxOutputBytes?: number | { stdout?: number; stderr?: number };
    /** Supported by newer OpenClaw buffered runners; ignored by 2026.5.2. */
    maxCombinedOutputBytes?: number;
    /** Supported by newer OpenClaw runners; ignored by 2026.5.2. */
    killProcessTree?: boolean;
    /** Stop immediately at the hard output boundary on newer hosts. */
    terminateOnOutputLimit?: boolean;
  },
) => Promise<{
  stdout: string;
  stderr: string;
  code: number | null;
  signal?: string | null;
  killed?: boolean;
  termination?: "exit" | "timeout" | "no-output-timeout" | "signal" | "output-limit" | "error";
  noOutputTimedOut?: boolean;
  outputLimitExceeded?: boolean;
}>;

export type DonsetchToolCall = {
  tool: "web_search" | "web_fetch";
  arguments: JsonObject;
};

export type DonsetchToolPayload = {
  structured: JsonObject;
  text: string;
  textTruncated: boolean;
  originalTextChars: number;
};

export type DonsetchSessionOptions = {
  timeoutSeconds?: number;
  maxResponseBytes?: number;
  maxTextChars?: number;
};

export type DonsetchReadiness = {
  state: "missing" | "executable" | "timeout" | "unavailable";
  version: string | null;
  testedVersion: string;
  compatibility: "unknown" | "tested" | "compatible_unverified" | "incompatible_major";
  binaryConfigured: boolean;
  diagnostic?: string;
};

export class DonsetchTransportError extends Error {
  readonly code: string;
  readonly diagnostic?: string;

  constructor(code: string, diagnostic = "") {
    super(code);
    this.name = "DonsetchTransportError";
    this.code = code;
    const safeDiagnostic = sanitizeDonsetchDiagnostic(diagnostic);
    if (safeDiagnostic) this.diagnostic = safeDiagnostic;
  }
}

function boundedInt(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "");
}

export function sanitizeDonsetchDiagnostic(value: unknown, limit = STDERR_EXCERPT_CHARS): string {
  if (typeof value !== "string" || !value) return "";
  const boundedLimit = boundedInt(limit, STDERR_EXCERPT_CHARS, 0, 8_192);
  if (!boundedLimit) return "";
  const cleaned = value
    .replace(SECRET_ASSIGNMENT_RE, (_match, label: string, separator: string) => `${label}${separator}[redacted]`)
    .replace(BEARER_RE, "Bearer [redacted]")
    .replace(URL_CREDENTIALS_RE, "$1[redacted]@")
    .replace(HOME_PATH_RE, "[path]")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
  return cleaned.length > boundedLimit ? `${cleaned.slice(0, boundedLimit)}…` : cleaned;
}

function normalizeBinary(binary: unknown): string {
  const candidate = typeof binary === "string" ? binary.trim() : "";
  if (!candidate || /[\u0000\r\n]/.test(candidate)) {
    throw new DonsetchTransportError("donsetch_binary_not_configured");
  }
  return candidate;
}

const PRESERVED_ENV_KEYS = new Set([
  "PATH",
  "HOME",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TZ",
  "TMPDIR",
  "TMP",
  "TEMP",
  "XDG_CACHE_HOME",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
  "XDG_RUNTIME_DIR",
  "DISPLAY",
  "WAYLAND_DISPLAY",
  "DBUS_SESSION_BUS_ADDRESS",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
  "NODE_EXTRA_CA_CERTS",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "no_proxy",
  "SystemRoot",
  "WINDIR",
  "ComSpec",
  "PATHEXT",
  "LOCALAPPDATA",
  "APPDATA",
  "USERPROFILE",
]);

function preserveEnvironmentKey(key: string): boolean {
  return PRESERVED_ENV_KEYS.has(key)
    || key.startsWith("DONSETCH_")
    || key.startsWith("PLAYWRIGHT_")
    || key.startsWith("PUPPETEER_");
}

/**
 * OpenClaw's command runner overlays this object on process.env. Explicit
 * undefined values are therefore required to remove unrelated provider keys
 * before the separately installed child process is launched.
 */
function isolatedDonsetchEnvironment(): Record<string, string | undefined> {
  const isolated: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(process.env)) {
    isolated[key] = preserveEnvironmentKey(key) ? value : undefined;
  }
  return isolated;
}

function buildSessionInput(calls: DonsetchToolCall[]): string {
  const messages: JsonObject[] = [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: DONSETCH_MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "web-search-plus", version: DONSETCH_TESTED_VERSION },
      },
    },
    { jsonrpc: "2.0", method: "notifications/initialized", params: {} },
  ];
  calls.forEach((call, index) => {
    messages.push({
      jsonrpc: "2.0",
      id: index + 2,
      method: "tools/call",
      params: { name: call.tool, arguments: call.arguments },
    });
  });
  return `${messages.map((message) => JSON.stringify(message)).join("\n")}\n`;
}

function responseMessages(stdout: string): Map<number, JsonObject> {
  const byId = new Map<number, JsonObject>();
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      // DonSeTch may emit non-protocol startup text. It is never surfaced.
      continue;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
    const id = Number((parsed as JsonObject).id);
    if (!Number.isSafeInteger(id) || id < 1) continue;
    if (byId.has(id)) throw new DonsetchTransportError("donsetch_mcp_contract_failed");
    byId.set(id, parsed as JsonObject);
  }
  return byId;
}

function resultFor(messages: Map<number, JsonObject>, id: number, initialize = false): JsonObject {
  const message = messages.get(id);
  if (!message) throw new DonsetchTransportError("donsetch_mcp_contract_failed");
  if (message.error) {
    throw new DonsetchTransportError(initialize ? "donsetch_mcp_initialize_failed" : "donsetch_mcp_call_failed");
  }
  const result = message.result;
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new DonsetchTransportError("donsetch_mcp_contract_failed");
  }
  return result as JsonObject;
}

function boundedTextContent(value: unknown, maxChars: number): { text: string; originalChars: number; truncated: boolean } {
  const parts: string[] = [];
  if (typeof value === "string") {
    parts.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string") parts.push(item);
      else if (item && typeof item === "object" && !Array.isArray(item) && typeof (item as JsonObject).text === "string") {
        parts.push((item as JsonObject).text as string);
      }
    }
  }
  const text = parts.join("\n");
  return {
    text: text.slice(0, maxChars),
    originalChars: text.length,
    truncated: text.length > maxChars,
  };
}

function payloadFromResult(result: JsonObject, maxTextChars: number): DonsetchToolPayload {
  if (result.isError === true || result.is_error === true) {
    throw new DonsetchTransportError("donsetch_tool_error");
  }
  const preferred = result.structuredContent;
  const alternate = result.structured_content;
  const structured = preferred && typeof preferred === "object" && !Array.isArray(preferred)
    ? preferred as JsonObject
    : alternate && typeof alternate === "object" && !Array.isArray(alternate)
      ? alternate as JsonObject
      : {};
  const content = boundedTextContent(result.content, maxTextChars);
  return {
    structured,
    text: content.text,
    textTruncated: content.truncated,
    originalTextChars: content.originalChars,
  };
}

function timedOut(result: Awaited<ReturnType<DonsetchCommandRunner>>): boolean {
  return result.termination === "timeout"
    || result.termination === "no-output-timeout"
    || result.noOutputTimedOut === true;
}

/**
 * Executes one DonSeTch stdio MCP process for one WSP request. Multi-URL
 * extraction is represented by multiple tools/call messages in this one input
 * stream, so it does not create a child process per URL.
 */
export async function runDonsetchSession(
  runCommandWithTimeout: DonsetchCommandRunner,
  binaryValue: string,
  calls: DonsetchToolCall[],
  options: DonsetchSessionOptions = {},
): Promise<DonsetchToolPayload[]> {
  const binary = normalizeBinary(binaryValue);
  if (!Array.isArray(calls) || !calls.length || calls.length > MAX_TOOL_CALLS_PER_SESSION) {
    throw new DonsetchTransportError("donsetch_mcp_contract_failed");
  }
  if (calls.some((call) => !call || !["web_search", "web_fetch"].includes(call.tool))) {
    throw new DonsetchTransportError("donsetch_mcp_contract_failed");
  }

  const timeoutSeconds = boundedInt(options.timeoutSeconds, DEFAULT_TIMEOUT_SECONDS, 5, 600);
  const maxResponseBytes = boundedInt(options.maxResponseBytes, DEFAULT_MAX_RESPONSE_BYTES, 1_024, 16 * 1024 * 1024);
  const maxTextChars = boundedInt(options.maxTextChars, DEFAULT_MAX_TEXT_CHARS, 500, 1_000_000);
  const input = buildSessionInput(calls);
  let completed: Awaited<ReturnType<DonsetchCommandRunner>>;
  try {
    completed = await runCommandWithTimeout([binary, "mcp"], {
      timeoutMs: timeoutSeconds * 1_000,
      noOutputTimeoutMs: timeoutSeconds * 1_000,
      // OpenClaw 2026.5.2 ignores these forward-compatible options, so the
      // mandatory byte check below remains the compatibility backstop.
      maxOutputBytes: { stdout: maxResponseBytes, stderr: RUNNER_STDERR_LIMIT_BYTES },
      maxCombinedOutputBytes: maxResponseBytes + RUNNER_STDERR_LIMIT_BYTES,
      killProcessTree: true,
      terminateOnOutputLimit: true,
      input,
      env: isolatedDonsetchEnvironment(),
    });
  } catch (error) {
    throw new DonsetchTransportError("donsetch_process_failed", errorMessage(error));
  }

  const stderr = sanitizeDonsetchDiagnostic(completed.stderr);
  if (completed.termination === "output-limit" || completed.outputLimitExceeded === true) {
    throw new DonsetchTransportError("donsetch_response_too_large", stderr);
  }
  if (byteLength(completed.stdout) > maxResponseBytes) {
    throw new DonsetchTransportError("donsetch_response_too_large", stderr);
  }
  if (timedOut(completed)) throw new DonsetchTransportError("donsetch_timeout", stderr);
  if (completed.code !== 0 || completed.killed === true) {
    throw new DonsetchTransportError("donsetch_process_failed", stderr);
  }

  const messages = responseMessages(completed.stdout);
  resultFor(messages, 1, true);
  return calls.map((_call, index) => payloadFromResult(resultFor(messages, index + 2), maxTextChars));
}

function parsedVersion(value: string): string | null {
  const match = VERSION_RE.exec(value);
  if (!match) return null;
  return `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`;
}

export function donsetchVersionCompatibility(version: string | null): DonsetchReadiness["compatibility"] {
  if (!version) return "unknown";
  const versionParts = version.split(".").map(Number);
  const testedParts = DONSETCH_TESTED_VERSION.split(".").map(Number);
  if (versionParts.some((part) => !Number.isInteger(part)) || versionParts.length !== 3) return "unknown";
  if (versionParts.every((part, index) => part === testedParts[index])) return "tested";
  return versionParts[0] === testedParts[0] ? "compatible_unverified" : "incompatible_major";
}

export async function inspectDonsetchReadiness(
  runCommandWithTimeout: DonsetchCommandRunner,
  binaryValue: string | undefined,
  options: { timeoutSeconds?: number } = {},
): Promise<DonsetchReadiness> {
  const base: DonsetchReadiness = {
    state: "missing",
    version: null,
    testedVersion: DONSETCH_TESTED_VERSION,
    compatibility: "unknown",
    binaryConfigured: false,
  };
  let binary: string;
  try {
    binary = normalizeBinary(binaryValue);
  } catch {
    return base;
  }
  base.binaryConfigured = true;
  const timeoutSeconds = boundedInt(options.timeoutSeconds, 5, 1, 15);
  let completed: Awaited<ReturnType<DonsetchCommandRunner>>;
  try {
    completed = await runCommandWithTimeout([binary, "--version"], {
      timeoutMs: timeoutSeconds * 1_000,
      noOutputTimeoutMs: timeoutSeconds * 1_000,
      maxOutputBytes: { stdout: READINESS_STDOUT_LIMIT_BYTES, stderr: RUNNER_STDERR_LIMIT_BYTES },
      maxCombinedOutputBytes: READINESS_STDOUT_LIMIT_BYTES + RUNNER_STDERR_LIMIT_BYTES,
      killProcessTree: true,
      terminateOnOutputLimit: true,
      env: isolatedDonsetchEnvironment(),
    });
  } catch (error) {
    return { ...base, state: "unavailable", diagnostic: sanitizeDonsetchDiagnostic(errorMessage(error)) || undefined };
  }
  const diagnostic = sanitizeDonsetchDiagnostic(completed.stderr);
  if (timedOut(completed)) return { ...base, state: "timeout", diagnostic: diagnostic || undefined };
  if (completed.code !== 0 || completed.killed === true) {
    return { ...base, state: "unavailable", diagnostic: diagnostic || undefined };
  }
  const versionInput = `${completed.stdout.slice(0, 32_768)}\n${completed.stderr.slice(0, 32_768)}`;
  const version = parsedVersion(versionInput);
  return {
    ...base,
    state: "executable",
    version,
    compatibility: donsetchVersionCompatibility(version),
  };
}
