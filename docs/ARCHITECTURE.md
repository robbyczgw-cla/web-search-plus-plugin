# Architecture

## Overview

`web-search-plus-plugin` is a pure TypeScript implementation with a small local module split. The plugin registers `web_search_plus` directly in OpenClaw and performs provider routing, HTTP requests, retries, caching, cooldown tracking, deduplication, and SearXNG SSRF checks in-process.

```
┌──────────────────────────────────────────────────────────────┐
│                       OpenClaw Gateway                      │
│                                                              │
│  Agent calls web_search_plus(query, provider, ...)          │
│                           ↓                                  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              index.ts + local helper modules          │  │
│  │                                                        │  │
│  │  Types → Config → HTTP Helper → Cache → Health        │  │
│  │        → SSRF → QueryAnalyzer → Providers             │  │
│  │        → Retry/Fallback → Dedup → Plugin Entry        │  │
│  └───────────────────────────┬────────────────────────────┘  │
│                              ↓                               │
│      ┌───────┬───────┬────────┬────────┬──────┬────────┬──────────┐
│      │Serper │ Brave │ Tavily │ Linkup │ Exa  │ Querit │Firecrawl│
│      ├───────┼───────┼────────┼────────┼──────┼────────┼──────────┤
│      │Parallel│SerpBase│ You.com│SearXNG│Keenable│ source-only    │
│      └───────┴───────┴────────┴────────┴──────┴────────┴──────────┘
└──────────────────────────────────────────────────────────────┘
```

## Core Design

### Runtime module layout

The runtime entry lives in `index.ts`, with local helper modules for configuration mapping and scanner-safe routing preferences.

Together they cover:
- Type definitions for tool input/output and internal state
- Environment/config loading
- Shared HTTP request helper built on native `fetch()`
- In-memory cache helpers
- Provider health and cooldown state management
- SearXNG SSRF validation using `dns/promises` and `net`
- Query analysis and auto-routing heuristics
- Provider-specific request/response adapters
- Retry + fallback logic
- Cross-provider deduplication
- OpenClaw plugin entry + tool registration

One plugin runtime, a few local helper modules, zero external runtime dependencies.

## Runtime Layers

### 1. Types

Static types define the public tool contract and the normalized internal response shape.

Examples:
- `ToolParams`
- `ProviderName`
- `SearchResult`
- `SearchResponse`
- structured error classes such as `ProviderConfigError` and `ProviderRequestError`

### 2. Config

The bundled runtime reads provider values from explicit OpenClaw plugin config fields and does not directly read external credential state.

This keeps credential access explicit and avoids mixing plugin runtime behavior with host-wide environment state.

### 3. HTTP Helper

All provider calls use native `fetch()` from Node.js.

Shared request behavior includes:
- JSON request/response handling
- common headers/body construction
- response status validation
- output sanitization for errors
- per-request timeout via `AbortController`
- transient error classification for retries (`408`, `425`, `429`, `500`, `502`, `503`, `504`)

No `child_process`, no external interpreters.

### 4. Cache

The runtime cache is process-local memory. The package intentionally avoids runtime filesystem reads so ClawHub does not classify benign cache/config access as potential exfiltration.

Characteristics:
- cache key is derived from query + provider + result count + relevant search parameters
- cache metadata tracks timestamp, params, provider, and query context
- default TTL is currently one hour
- cache entries expire lazily on read
- cache writes update process memory only

### 5. Provider Health / Cooldown

Provider health state is process-local memory alongside the cache.

Behavior:
- repeated failures increase a provider's failure count
- cooldown duration grows across predefined backoff steps
- providers currently in cooldown are skipped when possible
- successful requests reset provider health state

This reduces repeated failures against rate-limited or degraded providers and improves fallback quality.

### 6. SSRF Protection

SearXNG support includes host validation before any request is sent.

Checks include:
- URL parsing and hostname validation
- DNS resolution using `dns/promises`
- IP classification using Node.js `net`
- blocking private, loopback, link-local, and metadata-style targets by default
- optional private-instance override through environment configuration

Implemented entirely in TypeScript with Node.js builtins.

### 7. QueryAnalyzer

The auto-router inspects query content and scores providers by intent.

Signals include:
- shopping / pricing intent
- research / explanation intent
- multilingual or geo-rich search intent
- semantic discovery intent
- direct-answer intent
- query complexity heuristics
- provider availability

The router returns an internal provider choice, confidence estimate, and Exa depth hint when relevant. The default tool UX keeps those details trimmed down and applies runtime routing preferences on top.

### 8. Providers

Each provider has a dedicated adapter function in `index.ts`.

Current providers:
- Serper
- Brave
- Tavily
- Linkup
- Querit
- Exa
- Firecrawl
- Parallel
- SerpBase
- You.com
- SearXNG
- Keenable

Each adapter is responsible for:
- auth handling
- provider-specific request shape
- optional feature mapping (`time_range`, domain filters, Exa depth)
- response parsing
- normalization into a shared output schema

### 9. Retry / Fallback

When a request fails transiently, the plugin retries with exponential backoff plus bounded random jitter (up to 50% of the base delay) so concurrent retries against a recovering provider do not synchronize into bursts.

If a provider still fails:
- the failure is recorded in provider health state
- the router/fallback chain tries the next eligible configured provider
- cooldown-skipped providers are tracked in output metadata when relevant



### 10. Dedup

When fallback or merged responses produce overlapping links, the plugin deduplicates results across providers before returning them (shared helper in `research.ts`).

This keeps output compact and avoids repeated URLs in the final tool result.

### 10b. Quality: rerank + authority signals (`quality.ts`)

For authority-sensitive routing classes (`official/vendor-release`, `docs/api`, `official/regulatory`, `finance/IR`, `security/cve`), auto-routed results pass through a small canonical-source reranker before caching: canonical domains are boosted, mirror/repost domains demoted, and any reordering is reported in `metadata.intent_rerank`. Quality reports include `authority_signals` (canonical domain hits, demoted domain hits, primary-source top-result flag) built from the same rules.

### 10c. Research mode (`research.ts`)

`mode="research"` orchestrates a compact multi-provider sweep: up to 3 configured, auto-allowed providers are queried **concurrently** (deterministic ordering by submission order), results are deduplicated, and the top URLs are extracted via the `extract.ts` auto fallback chain into `source_summaries`. An optional wall-clock time budget gates provider launches and extraction. Failures are collected as diagnostics (`routing.provider_errors`, `routing.extraction_error`) rather than failing the call, and a quality report is always attached. Research responses are not cached.

### 11. Plugin Entry

The OpenClaw plugin entry:
- registers the `web_search_plus` tool
- exposes a JSON-schema tool contract
- validates and normalizes tool parameters
- performs routing, execution, caching, retries, fallback, and final result shaping
- returns structured JSON back to OpenClaw

## Tool Parameters

The registered tool currently supports:

| Parameter | Type | Notes |
|-----------|------|-------|
| `query` | string | Required search query |
| `provider` | string | `serper`, `brave`, `tavily`, `linkup`, `querit`, `exa`, `firecrawl`, `parallel`, `serpbase`, `you`, `searxng`, `keenable`, or `auto` |
| `count` | number | Result count, clamped to safe limits |
| `depth` | string | Exa depth: `normal`, `deep`, `deep-reasoning` |
| `time_range` | string | `day`, `week`, `month`, `year` where supported |
| `include_domains` | string[] | Provider-specific domain allowlist |
| `exclude_domains` | string[] | Provider-specific domain denylist |
| `quality_report` | boolean | Attach routing/result-quality/authority diagnostics |
| `mode` | string | `normal` (default) or `research` multi-provider + extraction |
| `research_providers` | string[] | Explicit provider list for research mode |
| `research_extract_count` | number | Top research URLs to extract (default 3, max 5) |
| `research_time_budget` | number | Best-effort research wall-clock budget in seconds (default 55) |

## Data Flow

```
1. Agent invokes web_search_plus(query="iPhone price", provider="auto")
2. Plugin normalizes params and loads runtime config
3. Cache lookup runs using query/provider/parameter context
4. On cache miss, QueryAnalyzer scores available providers
5. Selected provider is called directly with fetch()
6. If request fails transiently, retry logic applies
7. If provider still fails, fallback chain tries the next healthy provider
8. Provider response is normalized to shared result schema
9. Results are deduplicated if multiple providers contributed
10. Final result is cached in process memory and returned to OpenClaw
```

## File Structure

```
web-search-plus-plugin/
├── index.ts                 # Runtime core: tool registration + search engine
├── extract.ts               # Extraction providers + auto fallback chain
├── research.ts              # Research-mode orchestration + cross-provider dedup
├── quality.ts               # Canonical-source rerank + authority signals
├── routing-config.ts        # Routing preferences (in-memory, schema v2)
├── runtime-config.ts        # Plugin config → runtime config mapping
├── openclaw.plugin.json     # Plugin metadata
├── package.json             # npm package config
├── .gitignore
├── LICENSE                  # MIT
├── README.md                # User documentation
├── CHANGELOG.md             # Version history
├── SKILL.md                 # Plugin summary / usage notes
├── docs/
│   └── ARCHITECTURE.md      # This file
└── dist/index.js            # Built ClawPack runtime
```

## Security Model

- **No `child_process` or `spawn`** — no external interpreter execution
- **No Python runtime** — fewer moving parts and no subprocess boundary
- **Native `fetch()` with `AbortController` timeout** — requests cannot hang indefinitely
- **API keys stay explicit** in OpenClaw plugin config
- **Input validation** on all tool parameters
- **Sanitized errors** to avoid leaking credentials/tokens
- **SSRF protection** for SearXNG before outbound requests
- **Provider cooldowns** reduce repeated failing calls
- **Zero external runtime dependencies** — only Node.js builtins are used

## Changes from v1.x

Removed in v2.0.0:
- `scripts/search.py`
- `scripts/setup.py`

The Python subprocess architecture has been replaced entirely by the in-process TypeScript implementation.
