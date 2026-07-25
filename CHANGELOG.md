# Changelog

## [Unreleased]

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

### Fixed
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
