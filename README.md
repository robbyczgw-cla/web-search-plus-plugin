# web-search-plus-plugin-v2

Native OpenClaw plugin for one clean set of web tools.

Current version: **2.4.0**

It registers:

- `web_search_plus` — intelligent multi-provider web search
- `web_extract_plus` — URL extraction across supported extract providers
- `web_answer_plus` — **optional beta** written answer / cited synthesis tool

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
- optional beta `web_answer_plus` for written summaries grounded in search results and capped extraction

## Provider coverage

### Search providers

- **Serper** — Google-style web/news/shopping/local
- **Brave** — broad current web and fallback
- **Tavily** — research-oriented search
- **Exa** — semantic discovery, similar-page, deep search
- **Querit** — multilingual/regional AI search
- **Linkup** — citation/source-grounded search
- **Firecrawl** — search with scrape-friendly metadata
- **Perplexity** — answer-style web results
- **Kilo gateway** — Perplexity-compatible gateway route
- **You.com** — current web / RAG-style snippets
- **SearXNG** — self-hosted metasearch

### Extraction providers

- **Linkup** — preferred when available
- **Firecrawl**
- **Tavily**
- **Exa**
- **You.com**

## Configuration

Use explicit OpenClaw plugin config fields. The runtime keeps the OpenClaw config-field model and does **not** depend on direct `.env` / `process.env` secret reads.

### Search provider fields

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

### Extra fields

- `braveCountry`
- `braveSearchLang`
- `braveSafesearch`
- `searxngAllowPrivate`
- `enableWebAnswer` — enables the optional beta `web_answer_plus`

Example:

```json
{
  "plugins": {
    "entries": {
      "web-search-plus-plugin-v2": {
        "config": {
          "tavilyApiKey": "tvly-...",
          "linkupApiKey": "...",
          "braveApiKey": "...",
          "enableWebAnswer": true
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

### `web_answer_plus` (beta)

Use this only when you explicitly want a:

- written answer
- brief
- summary
- cited synthesis

Important behavior:

- `freshness` defaults to **`none`**
- recency only happens when you explicitly set `freshness=auto/day/week/month/year`
- extraction is capped (`max_extracts`, hard limit 5)
- if no extraction-capable provider is configured, it returns a **snippet-backed** answer with a warning instead of pretending it extracted pages
- Linkup is the preferred extraction provider when available

## Auto-routing notes

`web_search_plus` picks from the providers you actually configured and falls back if the first choice fails or is cooling down.

Typical tendencies:

- shopping / local / broad web → Serper or Brave
- research / explanation → Tavily
- citations / evidence → Linkup
- semantic discovery / similar pages → Exa
- multilingual AI search → Querit
- answer-style results → Perplexity or Kilo gateway
- privacy / self-hosted → SearXNG

## Security and packaging

- missing provider credentials are skipped
- SearXNG private-network protection stays on by default
- `searxngAllowPrivate=true` disables that protection only for trusted setups
- package artifact ships runtime files only
- no secrets are persisted by the runtime

## Verification

Recommended checks:

```bash
npm test -- --test-reporter=spec
npm run build
npm pack --dry-run
```

## Acknowledgments

This OpenClaw plugin tracks the useful feature direction from the Hermes and MCP sister projects, adapted for OpenClaw/ClawHub instead of copied blindly.
