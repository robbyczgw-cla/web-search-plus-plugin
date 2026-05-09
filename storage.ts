import fs from "node:fs";
import path from "node:path";

function cloneJson(value: any): any {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function ensureParentDir(file: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

export function readJsonFile(file: string, fallback: any): any {
  try {
    const text = fs.readFileSync(file, "utf8");
    if (!text.trim()) return cloneJson(fallback);
    return JSON.parse(text);
  } catch {
    return cloneJson(fallback);
  }
}

export function writeJsonFile(file: string, value: any): void {
  ensureParentDir(file);
  const tempFile = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempFile, `${JSON.stringify(cloneJson(value), null, 2)}\n`, "utf8");
  fs.renameSync(tempFile, file);
}

export function deleteFileIfExists(file: string): void {
  try {
    fs.rmSync(file, { force: true });
  } catch {}
}

export function readCachedJson(file: string, ttlSeconds: number): any | null {
  const cached = readJsonFile(file, null);
  if (!cached) return null;
  const ts = Number(cached._cache_timestamp || 0);
  if (!ts || Date.now() / 1000 - ts > ttlSeconds) {
    deleteFileIfExists(file);
    return null;
  }
  return cached;
}
