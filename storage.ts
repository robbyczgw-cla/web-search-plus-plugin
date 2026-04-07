import fs from "fs";
import path from "path";

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function readJsonFile(file: string, fallback: any): any {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

export function writeJsonFile(file: string, value: any): void {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
}

export function deleteFileIfExists(file: string): void {
  try {
    fs.unlinkSync(file);
  } catch {}
}

export function readCachedJson(file: string, ttlSeconds: number): any | null {
  try {
    const cached = JSON.parse(fs.readFileSync(file, "utf8"));
    const ts = Number(cached._cache_timestamp || 0);
    if (!ts || Date.now() / 1000 - ts > ttlSeconds) {
      deleteFileIfExists(file);
      return null;
    }
    return cached;
  } catch {
    deleteFileIfExists(file);
    return null;
  }
}

export function parseEnvFile(envPath: string): Record<string, string> {
  if (!fs.existsSync(envPath)) return {};
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const stripped = trimmed.startsWith("export ") ? trimmed.slice(7) : trimmed;
    const idx = stripped.indexOf("=");
    if (idx < 0) continue;
    const key = stripped.slice(0, idx).trim();
    const value = stripped.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key) env[key] = value;
  }
  return env;
}

export function getStringProcessEnv(keys: string[]): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string") env[key] = value;
  }
  return env;
}
