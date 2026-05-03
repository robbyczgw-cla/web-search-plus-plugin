const memoryStore = new Map<string, any>();

function cloneJson(value: any): any {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

export function readJsonFile(file: string, fallback: any): any {
  if (!memoryStore.has(file)) return fallback;
  return cloneJson(memoryStore.get(file));
}

export function writeJsonFile(file: string, value: any): void {
  memoryStore.set(file, cloneJson(value));
}

export function deleteFileIfExists(file: string): void {
  memoryStore.delete(file);
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
