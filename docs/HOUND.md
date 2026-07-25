# Hound local MCP provider

Web Search Plus 3.2 can use [Hound](https://github.com/dondai1234/master-fetch)
as an optional local provider for search and extraction. Hound is an independent
MIT-licensed project created and maintained by
[Bishesh Bhandari](https://github.com/dondai1234). Web Search Plus does not
bundle, fork, or modify Hound; it connects to a separately installed Hound
process over MCP Streamable HTTP on loopback.

Hound is explicit-only by default. Configuring its endpoint does not add it to
automatic routing, fallback, Research, or extraction fallback.

## What "keyless" means

Hound does not require a commercial search or extraction API key, account, or
per-request payment. Search requests go from your machine to public search
engines, and extraction requests go to the target sites.

Keyless does **not** mean offline, anonymous, or free of operating cost:

- your public IP is visible to search engines and target sites;
- public engines can rate-limit, block, or change behavior;
- browser-backed extraction uses local CPU, memory, storage, and Chromium;
- latency and result quality vary, and there is no hosted-service SLA;
- website terms and local law still apply to what you retrieve.

For those reasons Hound is a controlled local fallback, not a silent default.

## Requirements

- Web Search Plus 3.2 or newer
- Python 3.11 or newer for Hound
- loopback access from the OpenClaw gateway to the Hound process
- optional Chromium installation for browser-backed extraction

The Hermes reference integration was tested against `hound-mcp==11.1.6`. This
OpenClaw port tests the MCP protocol adapter with local mocks rather than a live
Hound installation. Newer compatible Hound releases should work through the
same public MCP tools, but the pinned version is the reproducible reference
setup.

## Install Hound separately

A dedicated virtual environment keeps Hound's browser, PDF, OCR, and search
dependencies outside the OpenClaw plugin:

```bash
python3.11 -m venv ~/.local/share/hound-wsp/venv
~/.local/share/hound-wsp/venv/bin/python -m pip install \
  "hound-mcp[all]==11.1.6"
~/.local/share/hound-wsp/venv/bin/playwright install chromium
```

For HTTP-only fetching without the browser/PDF/OCR extras, install
`hound-mcp==11.1.6` instead. Check Hound's upstream documentation for exact
capability and platform support.

## Start the loopback sidecar

```bash
~/.local/share/hound-wsp/venv/bin/hound \
  --http \
  --host 127.0.0.1 \
  --port 8765 \
  --cache-ttl 0
```

Keep that process running while OpenClaw uses Hound. For persistent deployments,
manage it with your normal local service manager and a dedicated unprivileged
user. Do not expose the port on a public interface.

Web Search Plus accepts only uncredentialed HTTP loopback endpoints using
`127.0.0.1` or `::1`. Hostnames, remote addresses, URL userinfo, query strings,
and fragments are rejected. The default example endpoint is:

```text
http://127.0.0.1:8765/mcp
```

## Configure OpenClaw

Add the Hound fields to the plugin's explicit OpenClaw config:

```json
{
  "plugins": {
    "entries": {
      "web-search-plus-plugin-v2": {
        "config": {
          "houndMcpUrl": "http://127.0.0.1:8765/mcp",
          "houndTimeoutSeconds": 120,
          "houndMaxResponseBytes": 2097152,
          "houndMaxContentChars": 40000
        }
      }
    }
  }
}
```

`houndMcpUrl` is an endpoint, not a credential. Hound is ready only while the
separate process is running.

## Verify

Check Hound itself:

```bash
~/.local/share/hound-wsp/venv/bin/hound --doctor
```

Then make explicit Web Search Plus calls with these tool arguments:

```json
{
  "query": "Python programming language official website",
  "provider": "hound",
  "count": 3
}
```

```json
{
  "urls": ["https://example.com"],
  "provider": "hound"
}
```

Successful responses identify `hound` as the selected provider. If the sidecar
is absent or times out, Web Search Plus returns a bounded provider error rather
than inventing results.

## Routing, caching, and privacy

- Hound starts with `auto_allow=false`; explicit calls work, while automatic
  search, fallback, Research, and extraction fallback exclude it.
- Web Search Plus owns routing, normalization, SSRF checks, bounded output, and
  its in-process search cache.
- The adapter requests `cache_ttl=0` so the sidecar cache does not become a
  second authoritative state layer.
- Search maps to Hound's `mcp_smart_search`; extraction maps to one
  `mcp_smart_fetch` call per URL.
- Hound may use plain HTTP, a local browser, PDF tooling, or OCR depending on the
  target and installed extras.
- Queries and URLs are not sent to a commercial Hound service, but they still
  leave your machine for public search engines and destination websites.

To opt Hound into automatic routing deliberately, call
`web_routing_config_plus` with:

```json
{
  "action": "set_auto_allow",
  "provider": "hound",
  "enabled": true
}
```

Do this only after measuring local reliability and latency. Explicit-only is
the recommended default. Set `enabled` back to `false` to remove Hound from
automatic selection without disabling explicit calls.

## Attribution and licenses

- Hound / `hound-mcp`: Copyright Bishesh Bhandari, MIT License
- Hound repository: <https://github.com/dondai1234/master-fetch>
- Web Search Plus: separate MIT-licensed project and MCP client integration

Web Search Plus ships only its independent adapter. Hound's package, code,
models, browser dependencies, and their licenses remain part of the separate
Hound installation.
