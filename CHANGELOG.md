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
