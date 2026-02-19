# web-search-plus-plugin — OpenClaw Plugin

A standalone OpenClaw plugin that exposes `web_search_plus` as a native tool with multi-provider routing.

It bundles its own Python backend script and supports:
- **Serper (Google)**
- **Tavily**
- **Exa**

The tool can auto-route queries by intent or use a forced provider.

## What it does

- Registers native tool: `web_search_plus`
- Runs bundled script at `scripts/search.py`
- Supports:
  - `query` (required)
  - `provider` (`serper` | `tavily` | `exa` | `auto`)
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
- `SERPER_API_KEY`
- `TAVILY_API_KEY`
- `EXA_API_KEY`

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
