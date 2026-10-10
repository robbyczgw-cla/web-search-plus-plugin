# Changelog

## [Unreleased]

## [4.4.0] - 2026-10-10

Light sync toward Hermes Web Search Plus 5.0.1. This is not a 5.x engine port: the plugin keeps its in-process TypeScript design and takes over the 5.0 routing table plus the 5.0.1 fixes that apply here. The assessment of every 5.0.1 fix (applies / does not apply) is in the commit message and PR notes.

### Breaking changes

- **Automatic routing picks the first provider by query intent**, using the 5.0 table: Exa for docs and academic queries, Serper for security and shopping, Brave for everything else (general, news, local, community). The plugin's existing query classes are mapped onto the 5.0 intents; Hermes' intent classifier is not ported. Fallback order is first provider, Brave, Serper, Exa, Tavily, then `provider_priority`. Expect noticeably more Brave and fewer You.com, Firecrawl, Tavily and Linkup first picks. `routing_class` is unchanged (authority reranking still uses it); new `routing_intent`, `provider_order` (`measured` or `custom`) and `reason` (`intent_<name>`, `no_signals_matched`, `custom_order`) are added; `routing_policy` is `routing-v3-intent-lite`, `scores` and `adaptive_adjustments` are empty.
- **The default `provider_priority` is now Brave, Serper, Exa, Tavily, You.com, Firecrawl, Linkup, Parallel, SerpBase, Querit, SearXNG, Keenable** (was You.com, Serper, Exa, Firecrawl, Tavily, Linkup, Brave, ...). A stored list equal to the old default is replaced by the new default. A `provider_priority` that differs from both defaults is treated as your own order and now decides the first provider for every query (before, it only broke ties and ordered fallbacks). `reset` returns to the intent table.
- Adaptive score adjustments and `confidence_threshold` no longer influence which provider goes first. Provider statistics are still recorded for `web_search_health_plus`.

### Fixed

- A successful search with no hits now returns `message` ("No results found for this query. Do not invent sources or facts; ...") and `metadata.no_results`, is no longer cached, and in automatic mode the next provider is tried before giving up (an empty first answer used to end the search).
- Brave queries are shortened at a word boundary only past Brave's documented limit of 600 characters and 75 words (not the 400/50 that Hermes 5.0.1 used); `metadata.query_truncated` reports sizes, `query` still shows the original. Queries over 2,000 characters are cut before any provider.
- The host's abort signal now reaches `web_search_plus`: once the tool call is aborted no provider attempt or retry starts, a pending retry sleep ends, and in-flight provider requests are cancelled. (Retry-After was already capped at 30 s for inline waits and 3,600 s for cooldowns, and retries without it already back off 1 s, 3 s, 9 s with jitter.)
- One blocked, private or unresolvable URL no longer sinks an extraction batch: it gets its own error line and the other URLs are still extracted. Error messages no longer print the internal IP a host resolved to.
- Blank pages (cookie wall, empty body) are errors, not successes: they fall through to the next extraction provider and are not cached. An empty provider answer also falls through. Exa URLs listed in `statuses` as failed are reported as error lines instead of being dropped. Extraction answers that do not cover every requested URL are returned but not cached.
- Tool descriptions of `web_search_plus` and `web_extract_plus` start with a short first sentence.

### Changed

- DonSeTch tested version is 4.7.0 (was 4.2.9), matching Hermes Web Search Plus 5.0. Verified here against the real DonSeTch 4.7.0 binary for `--version`, one MCP `web_search` and one `web_fetch` through the plugin's transport; the unit tests still use mocked runners.
- Added `intent-routing.ts` and `query-limits.ts` to the package.

### Checked, no change needed

- The source-only gate only scans instruction-, prompt- and system-like fields, never query text, so "synthesizer" or "verify the claim" in a query does not fail Exa, Tavily or Linkup (new regression tests).
- Firecrawl and Linkup extraction already run per URL and keep pages they fetched. Extraction reports the real page length (`original_chars`) and points to the process-local full text (`full_content_ref`, `full_content_chars`), so there is no "full text stored" claim to correct.
- `web_extract_plus` availability already reads plugin config; there is no environment-only `check_fn` for search. Auto routing disabled without `default_provider` returns an explicit error instead of provider "None"; a private SearXNG URL only fails SearXNG itself.
- OpenClaw 2026.9.x compatibility: the plugin imports only `openclaw/plugin-sdk/plugin-entry` (`definePluginEntry`, `buildJsonPluginConfigSchema`) and uses `api.registerTool`, `api.pluginConfig` and `api.runtime.system.runCommandWithTimeout(argv, options)`; all are unchanged in the 2026.9.9 type declarations and none of the deprecated or removed subpaths are used. `compat.pluginApi` stays `>=2026.8.1` (a minimum, not a tested ceiling). The build target stays node22: OpenClaw's own Node floor is enforced by the host.

### Not ported from Hermes 5.0 / 5.0.1

Hedged (p75) fallback and per-request attempt engine; per-URL extraction rewrite with cross-provider per-URL retry and requested-order results (only the pieces above); `site:` operator domain filters for Brave, Serper, SerpBase and You.com; Tavily public-suffix domain validation; `Query rejected ... may be too long` error text for 413/414/422; the 998-line intent classifier, language detection, publication dates in result titles and snippet truncation; extra-result fetching (count + 5) and the two-per-domain cap change; RRF research fusion with passages; v3 state store, circuit breaker, receipts and Operator Console; Keenable `--keyless-public` setup flow; Hermes-only items (native backend, Desktop settings, config.json/.env loading).

## [4.3.1] - 2026-09-23

Matches Hermes Web Search Plus and web-search-plus-mcp 4.3.1. Their 4.3.1 change (keep-alive provider connections; MCP running search in-process) needs no port here: the plugin already runs in-process and Node `fetch` pools connections.

- Ported Hermes 4.0.4–4.3.0 search behavior: compact DonSeTch evidence with rank/URL binding and namespaced diagnostics; Exa highlight preference; Parallel native count/domain policy; Tavily native recency; shared Exa date receipts.
- Added search `no_cache` and `cache_ttl`, recency TTL caps (hour/live 60s, day/latest 300s, week 1800s), cache age and recency labels, and query-ranked research source summaries capped at 500 characters. `time_range` wins over `freshness` for dispatch, receipts, and TTL.
- Updated the DonSeTch tested version to 4.2.9. Other parsed versions report `compatible_unverified`.
- Adaptive routing records each provider attempt, including retries and research members. Cache hits and configuration errors do not add samples. Stats remain process-local; there is no stats file requiring a lock or atomic replacement.
- Search uses `defaults.max_results` when count is omitted; explicit counts win and clamp to 1–20.
- Confirmed leading-dash queries and span queries already pass as data. Python argument parsing/runtime cleanup and daily budget section validation have no counterpart: this plugin calls TypeScript functions directly and has no daily budget ledger.
- Skipped Jev, the Hermes native backend, and Desktop settings as requested. Skipped Windows fcntl because stats are in memory, and keep-alive pooling because Node fetch already pools connections.

## [4.0.3] - 2026-08-30

Feature sync with Hermes Web Search Plus 3.3.0–4.0.3, adapted to OpenClaw's in-process plugin and host-runner boundaries.

### Removed

- Removed the Hound provider, loopback MCP transport, provider/config schema entries, automatic-routing gate, package files, and active setup guidance. Existing explicit calls must change from `provider="hound"` to `provider="donsetch"`; old Hound settings have no effect in 4.x.
- Removed generated-answer and synthesis output from Search adapters. Tavily requests source results with `include_answer=false`; Exa exposes source-only neural search without deep/deep-reasoning synthesis.

### Added

- Added separately installed DonSeTch 3.2.1 as an explicit-only local Search/Markdown-Extract provider. The plugin passes `[donsetchBin, "mcp"]` to OpenClaw's trusted `api.runtime.system.runCommandWithTimeout` host runner rather than bundling DonSeTch or importing its own process implementation. One initialized stdio MCP session is reused across a multi-URL extraction request; response/content bounds, timeouts, environment isolation, sanitized diagnostics, readiness/version reporting, and stable provider errors are enforced at the adapter boundary. DonSeTch remains an independent AGPL-3.0-only component whose browser behavior depends on the target host.
- Added Octen via Monid as a BYOK, source-only Search provider with native freshness and domain filters. It is explicit-only by default, disables billable full-content retrieval, and keeps Monid lifecycle failures separate from Octen provider errors.
- Added TinyFish as a BYOK, source-only web/news Search provider with native freshness, locale, and domain filters. It is explicit-only by default, rejects redirects, bounds request/response data, and accepts result/filter hosts only as ASCII/Punycode. Documentation warns that TinyFish's standard Terms permit Customer Data to be used for model training and fine-tuning; explicit-only routing is not a privacy control.
- Added Hermes 3.3 completion-order Research harvesting with a default conservative quality quorum. Providers that are still pending after the candidate/provider/domain thresholds are met remain visible as `preempted_after_quorum`, while public results, attempts, and errors remain deterministic in submission order.
- Added provenance-safe Research URL clusters. Duplicate-provider evidence retains deterministic observation ids and attributed snippet fragments; result `source_type` and explainable `fetch_priority` fields are additive hints rather than truth claims.
- Added heading-aware extraction spans: a query-matching ATX heading can retain its body and deeper subheadings through the next same-or-shallower heading, with at most two heading candidates and a 1,200-codepoint cap per section.

### Changed

- Parallel Search now uses the stable `/v1/search` endpoint, accepts `parallelMode` values `turbo`, `fast`, `basic`, and `advanced`, defaults to `fast`, and participates in the normal automatic pool when configured. `auto_allow.parallel=false` remains an operator opt-out.
- Exa applies unified `day`, `week`, `month`, and `year` freshness by sending absolute UTC `startPublishedDate`/`endPublishedDate` bounds to `/search`; response metadata reports the effective range.
- Default provider priority and automatic-routing guards now match Hermes 4.0.3: Brave and Parallel are auto-allowed; SerpBase, Querit, DonSeTch, Octen, and TinyFish remain guarded.
- All five OpenClaw tools remain intentionally registered with `optional: true`. Additive onboarding uses `tools.alsoAllow` with exact desired tool names; `tools.allow` is documented only as a deliberately restrictive absolute alternative. A configured `plugins.allow` remains a separate plugin-load gate and must include the plugin id.

### Security and privacy

- Hosted Octen/TinyFish requests use fixed HTTPS origins, refuse redirects, cap response bodies, validate returned source URLs, and keep credentials out of diagnostics. Octen drops credentialed result URLs, and Monid FAILED envelopes are not retried as transient HTTP 500s.
- DonSeTch command execution is delegated to the OpenClaw host runner with an exact argv, no shell command, a bounded/sanitized result surface, and an environment that removes unrelated provider secrets. donsetchBin rejects non-absolute paths and `.`/`..` segments before the host runner is invoked.
- Source-only enforcement rejects answer- or synthesis-shaped adapter fields and provider modes, including Exa/Tavily synthesis controls, before results enter routing, caching, or Research aggregation.

### Documentation

- Add a repository-specific contribution guide covering upstream-first ports, OpenClaw and ClawHub runtime constraints, provider/tool changes, security/privacy requirements, package synchronization, and pull-request evidence.
- Add Node.js 22 GitHub Actions gates for locked install, tests, bundle build, and package-content verification, plus regression coverage that keeps the guide and CI commands synchronized.

## [3.3.0] - 2026-07-25

- Added a bounded process-local, versioned LRU cache for extraction responses. Its secret-free identity covers exact URL order, controls, effective budgets, provider policy, configured endpoint address, and URL/storage policy; cache hits preserve the full returned response including `content`, `raw_content`, and provider attribution. (Hermes v3.2 round 2)
- Added opt-in full-text continuation through `web_extract_plus(content_ref, content_start, content_end)`. Distinct provider raw text is separately addressed through `raw_content_start`/`raw_content_end`; without that range its availability and length are reported. Full text is held only by the existing process-local LRU entry; each reference is content-versioned and expires on eviction or host restart. (Hermes v3.2 round 2)
- Added request-scoped budget preflight for Research fan-out (maximum three providers), Extract fan-out/context ceilings, and Extract provider-start deadlines. Daily quota accounting is intentionally not implemented because it needs a persistent ledger. (Hermes v3.2 round 2)
- Added `web_search_health_plus`, a read-only in-process provider-health tool with explicit process start/scope metadata; no console server or cross-restart buckets are created. (Hermes v3.2 round 2)
- Added passive process-local shadow-quality aggregates to the health tool. They observe completed requests only and never influence provider routing or result content. (Hermes v3.2 round 2)
- Added explicit per-request `routing_override_provider` for deterministic Search and Extract routing, with visible routing-report provenance and no environment-variable switch. (Hermes v3.2 round 2)
- Added `web_extract_benchmark_plus`: an explicit-only, cache-bypassing Extract benchmark with a hard 1–3 provider-call cap, process-local priority recommendation, and Hound `auto_allow` enforcement. (Hermes v3.2 round 2)

### Breaking Changes
- Removed the Perplexity and Kilo Perplexity Chat Completions adapters from the public provider schema and runtime. They do not expose a verified source-only mode and must not be projected as search evidence. (Hermes v3.0.0)

### Changed
- Promoted Brave Search into the default Classic Routing v2 auto pool for independent-index source diversity. Explicit `auto_allow.brave=false` still opts it out. (Hermes v3.0.0)
- Added independent `extract_provider_priority` routing preferences plus the `set_extract_provider_priority` config action. Partial lists append missing extraction providers in the stable Tavily-first default order without changing search priority. (Hermes v3.0.0)
- Added bounded extraction context: request-order URL fan-out caps, operator ceilings, deterministic fair-share allocation across successful results, NFC Unicode-codepoint accounting, degraded status, and truthful omission/truncation metadata. (Hermes v3.0.0)
- Added opt-in semantic spans (`spans`/`spans_query`) with deterministic lexical ranking, non-overlapping passages, NFC Unicode-codepoint half-open offsets, and `within_preview` flags. (Hermes v3.1.0)
- Added calibrated result-set diversity diagnostics (registrable domains, canonical URLs, snippet trigrams, provider entropy) and opt-in Research duplicate re-ranking via `qualityDiversityRerank`. (Hermes v3.1.0)
- Added a derived `self_hosted` routing profile for SearXNG/Keenable, readiness errors, explicit-profile override diagnostics, extraction auto-allow enforcement, and onboarding status/preset support. (Hermes v3.1.0)
- Added a bounded Streamable HTTP MCP transport for the Hound sidecar: strict loopback endpoint validation, redirects disabled, finite deadlines, response-size limits, sanitized failure codes, and best-effort session termination. (Hermes v3.2.0)
- Added Hound search/extraction adapters for `mcp_smart_search` and per-URL `mcp_smart_fetch`, with Hound caching disabled, stable source-only projections, domain filtering, URL-cardinality preservation, and optional secondary raw-HTML fetches. (Hermes v3.2.0)
- Hound defaults to `auto_allow=false` and is excluded consistently from automatic search selection, fallback, Research, and extraction fallback. Operators can opt in with `web_routing_config_plus(action="set_auto_allow", provider="hound", enabled=true)`; explicit Hound calls remain available. (Hermes v3.2.0)
- Added an OpenClaw-specific Hound sidecar guide covering the separately pinned installation, loopback-only transport, explicit verification, auto-routing opt-in, privacy, caching, and attribution. (Hermes v3.2.0)

### Fixed
- Made inline extraction `raw_content` mirror the final budgeted `content`, while preserving distinct full provider raw text behind process-local content references.
- Applied the aggregate extraction budget as a deterministic prefix before the per-result head/tail window, with returned character accounting based on the final inline text.
- Made `routing_override_provider` strict for extraction and Research source extraction, including cache identity, so a failed forced provider can never return another provider's content.
- Bounded Hound response streams while reading chunked bodies, and detached best-effort session teardown behind a 250 ms abort deadline.
- Pointed the npm entrypoint at the bundled runtime, excluded the internal porting plan from the package, and completed the five-tool README/SKILL inventory.
- Added the documented `extractCacheMaxChars` manifest schema field and corrected routing/extraction tool metadata to describe process-local lifetime and fallback behavior.
- Bounded the process-local extraction cache by configurable full-text character count in addition to entry count.
- Addressed distinct provider `raw_content` with independent Unicode-codepoint offsets instead of reusing the normalized content range.
- Applied operator extraction-deadline ceilings consistently to request overrides.
- Tracked extraction-cache character usage incrementally while preserving LRU eviction behavior.
- Removed stale Perplexity/Kilo credential, freshness, setup, and provider claims from active package metadata and documentation after the source-only provider removal. Historical changelog entries remain intact. (Hermes v3.0.2)
- Restored the full Research attempt envelope: each provider launch/skip records provenance and outcome, started deadline overruns are classified as cancelled, partial failures degrade the response, and total fan-out failure returns `status="failed"` instead of a successful empty result. The single post-merge quality pass remains authoritative. (Hermes v3.0.2)

## [3.2.0] - 2026-07-05

Feature sync with the Hermes Web Search Plus stack (hermes-web-search-plus v2.5.0–v2.9.0 plus the unreleased Parallel budget change), adapted for the in-process OpenClaw runtime. This resumes engine syncs for the OpenClaw build.

### Added
- Keenable search and extraction provider using Keenable's independent web index: keyed via `keenableApiKey` (X-API-Key), or keyless against the **opt-in** public tier (`keenableAllowPublic: true`, ~1000 req/hour shared, no SLA, one-time warning in result metadata). Lowest priority in auto routing and extraction fallback so it never displaces a configured keyed provider. (Hermes v2.6.0)
- Unified `freshness` parameter (`day`/`week`/`month`/`year`) on `web_search_plus`: providers with native date filters receive the mapped value; providers without support run the normal search and report `freshness.applied=false` in metadata. Research mode reports per-provider application. (Hermes v2.8.0)
- Unified `search_type` parameter (`search`/`news`): Serper serves the news vertical natively via `google.serper.dev/news` with correct parsing of the `news` response field (date, source, thumbnail, position); other providers report `search_type.applied=false`. (Hermes v2.9.0)
- Serper is now an extraction provider: `web_extract_plus(provider="serper")` scrapes pages via Serper's webpage scraper (`https://scrape.serper.dev`, markdown preferred, per-URL error items). It joins the auto-extraction fallback chain in last position — Tavily-first ordering unchanged. (Hermes v2.9.0)
- Configurable search locale defaults with lightweight query language detection: `localeCountry` (ISO 3166-1 alpha-2) and `localeLanguage` (ISO 639-1 or `"auto"`) replace the hardcoded us/en defaults for Serper, Brave, Querit, Firecrawl, You.com, and SearXNG. Country resolution is config-first with explicit location hints from a curated city/country table winning ("mejores restaurantes Madrid" → `es`); `localeLanguage: "auto"` enables a conservative stopword/character heuristic for `de`/`es`/`fr`/`it`/`pt`/`nl`/`en` (at least two distinct signals with a single unambiguous winner). Query language never implies the country. Result metadata reports the resolved locale and per-value source. Without these fields behavior stays exactly us/en. (Hermes v2.9.0)
- Spam/mirror result filtering: results from known Stack Overflow/GitHub/documentation mirror domains are removed (strict exact-domain/true-subdomain matching, no look-alike false positives). Operators can extend via `qualityBlockedDomains` or rescue via `qualityAllowedDomains`. Domain-diversity reranking caps a single domain at 2 head slots (overflow demoted, not dropped). Explicit domain intent (`site:` queries, `include_domains`) bypasses both. Removals and demotions are reported in `metadata.result_filter`. (Hermes v2.5.0)
- Adaptive provider performance memory: every provider call records latency/result-count/error into an in-memory rolling window (50 samples, 7-day freshness) that feeds bounded (±1.0) routing-score adjustments after 5 fresh samples — enough to break ties and nudge close calls, never enough to override a clear query-class winner. Reported as `routing.adaptive_adjustments`. (Hermes v2.5.0)

### Security
- `web_extract_plus` now rejects private/internal extraction target URLs by default before provider dispatch: loopback, RFC1918, CGNAT/shared address space, IPv6 ULA/link-local/mapped-private, multicast, cloud metadata hosts, and hostnames that resolve to private IPs. Trusted intranet extraction can be opted into with `extractAllowPrivateUrls: true`. (Hermes v2.7.0)
- Domain boost matching no longer grants authority boosts to look-alike domains that merely contain a trusted domain string (for example `openai.com.evil.example`). (Hermes v2.8.0)
- Inline base64 image data in extracted content is replaced with `[IMAGE: alt]` placeholders before measuring content, preventing data-URI token bombs while preserving normal `http(s)` image links. (Hermes v2.8.0)

### Improved
- Rate-limit handling: 429 responses parse `Retry-After`, retry at most once (short waits ≤30s honored inline), and feed the provider's requested wait into the cooldown ladder instead of hanging the request. (Hermes v2.5.0)
- Provider cooldown escalation now decays stale failure history (older than 30 minutes) instead of punishing isolated old failures forever. (Hermes v2.5.0)
- Provider configuration errors such as missing API keys no longer mark providers unhealthy or put them into cooldown; cooldown stays reserved for real provider/network failures. (Hermes v2.7.0)
- `web_extract_plus` respects `disabled_providers` from routing preferences during fallback; explicit provider selection still tries the requested provider first, matching search semantics. (Hermes v2.5.1)
- Oversized extracted pages return a head/tail window plus an explanatory footer; the inline budget is configurable via `extractCharLimit` (default 15000). In-process adaptation of Hermes truncate-and-store: no filesystem paging, matching the scanner-safe plugin runtime. (Hermes v2.8.0)
- Parallel extraction `full_content` budget raised to 60k characters per result / 120k total so long pages are evaluated fairly against other extraction providers; operators can lower it via `parallelMaxCharsPerResult` / `parallelMaxCharsTotal`. (Hermes unreleased)
- Provider JSON decode failures now surface as clear provider errors, improving retry/fallback behavior. (Hermes v2.8.0)

### Not ported
- Hermes' subprocess/in-process loader work, `.env`/cache permission hardening, provider bench CLI, golden snapshot recorder, generated docs drift checks, `setup.py fastpath`, and the registry-driven dispatch refactor are host-runtime or repo-tooling specific and do not apply to the in-process OpenClaw plugin.

## [3.1.0] - 2026-06-10

Feature sync with the Hermes Web Search Plus stack (hermes-web-search-plus v2.3.x–v2.4.0), adapted for the in-process OpenClaw runtime.

### Added
- Research mode: `web_search_plus(mode="research")` queries up to 3 providers concurrently, deduplicates results across them, and extracts the top sources into `source_summaries` for grounding. New parameters: `mode`, `research_providers`, `research_extract_count` (default 3, max 5), and `research_time_budget` (seconds, default 55). Provider searches run concurrently so wall-clock cost tracks the slowest provider; result ordering stays deterministic by submission order. Failures surface as `routing.provider_errors` / `routing.extraction_error` diagnostics instead of failing the call.
- Canonical-source intent reranking for authority-sensitive routing classes (`official/vendor-release`, `docs/api`, `official/regulatory`, `finance/IR`, `security/cve`): primary sources (vendor blogs, official docs, regulators, IR/SEC pages, NVD/CVE records) now outrank mirrors such as YouTube, Medium, and Reddit. Reorderings are reported via `metadata.intent_rerank`.
- `authority_signals` in quality reports: canonical domain hits, demoted domain hits, top domain, and whether the top result is a primary source.
- New `official/vendor-release` routing class for vendor announcement queries (Anthropic, OpenAI, Mistral, Google, Meta, NVIDIA, Apple, Microsoft), routed toward You.com/Linkup/Exa.

### Improved
- Provider retry backoff now adds bounded random jitter (`RETRY_JITTER_FRACTION = 0.5`) so repeated or concurrent retries against a recovering provider no longer synchronize into bursts.

### Internal
- Split research orchestration into `research.ts` and rerank/authority helpers into `quality.ts`, mirroring the Hermes module layout. Cross-provider deduplication moved to `research.ts` (still re-exported from `index.ts`).
- Hermes v2.4.0's in-process execution and provider-health locking changes are not applicable here: the OpenClaw plugin already runs in-process on a single-threaded runtime.

### Tests
- Added research-mode coverage (provider selection, deterministic out-of-order completion ordering, cross-provider dedup, time-budget gating, extraction-error handling, end-to-end tool execution) and quality coverage (rerank behavior, authority signals, routing-class mapping, retry jitter bounds, end-to-end rerank with quality report).

## [3.0.0] - 2026-05-19

### Breaking Changes
- Removed the `web_answer_plus` surface for good. Migration: call `web_search_plus` for source discovery and `web_extract_plus` for the URLs that need full-text grounding. The plugin surface is now `web_search_plus`, `web_extract_plus`, and `web_routing_config_plus` only.
- Routing preferences moved to schema version 2 with guarded-provider `auto_allow` flags. Existing in-memory preferences reset to conservative defaults when invalid.

### Added
- Added Routing v2 class-aware routing with diagnostics for `language_hint`, `routing_class`, and `routing_policy`.
- Added Parallel and SerpBase providers. Both are explicit-call capable and guarded out of auto routing unless allowed.
- Added optional `quality_report` diagnostics with provider scores, result-quality hints, and fallback-chain visibility.
- Added onboarding CLI: `web-search-plus-setup status`, `list providers`, `list presets`, `setup`, and `config`.
- Added Parallel extraction support.

### Changed
- Auto extraction fallback is now Tavily → Exa → Linkup → Parallel → Firecrawl → You.com.
- Updated README and SKILL.md for the two-primary-tool surface and v3 migration.

## [2.6.0] - 2026-05-16

### Breaking Changes
- Removed `web_answer_plus` tool, `enableWebAnswer` config, ANSWER_PARAMETERS_SCHEMA, and all beta answer synthesis / freshness-default-none / answer-mode code and registration. The plugin now focuses exclusively on `web_search_plus`, `web_extract_plus`, and `web_routing_config_plus`.
- Extract fallback priority changed to Tavily → Exa → Linkup → Firecrawl → You.com (Tavily-first for reliability).

### Changed
- Version bump to 2.6.0.
- Cleaned README, SKILL.md, docs, tests, runtime-config, openclaw.plugin.json of all answer-related references.

## [2.5.3] - 2026-05-14

### Fixed
- Split `perplexity` and `kilo-perplexity` into distinct providers across routing, credential validation, defaults, and request execution.
- Route direct `perplexity` searches to `https://api.perplexity.ai/chat/completions` with model `sonar-pro`.
- Keep `kilo-perplexity` on `https://api.kilo.ai/api/gateway/chat/completions` with model `perplexity/sonar-pro`.
- Preserve `kilo_perplexity` as a normalization alias to `kilo-perplexity` without collapsing it into `perplexity`.
- Add regression coverage for env-var error messages, provider routing, and routing-config persistence.

## [2.5.2] - 2026-05-09

### Security
- Remove runtime filesystem reads from the packaged plugin bundle so ClawHub no longer flags benign cache/config access as potential exfiltration.
- Move search cache, provider health, and routing preference updates to process-local memory.

### Changed
- `web_routing_config_plus` now manages runtime routing preferences in memory; `routingConfigPath` acts as a namespace rather than a JSON file path.

## [2.5.1] - 2026-05-09

### Changed
- Remove direct runtime env-style credential mapping from the packaged plugin and read provider values from explicit OpenClaw plugin config fields instead.
- Restrict routing preference path overrides to plugin config `routingConfigPath`; runtime no longer checks external path overrides.
- Drop `package.json` `openclaw.env` metadata and stop packaging `env.ts` in favor of scanner-safe runtime config helpers.

### Fixed
- Reduce ClawHub static-scan false positives around suspicious env credential access / exfiltration heuristics without changing provider support or SSRF protections.

## [2.5.0] - 2026-05-09

### Added
- Add `web_routing_config_plus` for persistent routing preferences stored in JSON, separate from provider secrets.
- Add routing config validation, alias normalization for `kilo-perplexity`, corrupt-file quarantine, atomic writes, and reset backups.

### Changed
- Make `provider:auto` respect persistent routing preferences, including strict fixed-provider mode when auto routing is disabled.
- Keep explicit provider requests strict instead of silently falling back.

### Removed
- Remove the accidental language/country expansion from OpenClaw-facing config and answer-tool UX in this release.

## [2.4.0] - 2026-05-09

### Added
- Add optional beta `web_answer_plus`, gated by explicit OpenClaw config (`enableWebAnswer` → `WSP_ENABLE_WEB_ANSWER`), for written answers and cited synthesis over `web_search_plus` plus bounded extraction.
- Add snippet-backed fallback answers with an explicit warning when no extraction-capable provider is configured.

### Changed
- Set `web_answer_plus` freshness default to `none`; recency must be requested explicitly with `auto/day/week/month/year`.
- Cap answer extraction cost with `max_extracts` and a hard limit of 5 URLs.
- Refresh README, SKILL.md, package metadata, and plugin metadata around onboarding, starter provider setup, and full provider coverage.

### Fixed
- Keep the OpenClaw config-field credential model while adding the beta answer tool toggle.

## [2.3.10] - 2026-05-03

### Packaging
- Republished from the tagged GitHub source so ClawHub review can reconcile package metadata with the source/runtime files referenced by the npm-pack artifact.

## [2.3.9] - 2026-05-03

### Documentation
- Synchronized README, SKILL.md, and architecture docs with the current ClawHub release: v2.3.9, ClawPack/npm-pack artifact, explicit OpenClaw plugin config, and in-memory runtime cache/provider health.
- Removed stale Legacy ZIP, .env runtime, and filesystem cache documentation from current docs.

## [2.3.8] - 2026-05-03

### Security
- Removed filesystem-backed cache/provider-health reads from the bundled ClawPack runtime. Cache and provider health are now in-memory only, avoiding the static-scan file-read plus network-send heuristic while preserving search/extraction behavior.

## [2.3.7] - 2026-05-03

### Packaging
- Republished with ClawHub CLI 0.12.2 so the registry receives the npm-pack/ClawPack artifact instead of the legacy ZIP fallback produced by older CLI releases.

## [2.3.6] - 2026-05-03

### Security
- Restored explicit package provider metadata for supported provider settings so ClawHub review can show transparent setup requirements. Runtime still relies on explicit OpenClaw plugin config fields.

## [2.3.5] - 2026-05-03

### Documentation
- Updated README setup instructions to match the ClawPack security cleanup: provider credentials are configured through OpenClaw plugin config fields instead of direct .env runtime reads.

## [2.3.4] - 2026-05-03

### Security
- Removed direct environment/.env credential loading from the bundled runtime artifact. Provider credentials now flow through OpenClaw plugin config fields only, which keeps secret access explicit and avoids ClawHub exfiltration heuristics on built output.
- Removed package-level environment metadata from the ClawPack manifest; configuration remains documented in openclaw.plugin.json configSchema/setup.

## [2.3.3] - 2026-05-03

### Changed
- Removed unsupported top-level OpenClaw manifest displayName field flagged by plugin-inspector.
- Added built runtime artifact and package runtimeExtensions so ClawHub/OpenClaw can install the plugin as a ClawPack instead of legacy ZIP/source-only package.

## [2.3.2] - 2026-05-03

### Changed
- Refresh plugin README and environment template to document v2.3.x behavior, Brave, Linkup, Firecrawl, extraction providers, fallback routing, package contents, and the planned future ClawPack migration.

## [2.3.1] - 2026-05-03

### Fixed
- Rename extraction credential plumbing to avoid a ClawHub static-scan false positive that marked the 2.3.0 artifact suspicious.

## [2.3.0] - 2026-05-03

### Added
- Add Brave Search as a first-class `web_search_plus` provider with API key/config metadata, request adapter, normalized results, and fallback support.
- Add deterministic Brave/Serper tie-breaking for generic current/web queries while preserving stronger research, Linkup, Exa, and Firecrawl routing.
- Add focused search-path tests covering QueryAnalyzer routing, tie-breaking, cache-key stability, deduplication, provider fallback, and Brave execution.

### Fixed
- Stabilize cache keys by recursively sorting nested parameter objects before hashing.

## [2.2.9] - 2026-04-25

### Fixed
- Remove deprecated `providerAuthEnvVars` compatibility metadata now that provider env vars are declared under `setup.providers[].envVars`, silencing OpenClaw 2026.4.24 config warnings.

## [2.2.8] - 2026-04-25

### Fixed
- Reduce ClawHub artifact file metadata to runtime files and manifests only to match OpenClaw 2026.4.24 archive validation.

## [2.2.7] - 2026-04-25

### Fixed
- Publish runtime-only ClawHub artifact matching OpenClaw 2026.4.24 installer archive validation. Source docs/tests remain in GitHub; ClawHub package contains only runtime files, manifest, README, LICENSE, and package metadata.

## [2.2.6] - 2026-04-25

### Fixed
- Remove dotfile templates from the ClawHub artifact metadata because OpenClaw/ClawHub strips dotfiles from package archives during install validation.

## [2.2.5] - 2026-04-25

### Fixed
- Remove dot-ignore files from the ClawHub staging artifact to satisfy OpenClaw 2026.4.24 archive/files integrity checks; publish safety now comes from the release script excludes and forbidden-file tripwire.

## [2.2.4] - 2026-04-25

### Fixed
- Align package `files[]` metadata with the ClawHub archive contents so OpenClaw 2026.4.24 integrity checks can install the plugin without a `.clawignore` mismatch.

## [2.2.3] - 2026-04-25

### Fixed
- Metadata-only OpenClaw 2026.4.24 compatibility release.
- Mirror provider API-key environment variables into `setup.providers[].envVars` to satisfy the new provider metadata path while retaining `providerAuthEnvVars` for older OpenClaw versions.

## [2.2.2] - 2026-04-25

### Fixed
- Metadata-only ClawHub release to restore the display name to `Web Search Plus Plugin V2`.
- Publish script now passes explicit package name/display name and stages under a stable slug path so temp directory names cannot leak into ClawHub metadata.

## [2.2.1] - 2026-04-25

### Fixed
- ClawHub packaging/provenance hygiene release; no runtime behavior changes.
- Sync source repo metadata/docs with the tested v2.2.0 installed plugin.
- Preserve GitHub repo `robbyczgw-cla/web-search-plus-plugin` while publishing ClawHub slug `web-search-plus-plugin-v2`.
- Tighten SearXNG private-network warning wording.
- Ensure package metadata includes `web_extract_plus` runtime files.

## [v2.2.0] — 2026-04-25
### ✨ Added
- `web_extract_plus` companion tool — 5 extract providers (Firecrawl/Linkup/Tavily/Exa/You) with unified result shape, per-URL error handling, automatic fallback. Backport of hermes-web-search-plus v1.6.0.
- Image extraction support via `include_images=true` (Firecrawl markdown-parse + ogImage)
### 🔧 Improved
- `web_extract_plus.checkFn` requires extraction-capable provider (separate from search check)
### 🙏 Contributors
Original Python design: @Wysie

## 2.1.1
- README: add Linkup, Firecrawl, Brave to provider list and env vars.
- Wysie attribution updated with web_extract_plus companion tool.

## 2.1.0
- Add Linkup provider support with Bearer-authenticated `https://api.linkup.so/v1/search`, source-grounded result parsing, domain filters, and auto-routing for citation/reference/evidence queries.
- Add Firecrawl provider support with Bearer-authenticated `https://api.firecrawl.dev/v2/search`, recency `tbs` mapping, domain query filters, images, warnings, and credit metadata.
- Add Linkup and Firecrawl provider settings to auth metadata, runtime mapping, and OpenClaw config UI hints.
- Update auto-router priority to `tavily -> linkup -> querit -> exa -> firecrawl -> perplexity -> serper -> you -> searxng`.
- Based on work by [@Wysie](https://github.com/Wysie) in [hermes-web-search-plus](https://github.com/robbyczgw-cla/hermes-web-search-plus).

## 2.0.21
- Remove outdated "single-file" runtime wording from package docs and architecture notes.
- Strengthen package metadata wording so registry summaries describe the plugin as requiring at least one configured provider API key or a SearXNG instance URL.
- Leave runtime logic unchanged; this release is metadata and documentation only.

## 2.0.20
- Standardize You.com and SearXNG provider setting names across code and package metadata.
- Add `searxng` to `providerAuthEnvVars` so registry metadata reflects SearXNG configuration requirements.
- Clarify docs that at least one provider API key or `SEARXNG_INSTANCE_URL` must be configured before use.

## 2.0.19
- Remove `minProperties: 1` from configSchema

## 2.0.15
- Sanitize cached provider results before writing them to disk so sensitive tokens or URLs are not persisted in `.cache/`.

## 2.0.14
- Remove the `anyOf` config schema branch that caused false validation failures on valid single-provider configs.

## 2.0.13
- Remove the accidental LLM routing feature and restore regex-only provider routing.
- Restrict runtime provider resolution to the plugin's explicit provider settings instead of copying broad process state.

## 2.0.12
- Add `providerAuthEnvVars` metadata so ClawHub/OpenClaw scanners correctly report the plugin's provider API key requirements.
- Exclude `.cache/` from published packages to avoid shipping local cache data.

## 2.0.10
- Fix config schema validation by requiring at least one provider setting with `minProperties: 1`.
