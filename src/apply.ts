import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { LearningRecord } from "./types.ts";

export type ApplyResult = { applied: boolean; path: string; message: string };

function ensureAgentLearningsSection(content: string): string {
  if (/^## Agent Learnings\s*$/m.test(content)) return content;
  const trimmed = content.trimEnd();
  return `${trimmed}${trimmed ? "\n\n" : ""}## Agent Learnings\n`;
}

export function applyRepoAgentsRule(root: string, record: LearningRecord): ApplyResult {
  if (record.status !== "pending") return { applied: false, path: "", message: `Learning ${record.id} is ${record.status}, not pending.` };
  if (!record.draft?.proposedText.trim()) return { applied: false, path: "", message: "No proposed rule to apply." };
  if (record.recommendedTarget.kind !== "repo-agents") return { applied: false, path: record.recommendedTarget.path, message: `Target ${record.recommendedTarget.kind} is not supported by MVP apply.` };
  const path = join(root, record.recommendedTarget.path || "AGENTS.md");
  const current = existsSync(path) ? readFileSync(path, "utf8") : "# Repository Instructions\n";
  if (current.includes(record.draft.proposedText)) return { applied: false, path, message: "Rule already exists; not duplicated." };
  const withSection = ensureAgentLearningsSection(current);
  const updated = withSection.replace(/^## Agent Learnings\s*$/m, `## Agent Learnings\n${record.draft.proposedText}`);
  writeFileSync(path, `${updated.trimEnd()}\n`, "utf8");
  return { applied: true, path, message: `Applied ${record.id} to ${path}` };
}
