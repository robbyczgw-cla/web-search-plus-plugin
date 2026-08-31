/**
 * Fail-closed guards for the source-only provider charter.
 *
 * These checks intentionally live outside provider adapters so callers can run
 * them immediately before transport and immediately after adapter projection.
 * They never include request/response values in errors because those values can
 * contain queries, fetched content, or credentials.
 */

const ANSWER_ONLY_PROVIDERS = new Set([
  "perplexity",
  "kilo-perplexity",
]);

const BANNED_REQUEST_KEYS = new Set([
  "messages",
  "system",
  "systemprompt",
  "answer",
  "includeanswer",
  "synthesis",
  "fullsynthesis",
  "reasoning",
  "claim",
  "verification",
]);

const BANNED_RESULT_KEYS = new Set([
  "answer",
  "synthesis",
  "fullsynthesis",
  "claim",
  "verification",
]);

const BANNED_INSTRUCTION_FRAGMENTS = [
  "answer the user",
  "provide an answer",
  "synthesize",
  "reason step by step",
  "verify the claim",
] as const;

export class SourceOnlyGateError extends Error {
  readonly code: string;
  readonly path?: string;

  constructor(code: string, path?: string, detail = code) {
    super(path ? `${detail} at ${path}` : detail);
    this.name = "SourceOnlyGateError";
    this.code = code;
    this.path = path;
  }
}

function normalizedProvider(provider: unknown): string {
  return String(provider ?? "").trim().toLowerCase().replace(/_/g, "-");
}

function normalizedKey(key: string): string {
  return key.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function childPath(parent: string, key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
    ? `${parent}.${key}`
    : `${parent}[${JSON.stringify(key)}]`;
}

type WalkVisitor = (
  value: unknown,
  path: string,
  key: string | undefined,
  instructionContext: boolean,
) => void;

function isInstructionLikeKey(key: string): boolean {
  const keyName = normalizedKey(key);
  return keyName.includes("instruction")
    || keyName.includes("prompt")
    || keyName === "system"
    || keyName.startsWith("system");
}

function walkRecursively(
  value: unknown,
  visitor: WalkVisitor,
  path = "$",
  key: string | undefined = undefined,
  ancestors = new Set<object>(),
  parentInstructionContext = false,
): void {
  const instructionContext = parentInstructionContext
    || (key != null && isInstructionLikeKey(key));
  visitor(value, path, key, instructionContext);
  if (value == null || typeof value !== "object") return;
  if (ancestors.has(value)) {
    throw new SourceOnlyGateError("source_only_non_json_cycle", path);
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      value.forEach((child, index) => {
        walkRecursively(
          child,
          visitor,
          `${path}[${index}]`,
          undefined,
          ancestors,
          instructionContext,
        );
      });
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      walkRecursively(
        child,
        visitor,
        childPath(path, key),
        key,
        ancestors,
        instructionContext,
      );
    }
  } finally {
    ancestors.delete(value);
  }
}

function requireObject(value: unknown, code: string): asserts value is Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new SourceOnlyGateError(code, "$");
  }
}

/** Reject providers for which no verified source-result endpoint exists. */
export function assertSourceOnlyProvider(provider: unknown): string {
  const normalized = normalizedProvider(provider);
  if (ANSWER_ONLY_PROVIDERS.has(normalized)) {
    throw new SourceOnlyGateError(
      "source_only_answer_provider",
      undefined,
      `${normalized} has no verified source-only endpoint`,
    );
  }
  return normalized;
}

/**
 * Validate one provider request immediately before transport.
 *
 * Banned keys are checked at every object or array depth. Answer-producing
 * instructions are checked only in instruction-, prompt-, or system-like
 * fields (including their descendants), never in free-form query data.
 * Provider-specific wire modes are then checked explicitly.
 */
export function validateSourceOnlyOutboundRequest(
  provider: unknown,
  body: unknown,
): void {
  const normalized = assertSourceOnlyProvider(provider);
  requireObject(body, "source_only_request_body_invalid");

  walkRecursively(body, (value, path, key, instructionContext) => {
    if (key != null) {
      const keyName = normalizedKey(key);
      if (BANNED_REQUEST_KEYS.has(keyName)) {
        if (keyName === "includeanswer" && value === false) return;
        throw new SourceOnlyGateError("source_only_request_field", path);
      }
    }
    if (instructionContext && typeof value === "string") {
      const instruction = value.toLowerCase().replace(/\s+/g, " ");
      if (BANNED_INSTRUCTION_FRAGMENTS.some((fragment) => instruction.includes(fragment))) {
        throw new SourceOnlyGateError("source_only_request_instruction", path);
      }
    }
  });

  if (normalized === "tavily" && body.include_answer !== false) {
    throw new SourceOnlyGateError(
      "source_only_tavily_requires_include_answer_false",
      "$.include_answer",
      "tavily source-only mode requires include_answer=false",
    );
  }
  if (normalized === "linkup" && body.outputType !== "searchResults") {
    throw new SourceOnlyGateError(
      "source_only_linkup_requires_search_results",
      "$.outputType",
      "linkup source-only mode requires outputType=searchResults",
    );
  }
  if (normalized === "exa") {
    walkRecursively(body, (value, path, key) => {
      if (key == null || typeof value !== "string") return;
      if (!["type", "depth", "searchdepth"].includes(normalizedKey(key))) return;
      const mode = value.trim().toLowerCase();
      if (mode === "deep" || mode === "deep-reasoning") {
        throw new SourceOnlyGateError(
          "source_only_exa_deep_mode",
          path,
          "exa deep modes are not source-only",
        );
      }
    });
  }
}

/**
 * Reject answer-shaped fields anywhere in a normalized adapter response.
 * Presence is forbidden even when the value is empty, false, or null.
 */
export function validateSourceOnlyAdapterResult(
  provider: unknown,
  result: unknown,
): void {
  assertSourceOnlyProvider(provider);
  requireObject(result, "source_only_adapter_result_invalid");

  walkRecursively(result, (value, path, key) => {
    if (key != null && BANNED_RESULT_KEYS.has(normalizedKey(key))) {
      throw new SourceOnlyGateError("source_only_adapter_result_field", path);
    }
    if (key != null && normalizedKey(key) === "type" && typeof value === "string") {
      const resultType = value.trim().toLowerCase();
      if (resultType === "answer" || resultType === "synthesis") {
        throw new SourceOnlyGateError("source_only_adapter_result_type", path);
      }
    }
  });
}

// Short aliases mirror the Hermes gate vocabulary and keep integration sites
// readable without changing the explicit source-only export names above.
export const validateOutboundBody = validateSourceOnlyOutboundRequest;
export const validateAdapterResult = validateSourceOnlyAdapterResult;
