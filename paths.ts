import path from "path";
import { fileURLToPath } from "url";

export function getPluginDir(): string {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {}
  return process.cwd();
}
