---
name: web-search-plus-plugin-v2
version: 2.6.0
description: OpenClaw plugin for multi-provider web search, extraction, and runtime routing preferences. Registers `web_search_plus`, `web_extract_plus`, and `web_routing_config_plus`.
---

# Web Search Plus Plugin

Native OpenClaw plugin that gives agents one clean set of web tools.

## Tools

- `web_search_plus`
- `web_extract_plus`
- `web_routing_config_plus`

## Good starter setup

Use any one provider to begin, but the recommended starter mix is:

- Tavily
- Linkup
- Brave

Linkup is the preferred extraction provider when present.

## Config fields

Search providers:

- `serperApiKey`
- `braveApiKey`
- `tavilyApiKey`
- `exaApiKey`
- `queritApiKey`
- `linkupApiKey`
- `firecrawlApiKey`
- `perplexityApiKey`
- `kilocodeApiKey`
- `youApiKey`
- `searxngInstanceUrl`

Extra settings:

- `braveSafesearch`
- `searxngAllowPrivate`
- `routingConfigPath` (namespace only)

## Usage guidance

Prefer `web_search_plus` for live/current info, prices, weather, sports, schedules, and finding raw sources.

OpenClaw plugin config remains the source of truth for credentials; runtime code does not rely on direct `.env` reads.

Perplexity provider split:

- `perplexity` → direct Perplexity API (`perplexityApiKey`)
- `kilo-perplexity` / `kilo_perplexity` → Kilo gateway (`kilocodeApiKey`)
