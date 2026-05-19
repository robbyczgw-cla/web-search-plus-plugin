---
name: web-search-plus-plugin-v2
version: 3.0.0
description: OpenClaw plugin for Routing v2 multi-provider web search, Tavily-first extraction, quality reports, onboarding CLI, and runtime routing preferences. Registers `web_search_plus`, `web_extract_plus`, and `web_routing_config_plus`.
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

Tavily is the default first extraction provider in auto mode. The fallback chain is Tavily → Exa → Linkup → Parallel → Firecrawl → You.com.

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

Extra settings:

- `braveSafesearch`
- `searxngAllowPrivate`
- `routingConfigPath` (namespace only; runtime prefs are in-memory)

## Routing v2

Auto routing is class-aware and benchmark-backed. Key classes: multilingual/current, local/shopping, docs/api, academic/arxiv, community/reddit, security/cve, official/regulatory, finance/IR, weather/factual, oss-discovery, and answer/synthesis.

Default auto pool: You.com, Serper, Exa, Firecrawl, Tavily, Linkup.
Guarded providers require `auto_allow[provider]=true` for auto routing: Brave, SerpBase, Querit, Parallel, Perplexity, Kilo Perplexity.

Every search routing object exposes `language_hint`, `routing_class`, and `routing_policy`. Pass `quality_report: true` for provider scores, result quality hints, and fallback diagnostics.

## Usage guidance

Prefer `web_search_plus` for live/current info, prices, weather, sports, schedules, and finding raw sources. Use `web_extract_plus` once URLs are known.

OpenClaw plugin config remains the source of truth for credentials; runtime code does not rely on direct `.env` reads.

Perplexity provider split:

- `perplexity` → direct Perplexity API (`perplexityApiKey`)
- `kilo-perplexity` / `kilo_perplexity` → Kilo gateway (`kilocodeApiKey`)
