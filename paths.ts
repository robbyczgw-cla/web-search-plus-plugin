import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export function getPluginDir(): string {
  // Resolve lazily so env access does not happen at module load.
  // When OpenClaw transpiles plugins, import.meta.url may point to a temp dir.
  // Check the known extension path first when HOME is available.
  const homeDir = process.env.HOME;
  if (homeDir) {
    const knownPath = path.join(homeDir, ".openclaw", "extensions", "web-search-plus-plugin");
    if (fs.existsSync(path.join(knownPath, "package.json"))) return knownPath;
  }
  try {
    if (typeof __dirname !== "undefined") return __dirname;
  } catch {}
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {}
  return process.cwd();
}
