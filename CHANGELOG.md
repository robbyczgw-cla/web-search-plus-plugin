## 2.1.0
- Add Linkup provider support with Bearer-authenticated `https://api.linkup.so/v1/search`, source-grounded result parsing, domain filters, and auto-routing for citation/reference/evidence queries.
- Add Firecrawl provider support with Bearer-authenticated `https://api.firecrawl.dev/v2/search`, recency `tbs` mapping, domain query filters, images, warnings, and credit metadata.
- Add `LINKUP_API_KEY` and `FIRECRAWL_API_KEY` to provider auth metadata, runtime env mapping, and OpenClaw config UI hints.
- Update auto-router priority to `tavily -> linkup -> querit -> exa -> firecrawl -> perplexity -> serper -> you -> searxng`.
- Based on work by [@Wysie](https://github.com/Wysie) in [hermes-web-search-plus](https://github.com/robbyczgw-cla/hermes-web-search-plus).

## 2.0.21
- Remove outdated "single-file" runtime wording from package docs and architecture notes.
- Strengthen package metadata wording so registry summaries describe the plugin as requiring at least one configured provider API key or a SearXNG instance URL.
- Leave runtime logic unchanged; this release is metadata and documentation only.

## 2.0.20
- Standardize provider environment variable names on `YOU_API_KEY` and `SEARXNG_INSTANCE_URL` across code and package metadata.
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
- Restrict runtime environment reads to the plugin's explicit provider env vars instead of copying all `process.env` values.

## 2.0.12
- Add `providerAuthEnvVars` metadata so ClawHub/OpenClaw scanners correctly report the plugin's provider API key requirements.
- Exclude `.cache/` from published packages to avoid shipping local cache data.

## 2.0.10
- Fix config schema validation by requiring at least one provider setting with `minProperties: 1`.
