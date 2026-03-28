# web-search-plus-plugin

Multi-provider web search plugin for OpenClaw.

It registers a `web_search_plus` tool that can query multiple providers and auto-route to the one that best fits the query.

## Why use this instead of OpenClaw's built-in `web_search`?

OpenClaw's built-in `web_search` uses Brave Search.

This plugin is useful if you want:
- more than one backend
- different search styles for different tasks
- fallback between providers when one is unavailable
- a self-hosted option via SearXNG

Supported providers:
- Serper (Google)
- Tavily
- Exa
- Querit
- Perplexity
- You.com
- SearXNG

## What you need

You do not need every provider.

You need at least one configured provider:
- an API key for any hosted provider, or
- a SearXNG instance URL

All provider settings are optional individually. Free tiers are available for several of them.

## Quick setup

```bash
cp .env.template .env
# add at least one API key or SearXNG URL
```

Then load the plugin in OpenClaw and restart the gateway.

## Provider overview

| Provider | Best for | Free tier |
| --- | --- | --- |
| Serper | Google-style general web, news, shopping, local results | Yes |
| Tavily | Research-style results and summaries | Yes |
| Exa | Semantic / neural discovery | Yes |
| Querit | Multilingual and regional search | Yes |
| Perplexity | Answer-style web results with citations | Limited / depends on plan |
| You.com | General web + answer-oriented results | Limited |
| SearXNG | Self-hosted metasearch | Yes, self-hosted |

## Notes

- Auto-routing chooses among configured providers only.
- If a provider is missing credentials, it is skipped.
- SearXNG includes SSRF protection by default.
- `SEARXNG_ALLOW_PRIVATE=true` disables that protection and should only be used on trusted private networks.

## Environment variables

Main options:
- `SERPER_API_KEY`
- `TAVILY_API_KEY`
- `EXA_API_KEY`
- `QUERIT_API_KEY`
- `PERPLEXITY_API_KEY`
- `KILOCODE_API_KEY`
- `YOU_API_KEY`
- `SEARXNG_INSTANCE_URL`
- `SEARXNG_ALLOW_PRIVATE`

## Repository

GitHub: <https://github.com/robbyczgw-cla/web-search-plus-plugin>
