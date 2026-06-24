# web-search-plus-plugin-v2

<p align="center">
  <img src="docs/assets/web-search-plus-logo.png" alt="web search plus logo" width="180">
</p>

Native OpenClaw plugin for one clean set of web tools.

Current version: **3.1.0**

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
- **Brave** — broad current web and fallback; guarded in auto routing
- **Tavily** — research-oriented search
- **Exa** — semantic discovery, similar-page, docs/API, arXiv, deep search
- **Querit** — multilingual/current AI search; guarded in auto routing
- **Linkup** — citation/source-grounded search
- **Firecrawl** — search with scrape-friendly metadata and vendor/source pages
- **Parallel** — search and extraction; guarded in auto routing
- **SerpBase** — Google-style alternate search; guarded in auto routing
- **Perplexity** — direct answer-style web results via `https://api.perplexity.ai/chat/completions`; guarded in auto routing
- **Kilo Perplexity** — gateway route via `https://api.kilo.ai/api/gateway/chat/completions`; guarded in auto routing
- **You.com** — current web / RAG-style snippets
- **SearXNG** — self-hosted metasearch
- **Keenable** — independent web index; works keyless, optional key raises limits

### Extraction providers

Auto fallback order:

- Tavily
- Exa
- Linkup
- Parallel
- Firecrawl
- You.com
- Keenable (keyless fallback)

Tavily is the default first call because it was the fastest reliable benchmark head; Firecrawl stays the robust scraper safety net.

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
- `perplexityApiKey`
- `kilocodeApiKey`
- `youApiKey`
- `searxngInstanceUrl`
- `keenableApiKey` (optional — Keenable works keyless without it)

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

Default conservative auto pool: You.com, Serper, Exa, Firecrawl, Tavily, Linkup.
Guarded providers require `auto_allow=true` in routing preferences: Brave, SerpBase, Querit, Parallel, Perplexity, Kilo Perplexity.

Pass `quality_report: true` to receive routing scores, result-quality hints, fallback-chain diagnostics, and `authority_signals` (canonical domain hits, demoted domain hits, and whether the top result is a primary source) for canonical-source routing classes.

### Canonical-source reranking

For routing classes where source authority beats snippet luck (`official/vendor-release`, `docs/api`, `official/regulatory`, `finance/IR`, `security/cve`), auto-routed results are reranked so primary sources (vendor blogs, official docs, regulators, IR pages, NVD/CVE records) outrank mirrors like YouTube, Medium, or Reddit. When the order changes, `metadata.intent_rerank` reports the routing class and the top domain before/after.

## Research mode

`web_search_plus(mode="research")` runs a compact multi-provider sweep for grounding-heavy questions:

1. Picks up to 3 configured, auto-allowed providers (primary route first, then Linkup/Tavily/Exa/Firecrawl/… by preference), or uses an explicit `research_providers` list.
2. Queries them **concurrently** — wall-clock cost tracks the slowest provider, not the sum. Result ordering stays deterministic regardless of which provider finishes first.
3. Deduplicates results across providers.
4. Extracts the top `research_extract_count` URLs (default 3, max 5) via `web_extract_plus` auto fallback into `source_summaries`.

Research mode is best-effort: provider or extraction failures produce diagnostics in `routing.provider_errors` / `routing.extraction_error` instead of failing the whole call. A `research_time_budget` (seconds, default 55) gates which providers launch and whether extraction runs. Quality reports are always attached.

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

## Verification

Recommended checks:

```bash
npm test -- --test-reporter=spec
npm run build
npm pack --dry-run
```

## Acknowledgments

This OpenClaw plugin tracks the useful feature direction from the Hermes and MCP sister projects, adapted for OpenClaw/ClawHub instead of copied blindly.
