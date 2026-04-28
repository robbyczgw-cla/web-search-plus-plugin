# OpenClaw Plugin Issue Findings

Generated: deterministic
Status: PASS

## Triage Summary

| Metric               | Value |
| -------------------- | ----- |
| Issue findings       | 3     |
| P0                   | 0     |
| P1                   | 0     |
| Live issues          | 0     |
| Live P0 issues       | 0     |
| Compat gaps          | 0     |
| Deprecation warnings | 0     |
| Inspector gaps       | 3     |
| Upstream metadata    | 0     |
| Contract probes      | 3     |

## Triage Overview

| Class               | Count | P0 | Meaning                                                                                                         |
| ------------------- | ----- | -- | --------------------------------------------------------------------------------------------------------------- |
| live-issue          | 0     | 0  | Potential runtime breakage in the target OpenClaw/plugin pair. P0 only when it is not a deprecated compat seam. |
| compat-gap          | 0     | -  | Compatibility behavior is needed but missing from the target OpenClaw compat registry.                          |
| deprecation-warning | 0     | -  | Plugin uses a supported but deprecated compatibility seam; keep it wired while migration exists.                |
| inspector-gap       | 3     | -  | Plugin Inspector needs stronger capture/probe evidence before making contract judgments.                        |
| upstream-metadata   | 0     | -  | Plugin package or manifest metadata should improve upstream; not a target OpenClaw live break by itself.        |
| fixture-regression  | 0     | -  | Fixture no longer exposes an expected seam; investigate fixture pin or scanner drift.                           |

## P0 Live Issues

_none_

## Live Issues

_none_

## Compat Gaps

_none_

## Deprecation Warnings

_none_

## Inspector Proof Gaps

- P2 **web-search-plus-plugin-v2** `inspector-gap` `inspector-follow-up`
  - **package-dependency-install-required**: web-search-plus-plugin-v2: cold import requires isolated dependency installation
  - state: open · compat:none
  - evidence:
    - openclaw @ package.json

- P2 **web-search-plus-plugin-v2** `inspector-gap` `inspector-follow-up`
  - **package-typescript-source-entrypoint**: web-search-plus-plugin-v2: cold import needs TypeScript source entrypoint support
  - state: open · compat:none
  - evidence:
    - extension:index.ts

- P2 **web-search-plus-plugin-v2** `inspector-gap` `inspector-follow-up`
  - **runtime-tool-capture**: web-search-plus-plugin-v2: runtime tool schema needs registration capture
  - state: open · compat:none
  - evidence:
    - registerTool @ index.ts:815
    - registerTool @ index.ts:947

## Upstream Metadata Issues

_none_

## Issues

- P2 **web-search-plus-plugin-v2** `inspector-gap` `inspector-follow-up`
  - **package-dependency-install-required**: web-search-plus-plugin-v2: cold import requires isolated dependency installation
  - state: open · compat:none
  - evidence:
    - openclaw @ package.json

- P2 **web-search-plus-plugin-v2** `inspector-gap` `inspector-follow-up`
  - **package-typescript-source-entrypoint**: web-search-plus-plugin-v2: cold import needs TypeScript source entrypoint support
  - state: open · compat:none
  - evidence:
    - extension:index.ts

- P2 **web-search-plus-plugin-v2** `inspector-gap` `inspector-follow-up`
  - **runtime-tool-capture**: web-search-plus-plugin-v2: runtime tool schema needs registration capture
  - state: open · compat:none
  - evidence:
    - registerTool @ index.ts:815
    - registerTool @ index.ts:947

## Contract Probe Backlog

- P2 **web-search-plus-plugin-v2** `package-loader`
  - contract: Inspector installs package dependencies in an isolated workspace before cold import.
  - id: `package.entrypoint.isolated-dependency-install:web-search-plus-plugin-v2`
  - evidence:
    - openclaw @ package.json

- P2 **web-search-plus-plugin-v2** `package-loader`
  - contract: Inspector can compile or load TypeScript source entrypoints before registration capture.
  - id: `package.entrypoint.typescript-loader:web-search-plus-plugin-v2`
  - evidence:
    - extension:index.ts

- P2 **web-search-plus-plugin-v2** `tool-runtime`
  - contract: Registered runtime tools expose stable names, input schemas, and result metadata.
  - id: `tool.registration.schema-capture:web-search-plus-plugin-v2`
  - evidence:
    - registerTool @ index.ts:815
    - registerTool @ index.ts:947
