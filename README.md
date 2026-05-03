# web-search-plus-plugin-v2

Native OpenClaw plugin for multi-provider web search and URL extraction.

Current version: **2.3.1**

It registers two OpenClaw tools:

- `web_search_plus` — intelligent multi-provider web search
- `web_extract_plus` — URL content extraction via extraction-capable providers

The plugin needs at least one configured provider credential, or a `SEARXNG_INSTANCE_URL`.

## Install

```bash
openclaw plugins install clawhub:web-search-plus-plugin-v2
```

ClawHub:

- Plugin page: <https://clawhub.ai/plugins/web-search-plus-plugin-v2>
- Source: <https://github.com/robbyczgw-cla/web-search-plus-plugin>

## Why use this instead of OpenClaw's built-in `web_search`?

OpenClaw's built-in `web_search` uses Brave Search.

Use this plugin when you want:

- automatic routing across multiple search providers instead of one fixed backend
- Serper/Google-style coverage for shopping, local, product, and broad web queries
- Brave Search as a first-class fallback/general web provider
- Tavily for research-oriented queries
- Linkup for citation/source-grounded queries
- Exa for neural/semantic discovery
- Querit for multilingual AI search
- Firecrawl for search plus extraction metadata
- Perplexity or Kilo gateway for answer-style web results
- You.com for RAG-ish/current web results
- SearXNG for self-hosted privacy-first search
- `web_extract_plus` for fetching clean URL content after search

## Supported providers

Search providers:

- Serper — Google-style general web, news, shopping, local results. Env: `SERPER_API_KEY`
- Brave — general/current web, shopping-ish and broad fallback queries. Env: `BRAVE_API_KEY`
- Tavily — research-style results and summaries. Env: `TAVILY_API_KEY`
- Linkup — source-grounded/citation-focused search. Env: `LINKUP_API_KEY`
- Querit — multilingual and regional AI search. Env: `QUERIT_API_KEY`
- Exa — semantic, neural, similar-page, and discovery search. Env: `EXA_API_KEY`
- Firecrawl — web discovery with scrape-ready metadata. Env: `FIRECRAWL_API_KEY`
- Perplexity — answer-style web results. Env: `PERPLEXITY_API_KEY`
- Kilo gateway — Perplexity-compatible answer-style route. Env: `KILOCODE_API_KEY`
- You.com — general web and answer-oriented results. Env: `YOU_API_KEY`
- SearXNG — self-hosted metasearch. Env: `SEARXNG_INSTANCE_URL`

Extraction-capable providers for `web_extract_plus`:

- Firecrawl
- Linkup
- Tavily
- Exa
- You.com

## What you need

You do **not** need every provider.

Configure at least one of these:

- `SERPER_API_KEY`
- `BRAVE_API_KEY`
- `TAVILY_API_KEY`
- `LINKUP_API_KEY`
- `QUERIT_API_KEY`
- `EXA_API_KEY`
- `FIRECRAWL_API_KEY`
- `PERPLEXITY_API_KEY`
- `KILOCODE_API_KEY`
- `YOU_API_KEY`
- `SEARXNG_INSTANCE_URL`

Optional Brave settings:

- `BRAVE_COUNTRY` — country code, for example `US` or `DE`
- `BRAVE_SEARCH_LANG` — search language, for example `en` or `de`
- `BRAVE_SAFESEARCH` — `strict`, `moderate`, or `off`

Optional SearXNG setting:

- `SEARXNG_ALLOW_PRIVATE=true` — disables SSRF/private-network protection. Use only with fully trusted private SearXNG/network setups.

## Quick setup

```bash
cp .env.template .env
# add at least one provider key or SEARXNG_INSTANCE_URL
```

Then install or update the plugin and restart OpenClaw if your setup does not hot-reload plugins.

## Auto-routing logic

`web_search_plus` scores each query against the providers you have configured and picks the best match for the query type.

Examples:

- product, shopping, local, broad current web → Serper or Brave
- generic current web where Brave and Serper tie → deterministic Brave/Serper tie-breaker
- research/explanation queries → Tavily
- citation/source-grounded queries → Linkup
- semantic discovery / “similar to” queries → Exa
- multilingual/regional AI search → Querit
- answer-style queries → Perplexity direct API or Kilo gateway
- privacy/self-hosted mode → SearXNG

If the first provider fails, is rate-limited, or lacks credentials, the plugin falls back to the next configured provider instead of failing immediately.

## `web_search_plus`

Typical use:

```python
web_search_plus(query="latest OpenClaw release", provider="auto")
```

Useful parameters include:

- `query` — search query
- `provider` — `auto`, `serper`, `brave`, `tavily`, `linkup`, `querit`, `exa`, `firecrawl`, `perplexity`, `you`, or `searxng`
- provider-specific filters such as country/language/recency where supported

The response includes normalized results and routing metadata so you can see which provider was chosen and whether fallback was used.

## `web_extract_plus`

Extract clean content from specific URLs using extraction-capable providers.

Parameters:

- `urls` — required array of `http://` or `https://` URLs
- `provider` — `auto`, `firecrawl`, `linkup`, `tavily`, `exa`, or `you`
- `format` — `markdown` or `html`; default `markdown`
- `include_images` — include image metadata when supported
- `include_raw_html` — include raw HTML when supported
- `render_js` — render JavaScript before extraction when supported

Auto extraction tries available extraction providers in this order:

- Firecrawl
- Linkup
- Tavily
- Exa
- You.com

Examples:

```python
web_extract_plus(urls=["https://example.com"], provider="firecrawl")
# Extract clean markdown from one URL

web_extract_plus(urls=["https://docs.linkup.so"], provider="linkup", render_js=False)
# Use Linkup fetch

web_extract_plus(urls=["https://example.com", "https://example.org"], provider="auto", include_images=True)
# Fallback across extraction-capable providers
```

## Cache and provider health

The plugin writes runtime state only inside its own `.cache/` directory:

- hashed search result payloads, including timestamp, query, provider, search params, and returned results
- `provider_health.json`, with provider failure/cooldown state and sanitized last-error text for fallback routing

No API keys are written to cache by the plugin logic.

## Security notes

- Missing provider credentials are skipped.
- SearXNG URLs are protected against SSRF/private-network access by default.
- `SEARXNG_ALLOW_PRIVATE=true` disables that protection and should only be used for trusted private deployments.
- Search queries and extracted URLs are sent to whichever configured provider the router selects.
- ClawHub currently reports the artifact as **Legacy ZIP**. That is expected for this release line; a future ClawPack migration is planned.

## Packaging notes

The npm package intentionally ships runtime files only:

- `index.ts`
- `extract.ts`
- `paths.ts`
- `storage.ts`
- `env.ts`
- `openclaw.plugin.json`
- `package.json`
- `README.md`
- `LICENSE`

Tests and local cache/env files are not included in the package artifact.

## Verification

Current release verification:

```bash
npm test -- --test-reporter=spec
# 26/26 passing

npm pack --dry-run
# runtime files only
```

## Acknowledgments

Thanks to [@Wysie](https://github.com/Wysie) for contributing the original Linkup, Firecrawl, and `web_extract_plus` design in the sister project [hermes-web-search-plus](https://github.com/robbyczgw-cla/hermes-web-search-plus), which was backported into this OpenClaw plugin.
