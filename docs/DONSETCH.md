# DonSeTch operator guide

This guide covers the optional DonSeTch integration in Web Search Plus 4.3.1. DonSeTch is not bundled, redistributed, or started as a service by this plugin. It is an independent **AGPL-3.0-only** component that the operator must install, license-review, and maintain separately.

## Supported version and preflight

The adapter is currently tested and pinned against **DonSeTch 4.2.9**. Other parsed versions are reported as `compatible_unverified`; they are not claimed to be tested.

Install the pinned DonSeTch package separately from Web Search Plus:

```bash
npm install -g donsetch@4.2.9
```

Then resolve and inspect the executable on the same host and as the same operating-system user that runs OpenClaw:

```bash
command -v donsetch
donsetch --version
donsetch doctor
```

`command -v donsetch` must return an absolute path. Set that exact path as `donsetchBin`; do not rely on OpenClaw's working directory or a mutable `PATH`. `doctor` is an operator preflight command. The plugin does not invoke it automatically, and browser-related success remains dependent on the target host's DonSeTch, browser, display, certificate, proxy, and network setup.

## OpenClaw configuration

All Web Search Plus tools are optional. Add only the required tool names to the host's existing tool profile with `tools.alsoAllow`:

```json
{
  "tools": {
    "alsoAllow": [
      "web_search_plus",
      "web_extract_plus",
      "web_routing_config_plus",
      "web_search_health_plus"
    ]
  },
  "plugins": {
    "allow": ["web-search-plus-plugin-v2"],
    "entries": {
      "web-search-plus-plugin-v2": {
        "config": {
          "donsetchBin": "/absolute/path/to/donsetch",
          "donsetchTimeoutSeconds": 180,
          "donsetchMaxContentChars": 15000,
          "donsetchTier": "auto"
        }
      }
    }
  }
}
```

`tools.alsoAllow` is additive: it preserves profile-derived and already available tools. Add `web_extract_benchmark_plus` only if the agent should be able to run the explicit extraction benchmark. By contrast, `tools.allow` is an absolute restrictive allowlist and must retain every other tool the agent needs.

`plugins.allow` is a separate plugin-load gate. If the host already configures it, include `web-search-plus-plugin-v2`; allowing tool names does not allow the plugin itself to load. If `plugins.allow` is not used by that host, do not introduce a restrictive list merely for DonSeTch.

DonSeTch-specific plugin fields are:

| Field | Meaning |
| --- | --- |
| `donsetchBin` | Required absolute path to the separately installed executable. |
| `donsetchTimeoutSeconds` | Whole-session deadline, 5–600 seconds; default 180. |
| `donsetchMaxContentChars` | Per-URL Markdown request/output budget, 500–200,000 characters; default 15,000. |
| `donsetchTier` | `auto`, `1`, or `2`; `render_js=true` forces tier 2. |

DonSeTch extraction supports Markdown output. Raw HTML is not exposed by this adapter.

## Process boundary

The plugin never imports `child_process` and never constructs a shell command. It injects an exact argument vector into OpenClaw's host-owned `api.runtime.system.runCommandWithTimeout`:

```text
[donsetchBin, "mcp"]
```

The readiness check uses the same host runner with:

```text
[donsetchBin, "--version"]
```

One Web Search Plus request creates one initialized stdio MCP session. A multi-URL `web_extract_plus` request sends all of its `web_fetch` calls through that one session; it does not create one process per URL. The request accepts at most 50 MCP tool calls, while the normal plugin extraction ceiling defaults to 10 URLs and has a hard maximum of 50.

The adapter applies these boundaries:

- both hard and no-output timeouts use `donsetchTimeoutSeconds`;
- stdout defaults to a 4 MiB byte ceiling, with a mandatory post-run byte check;
- stderr is requested with an 8 KiB runner ceiling, and any surfaced diagnostic is sanitized and limited to 2,048 characters;
- normalized text is bounded separately, including the per-URL `donsetchMaxContentChars` limit;
- `killProcessTree=true`, `terminateOnOutputLimit=true`, and runner output limits are requested from OpenClaw;
- unrelated environment variables, including other providers' credentials, are explicitly removed from the child environment; only a narrow operating-system/runtime allowlist plus `DONSETCH_*`, `PLAYWRIGHT_*`, and `PUPPETEER_*` variables is preserved.

Tree termination and immediate output-limit enforcement are host-runner capabilities. The adapter requests them and retains its own timeout/result/byte checks as a compatibility backstop; operators should still verify process cleanup on the deployed OpenClaw version. The adapter never returns raw startup output and redacts common token, credential, URL-credential, and home-path patterns from diagnostics.

## Safe enablement procedure

DonSeTch starts with `auto_allow.donsetch=false`. Installing the executable and configuring `donsetchBin` do not route automatic traffic to it.

1. Run the local preflight commands above.
2. Call `web_search_health_plus` and inspect its `donsetch` object.
3. Test search with `web_search_plus(provider="donsetch", ...)`.
4. Test known public URLs with `web_extract_plus(provider="donsetch", ...)`.
5. Only after the target host behaves as expected, call:

   ```text
   web_routing_config_plus(action="set_auto_allow", provider="donsetch", enabled=true)
   ```

The gate is process-local and returns to its configured/default state after an OpenClaw host restart. DonSeTch is last in the default extraction priority. For Search, enabling `auto_allow` makes the configured provider eligible; use `set_provider_priority` only when its position in automatic Search should also be made explicit. Disable automatic traffic again with the same action and `enabled=false`. Explicit provider calls remain possible while the provider is configured, not disabled, and healthy.

`auto_allow` is a routing policy, not a privacy boundary, network sandbox, license acceptance, or assurance of provider quality.

## Readiness and health

When `donsetchBin` is configured, `web_search_health_plus` runs the bounded `[donsetchBin, "--version"]` readiness check through `api.runtime.system.runCommandWithTimeout`. Its `donsetch` result includes:

- `state`: `missing`, `executable`, `timeout`, or `unavailable`;
- the parsed `version`, when available;
- `testedVersion`, currently `4.2.9`;
- `compatibility`: `tested`, `compatible_unverified`, or `unknown`;
- `binaryConfigured` and, for failures, a sanitized diagnostic when available.

`state="executable"` only proves that the version command completed. It does not replace `donsetch doctor`, a real explicit Search/Extract smoke test, or verification of browser/process cleanup. Provider health, cooldown observations, routing preferences, and shadow-quality samples are process-local and are lost on restart.

## Privacy, network, cache, and attribution limits

- DonSeTch runs as a local child process, but Search queries can still reach public search engines and extracted URLs are fetched from their target sites. Local stdio is not an offline or no-egress guarantee.
- Web Search Plus rejects private/internal extraction targets by default. Enabling `extractAllowPrivateUrls` deliberately removes that plugin-level protection and should be limited to trusted intranet use.
- The child receives the host networking, proxy, certificate, browser, and display variables listed by the adapter. Review `DONSETCH_*`, Playwright/Puppeteer, and proxy variables available to the OpenClaw service account before enabling traffic.
- Web Search Plus caches completed results only in process memory. Search/extraction entries and `full_content_ref` continuation data disappear on eviction or host restart. Any cache maintained independently by DonSeTch, including one selected through a `DONSETCH_*` variable, is outside this plugin's lifecycle and must be reviewed and managed separately.
- Results are normalized to source URLs, snippets or extracted Markdown. DonSeTch engine names and consensus metadata are retained only when DonSeTch supplies them. These fields describe observed provenance; they do not verify truth, authorship, licensing, or consensus quality.
- Extracted text can omit page layout, notices, or context. Cite and inspect the original URL, respect the target site's terms and copyright, and do not treat a normalized snippet as a complete source.

## Migration from Hound

Web Search Plus 4.0.3 removes the Hound HTTP MCP adapter and replaces that optional boundary with DonSeTch stdio through the OpenClaw host runner. This is not an in-place endpoint rename.

1. Remove the obsolete `houndMcpUrl`, `houndTimeoutSeconds`, `houndMaxResponseBytes`, and `houndMaxContentChars` plugin fields. The 4.0.3 schema rejects unknown fields.
2. Remove or replace `hound` in configured provider priorities, disabled-provider lists, defaults, and `auto_allow` maps. Use `donsetch` only after completing the explicit smoke tests above.
3. Install and review DonSeTch separately, pin 4.2.9, and set the absolute `donsetchBin` path.
4. Map `houndTimeoutSeconds` to `donsetchTimeoutSeconds` and `houndMaxContentChars` to `donsetchMaxContentChars` only after reassessing the new defaults. There is no DonSeTch endpoint field and no public replacement for `houndMaxResponseBytes`; the DonSeTch transport owns a bounded output ceiling internally.
5. Restart OpenClaw, inspect `web_search_health_plus`, then test explicit Search and Extract before enabling `auto_allow.donsetch`.
6. Retire the old Hound sidecar using its own operator procedure after confirming that no other workload depends on it.

The architectural change is deliberate: Hound's loopback HTTP MCP endpoint is gone, and Web Search Plus now delegates a single, exact stdio process invocation to OpenClaw for each DonSeTch request.
