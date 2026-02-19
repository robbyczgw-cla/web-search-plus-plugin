# web-search-plus-plugin — OpenClaw Plugin

A standalone OpenClaw plugin that exposes `web_search_plus` as a native tool with multi-provider routing.

It bundles its own Python backend script and supports:
- **Serper (Google)** — best for factual/shopping queries
- **Tavily** — best for research & analysis
- **Exa (Neural)** — best for discovery & semantic search
- **You.com** — real-time web + RAG
- **SearXNG** — self-hosted privacy-first search

The tool auto-routes queries by intent or you can force a specific provider.

## What it does

- Registers native tool: `web_search_plus`
- Runs bundled script at `scripts/search.py`
- Supports:
  - `query` (required)
  - `provider` (`serper` | `tavily` | `exa` | `you` | `searxng` | `auto`)
  - `count` (result count)

## Installation

Add plugin path to `plugins.load.paths` and enable in `plugins.entries`.

### Example OpenClaw config snippet

```json
{
  "plugins": {
    "load": {
      "paths": [
        "/path/to/web-search-plus-plugin"
      ]
    },
    "entries": [
      {
        "id": "web-search-plus-plugin",
        "enabled": true
      }
    ]
  }
}
```

## Environment variables

At least one provider key is required:
- `SERPER_API_KEY` — [console.serper.dev](https://console.serper.dev)
- `TAVILY_API_KEY` — [tavily.com](https://tavily.com)
- `EXA_API_KEY` — [exa.ai](https://exa.ai)
- `YOU_API_KEY` — [you.com/api](https://you.com/api) (optional)
- `SEARXNG_URL` — your SearXNG instance URL (optional, self-hosted)

## Enable for an agent

Allow the tool in agent config:

```json
{
  "agents": {
    "my-agent": {
      "tools": {
        "allow": [
          "web_search_plus"
        ]
      }
    }
  }
}
```

## Notes

- Plugin resolves the script path relative to the plugin directory.
- No dependency on external skill paths.
- Publishable as a standalone plugin repository.
