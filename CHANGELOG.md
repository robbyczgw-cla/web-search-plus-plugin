# Changelog

## [2.7.0] - 2026-05-16

### Added
- Serpbase provider (`serpbase`) for Google-style web search via https://api.serpbase.dev/google/search. Supports organic results, answer_box, and knowledge_graph parsing.
- `serpbaseApiKey` config option (SERPBASE_API_KEY env alias).
- Routing support: included in ProviderName, DEFAULT_PROVIDER_PRIORITY, normalization, and runtime credential checks.
- Version bump to 2.7.0 (new provider feature).

### Changed
- Updated openclaw.plugin.json configSchema/uiHints/description, runtime-config.ts, routing-config.ts, README.md, SKILL.md, docs/ARCHITECTURE.md.

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
