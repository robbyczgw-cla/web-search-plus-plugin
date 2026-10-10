---
name: web-search-plus-plugin-v2
version: 4.4.0
description: OpenClaw plugin for source-only Routing v2 multi-provider search, completion-order Research with quality quorum and attributed provenance, heading-aware extraction spans, Tavily-first extraction, explicit-only Octen/TinyFish, optional separately installed DonSeTch through the OpenClaw host runner, process-local health, routing preferences, and extraction benchmarks. Registers five optional web tools.
---

# Web Search Plus Plugin

Use this OpenClaw plugin for current web search, multi-provider research, URL extraction, routing configuration, provider health, and bounded extraction benchmarks. `web_answer_plus` is not part of the source-only surface; use Search plus Extract.

## Enable the optional tools

The plugin registers all five tools with `optional: true`:

- `web_search_plus`
- `web_extract_plus`
- `web_routing_config_plus`
- `web_search_health_plus`
- `web_extract_benchmark_plus`

They must be permitted by OpenClaw's tool policy. Add the exact tools the agent needs without replacing its existing profile:

```json
{
  "tools": {
    "alsoAllow": [
      "web_search_plus",
      "web_extract_plus",
      "web_routing_config_plus",
      "web_search_health_plus",
      "web_extract_benchmark_plus"
    ]
  }
}
```

For least privilege, remove any names the agent does not need. `tools.alsoAllow` is additive. `tools.allow` is the restrictive alternative and must also retain every non-plugin tool the agent needs. A configured `plugins.allow` is separate and must include `web-search-plus-plugin-v2` so the plugin can load.

## Good starter setup

Start with one or more of Brave, Serper, and Exa. Tavily is first in the default extraction order:

Tavily → Exa → Linkup → Parallel → Firecrawl → You.com → Keenable → Serper → DonSeTch.

DonSeTch appears last in the stable extraction priority but is skipped by automatic routing until an operator explicitly enables its `auto_allow` gate. Extraction targets reject private/internal destinations by default. Inline content uses deterministic URL/context limits, and full-text continuation references live only in the process-local LRU until eviction or host restart.

Use `spans=true` for deterministic, query-conditioned passages. A query-matching ATX Markdown heading retains its body and deeper subheadings through the next same-or-shallower heading. At most two heading sections are added, each capped at 1,200 Unicode codepoints. Offsets are NFC Unicode-codepoint half-open ranges; `within_preview` reports whether a span is present in the inline preview.

## Provider configuration

Hosted Search credentials/settings:

- `serperApiKey`, `braveApiKey`, `tavilyApiKey`, `exaApiKey`
- `queritApiKey`, `linkupApiKey`, `firecrawlApiKey`
- `parallelApiKey`, `serpbaseApiKey`, `youApiKey`
- `searxngInstanceUrl`, `keenableApiKey`
- `monidApiKey` for Octen via Monid
- `tinyfishApiKey`

Local provider:

- `donsetchBin` — absolute path to a separately installed DonSeTch executable

Important controls:

- `parallelMode`: `turbo`, `fast` (default), `basic`, or `advanced`; Parallel uses its stable v1 Search endpoint and is auto-allowed when configured
- `octenTimeoutSeconds`, `tinyfishTimeoutSeconds`
- `donsetchTimeoutSeconds`, `donsetchMaxContentChars`, `donsetchTier`
- `keenableAllowPublic`, `searxngAllowPrivate`, `extractAllowPrivateUrls`
- `extractCharLimit`, `extractMaxUrls`, `extractMaxContextChars`, `extractDeadlineSeconds`
- `extractCacheMaxEntries`, `extractCacheMaxChars`
- `localeCountry`, `localeLanguage`
- `parallelMaxCharsPerResult`, `parallelMaxCharsTotal`
- `qualityBlockedDomains`, `qualityAllowedDomains`, `qualityDiversityRerank`

OpenClaw plugin config is the only credential source; this package does not discover `.env` files.

## Provider boundaries

- Exa exposes source-only neural `/search`. Unified `day|week|month|year` freshness becomes absolute UTC publication-date bounds. Deep, deep-reasoning, answer, and synthesis output are not exposed.
- Parallel uses stable v1 Search with `fast` as the default mode and participates in normal automatic routing when configured.
- Octen via Monid and TinyFish are Search-only and explicit-only by default. Both support freshness and domain filters; TinyFish also supports native news and locale.
- TinyFish's standard [Terms](https://www.tinyfish.ai/terms) permit Customer Data, including queries, to be used for model training and fine-tuning. Explicit-only is not a privacy guarantee. Review its [Privacy Policy](https://www.tinyfish.ai/privacy-policy) and the terms applicable to your account before sending sensitive data.

## DonSeTch

Install the independent AGPL-3.0-only DonSeTch 4.7.0 package separately:

```bash
npm install -g donsetch@4.7.0
command -v donsetch
donsetch --version
donsetch doctor
```

Set `donsetchBin` to the absolute executable path. Web Search Plus passes the bounded `[donsetchBin, "mcp"]` invocation to OpenClaw's trusted `api.runtime.system.runCommandWithTimeout` host runner; the plugin does not bundle DonSeTch or own a shell/process implementation. One stdio MCP session serves one Web Search Plus request, including every URL in a multi-URL extraction. Credentials unrelated to DonSeTch are removed from the child environment, outputs and diagnostics are bounded/sanitized, and browser success remains dependent on the host's Chrome/Chromium/display setup.

Use `provider="donsetch"` explicitly first. Only after verifying the target host should an operator call `web_routing_config_plus(action="set_auto_allow", provider="donsetch", enabled=true)`.

## Routing v2

Automatic routing picks the first provider by query intent (Hermes Web Search Plus 5.0 table): Exa for docs and academic queries, Serper for security and shopping, Brave for everything else (general, news, local, community). Fallback: Brave → Serper → Exa → Tavily → `provider_priority`. `provider_priority` orders the rest of the fallback chain; to use your own order for every query set `provider_order` to `custom` (`web_routing_config_plus(action="set_provider_order", order="custom")`, reason `custom_order`).

Default search priority: Brave → Serper → Exa → Tavily → You.com → Firecrawl → Linkup → Parallel → SerpBase → Querit → SearXNG → Keenable.

SerpBase, Querit, DonSeTch, Octen, and TinyFish are guarded by `auto_allow=false`; Brave and Parallel are in the normal automatic pool. Search and extraction priorities are independent. The `self_hosted` profile derives SearXNG/Keenable automatic pools while preserving explicit configured-provider calls.

Use `quality_report=true` for routing, authority, diversity, fallback, and result-quality diagnostics. Provider health and shadow-quality state are process-local and disappear on restart.

## Research mode

`web_search_plus(mode="research")` launches up to three providers concurrently and harvests completions as they arrive. Public results, attempts, and errors remain in deterministic submission order.

The default quality quorum can stop waiting once at least two providers contribute `min(count, 5)` unique candidates across `min(result_target, 3)` domains. Pending providers remain visible as `preempted_after_quorum`; `metadata.research_quorum` reports the decision. Explicit `research_providers` are explicit choices rather than automatic-routing candidates, while disabled/unconfigured providers remain ineligible.

Canonical-URL clusters preserve deterministic observation ids and attributed snippet fragments instead of discarding duplicate-provider evidence. Each Research result adds provider-neutral `source_type` and explainable `fetch_priority` hints; these are routing/fetch cues, not truth claims. `research_time_budget` still gates launch, completion waits, and extraction.

## Usage guidance

Prefer `web_search_plus` for current information and finding sources. Use `mode="research"` when a question benefits from cross-provider evidence and extracted source summaries. Use `web_extract_plus` when URLs are already known. Use the routing/health/benchmark tools only when the host has explicitly allowed them and their diagnostics are needed.
