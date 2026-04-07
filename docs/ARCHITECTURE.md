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
│      ┌───────┬────────┬────────┬──────┬────────────┬──────┬───────┐
│      │Serper │ Tavily │ Querit │ Exa  │ Perplexity │ You  │SearXNG│
│      └───────┴────────┴────────┴──────┴────────────┴──────┴───────┘
└──────────────────────────────────────────────────────────────┘
```

## Core Design

### Runtime module layout

The runtime entry lives in `index.ts`, with a few local helper modules for path resolution, env loading, and storage utilities.

Together they cover:
- Type definitions for tool input/output and internal state
- Environment/config loading
- Shared HTTP request helper built on native `fetch()`
- File-based cache helpers
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

The plugin resolves its runtime directory, loads `.env` manually, and merges configuration from:

1. process environment
2. OpenClaw plugin config
3. local `.env`

This lets users configure keys either through OpenClaw UI/config or directly via `.env` for local development.

Notable implementation detail:
- `PLUGIN_DIR` resolution handles OpenClaw-transpiled plugin installs, so the plugin can still find `.env`, `.cache`, and package-local files reliably.

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

The cache is file-based and stored in `.cache/` under the plugin directory.

Characteristics:
- cache key is derived from query + provider + result count + relevant search parameters
- entries are JSON files on disk
- cache survives gateway restarts
- cache metadata tracks timestamp, params, provider, and query context
- default TTL is currently one hour



### 5. Provider Health / Cooldown

Provider health state is stored in `.cache/provider_health.json`.

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

The router returns:
- chosen provider
- confidence score
- confidence level
- reason for the choice
- top matched signals
- Exa depth recommendation when relevant

### 8. Providers

Each provider has a dedicated adapter function in `index.ts`.

Current providers:
- Serper
- Tavily
- Querit
- Exa
- Perplexity
- You.com
- SearXNG

Each adapter is responsible for:
- auth handling
- provider-specific request shape
- optional feature mapping (`time_range`, domain filters, Exa depth)
- response parsing
- normalization into a shared output schema

### 9. Retry / Fallback

When a request fails transiently, the plugin retries with exponential backoff.

If a provider still fails:
- the failure is recorded in provider health state
- the router/fallback chain tries the next eligible configured provider
- cooldown-skipped providers are tracked in output metadata when relevant



### 10. Dedup

When fallback or merged responses produce overlapping links, the plugin deduplicates results across providers before returning them.

This keeps output compact and avoids repeated URLs in the final tool result.

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
| `provider` | string | `serper`, `tavily`, `querit`, `exa`, `perplexity`, `you`, `searxng`, or `auto` |
| `count` | number | Result count, clamped to safe limits |
| `depth` | string | Exa depth: `normal`, `deep`, `deep-reasoning` |
| `time_range` | string | `day`, `week`, `month`, `year` where supported |
| `include_domains` | string[] | Provider-specific domain allowlist |
| `exclude_domains` | string[] | Provider-specific domain denylist |

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
10. Final result is cached and returned to OpenClaw
```

## File Structure

```
web-search-plus-plugin/
├── index.ts                 # Entire runtime: tool registration + search engine
├── openclaw.plugin.json     # Plugin metadata
├── package.json             # npm package config
├── .env.template            # API key template
├── .env                     # Local keys (gitignored)
├── .gitignore
├── LICENSE                  # MIT
├── README.md                # User documentation
├── CHANGELOG.md             # Version history
├── SKILL.md                 # Plugin summary / usage notes
├── docs/
│   └── ARCHITECTURE.md      # This file
└── .cache/                  # Search cache + provider health state (gitignored)
```

## Security Model

- **No `child_process` or `spawn`** — no external interpreter execution
- **No Python runtime** — fewer moving parts and no subprocess boundary
- **Native `fetch()` with `AbortController` timeout** — requests cannot hang indefinitely
- **API keys stay local** in `.env` or OpenClaw plugin config
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
