---
name: web-search-plus-plugin-v2
version: 2.4.0
description: OpenClaw plugin for multi-provider web search, extraction, and optional beta answer synthesis. Registers `web_search_plus`, `web_extract_plus`, and gated beta `web_answer_plus`.
---

# Web Search Plus Plugin

Native OpenClaw plugin that gives agents one clean set of web tools.

## Tools

- `web_search_plus`
- `web_extract_plus`
- `web_answer_plus` (**beta**, gated by `enableWebAnswer`)

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

- `braveCountry`
- `braveSearchLang`
- `braveSafesearch`
- `searxngAllowPrivate`
- `enableWebAnswer`

## Usage guidance

Prefer `web_search_plus` for live/current info, prices, weather, sports, schedules, and finding raw sources.

Use `web_answer_plus` only when a user clearly wants a written answer, brief, summary, or cited synthesis. It defaults to `freshness=none`, caps extraction, and falls back to snippet-backed answers with a warning when no extraction provider is configured.

OpenClaw plugin config remains the source of truth for credentials; runtime code does not rely on direct `.env` reads.
