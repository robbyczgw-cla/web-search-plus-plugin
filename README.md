# web-search-plus-plugin-v2

<p align="center">
  <img src="docs/assets/web-search-plus-logo.png" alt="web search plus logo" width="180">
</p>

Native OpenClaw plugin for one clean set of web tools.

Current version: **2.7.0**

It registers:

- `web_search_plus` — intelligent multi-provider web search
- `web_extract_plus` — URL extraction across supported extract providers
- `web_routing_config_plus` — runtime routing preferences manager

You only need **one** provider configured to start. The best starter stack is:

- **Tavily** for research search
- **Linkup** for source-grounded search and preferred extraction
- **Brave** for broad/current web fallback

## Install

```bash
openclaw plugins install clawhub:web-search-plus-plugin-v2
```

ClawHub: <https://clawhub.ai/plugins/web-search-plus-plugin-v2>
Source: <https://github.com/robbyczgw-cla/web-search-plus-plugin>

## What this gives you

Compared with the built-in `web_search`, this plugin adds:

- routing across multiple web providers instead of one backend
- stronger coverage for research, citations, semantic discovery, and privacy/self-hosted search
- `web_extract_plus` for clean page content after search

## Provider coverage

### Search providers

- **Serper** — Google-style web/news/shopping/local
- **Brave** — broad current web and fallback
- **Tavily** — research-oriented search
- **Exa** — semantic discovery, similar-page, deep search
- **Querit** — multilingual/regional AI search
- **Linkup** — citation/source-grounded search
- **Firecrawl** — search with scrape-friendly metadata
- **Perplexity** — direct answer-style web results via `https://api.perplexity.ai/chat/completions`
- **Kilo Perplexity** — gateway answer-style route via `https://api.kilo.ai/api/gateway/chat/completions`
- **You.com** — current web / RAG-style snippets
- **Serpbase** — Google-style web search via `api.serpbase.dev`; explicit/fallback-only in auto routing by default because provider-side query retention is used for billing/debugging
- **SearXNG** — self-hosted metasearch

### Extraction providers

- **Tavily** — default first choice in auto mode
- **Exa**
- **Linkup**
- **Firecrawl**
- **You.com**

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
- `perplexityApiKey`
- `serpbaseApiKey`
- `kilocodeApiKey`
- `youApiKey`
- `searxngInstanceUrl`

`serpbaseApiKey` maps to Serpbase's `X-API-Key` header. Serpbase is available through `provider: "serpbase"` and can be configured as a runtime `fallback_provider`, but it is intentionally not selected as a normal `provider: "auto"` default.

### Extra fields

- `braveSafesearch`
- `searxngAllowPrivate`
- `routingConfigPath` — optional namespace for in-memory routing preferences

Example:

```json
{
  "plugins": {
    "entries": {
      "web-search-plus-plugin-v2": {
        "config": {
          "tavilyApiKey": "tvly-...",
          "linkupApiKey": "...",
          "braveApiKey": "..."
        }
      }
    }
  }
}
```

## Tool guidance

### `web_search_plus`

Use this first for:

- current events
- sports lineups, scores, schedules
- prices and shopping checks
- weather
- raw source discovery
- quick direct web lookups

### `web_extract_plus`

Use this after search when you already know which URLs you want to read.

Auto extraction fallback order:

- Tavily
- Exa
- Linkup
- Firecrawl
- You.com

## Routing preferences

`web_routing_config_plus` manages runtime routing behavior in memory, separate from provider secrets. ClawHub scanner constraints intentionally avoid runtime filesystem reads in this package.

Default namespace:

- `memory:default`
- override with plugin config `routingConfigPath`

Supported actions:

- `show`
- `set_default_provider`
- `set_auto_routing`
- `set_provider_priority`
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

## Auto-routing notes

`web_search_plus` picks from the providers you actually configured and falls back if the first auto-selected choice fails or is cooling down.

Typical tendencies:

- shopping / local / broad web → Serper or Brave
- research / explanation → Tavily
- citations / evidence → Linkup
- semantic discovery / similar pages → Exa
- multilingual AI search → Querit
- answer-style results → Perplexity direct or Kilo Perplexity gateway
- `provider` accepts `kilo-perplexity` and legacy alias `kilo_perplexity`
- privacy / self-hosted → SearXNG

## Security and packaging

- missing provider credentials are skipped
- SearXNG private-network protection stays on by default
- `searxngAllowPrivate=true` disables that protection only for trusted setups
- package artifact ships runtime files only
- no secrets are persisted by routing preferences or runtime cache

## Verification

Recommended checks:

```bash
npm test -- --test-reporter=spec
npm run build
npm pack --dry-run
```

## Acknowledgments

This OpenClaw plugin tracks the useful feature direction from the Hermes and MCP sister projects, adapted for OpenClaw/ClawHub instead of copied blindly.
