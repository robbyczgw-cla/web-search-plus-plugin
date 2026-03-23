import { spawn } from "child_process";
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

const SENSITIVE_PATTERN = /(?:key|token|secret|password|api[_-]?key)\s*[=:]\s*\S+/gi;

function sanitizeOutput(text: string): string {
  return text.replace(SENSITIVE_PATTERN, "[REDACTED]");
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

function runPython(
  args: string[],
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn("python3", args, { env, shell: false });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        resolve({ stdout: "", stderr: "Search timed out", code: 1 });
      }
    }, timeoutMs);

    child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

    child.on("close", (code: number | null) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ stdout, stderr, code: code ?? 1 });
      }
    });

    child.on("error", (err: Error) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        const safeMsg = (err as any).code === "ENOENT" ? "python3 not found" : "Process error";
        resolve({ stdout: "", stderr: safeMsg, code: 1 });
      }
    });
  });
}

const PLUGIN_DIR = getPluginDir();
const scriptPath = path.join(PLUGIN_DIR, "scripts", "search.py");

const PARAMETERS_SCHEMA = {
  type: "object",
  required: ["query"],
  properties: {
    query: { type: "string", description: "Search query" },
    provider: {
      type: "string",
      enum: ["serper", "tavily", "querit", "exa", "perplexity", "you", "searxng", "auto"],
      description: "Force a specific provider, or 'auto' for smart routing (default: auto)",
    },
    count: { type: "number", description: "Number of results (default: 5)" },
    depth: {
      type: "string",
      enum: ["normal", "deep", "deep-reasoning"],
      description: "Exa search depth: 'deep' synthesizes across sources (4-12s), 'deep-reasoning' for complex cross-reference analysis (12-50s). When provider is auto, depth may be auto-selected based on query complexity.",
    },
    time_range: {
      type: "string",
      enum: ["day", "week", "month", "year"],
      description: "Filter results by recency. Applies to Serper (as tbs), Perplexity (as search_recency_filter), Tavily/You.com (as freshness). Useful for news and current events.",
    },
    include_domains: {
      type: "array",
      items: { type: "string" },
      description: "Only include results from these domains (e.g. ['arxiv.org', 'github.com']). Supported by Tavily and Exa.",
    },
    exclude_domains: {
      type: "array",
      items: { type: "string" },
      description: "Exclude results from these domains (e.g. ['reddit.com', 'pinterest.com']). Supported by Tavily and Exa.",
    },
  },
};

export default function (api: any) {
  // Bridge OpenClaw config fields to env vars expected by search.py
  const configEnv: Record<string, string> = {};
  const pluginConfig: Record<string, string> = (api.pluginConfig ?? {}) as Record<string, string>;
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
      parameters: PARAMETERS_SCHEMA,
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
        if (!fs.existsSync(scriptPath)) {
          return {
            content: [{ type: "text", text: `Search failed: script not found at ${scriptPath}` }],
          };
        }

        const args = [scriptPath, "--query", params.query, "--compact"];

        if (params.provider && params.provider !== "auto") {
          args.push("--provider", params.provider);
        }

        if (typeof params.count === "number" && Number.isFinite(params.count)) {
          args.push("--max-results", String(Math.max(1, Math.floor(params.count))));
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

        const result = await runPython(args, childEnv, 75000);

        if (result.code !== 0) {
          const stderr = sanitizeOutput(result.stderr.trim()) || "Unknown error";
          return {
            content: [{ type: "text", text: `Search failed (exit ${result.code}): ${stderr}` }],
          };
        }

        return {
          content: [{ type: "text", text: sanitizeOutput(result.stdout.trim()) || "{}" }],
        };
      },
    },
    { optional: true },
  );
}
