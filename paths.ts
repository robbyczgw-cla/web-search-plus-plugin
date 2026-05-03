import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export function getPluginDir(): string {
  try {
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    if (fs.existsSync(path.join(moduleDir, "package.json"))) return moduleDir;
    const parentDir = path.dirname(moduleDir);
    if (fs.existsSync(path.join(parentDir, "package.json"))) return parentDir;
    return moduleDir;
  } catch {}
  return process.cwd();
}
