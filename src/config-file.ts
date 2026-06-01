import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { configPath, DEFAULT_CONFIG, legacyConfigPath } from "./config.ts";
import type { LearningLoopConfig } from "./config.ts";

function renderConfig(config: LearningLoopConfig = DEFAULT_CONFIG): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}

export function initConfig(root: string): { created: boolean; path: string; message: string } {
  const path = configPath(root);
  const legacyPath = legacyConfigPath(root);
  if (existsSync(path)) return { created: false, path, message: `Config already exists: ${path}` };
  if (existsSync(legacyPath)) return { created: false, path: legacyPath, message: `Legacy config already exists: ${legacyPath}` };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, renderConfig(), "utf8");
  return { created: true, path, message: `Created config: ${path}` };
}

export { renderConfig };
