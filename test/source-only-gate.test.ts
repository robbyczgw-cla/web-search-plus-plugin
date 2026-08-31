import assert from "node:assert/strict";
import test from "node:test";
import {
  SourceOnlyGateError,
  assertSourceOnlyProvider,
  validateSourceOnlyAdapterResult,
  validateSourceOnlyOutboundRequest,
} from "../source-only-gate.ts";

function rejectsWithCode(run: () => void, code: string): void {
  assert.throws(
    run,
    (error: any) => error instanceof SourceOnlyGateError && error.code === code,
  );
}

test("outbound gate recursively rejects answer fields and instructions", () => {
  const cases: Array<[Record<string, unknown>, string]> = [
    [{ query: "q", nested: [{ answer: "hidden" }] }, "source_only_request_field"],
    [{ query: "q", nested: { system_prompt: "source mode" } }, "source_only_request_field"],
    [{ query: "q", nested: [{ instruction: "Please provide an answer from these sources" }] }, "source_only_request_instruction"],
    [{ query: "q", nested: { search_prompt: { items: ["reason step by step before searching"] } } }, "source_only_request_instruction"],
  ];
  for (const [body, expectedCode] of cases) {
    rejectsWithCode(
      () => validateSourceOnlyOutboundRequest("serper", body),
      expectedCode,
    );
  }
});

test("free-form query text is never treated as an adapter instruction", () => {
  for (const [provider, body] of [
    ["serper", { query: "provide an answer about primary sources" }],
    ["tavily", { query: "answer the user with source documents", include_answer: false }],
    ["linkup", { q: "synthesize the history of search", outputType: "searchResults" }],
    ["exa", { query: "reason step by step about this phrase", type: "neural" }],
  ] as const) {
    validateSourceOnlyOutboundRequest(provider, body);
  }

  validateSourceOnlyOutboundRequest("serper", {
    query: "q",
    filters: { literal_user_text: "verify the claim made in this quotation" },
  });
});

test("instruction-like fields and their nested values remain fail-closed", () => {
  for (const body of [
    { query: "q", instruction: "provide an answer" },
    { query: "q", adapterPrompt: ["safe prefix", "synthesize these sources"] },
    { query: "q", systemNote: { content: "verify the claim" } },
  ]) {
    rejectsWithCode(
      () => validateSourceOnlyOutboundRequest("serper", body),
      "source_only_request_instruction",
    );
  }
});

test("Tavily requires the explicit source-only answer flag", () => {
  validateSourceOnlyOutboundRequest("tavily", {
    query: "source documents",
    include_answer: false,
    nested: [{ include_answer: false }],
  });
  for (const body of [
    { query: "q" },
    { query: "q", include_answer: true },
    { query: "q", include_answer: "false" },
  ]) {
    assert.throws(
      () => validateSourceOnlyOutboundRequest("tavily", body),
      SourceOnlyGateError,
    );
  }
});

test("Linkup requires outputType=searchResults", () => {
  validateSourceOnlyOutboundRequest("linkup", {
    q: "source documents",
    outputType: "searchResults",
  });
  for (const outputType of [undefined, "sourcedAnswer", "searchresults", "SearchResults"]) {
    rejectsWithCode(
      () => validateSourceOnlyOutboundRequest("linkup", { q: "q", outputType }),
      "source_only_linkup_requires_search_results",
    );
  }
});

test("Exa rejects deep and deep-reasoning modes at any request depth", () => {
  validateSourceOnlyOutboundRequest("exa", {
    query: "source documents",
    type: "neural",
    contents: { text: { verbosity: "standard" } },
  });
  for (const body of [
    { query: "q", type: "deep" },
    { query: "q", type: "deep-reasoning" },
    { query: "q", options: { depth: "deep" } },
    { query: "q", options: [{ search_depth: "deep-reasoning" }] },
  ]) {
    rejectsWithCode(
      () => validateSourceOnlyOutboundRequest("exa", body),
      "source_only_exa_deep_mode",
    );
  }
});

test("answer-only providers fail before request or result validation", () => {
  for (const provider of ["perplexity", "kilo-perplexity", "kilo_perplexity", " KILO-PERPLEXITY "]) {
    rejectsWithCode(
      () => assertSourceOnlyProvider(provider),
      "source_only_answer_provider",
    );
    rejectsWithCode(
      () => validateSourceOnlyOutboundRequest(provider, {}),
      "source_only_answer_provider",
    );
    rejectsWithCode(
      () => validateSourceOnlyAdapterResult(provider, {}),
      "source_only_answer_provider",
    );
  }
});

test("adapter result gate recursively rejects every banned response field", () => {
  const bannedFields = [
    "answer",
    "synthesis",
    "full_synthesis",
    "fullSynthesis",
    "claim",
    "verification",
  ];
  for (const field of bannedFields) {
    rejectsWithCode(
      () => validateSourceOnlyAdapterResult("serper", {
        provider: "serper",
        results: [{ url: "https://example.test", metadata: { [field]: null } }],
      }),
      "source_only_adapter_result_field",
    );
  }
});

test("adapter result gate rejects answer/synthesis result types", () => {
  for (const type of ["answer", "synthesis", " Synthesis "]) {
    rejectsWithCode(
      () => validateSourceOnlyAdapterResult("linkup", {
        provider: "linkup",
        results: [{ url: "https://example.test", type }],
      }),
      "source_only_adapter_result_type",
    );
  }
});

test("source-only result envelopes pass without mutation", () => {
  const result = {
    provider: "tavily",
    query: "source documents",
    results: [{
      title: "Source",
      url: "https://example.test/source",
      snippet: "Observed source text",
      metadata: { verification_status: "not_claimed" },
    }],
    metadata: { mode: "source_results" },
  };
  const snapshot = structuredClone(result);

  validateSourceOnlyAdapterResult("tavily", result);

  assert.deepEqual(result, snapshot);
});
