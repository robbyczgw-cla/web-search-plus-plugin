---
name: web-search-plus-plugin
description: OpenClaw plugin for multi-provider web search with intelligent auto-routing. Registers the `web_search_plus` tool — supports Serper, Tavily, Querit, Exa, Perplexity, You.com, and SearXNG.
---

# Web Search Plus Plugin

Registers `web_search_plus` as a native OpenClaw tool. Analyzes query intent and routes to the best configured provider automatically.

## Quick Start

```bash
openclaw plugins install web-search-plus-plugin
```

Add at least one API key via OpenClaw plugin config or environment variables, then allow the tool for your agent:

```json
{ "tools": { "allow": ["web_search_plus"] } }
```

## Runtime

- Pure TypeScript — single file, zero external dependencies
- All provider calls via native `fetch()`
- File-based result caching with provider health tracking
- Built-in SSRF protection for SearXNG

## Providers

| Provider | Strength |
|----------|----------|
| **Serper** | Google-backed general search, news, shopping |
| **Tavily** | Research-focused, deep content extraction |
| **Querit** | Multilingual AI search, 20+ countries |
| **Exa** | Neural/semantic search with deep reasoning modes |
| **Perplexity** | AI-synthesized answers with citations |
| **You.com** | Real-time RAG snippets |
| **SearXNG** | Self-hosted, privacy-first, free |

## Configuration

Via OpenClaw plugin config:

```json
{
  "plugins": {
    "entries": {
      "web-search-plus-plugin": {
        "config": {
          "serperApiKey": "...",
          "tavilyApiKey": "...",
          "exaApiKey": "..."
        }
      }
    }
  }
}
```

Or via `.env` file in the plugin directory. At least one provider key is required.
