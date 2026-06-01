import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import type { LearningRecord } from "./types.ts";
import { loadConfig } from "./config.ts";

export type ApplyResult = { applied: boolean; path: string; message: string };

function ensureAgentLearningsSection(content: string): string {
  if (/^## Agent Learnings\s*$/m.test(content)) return content;
  const trimmed = content.trimEnd();
  return `${trimmed}${trimmed ? "\n\n" : ""}## Agent Learnings\n`;
}

export function resolveRepoAgentsPath(root: string, record: LearningRecord): { ok: true; absPath: string; relPath: string } | { ok: false; message: string; relPath: string } {
  const config = loadConfig(root);
  const rawPath = record.recommendedTarget.path || config.repoAgentsPath;
  if (isAbsolute(rawPath)) return { ok: false, relPath: rawPath, message: `Unsafe target path rejected: ${rawPath}` };
  const repo = resolve(root);
  const absPath = resolve(repo, rawPath);
  const relPath = relative(repo, absPath);
  if (!relPath || relPath.startsWith("..") || isAbsolute(relPath)) return { ok: false, relPath: rawPath, message: `Unsafe target path rejected: ${rawPath}` };
  return { ok: true, absPath, relPath };
}

export function previewRepoAgentsRule(root: string, record: LearningRecord): ApplyResult {
  if (record.status !== "pending") return { applied: false, path: "", message: `Learning ${record.id} is ${record.status}, not pending.` };
  if (!record.draft?.proposedText.trim()) return { applied: false, path: "", message: "No proposed rule to apply." };
  if (record.recommendedTarget.kind !== "repo-agents") return { applied: false, path: record.recommendedTarget.path, message: `Target ${record.recommendedTarget.kind} is not supported by MVP apply.` };
  const target = resolveRepoAgentsPath(root, record);
  if (!target.ok) return { applied: false, path: target.relPath, message: target.message };
  return { applied: false, path: target.relPath, message: `Preview only; no repo rule applied yet. Would apply ${record.id} to ${target.relPath}:\n${record.draft.proposedText}\n\nRun: /learn approve ${record.id} --confirm` };
}

export function applyRepoAgentsRule(root: string, record: LearningRecord): ApplyResult {
  if (record.status !== "pending") return { applied: false, path: "", message: `Learning ${record.id} is ${record.status}, not pending.` };
  if (!record.draft?.proposedText.trim()) return { applied: false, path: "", message: "No proposed rule to apply." };
  if (record.recommendedTarget.kind !== "repo-agents") return { applied: false, path: record.recommendedTarget.path, message: `Target ${record.recommendedTarget.kind} is not supported by MVP apply.` };
  const target = resolveRepoAgentsPath(root, record);
  if (!target.ok) return { applied: false, path: target.relPath, message: target.message };
  const current = existsSync(target.absPath) ? readFileSync(target.absPath, "utf8") : "# Repository Instructions\n";
  if (current.includes(record.draft.proposedText)) return { applied: false, path: target.relPath, message: "Rule already exists; not duplicated." };
  const withSection = ensureAgentLearningsSection(current);
  const updated = withSection.replace(/^## Agent Learnings\s*$/m, `## Agent Learnings\n${record.draft.proposedText}`);
  mkdirSync(dirname(target.absPath), { recursive: true });
  writeFileSync(target.absPath, `${updated.trimEnd()}\n`, "utf8");
  return { applied: true, path: target.relPath, message: `Applied ${record.id} to ${target.relPath}` };
}
