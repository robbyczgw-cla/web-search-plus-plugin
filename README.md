# Web Search Plus Plugin

<p align="center">
  <img src="docs/assets/web-search-plus-logo.png" alt="web search plus logo" width="180">
</p>

Native OpenClaw plugin for one clean set of web tools.

Current version: **3.2.0**

> **Status: synced through the applicable Hermes v3.2 line.**
> The v3.0–v3.2 changes are ported where they fit the in-process, scanner-safe OpenClaw runtime. Hermes-only subprocess, filesystem-state, migration, and benchmark infrastructure remains intentionally unported; see `PLAN.md` for the feature-by-feature assessment.

It registers:

- `web_search_plus` — Routing v2 intelligent multi-provider web search with research mode and canonical-source reranking
- `web_extract_plus` — Tavily-first URL extraction across supported providers
- `web_routing_config_plus` — in-memory runtime routing preferences manager

`web_answer_plus` is removed in v3.0.0. Use search plus extraction; fewer tools, less mush.

## Install

```bash
openclaw plugins install clawhub:web-search-plus-plugin-v2
```

ClawHub: <https://clawhub.ai/plugins/web-search-plus-plugin-v2>
Source: <https://github.com/robbyczgw-cla/web-search-plus-plugin>

## Quick setup

You only need **one** provider configured to start. The recommended starter stack is:

- **You.com** for fast snippets / factual queries
- **Serper** for Google-style local, shopping, and community search
- **Linkup** for source-grounded search and citations

Onboarding CLI:

```bash
web-search-plus-setup status --config ./web-search-plus-plugin.config.json
web-search-plus-setup list providers
web-search-plus-setup list presets
web-search-plus-setup setup --preset starter --config ./web-search-plus-plugin.config.json
web-search-plus-setup config --config ./web-search-plus-plugin.config.json --set routingConfigPath=memory:default
```

Runtime credentials still come from explicit OpenClaw plugin config fields. The CLI writes a JSON helper file for setup/onboarding, not runtime secret discovery.

## Provider coverage

### Search providers

- **Serper** — Google-style web/news/shopping/local
- **Brave** — independent-index current web and multilingual search in the default auto pool
- **Tavily** — research-oriented search
- **Exa** — semantic discovery, similar-page, docs/API, arXiv, deep search
- **Querit** — multilingual/current AI search; guarded in auto routing
- **Linkup** — citation/source-grounded search
- **Firecrawl** — search with scrape-friendly metadata and vendor/source pages
- **Parallel** — search and extraction; guarded in auto routing
- **SerpBase** — Google-style alternate search; guarded in auto routing
- **You.com** — current web / RAG-style snippets
- **SearXNG** — self-hosted metasearch
- **Keenable** — independent web index; keyed or opt-in keyless public tier, lowest-priority fallback
- **Hound** — optional local MCP sidecar; explicit-only until deliberately auto-allowed ([setup and security guide](docs/HOUND.md))

### Extraction providers

Auto fallback order:

- Tavily
- Exa
- Linkup
- Parallel
- Firecrawl
- You.com
- Keenable (keyed or opt-in keyless public tier)
- Serper (webpage scraper via `scrape.serper.dev`, last resort)
- Hound (local MCP sidecar, guarded and explicit-only by default)

Tavily is the default first call because it was the fastest reliable benchmark head; Firecrawl stays the robust scraper safety net. Extraction targets are validated against private/internal destinations by default (see `extractAllowPrivateUrls`). Calls process at most 10 URLs and return at most 60,000 aggregate Unicode codepoints by default; `max_urls` and `max_context_chars` may request lower limits, while `extractMaxUrls` and `extractMaxContextChars` set operator ceilings. Oversized pages return a head/tail window governed by `extractCharLimit`, and inline base64 images are replaced with `[IMAGE: alt]` placeholders.

Set `spans: true` to add up to three deterministic, non-overlapping passages per successful result. `spans_query` conditions lexical ranking. Span offsets address the complete cleaned NFC text in Unicode codepoints using half-open `[start,end)` ranges; `within_preview` reports whether the selected text survived inline truncation.

## Configuration

Use explicit OpenClaw plugin config fields. The runtime uses only plugin config fields for credentials.

### Search provider fields

- `serperApiKey`
- `braveApiKey`
- `tavilyApiKey`
- `exaApiKey`
- `queritApiKey`
- `linkupApiKey`
- `firecrawlApiKey`
- `parallelApiKey`
- `serpbaseApiKey`
- `youApiKey`
- `searxngInstanceUrl`
- `keenableApiKey`
- `houndMcpUrl`

### Extra fields

- `braveSafesearch`
- `searxngAllowPrivate`
- `routingConfigPath` — optional namespace for in-memory routing preferences
- `keenableAllowPublic` — opt-in keyless Keenable public tier (unauthenticated shared service, off by default)
- `houndTimeoutSeconds` / `houndMaxResponseBytes` / `houndMaxContentChars` — bounded local Hound MCP transport and extraction request limits; see [the Hound guide](docs/HOUND.md)
- `extractAllowPrivateUrls` — opt-in: allow extraction of private/internal URLs (trusted intranets only)
- `extractCharLimit` — inline character budget per extracted page before head/tail truncation (default 15000)
- `extractMaxUrls` — operator ceiling for URLs processed per extraction call (default 10, hard maximum 50)
- `extractMaxContextChars` — operator ceiling for aggregate inline extraction content (default 60000 Unicode codepoints, maximum 200000)
- `extractCacheMaxEntries` — process-local LRU capacity for completed extraction requests (default 64, range 1–500; lost on host restart)
- `localeCountry` / `localeLanguage` — default search locale for Serper, Brave, Querit, Firecrawl, You.com, and SearXNG; `localeLanguage: "auto"` enables conservative query language inference. Explicit location hints in the query win the country; query language never implies the country. Without these fields the providers keep their us/en defaults.
- `parallelMaxCharsPerResult` / `parallelMaxCharsTotal` — Parallel extraction full-content budgets (defaults 60000 / 120000)
- `qualityBlockedDomains` / `qualityAllowedDomains` — extend or rescue from the built-in spam/mirror result blocklist

Example:

```json
{
  "plugins": {
    "entries": {
      "web-search-plus-plugin-v2": {
        "config": {
          "youApiKey": "...",
          "serperApiKey": "...",
          "linkupApiKey": "..."
        }
      }
    }
  }
}
```

## Routing v2

`web_search_plus(provider="auto")` uses class-aware benchmarked routing. Diagnostics expose `language_hint`, `routing_class`, and `routing_policy` on every response.

Classes:

- multilingual/current → Querit/Brave when allowed
- local/shopping → Serper
- docs/api → Exa/Firecrawl
- academic/arxiv → Exa
- community/reddit → Serper/Brave
- security/cve → Firecrawl for vendor/source pages
- official/vendor-release → You.com/Linkup for vendor announcements (Anthropic, OpenAI, Mistral, …)
- official/regulatory → Linkup
- finance/IR → Linkup/Tavily
- weather/factual → You.com snippet-first
- oss-discovery → Exa similar-page discovery
- answer/synthesis → flags `answer_mode_recommended`; it does **not** resurrect `web_answer_plus`

Default conservative auto pool: You.com, Serper, Brave, Exa, Firecrawl, Tavily, Linkup.
Guarded providers require `auto_allow=true` in routing preferences: SerpBase, Querit, Parallel, Hound. Brave is in the default Classic auto pool for independent-index source diversity; operators can still set `auto_allow.brave=false`. Hound remains explicit-only until `web_routing_config_plus(action="set_auto_allow", provider="hound", enabled=true)` is called.

Search `provider_priority` and extraction `extract_provider_priority` are independent. Partial extraction lists are completed in the public Tavily-first order, and can be updated with `web_routing_config_plus(action="set_extract_provider_priority", providers=[...])`.

`web_routing_config_plus(action="set_profile", profile="self_hosted")` derives a local-first routing view: SearXNG then Keenable for search, and Keenable first for extraction. Other providers are excluded from automatic selection and fallback but remain available when explicitly requested. Auto mode fails with a clear readiness error until `searxngInstanceUrl`, `keenableApiKey`, or the opted-in Keenable public tier is configured. Return to the normal pool with `profile="standard"`. The setup CLI also exposes `--preset self-hosted`.

Pass `quality_report: true` to receive routing scores, result-quality hints, fallback-chain diagnostics, `authority_signals` (canonical domain hits, demoted domain hits, and whether the top result is a primary source), and a deterministic `diversity` score. The score combines registrable-domain coverage, canonical-URL uniqueness, snippet-trigram diversity, and provider mix. Set `qualityDiversityRerank: true` to move near-duplicate Research candidates behind the diverse head without removing results.

Auto routing additionally learns from recent provider behavior: every call records latency, result volume, and errors into an in-memory rolling window, and routing scores get a bounded (±1.0) adjustment (`routing.adaptive_adjustments`) once enough fresh samples exist — enough to break ties, never enough to override a clear query-class winner.

### Result hygiene

Results from known SEO mirror/scraper domains (Stack Overflow clones, GitHub issue mirrors, documentation mirrors) are removed, and a single domain is capped at two head slots via a stable diversity rerank (overflow is demoted, not dropped). Explicit `site:` queries and `include_domains` bypass both. Removals and demotions are reported in `metadata.result_filter`.

### Freshness, news vertical, and locale

- `freshness: day|week|month|year` maps to each provider's native recency filter; providers without one run normally and report `freshness.applied=false` in metadata.
- `search_type: news` uses Serper's native `/news` endpoint (with date, source, thumbnail, and position metadata); other providers report `search_type.applied=false`.
- `localeCountry`/`localeLanguage` set default region and language for the locale-capable providers, with query-aware language inference when `localeLanguage: "auto"`. The resolved locale and its per-value source are reported in `metadata.locale`.

### Canonical-source reranking

For routing classes where source authority beats snippet luck (`official/vendor-release`, `docs/api`, `official/regulatory`, `finance/IR`, `security/cve`), auto-routed results are reranked so primary sources (vendor blogs, official docs, regulators, IR pages, NVD/CVE records) outrank mirrors like YouTube, Medium, or Reddit. When the order changes, `metadata.intent_rerank` reports the routing class and the top domain before/after.

## Research mode

`web_search_plus(mode="research")` runs a compact multi-provider sweep for grounding-heavy questions:

1. Picks up to 3 configured, auto-allowed providers (primary route first, then Linkup/Tavily/Exa/Firecrawl/… by preference), or uses an explicit `research_providers` list.
2. Queries them **concurrently** — wall-clock cost tracks the slowest provider, not the sum. Result ordering stays deterministic regardless of which provider finishes first.
3. Deduplicates results across providers.
4. Extracts the top `research_extract_count` URLs (default 3, max 5) via `web_extract_plus` auto fallback into `source_summaries`.

Research mode is best-effort: each launched/skipped provider is recorded in `routing.provider_attempts`; provider or extraction failures produce diagnostics in `routing.provider_errors` / `routing.extraction_error`. Partial evidence returns `status="degraded"`, while total fan-out failure returns a complete `status="failed"` envelope. A `research_time_budget` (seconds, default 55) gates launches, cancels the response wait for started overruns, and gates extraction. Quality reports are attached once after the merge. Optional `qualityDiversityRerank` moves later URL/content duplicate candidates behind the diverse result head before source extraction.

```json
{
  "query": "What changed in the EU AI Act enforcement timeline?",
  "mode": "research",
  "research_extract_count": 3,
  "research_time_budget": 55
}
```

## Routing preferences

`web_routing_config_plus` manages runtime routing behavior in memory, separate from provider secrets. ClawHub scanner constraints intentionally avoid runtime filesystem reads in this package.

Supported actions:

- `show`
- `set_default_provider`
- `set_auto_routing`
- `set_auto_allow`
- `set_provider_priority`
- `set_extract_provider_priority`
- `set_profile`
- `set_fallback_provider`
- `disable_provider`
- `enable_provider`
- `set_confidence_threshold`
- `reset`

Behavior notes:

- if `auto_routing=false`, `provider:auto` becomes strict `default_provider`
- explicit provider requests stay strict and do not silently fall back
- normal auto mode can still use priority order, fallback provider, cooldowns, and retries
- invalid plugin-provided routing config falls back to defaults with a warning
- reset restores in-memory defaults for the selected namespace

## Verification

Recommended checks:

```bash
npm test -- --test-reporter=spec
npm run build
npm pack --dry-run
```

## Acknowledgments

This OpenClaw plugin tracks the useful feature direction from the Hermes and MCP sister projects, adapted for OpenClaw/ClawHub instead of copied blindly.
