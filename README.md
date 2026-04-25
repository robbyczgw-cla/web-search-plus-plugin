# web-search-plus-plugin

Multi-provider web search plugin for OpenClaw.

Requires at least one configured provider API key or a `SEARXNG_INSTANCE_URL`.

## Install

```bash
openclaw plugins install clawhub:web-search-plus-plugin-v2
```

It registers a `web_search_plus` tool for search and a `web_extract_plus` companion tool for URL extraction.

## Why use this instead of OpenClaw's built-in `web_search`?

OpenClaw's built-in `web_search` uses Brave Search.

You might want this plugin when:
- Brave returns thin or no results for a query, but Serper/Google or You.com still finds relevant pages.
- You want research-oriented output; Tavily can return structured results that are easier to summarize.
- You want semantic discovery; Exa can find related content that plain keyword search may miss.

Supported providers:
- Serper (Google)
- Tavily
- Exa
- Querit
- Perplexity
- You.com
- SearXNG
- Linkup
- Firecrawl

## What you need

You do not need every provider.

You need at least one configured provider:
- an API key for any hosted provider, or
- a SearXNG instance URL

Supported "at least one" options:
- `SERPER_API_KEY`
- `TAVILY_API_KEY`
- `EXA_API_KEY`
- `QUERIT_API_KEY`
- `PERPLEXITY_API_KEY`
- `KILOCODE_API_KEY`
- `YOU_API_KEY`
- `SEARXNG_INSTANCE_URL`

## Quick setup

```bash
cp .env.template .env
# add at least one API key or SearXNG URL
```

Then load the plugin in OpenClaw and restart the gateway.

## Provider overview

| Provider | Best for | Free tier | Rate limit (free) |
| --- | --- | --- | --- |
| Serper | Google-style general web, news, shopping, local results | Yes | 2,500/mo |
| Tavily | Research-style results and summaries | Yes | 1,000/mo |
| Exa | Semantic / neural discovery | Yes | 1,000/mo |
| Querit | Multilingual and regional search | Yes | Varies |
| Perplexity | Answer-style web results with citations | Limited / depends on plan | API credits required |
| You.com | General web + answer-oriented results | Limited | 60 req/hr |
| SearXNG | Self-hosted metasearch | Yes, self-hosted | Self-hosted, unlimited |

## web_extract_plus

Extract content from specific URLs using provider-specific extraction backends.

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `urls` | string[] | **required** | URLs to extract |
| `provider` | string | `"auto"` | Force: `firecrawl`, `linkup`, `tavily`, `exa`, `you` |
| `format` | string | `"markdown"` | `markdown` or `html` |
| `include_images` | boolean | `false` | Include image metadata when supported |
| `include_raw_html` | boolean | `false` | Include raw HTML when supported |
| `render_js` | boolean | `false` | Render JavaScript before extraction when supported |

Auto extraction currently tries Firecrawl, then Linkup, Tavily, Exa, and You.com when keys are available.

Examples:

```python
web_extract_plus(urls=["https://example.com"], provider="firecrawl")
# → Extract clean markdown from a URL

web_extract_plus(urls=["https://docs.linkup.so"], provider="linkup", render_js=False)
# → Linkup fetch endpoint

web_extract_plus(urls=["https://example.com", "https://example.org"], provider="auto", include_images=True)
# → Automatic fallback across extraction-capable providers
```

## Auto-routing logic

The plugin scores each query against the providers you have configured and picks the best match for that query type. If the first choice is unavailable or fails, it falls back to another configured provider instead of failing immediately.


## Notes

- Auto-routing chooses among configured providers only.
- If a provider is missing credentials, it is skipped.
- SearXNG includes SSRF protection by default.
- `SEARXNG_ALLOW_PRIVATE=true` disables that protection and should only be used on trusted private networks.

## Environment variables

- `SERPER_API_KEY`
- `TAVILY_API_KEY`
- `EXA_API_KEY`
- `QUERIT_API_KEY`
- `PERPLEXITY_API_KEY`
- `KILOCODE_API_KEY` — alternative Perplexity-compatible search gateway via `https://api.kilo.ai/api/gateway/chat/completions`
- `YOU_API_KEY`
- `SEARXNG_INSTANCE_URL`
- `SEARXNG_ALLOW_PRIVATE`
- `LINKUP_API_KEY`
- `FIRECRAWL_API_KEY`

## Cache behavior

The plugin writes cache files only inside its own `.cache/` directory:
- hashed search result payloads, including returned results plus cache metadata such as timestamp, query, provider, and search params
- `provider_health.json`, which stores provider failure/cooldown state and sanitized last-error text for fallback routing

No API keys are written to the cache by the plugin logic.

## Repository

GitHub: <https://github.com/robbyczgw-cla/web-search-plus-plugin>

## Acknowledgments

Thanks to [@Wysie](https://github.com/Wysie) for contributing the original Linkup, Firecrawl, and `web_extract_plus` design in the sister project [hermes-web-search-plus](https://github.com/robbyczgw-cla/hermes-web-search-plus), which was backported into this OpenClaw plugin.
