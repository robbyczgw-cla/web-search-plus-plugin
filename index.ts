import { Type } from "@sinclair/typebox";
import { spawnSync } from "child_process";
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

const PLUGIN_DIR = getPluginDir();
const scriptPath = path.join(PLUGIN_DIR, "scripts", "search.py");

export default function (api: any) {
  api.registerTool(
    {
      name: "web_search_plus",
      description:
        "Search the web using multi-provider routing (Serper/Google, Tavily/Research, Exa/Neural). Automatically routes to the best provider based on query intent. Use this for ALL web searches instead of web_search.",
      parameters: Type.Object({
        query: Type.String({ description: "Search query" }),
        provider: Type.Optional(
          Type.Union(
            [
              Type.Literal("serper"),
              Type.Literal("tavily"),
              Type.Literal("exa"),
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
      }),
      async execute(
        _id: string,
        params: { query: string; provider?: string; count?: number },
      ) {
        const args = [scriptPath, "--query", params.query, "--compact"];

        if (params.provider && params.provider !== "auto") {
          args.push("--provider", params.provider);
        }

        if (typeof params.count === "number" && Number.isFinite(params.count)) {
          args.push("--max-results", String(Math.max(1, Math.floor(params.count))));
        }

        try {
          const child = spawnSync("python3", args, {
            timeout: 30000,
            env: process.env,
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
