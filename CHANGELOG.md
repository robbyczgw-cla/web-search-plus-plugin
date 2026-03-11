# Changelog

All notable changes to web-search-plus-plugin are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) + [Semantic Versioning](https://semver.org/).

## [1.2.0] - 2026-03-11

### Added

#### Signal pattern coverage (gap analysis)
- **LOCAL_NEWS_SIGNALS** — 9 German patterns: "in der nähe", "in meiner nähe", "öffnungszeiten", "adresse von", "wegbeschreibung nach", "heute", "morgen", "aktuell", "nachrichten"
- **EXA_DEEP_SIGNALS** — 8 new patterns: "research on/about/into", "whitepaper", "technical report", "survey of", "meta-analysis", "systematic review", "case study", "benchmarking"
- **EXA_DEEP_REASONING_SIGNALS** — 5 new patterns: "trade-offs", "pros and cons of", "should I use/choose/pick", "which is better", "vergleiche/vergleichen" (DE)
- **DIRECT_ANSWER_SIGNALS** — 4 German patterns: "wann", "wer", "wo", "wie viele"

#### Exa Deep Research (`deep` + `deep-reasoning`)
- **New `depth` tool parameter** — agents can now request `depth: "deep"` (multi-source synthesis, 4-12s, $12/1k requests) or `depth: "deep-reasoning"` (cross-document reasoning with deeper analysis, 12-50s, $15/1k requests) when searching via Exa
- **Automatic depth selection** — the auto-router detects queries that benefit from deep search using two new signal categories:
  - `EXA_DEEP_SIGNALS` (25 patterns): triggers on "synthesize", "deep research", "comprehensive analysis", "SEC filings", "literature review", "due diligence", "market research", "dossier", etc. (English + German)
  - `EXA_DEEP_REASONING_SIGNALS` (18 patterns): triggers on "reconcile", "competing claims", "critical analysis", "regulatory landscape", "patent analysis", "competitive intelligence", etc. (English + German)
- **Deep search response parsing** — synthesized content from Exa's `output.content` field is returned as the primary result with `type: "synthesis"`, followed by individual source documents with `type: "source"`
- **Grounding citations** — field-level citations from Exa's `output.grounding` array are included in results, each with `url`, `title`, `confidence`, and `field` reference
- **CLI arguments** — `--exa-depth normal|deep|deep-reasoning`, `--exa-verbosity compact|standard|full`
- **Extended `--exa-type` choices** — now supports `neural`, `fast`, `auto`, `keyword`, `instant` (was: only `neural`, `keyword`)

#### OpenClaw Plugin Integration
- **`configSchema`** — the plugin manifest now declares 7 configuration fields (`serperApiKey`, `tavilyApiKey`, `exaApiKey`, `perplexityApiKey`, `kilocodeApiKey`, `youApiKey`, `searxngInstanceUrl`), enabling configuration through the OpenClaw Control UI
- **`uiHints`** — all API key fields are marked `sensitive: true` so the OpenClaw UI renders them as password inputs and masks them in logs/exports. Each field has a descriptive label and placeholder
- **Config bridge** — `index.ts` now reads `api.config` from OpenClaw and maps plugin config fields to the environment variables expected by `search.py`. Merge order: `process.env` < OpenClaw config < `.env` file (`.env` wins for local dev overrides)
- **`kind: "skill"`** — plugin manifest now declares its category

#### Tool Schema
- **All 6 providers exposed** — the MCP tool schema now lists `serper`, `tavily`, `exa`, `perplexity`, `you`, `searxng`, and `auto` (was: only `serper`, `tavily`, `exa`, `auto`). Agents can now explicitly request any provider
- **`depth` parameter** — new optional parameter in the tool schema with description explaining cost and latency tradeoffs

#### .env.template
- **All 7 provider keys** documented with signup URLs: `SERPER_API_KEY`, `TAVILY_API_KEY`, `EXA_API_KEY`, `PERPLEXITY_API_KEY`, `KILOCODE_API_KEY`, `YOU_API_KEY`, `SEARXNG_INSTANCE_URL`

### Fixed

#### Router availability bug (critical)
- **`get_env_key()` → `get_api_key(p, self.config)`** in `QueryAnalyzer.route()` and `explain_routing()` — the router was using a legacy function that only checked environment variables, completely ignoring API keys configured in `config.json`. This meant users who ran the setup wizard (which writes to `config.json`) had their providers marked as "unavailable" by the router, causing incorrect routing decisions and fallback to the wrong provider. Now both `config.json` and environment variables are checked consistently

#### Perplexity API key alias (medium)
- **`PERPLEXITY_API_KEY` now recognized** — the README and `.env.template` documented `PERPLEXITY_API_KEY` as a valid env var, but `get_api_key()` only checked `KILOCODE_API_KEY`. Users who set `PERPLEXITY_API_KEY` got a silent "Missing API key" error. Now `PERPLEXITY_API_KEY` is checked first with `KILOCODE_API_KEY` as fallback

#### `--include-news` dead code (low)
- **Replaced with `--no-news`** — the previous `--include-news` flag used `action="store_true"` with `default=True`, making it impossible to disable news results. The flag had no effect. Now `--no-news` correctly excludes You.com news results when set. News results remain included by default (no behavior change for existing users)

#### `config.json` not gitignored (security)
- **Added `config.json` to `.gitignore`** — the setup wizard (`setup.py`) writes API keys to `config.json`, but this file was not gitignored. A `git add .` would commit API keys to the repository. The `ARCHITECTURE.md` incorrectly claimed it was already gitignored

#### Version sync
- **`openclaw.plugin.json` version** now matches `package.json` (was `1.0.0` vs `1.1.6`, now both `1.2.0`)

### Changed

#### Exa adapter improvements
- **Richer snippets** — standard Exa results now use `verbosity: "standard"` and `maxCharacters: 2000` (was: 1000 with no verbosity setting). Highlights use `numSentences: 3, highlightsPerUrl: 2` instead of bare `true`
- **Better snippet extraction** — prefers full text content over highlights, with highlights as fallback. Multiple highlights are joined with `" ... "` separator instead of taking only the first one
- **Deep search timeout** — `make_request()` uses 55s timeout for deep searches (was: 30s for all)

#### Tool description
- **Updated** to mention all 6 providers and the new `depth` parameter. Now reads: "Search the web using multi-provider intelligent routing (Serper/Google, Tavily/Research, Exa/Neural+Deep, Perplexity, You.com, SearXNG)..."

#### Timeout
- **`spawnSync` timeout increased** from 30s to 65s to accommodate Exa Deep Reasoning which can take up to 50s

#### Router scoring
- **Exa score now includes deep signal contribution** — `exa_score = discovery_score + similarity_bonus + (exa_deep_score * 0.5) + (exa_deep_reasoning_score * 0.5)`. The 0.5 multiplier ensures deep signals boost Exa as provider without dominating over other intents
- **Exa depth determination** uses threshold ≥ 4.0 — a single strong deep signal (e.g., "synthesize" = 5.0) is enough to trigger deep search, but weak signals alone won't

#### Default config
- **Exa config block** now includes `depth: "normal"` and `verbosity: "standard"` defaults, configurable via `config.json`

#### Cache context
- **`exa_depth` and `exa_verbosity` included in cache key** — prevents a cached "normal" result from being returned for a subsequent "deep" query on the same text

## [1.1.5] - 2026-03-07

### Changed
- 📖 **Expanded README** — provider comparison table with free tiers, auto-routing examples, tool parameter docs, CLI test commands, 8 FAQ entries, requirements section

## [1.1.4] - 2026-03-07

### Added
- 🔍 **Perplexity provider** added to README and `.env.template`
- 📦 **npm publish** — proper `files` list, `main`, `repository` fields in package.json

## [1.1.3] - 2026-03-06

### Added
- 🕒 **Perplexity freshness filter** — synced from web-search-plus v2.8.5

## [1.1.2] - 2026-03-05

### Security
- 🔒 **SSRF protection** — synced from web-search-plus v2.8.4. SearXNG instance URLs are validated against private IP ranges and cloud metadata endpoints

## [1.1.1] - 2026-03-04

### Fixed
- 🔧 **Perplexity results parsing** — synced from web-search-plus v2.8.3

## [1.1.0] - 2026-03-03

### Added
- 🔍 **Perplexity (Sonar Pro)** — new provider via direct API key or Kilo Gateway (`KILOCODE_API_KEY`)
- 🧠 **Auto-routing improvements** — Perplexity scored for direct-answer queries
- 🔄 Synced search.py with web-search-plus skill v2.8.0

## [1.0.2] - 2026-02-28

### Fixed
- 🔑 **`.env` loading** — plugin loads `.env` from its own directory with fallback to sibling skill path
- 🔒 **`.gitignore`** — `.env` added to prevent accidental key commits
- 📄 **`.env.template`** — added for easy setup

## [1.0.1] - 2026-02-27

### Added
- 📖 **You.com and SearXNG** providers documented in README

## [1.0.0] - 2026-02-26

### Added
- 🎉 **Initial release** — standalone OpenClaw plugin
- 🔍 Registers `web_search_plus` as native tool
- 🧠 Auto-routing across Serper, Tavily, Exa
- 📦 Bundled Python backend (`scripts/search.py`)
- 🛠️ Interactive setup wizard (`scripts/setup.py`)
- 💾 Local result caching
- ⚡ Graceful provider fallbacks
