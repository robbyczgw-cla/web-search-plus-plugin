import { Type } from "@sinclair/typebox";
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

function getPluginDir(): string {
  try {
    if (typeof __dirname !== "undefined") return __dirname;
  } catch {}
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {}
  return path.join(process.cwd(), "skills", "web-search-plus-plugin");
}

function loadEnvFile(envPath: string): Record<string, string> {
  if (!fs.existsSync(envPath)) return {};
  const env: Record<string, string> = {};
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const stripped = trimmed.startsWith("export ") ? trimmed.slice(7) : trimmed;
    const eqIdx = stripped.indexOf("=");
    if (eqIdx < 0) continue;
    const key = stripped.slice(0, eqIdx).trim();
    const val = stripped.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key) env[key] = val;
  }
  return env;
}

const PLUGIN_DIR = getPluginDir();
const scriptPath = path.join(PLUGIN_DIR, "scripts", "search.py");

export default function (api: any) {
  // Bridge OpenClaw config fields to env vars expected by search.py
  const configEnv: Record<string, string> = {};
  const pluginConfig: Record<string, string> = (api as any)?.config ?? {};
  const configKeyMap: Record<string, string> = {
    serperApiKey: "SERPER_API_KEY",
    tavilyApiKey: "TAVILY_API_KEY",
    queritApiKey: "QUERIT_API_KEY",
    exaApiKey: "EXA_API_KEY",
    perplexityApiKey: "PERPLEXITY_API_KEY",
    kilocodeApiKey: "KILOCODE_API_KEY",
    youApiKey: "YOU_API_KEY",
    searxngInstanceUrl: "SEARXNG_INSTANCE_URL",
  };
  for (const [cfgKey, envKey] of Object.entries(configKeyMap)) {
    const val = pluginConfig[cfgKey];
    if (val && typeof val === "string") configEnv[envKey] = val;
  }

  api.registerTool(
    {
      name: "web_search_plus",
      description:
        "Search the web using multi-provider intelligent routing (Serper/Google, Tavily/Research, Querit/Multilingual AI Search, Exa/Neural+Deep, Perplexity, You.com, SearXNG). Automatically selects the best provider based on query intent. Use for ALL web searches. Set depth='deep' for multi-source synthesis, 'deep-reasoning' for complex cross-document analysis.",
      parameters: Type.Object({
        query: Type.String({ description: "Search query" }),
        provider: Type.Optional(
          Type.Union(
            [
              Type.Literal("serper"),
              Type.Literal("tavily"),
              Type.Literal("querit"),
              Type.Literal("exa"),
              Type.Literal("perplexity"),
              Type.Literal("you"),
              Type.Literal("searxng"),
              Type.Literal("auto"),
            ],
            {
              description:
                "Force a specific provider, or 'auto' for smart routing (default: auto)",
            },
          ),
        ),
        count: Type.Optional(
          Type.Number({ description: "Number of results (default: 5)" }),
        ),
        depth: Type.Optional(
          Type.Union(
            [
              Type.Literal("normal"),
              Type.Literal("deep"),
              Type.Literal("deep-reasoning"),
            ],
            {
              description:
                "Exa search depth: 'deep' synthesizes across sources (4-12s), 'deep-reasoning' for complex cross-reference analysis (12-50s). When provider is auto, depth may be auto-selected based on query complexity.",
            },
          ),
        ),
        time_range: Type.Optional(
          Type.Union(
            [
              Type.Literal("day"),
              Type.Literal("week"),
              Type.Literal("month"),
              Type.Literal("year"),
            ],
            {
              description:
                "Filter results by recency. Applies to Serper (as tbs), Perplexity (as search_recency_filter), Tavily/You.com (as freshness). Useful for news and current events.",
            },
          ),
        ),
        include_domains: Type.Optional(
          Type.Array(Type.String(), {
            description:
              "Only include results from these domains (e.g. ['arxiv.org', 'github.com']). Supported by Tavily and Exa.",
          }),
        ),
        exclude_domains: Type.Optional(
          Type.Array(Type.String(), {
            description:
              "Exclude results from these domains (e.g. ['reddit.com', 'pinterest.com']). Supported by Tavily and Exa.",
          }),
        ),
      }),
      async execute(
        _id: string,
        params: {
          query: string;
          provider?: string;
          count?: number;
          depth?: string;
          time_range?: string;
          include_domains?: string[];
          exclude_domains?: string[];
        },
      ) {
        const args = [scriptPath, "--query", params.query, "--compact"];

        if (params.provider && params.provider !== "auto") {
          args.push("--provider", params.provider);
        }

        if (typeof params.count === "number" && Number.isFinite(params.count)) {
          args.push(
            "--max-results",
            String(Math.max(1, Math.floor(params.count))),
          );
        }

        if (params.depth && params.depth !== "normal") {
          args.push("--exa-depth", params.depth);
        }

        if (params.time_range) {
          args.push("--time-range", params.time_range);
          args.push("--freshness", params.time_range);
        }

        if (params.include_domains?.length) {
          args.push("--include-domains", ...params.include_domains);
        }

        if (params.exclude_domains?.length) {
          args.push("--exclude-domains", ...params.exclude_domains);
        }

        const envPaths = [
          path.join(PLUGIN_DIR, ".env"),
          path.join(PLUGIN_DIR, "..", "web-search-plus", ".env"),
        ];
        const fileEnv: Record<string, string> = {};
        for (const envPath of envPaths) {
          Object.assign(fileEnv, loadEnvFile(envPath));
        }
        const childEnv = { ...process.env, ...configEnv, ...fileEnv };

        try {
          const child = spawnSync("python3", args, {
            timeout: 75000,
            env: childEnv,
            shell: false,
            encoding: "utf8",
          });

          if (child.error) {
            return {
              content: [
                { type: "text", text: `Search failed: ${child.error.message}` },
              ],
            };
          }

          if (child.status !== 0) {
            const stderr = child.stderr?.trim() || "Unknown error";
            return {
              content: [
                {
                  type: "text",
                  text: `Search failed (exit ${child.status}): ${stderr}`,
                },
              ],
            };
          }

          return {
            content: [{ type: "text", text: child.stdout?.trim() || "{}" }],
          };
        } catch (err: any) {
          return {
            content: [
              { type: "text", text: `Search failed: ${err?.message ?? err}` },
            ],
          };
        }
      },
    },
    { optional: true },
  );
}
