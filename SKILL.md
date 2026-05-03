---
name: web-search-plus-plugin-v2
version: 2.3.9
description: OpenClaw plugin for multi-provider web search and URL extraction with intelligent auto-routing. Registers `web_search_plus` and `web_extract_plus`; supports Serper, Brave, Tavily, Linkup, Querit, Exa, Firecrawl, Perplexity/Kilo, You.com, and SearXNG.
---

# Web Search Plus Plugin

Native OpenClaw plugin that registers `web_search_plus` and `web_extract_plus`. It analyzes query intent and routes to the best configured provider automatically.

## Quick Start

```bash
openclaw plugins install clawhub:web-search-plus-plugin-v2
```

Configure at least one provider through OpenClaw plugin config, then allow the tools for your agent if your setup uses tool allowlists:

```json
{ "tools": { "allow": ["web_search_plus", "web_extract_plus"] } }
```

## Runtime

- ClawPack / npm-pack artifact with built JavaScript runtime
- Zero external runtime dependencies
- Provider calls use native `fetch()`
- In-memory result cache and provider health tracking only
- Built-in SSRF protection for SearXNG

## Providers

- Serper — Google-backed general search, news, shopping
- Brave — general/current web search with deterministic routing parity vs Serper
- Tavily — research-focused search and extraction
- Linkup — source-grounded search with citations and fact-check signals
- Querit — multilingual AI search
- Firecrawl — web search with optional extraction-ready content
- Exa — neural/semantic search with deep reasoning modes
- Perplexity — AI-synthesized answers with citations
- Kilo gateway — Perplexity-compatible answer route
- You.com — real-time RAG snippets
- SearXNG — self-hosted, privacy-first metasearch

## Configuration

Use OpenClaw plugin config fields. Example:

```json
{
  "plugins": {
    "entries": {
      "web-search-plus-plugin-v2": {
        "config": {
          "serperApiKey": "...",
          "braveApiKey": "...",
          "tavilyApiKey": "...",
          "exaApiKey": "..."
        }
      }
    }
  }
}
```

Supported config fields include `serperApiKey`, `braveApiKey`, `tavilyApiKey`, `linkupApiKey`, `queritApiKey`, `exaApiKey`, `firecrawlApiKey`, `perplexityApiKey`, `kilocodeApiKey`, `youApiKey`, and `searxngInstanceUrl`.

Package metadata declares the matching provider env names for ClawHub transparency, but the bundled runtime does not directly read `.env` or `process.env` credentials.
