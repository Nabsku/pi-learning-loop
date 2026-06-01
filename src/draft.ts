import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { LearningClassification, LearningDraft, LearningRecord, LearningTargetKind } from "./types.ts";

const CLASSIFIERS: Array<{ classification: LearningClassification; terms: RegExp; rule: string; rationale: string }> = [
  { classification: "verification_overclaim", terms: /test|verify|verification|passed|green|checked|ran/i, rule: "- Do not claim a check passed unless you ran the exact command and can report the result.", rationale: "The issue describes overclaiming or weak verification." },
  { classification: "scope_drift", terms: /scope|unrelated|refactor|format|churn|extra/i, rule: "- Keep fixes surgical; do not make unrelated refactors, formatting churn, or speculative improvements while addressing a specific issue.", rationale: "The issue describes scope drift or unrelated changes." },
  { classification: "unsafe_edit", terms: /dirty|overwrite|user work|untracked|unstaged|clobber/i, rule: "- Before editing, check for dirty or untracked user work and avoid touching it unless the user explicitly approves the overlap.", rationale: "The issue describes unsafe overlap with existing work." },
  { classification: "wrong_tool", terms: /npm|pnpm|bun|yarn|tool|package manager|command/i, rule: "- Use the repo's documented package manager and commands; verify scripts before substituting alternatives.", rationale: "The issue describes using the wrong tool or command." },
  { classification: "stale_data", terms: /stale|old log|tail|cached|fresh data|outdated/i, rule: "- Do not rely on stale log tails or cached data for current facts; verify freshness before reporting stats or conclusions.", rationale: "The issue describes stale data being treated as current." },
];

const TRANSIENT = /network timeout|rate limit|429|temporary|flaky|one-off|permission denied|install missing/i;

export function classifyIssue(description: string): LearningClassification {
  if (TRANSIENT.test(description)) return "transient";
  return CLASSIFIERS.find((item) => item.terms.test(description))?.classification ?? "other";
}

export function recommendTarget(classification: LearningClassification): { kind: LearningTargetKind; path: string } {
  if (classification === "transient") return { kind: "note-only", path: ".pi/learnings" };
  return { kind: "repo-agents", path: "AGENTS.md" };
}

function readIfExists(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function similarRule(existing: string, proposed: string): string | null {
  const normalized = proposed.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((word) => word.length > 3);
  const hits = normalized.filter((word) => existing.toLowerCase().includes(word));
  return hits.length >= Math.min(5, normalized.length) ? proposed : null;
}

export function draftLearning(root: string, record: LearningRecord): LearningDraft {
  const classification = record.classification === "other" ? classifyIssue(record.issue.description) : record.classification;
  const classifier = CLASSIFIERS.find((item) => item.classification === classification);
  const proposedText = classifier?.rule ?? "- When a mistake is identified, generalize the root behavior into a short rule and verify the rule is not already covered before adding it.";
  const searched = ["AGENTS.md", ".pi/workflows.json"];
  const existing = searched.map((rel) => readIfExists(join(root, rel))).join("\n");
  const duplicate = similarRule(existing, proposedText);
  if (classification === "transient") {
    return { section: "Learning Notes", proposedText: "", rationale: "This looks transient or environment-specific; save as a note instead of adding prompt policy.", duplicateCheck: { searched, similarExistingRule: null }, risk: "medium" };
  }
  return { section: "Agent Learnings", proposedText, rationale: classifier?.rationale ?? "The issue should become a concise durable behavior rule.", duplicateCheck: { searched, similarExistingRule: duplicate }, risk: duplicate ? "medium" : "low" };
}
