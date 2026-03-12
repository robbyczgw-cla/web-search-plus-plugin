# Architecture

## Overview

```
┌─────────────────────────────────────────────────┐
│                 OpenClaw Gateway                 │
│                                                  │
│  Agent calls web_search_plus(query, provider)   │
│         ↓                                        │
│  ┌──────────────────────────────┐               │
│  │     index.ts (Plugin)        │               │
│  │  - Registers native tool     │               │
│  │  - Loads .env                │               │
│  │  - Spawns Python process     │               │
│  └──────────┬───────────────────┘               │
│              ↓                                   │
│  ┌──────────────────────────────┐               │
│  │    scripts/search.py         │               │
│  │  - Auto-routing engine       │               │
│  │  - Provider adapters         │               │
│  │  - Result caching            │               │
│  │  - Response normalization    │               │
│  └──────────┬───────────────────┘               │
│              ↓                                   │
│  ┌─────┬─────┬──────┬─────┬──────┬─────┬───────┐  │
│  │Serp.│Tav. │Querit│ Exa │Perpl.│You  │SearXNG│  │
│  └─────┴─────┴──────┴─────┴──────┴─────┴───────┘  │
└─────────────────────────────────────────────────┘
```

## Components

### 1. Plugin Entry (`index.ts`)

The plugin entry point registers `web_search_plus` as a native OpenClaw tool via the plugin API.

**Responsibilities:**
- Register tool schema (query, provider, count parameters)
- Load API keys from `.env` file (plugin dir, with fallback to sibling skill dir)
- Spawn `search.py` as a child process with `spawnSync`
- Pass environment variables securely to child process
- Parse and return results

**Key design decisions:**
- Uses `spawnSync` (synchronous) — search completes in <5s, no need for async process management
- Loads `.env` manually (no `dotenv` dependency) to keep the plugin zero-dependency
- 30s timeout on child process to prevent hangs

### 2. Search Engine (`scripts/search.py`)

The core search backend. A single Python script (~2500 lines) that handles routing, provider adapters, caching, and response normalization.

**Subsystems:**

#### Auto-Router
Scores each provider based on query signals:
- **Keyword matching** — "price", "buy" → Serper; "how", "explain" → Tavily
- **Pattern detection** — URLs → Exa; questions → Perplexity
- **Intent classification** — shopping, research, discovery, news, direct-answer
- **Provider availability** — only configured providers are scored
- **Fallback chain** — if top-scored provider fails, tries next

#### Provider Adapters
Each provider has its own adapter that:
- Constructs the API request (headers, params, body)
- Parses provider-specific response format
- Normalizes results to common schema: `{title, url, snippet, source}`
- Handles provider-specific errors and rate limits

#### Cache Layer
- File-based cache in `.cache/` directory
- Cache key = hash of (query + provider + max_results + params)
- No TTL — cached results persist until manually cleared
- Saves API costs on repeated/similar queries

#### SSRF Protection (SearXNG)
- Validates instance URLs against private IP ranges
- Blocks cloud metadata endpoints (169.254.169.254, etc.)
- Can be overridden with `SEARXNG_ALLOW_PRIVATE=1` for local instances

### 3. Setup Wizard (`scripts/setup.py`)

Interactive CLI wizard for first-time configuration:
- Walks through each provider (enable/disable, API key entry)
- Tests SearXNG instance connectivity
- Sets default provider and auto-routing preferences
- Writes `config.json` (gitignored)

## Data Flow

```
1. Agent invokes web_search_plus(query="iPhone price", provider="auto")
2. index.ts spawns: python3 search.py --query "iPhone price" --compact
3. search.py checks cache → miss
4. Auto-router scores providers:
   - Serper: 5.0 (shopping keywords + price)
   - Tavily: 2.0 (default)
   - Exa: 1.0 (no signals)
5. Serper adapter calls Google Search API
6. Response normalized to [{title, url, snippet}, ...]
7. Result cached to .cache/<hash>.json
8. JSON returned to index.ts → tool result to agent
```

## File Structure

```
web-search-plus-plugin/
├── index.ts                 # Plugin entry — tool registration
├── openclaw.plugin.json     # Plugin metadata
├── package.json             # npm package config
├── .env.template            # API key template
├── .env                     # Your API keys (gitignored)
├── .gitignore
├── LICENSE                  # MIT
├── README.md                # User documentation
├── CHANGELOG.md             # Version history
├── docs/
│   └── ARCHITECTURE.md      # This file
├── scripts/
│   ├── search.py            # Search engine + auto-router
│   └── setup.py             # Interactive setup wizard
└── .cache/                  # Local result cache (gitignored)
```

## Security Model

- **API keys** stay local in `.env` (gitignored, never committed)
- **No outbound data** except search queries to configured providers
- **SSRF protection** on SearXNG instance URLs
- **Input validation** on all tool parameters
- **No dependencies** — zero npm dependencies, only Python stdlib + `urllib`
- **30s timeout** on all external requests
- **Child process isolation** — search.py runs as separate process

## Provider Comparison (Technical)

| Provider | Protocol | Auth | Response Format | Latency |
|----------|----------|------|-----------------|---------|
| Serper | REST | API key header | JSON | ~200ms |
| Tavily | REST | API key in body | JSON | ~500ms |
| Querit | REST | Bearer token | JSON | ~400ms |
| Exa | REST | Bearer token | JSON | ~400ms |
| Perplexity | REST (OpenAI-compatible) | Bearer token | JSON (chat) | ~1-3s |
| You.com | REST | API key header | JSON | ~600ms |
| SearXNG | REST | None (self-hosted) | JSON | ~300ms |
