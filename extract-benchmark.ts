type Json = Record<string, any>;
let latest: Json | null = null;
export function saveExtractBenchmark(result: Json): void { latest = structuredClone(result); }
export function getLatestExtractBenchmark(): Json | null { return latest ? structuredClone(latest) : null; }
export function __resetExtractBenchmarkForTests(): void { latest = null; }
