---
name: web-search-plus-plugin-v2
version: 3.2.0
description: OpenClaw plugin for Routing v2 multi-provider web search, research mode, canonical-source reranking, spam/mirror filtering, unified freshness and news vertical, locale defaults, Tavily-first extraction, optional local Hound MCP search/extraction, quality reports, onboarding CLI, and runtime routing preferences. Registers `web_search_plus`, `web_extract_plus`, and `web_routing_config_plus`.
---

# Web Search Plus Plugin

Native OpenClaw plugin that gives agents one clean web surface: search, extract, and routing config. `web_answer_plus` is intentionally removed in v3.0.0; use search plus extraction instead.

## Tools

- `web_search_plus`
- `web_extract_plus`
- `web_routing_config_plus`

## Good starter setup

Recommended starter preset:

- You.com
- Serper
- Linkup

Run:

```bash
web-search-plus-setup setup --preset starter --config ./web-search-plus-plugin.config.json
```

Tavily is the default first extraction provider in auto mode. The fallback chain is Tavily → Exa → Linkup → Parallel → Firecrawl → You.com → Keenable → Serper (webpage scraper) → Hound. Hound is a separately installed local MCP sidecar and remains explicit-only until deliberately auto-allowed. Extraction targets are validated against private/internal destinations by default. Calls process at most 10 URLs and return at most 60,000 aggregate Unicode codepoints by default; request-side `max_urls`/`max_context_chars` can lower those limits and operator settings can impose ceilings. Oversized pages return a head/tail window governed by `extractCharLimit`.

Use `spans=true` for deterministic query-conditioned passages. `spans_query` supplies the ranking query; offsets are half-open Unicode-codepoint positions into the complete cleaned NFC text, and `within_preview` says whether each passage is present in the inline preview.

## Config fields

Search providers:

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

Extra settings:

- `braveSafesearch`
- `searxngAllowPrivate`
- `routingConfigPath` (namespace only; runtime prefs are in-memory)
- `keenableAllowPublic` (opt-in keyless Keenable public tier)
- `houndTimeoutSeconds` / `houndMaxResponseBytes` / `houndMaxContentChars` (bounded Hound MCP limits)
- `extractAllowPrivateUrls` (opt-in private/internal extraction targets)
- `extractCharLimit` (inline extract budget, default 15000)
- `extractMaxUrls` (operator URL ceiling, default 10)
- `extractMaxContextChars` (operator aggregate context ceiling, default 60000)
- `extractCacheMaxEntries` (process-local extraction LRU capacity, default 64; entries disappear on host restart)
- `localeCountry` / `localeLanguage` (default search locale; `"auto"` language enables query inference)
- `parallelMaxCharsPerResult` / `parallelMaxCharsTotal` (Parallel extract budgets)
- `qualityBlockedDomains` / `qualityAllowedDomains` (spam/mirror blocklist overrides)

## Routing v2

Auto routing is class-aware and benchmark-backed. Key classes: multilingual/current, local/shopping, docs/api, academic/arxiv, community/reddit, security/cve, official/vendor-release, official/regulatory, finance/IR, weather/factual, oss-discovery, and answer/synthesis.

Default auto pool: You.com, Serper, Brave, Exa, Firecrawl, Tavily, Linkup.
Guarded providers require `auto_allow[provider]=true` for auto routing: SerpBase, Querit, Parallel, Hound. Brave is auto-allowed by default for independent-index source diversity and can still be disabled explicitly. Hound setup and security constraints are documented in `docs/HOUND.md`.

`provider_priority` controls search only. `extract_provider_priority` independently controls `web_extract_plus(provider="auto")`; missing extraction providers are appended in the stable Tavily-first default order.

The `self_hosted` routing profile is selected with `web_routing_config_plus(action="set_profile", profile="self_hosted")`. It derives SearXNG → Keenable search routing and Keenable-first extraction while keeping explicit keyed provider overrides available. Auto calls require a configured SearXNG instance or Keenable credential/public-tier opt-in.

Every search routing object exposes `language_hint`, `routing_class`, and `routing_policy`. Pass `quality_report: true` for provider scores, result quality hints, fallback diagnostics, `authority_signals` (canonical/demoted domain hits and primary-source top-result flag), and a calibrated `diversity` score. `qualityDiversityRerank=true` is an operator opt-in that moves near-duplicate Research results behind the diverse head without dropping them. Recent provider latency/success behavior feeds bounded adaptive score adjustments (`routing.adaptive_adjustments`).

Known SEO mirror/scraper domains are filtered from results and one domain is capped at two head slots (`metadata.result_filter`); `site:`/`include_domains` constraints bypass both. `freshness: day|week|month|year` applies native recency filters where supported (`metadata.freshness`), `search_type: news` uses Serper's native news vertical (`metadata.search_type`), and `localeCountry`/`localeLanguage` steer provider locale (`metadata.locale`).

For canonical-source classes (official/vendor-release, docs/api, official/regulatory, finance/IR, security/cve), auto-routed results are reranked so primary sources outrank mirrors; reorderings are reported in `metadata.intent_rerank`.

## Research mode

`web_search_plus(mode="research")` queries up to 3 providers concurrently, deduplicates across them, and extracts the top `research_extract_count` URLs (default 3) into `source_summaries` for grounding. Use `research_providers` to pick providers explicitly and `research_time_budget` (seconds, default 55) to cap wall-clock cost. `routing.provider_attempts` preserves per-provider outcomes; partial evidence is degraded and total fan-out failure is a failed envelope.

## Usage guidance

Prefer `web_search_plus` for live/current info, prices, weather, sports, schedules, and finding raw sources. Use `mode="research"` for grounding-heavy questions that benefit from multiple providers plus extracted full text. Use `web_extract_plus` once URLs are known.

OpenClaw plugin config remains the source of truth for credentials; runtime code does not rely on direct `.env` reads.
