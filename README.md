# web-search-plus-plugin

Multi-provider web search plugin for OpenClaw.

## Install

```bash
openclaw plugins install clawhub:web-search-plus-plugin
```

It registers a `web_search_plus` tool that can query multiple providers and auto-route to the one that best fits the query.

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

## Auto-routing logic

The plugin scores each query against the providers you have configured and picks the best match for that query type. If the first choice is unavailable or fails, it falls back to another configured provider instead of failing immediately.

### Hybrid LLM routing

Regex routing always runs first.

If auto-routing confidence is at least `0.7`, the regex result is used directly.
If confidence is lower and `llmRouting` is enabled, the plugin asks a lightweight LLM classifier for a second opinion.
If that LLM call times out, fails, or returns an invalid provider, the plugin falls back to the regex result.

The routing payload now includes:
- `routing_mode`: `"regex"` or `"llm"`
- `from_cache`: whether the LLM routing decision came from the in-memory LRU cache
- `llm_model`: the classifier model used when LLM routing runs

LLM routing uses:
- 3 second timeout
- in-memory LRU cache, max 500 entries
- 1 hour TTL per cached decision
- opt-in config, off by default

### LLM routing configuration

Plugin config options:
- `llmRouting` - enable the hybrid regex + LLM flow
- `llmRoutingProvider` - `kilo` or `local`, default `kilo`
- `llmRoutingModel` - model name, default `google/gemini-2.0-flash`
- `llmRoutingBaseUrl` - base URL for the routing backend, default `http://localhost:11434/v1` for local mode
- `llmRoutingApiKey` - optional auth token for the routing backend, can be empty for local mode

Backend modes:
- `kilo`: uses the Kilo gateway. By default it reuses the existing `kilocodeApiKey` / `KILOCODE_API_KEY`.
- `local`: uses any OpenAI-compatible local endpoint, such as Ollama or LM Studio.

Example local setup:

```json
{
  "llmRouting": true,
  "llmRoutingProvider": "local",
  "llmRoutingModel": "llama3.1",
  "llmRoutingBaseUrl": "http://localhost:11434/v1",
  "llmRoutingApiKey": ""
}
```

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

## Cache behavior

The plugin writes cache files only inside its own `.cache/` directory:
- hashed search result payloads, including returned results plus cache metadata such as timestamp, query, provider, and search params
- `provider_health.json`, which stores provider failure/cooldown state and sanitized last-error text for fallback routing

No API keys are written to the cache by the plugin logic.

## Repository

GitHub: <https://github.com/robbyczgw-cla/web-search-plus-plugin>
