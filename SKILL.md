---
name: web-search-plus-plugin
description: OpenClaw native plugin for multi-provider web search with intelligent auto-routing across Serper/Google, Tavily, Querit, Exa, Perplexity, You.com, and SearXNG. Registers the `web_search_plus` tool with automatic provider selection based on query intent.
---

# Web Search Plus Plugin

Native OpenClaw plugin that registers the `web_search_plus` tool with intelligent multi-provider routing.

## Install

```bash
openclaw plugins install web-search-plus-plugin
```

## Providers

- **Serper** — Google-backed, fast, general search
- **Tavily** — Research-focused, deep content extraction
- **Querit** — Multilingual AI search, 20+ countries
- **Exa** — Neural search with deep/deep-reasoning modes
- **Perplexity** — AI-synthesized answers
- **You.com** — RAG + real-time
- **SearXNG** — Self-hosted privacy search

## Configuration

Configure API keys in your OpenClaw plugin config or via environment variables:

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

## Usage

The `web_search_plus` tool is registered as optional. Enable it:

```json
{ "tools": { "allow": ["web_search_plus"] } }
```
