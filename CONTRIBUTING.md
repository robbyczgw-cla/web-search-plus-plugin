# Contributing to Web Search Plus for OpenClaw

Thanks for improving the OpenClaw/ClawHub port of Web Search Plus. This repository favors small, reviewable ports, source-backed behavior, scanner-safe runtime code, and deterministic tests without paid provider credentials.

## Project boundaries

This repository owns the in-process OpenClaw plugin, its five registered tools, plugin manifest, bundled runtime, onboarding CLI, ClawHub package, and OpenClaw-specific configuration surface.

It is a deliberate port of useful behavior from [Hermes Web Search Plus](https://github.com/robbyczgw-cla/hermes-web-search-plus), not a second canonical engine and not a mechanical source copy. Shared behavior should normally be designed and proven upstream first, then adapted to OpenClaw's host contracts.

The public Search and Extract surfaces are mechanically source-only. Do not reintroduce `web_answer_plus`, answer-style providers, or synthesized claims presented as source evidence.

## Before opening an issue

- Search existing issues and pull requests.
- Include the plugin version, OpenClaw version, Node.js version, tool name, and a minimal redacted configuration shape.
- State whether a provider was selected explicitly, by auto-routing, or during Research mode.
- Never paste API keys, tokens, full query logs, private URLs, OpenClaw config files, or raw provider responses.
- Report exploitable vulnerabilities privately to the maintainers rather than in a public issue.

## Local setup

Use Node.js 22, matching the bundle target and [GitHub Actions](.github/workflows/ci.yml):

```bash
npm ci
```

`package-lock.json` is reviewed dependency state. Do not regenerate it for an unrelated documentation or source change.

## Required checks

Run the same gates as CI:

```bash
npm ci
npm test
npm run build
npm pack --dry-run
```

`npm test` runs the network-free Node test suite directly against TypeScript sources. `npm run build` regenerates the bundled `dist/index.js`; commit the bundle whenever source changes alter it. `npm pack --dry-run` is the final truth for what ClawHub/npm consumers will receive.

Provider tests must mock `fetch` or the sidecar transport. CI must not require live credentials, provider quota, mutable search results, an OpenClaw gateway, or a local Hound process.

## Porting from Web Search Plus

Start shared routing, provider, extraction, budgeting, provenance, or quality work in Hermes Web Search Plus unless the change exists only because of OpenClaw. A port must be reviewed as an adaptation, not credited as original OpenClaw-only invention.

For each port:

1. Identify the upstream release or commit used as design input.
2. List the behavior being ported and the behavior intentionally omitted.
3. Adapt configuration to explicit plugin fields; runtime code must not discover secrets from `.env` or arbitrary files.
4. Preserve OpenClaw's in-process execution model, tool registration API, scanner constraints, and process-local state semantics.
5. Add parity tests that prove behavior rather than merely matching filenames.
6. Update the README, SKILL, manifest, changelog, and bundle where their public contracts changed.

Host-runtime features such as Hermes subprocess loaders, filesystem paging, runtime hooks, operator consoles, or repo-specific generators are not automatically appropriate here. No-port decisions are healthy; unexplained drift is not.

## Provider and tool changes

A provider change must include:

- a verified source-result or extraction endpoint;
- explicit configuration fields in [`openclaw.plugin.json`](openclaw.plugin.json);
- source-only normalization and truthful attribution;
- finite deadlines, bounded responses, sanitized failures, and deterministic fallback behavior;
- deliberate default/guarded/explicit routing policy;
- network-free success, failure, timeout, schema, and routing tests;
- matching README and [`SKILL.md`](SKILL.md) documentation;
- an entry under `[Unreleased]` in [`CHANGELOG.md`](CHANGELOG.md).

Treat registered tool names, input schemas, output envelopes, process-local lifetime claims, and fallback semantics as public API. Additive changes still need registration and package tests. Removing or renaming a tool requires explicit maintainer agreement and a major-version decision.

When adding or renaming packaged modules, update the `files` allowlist in `package.json` and prove the tarball with `npm pack --dry-run`. Keep `package.json`, `openclaw.plugin.json`, `SKILL.md`, README version claims, and the built bundle synchronized for releases.

A sidecar remains an independently installed upstream project. Do not bundle it, blur authorship, or weaken loopback/transport limits for convenience. Hound integration requirements and attribution live in [`docs/HOUND.md`](docs/HOUND.md).

## OpenClaw runtime constraints

- Credentials come only from explicit OpenClaw plugin configuration fields.
- Routing preferences and health data are process-local unless the public contract says otherwise.
- Runtime code must remain compatible with the declared OpenClaw plugin API and minimum gateway version.
- Avoid runtime filesystem reads that violate ClawHub scanner expectations.
- Preserve bounded fan-out, context budgets, cache limits, SSRF defenses, redirect policy, and guarded provider defaults.
- Do not add a background server, persistent ledger, or cross-restart state as a “small” port.

## Security and privacy

- Never commit credentials or realistic token-shaped fixtures.
- Do not log query text, private URLs, headers, provider payloads, or secret-bearing configuration.
- Keep extraction blocked for private/internal targets by default; opt-ins must remain explicit and documented.
- Stable errors should expose sanitized codes and bounded context, not upstream response bodies.
- Cache identities may include non-secret routing inputs, never credentials.
- Security-sensitive behavior needs focused negative tests, including look-alike hosts, redirects, response limits, and fail-closed defaults.

## Documentation and changelog

Update the [README](README.md) for installation, configuration, and user-visible behavior. Update [`SKILL.md`](SKILL.md) when agent-facing tool guidance changes. Update [`openclaw.plugin.json`](openclaw.plugin.json) when configuration or tool contracts change.

Every user-visible, packaging, security, compatibility, or contributor-workflow change needs a concise `[Unreleased]` entry in [`CHANGELOG.md`](CHANGELOG.md). Do not hard-code volatile test counts or future release dates in contributor documentation.

## Pull requests

Keep pull requests focused and include:

- the problem and chosen host boundary;
- upstream provenance plus explicit no-port decisions;
- user-visible, package, and compatibility impact;
- tests added or changed;
- exact commands run and their results;
- security/privacy implications;
- changelog and release impact.

Before requesting review, rebase on the current default branch, run all required checks, inspect `npm pack --dry-run`, and review the diff for credentials, internal paths, debug output, stale bundled code, manifest drift, and unrelated lockfile churn.

Maintainers decide provider admission, routing defaults, public tool changes, OpenClaw compatibility floors, release publication, and whether shared behavior belongs upstream first.
