---
name: web-search-plus-plugin-v2
version: 3.2.0
description: OpenClaw plugin for Routing v2 multi-provider web search, research mode, canonical-source reranking, spam/mirror filtering, unified freshness and news vertical, locale defaults, Tavily-first extraction, quality reports, onboarding CLI, and runtime routing preferences. Registers `web_search_plus`, `web_extract_plus`, and `web_routing_config_plus`.
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

Tavily is the default first extraction provider in auto mode. The fallback chain is Tavily → Exa → Linkup → Parallel → Firecrawl → You.com → Keenable → Serper (webpage scraper). Extraction targets are validated against private/internal destinations by default; oversized pages return a head/tail window governed by `extractCharLimit`.

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
- `perplexityApiKey`
- `kilocodeApiKey`
- `youApiKey`
- `searxngInstanceUrl`
- `keenableApiKey`

Extra settings:

- `braveSafesearch`
- `searxngAllowPrivate`
- `routingConfigPath` (namespace only; runtime prefs are in-memory)
- `keenableAllowPublic` (opt-in keyless Keenable public tier)
- `extractAllowPrivateUrls` (opt-in private/internal extraction targets)
- `extractCharLimit` (inline extract budget, default 15000)
- `localeCountry` / `localeLanguage` (default search locale; `"auto"` language enables query inference)
- `parallelMaxCharsPerResult` / `parallelMaxCharsTotal` (Parallel extract budgets)
- `qualityBlockedDomains` / `qualityAllowedDomains` (spam/mirror blocklist overrides)

## Routing v2

Auto routing is class-aware and benchmark-backed. Key classes: multilingual/current, local/shopping, docs/api, academic/arxiv, community/reddit, security/cve, official/vendor-release, official/regulatory, finance/IR, weather/factual, oss-discovery, and answer/synthesis.

Default auto pool: You.com, Serper, Exa, Firecrawl, Tavily, Linkup.
Guarded providers require `auto_allow[provider]=true` for auto routing: Brave, SerpBase, Querit, Parallel, Perplexity, Kilo Perplexity.

Every search routing object exposes `language_hint`, `routing_class`, and `routing_policy`. Pass `quality_report: true` for provider scores, result quality hints, fallback diagnostics, and `authority_signals` (canonical/demoted domain hits and primary-source top-result flag). Recent provider latency/success behavior feeds bounded adaptive score adjustments (`routing.adaptive_adjustments`).

Known SEO mirror/scraper domains are filtered from results and one domain is capped at two head slots (`metadata.result_filter`); `site:`/`include_domains` constraints bypass both. `freshness: day|week|month|year` applies native recency filters where supported (`metadata.freshness`), `search_type: news` uses Serper's native news vertical (`metadata.search_type`), and `localeCountry`/`localeLanguage` steer provider locale (`metadata.locale`).

For canonical-source classes (official/vendor-release, docs/api, official/regulatory, finance/IR, security/cve), auto-routed results are reranked so primary sources outrank mirrors; reorderings are reported in `metadata.intent_rerank`.

## Research mode

`web_search_plus(mode="research")` queries up to 3 providers concurrently, deduplicates across them, and extracts the top `research_extract_count` URLs (default 3) into `source_summaries` for grounding. Use `research_providers` to pick providers explicitly and `research_time_budget` (seconds, default 55) to cap wall-clock cost. Failures are best-effort diagnostics, not hard errors.

## Usage guidance

Prefer `web_search_plus` for live/current info, prices, weather, sports, schedules, and finding raw sources. Use `mode="research"` for grounding-heavy questions that benefit from multiple providers plus extracted full text. Use `web_extract_plus` once URLs are known.

OpenClaw plugin config remains the source of truth for credentials; runtime code does not rely on direct `.env` reads.

Perplexity provider split:

- `perplexity` → direct Perplexity API (`perplexityApiKey`)
- `kilo-perplexity` / `kilo_perplexity` → Kilo gateway (`kilocodeApiKey`)
