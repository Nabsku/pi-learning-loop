import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@earendil-works/pi-ai";
import { classifyIssueWithModel, draftLearning, recommendTarget } from "./draft.ts";
import { bounded, createLearning, listLearnings, readLearning, repoRoot, saveLearning } from "./store.ts";
import { textResult } from "./result.ts";
import { loadConfig } from "./config.ts";

function summarize(record: { id: string; issue: { description: string }; status: string; draft?: { proposedText: string }; recommendedTarget: { kind: string; path: string } }): string {
  const draft = record.draft?.proposedText ? `\nrule: ${record.draft.proposedText}` : "";
  return `${record.id} [${record.status}] ${record.issue.description}\ntarget: ${record.recommendedTarget.kind}:${record.recommendedTarget.path}${draft}`;
}

export function registerLearningTools(pi: ExtensionAPI) {
  pi.registerTool({
    name: "learning_mark_issue",
    label: "Learning Mark Issue",
    description: "Create a pending learning record from a concrete Pi mistake. Does not write AGENTS.md.",
    promptSnippet: "Use when the user explicitly asks Pi to learn from a mistake. Draft first; never apply without approval.",
    parameters: Type.Object({ cwd: Type.Optional(Type.String()), issue: Type.String(), excerpt: Type.Optional(Type.String()) }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const root = repoRoot(params.cwd);
      const config = loadConfig(root);
      const classification = await classifyIssueWithModel(root, params.issue, ctx);
      const target = recommendTarget(classification);
      if (target.kind === "repo-agents") target.path = config.repoAgentsPath;
      const record = createLearning(root, {
        source: { selector: "manual", role: "unknown", excerpt: bounded(params.excerpt ?? params.issue, config.maxExcerptChars) },
        issue: { description: bounded(params.issue, 1000) },
        classification,
        recommendedTarget: target,
      });
      return textResult(`Created learning ${record.id}\nNext: learning_draft_rule id=${record.id}`, record);
    },
  });

  pi.registerTool({
    name: "learning_draft_rule",
    label: "Learning Draft Rule",
    description: "Draft a durable rule for a pending learning record. Does not apply it.",
    promptSnippet: "Use after learning_mark_issue. Show the draft and wait for approval before applying.",
    parameters: Type.Object({ cwd: Type.Optional(Type.String()), id: Type.String() }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const root = repoRoot(params.cwd);
      const record = readLearning(root, params.id);
      record.draft = await draftLearning(root, record, ctx);
      saveLearning(root, record);
      return textResult(summarize(record), record);
    },
  });

  pi.registerTool({
    name: "learning_list",
    label: "Learning List",
    description: "List pending learning records.",
    parameters: Type.Object({ cwd: Type.Optional(Type.String()) }),
    async execute(_id, params) {
      const root = repoRoot(params.cwd);
      const records = listLearnings(root);
      return textResult(records.length ? records.map(summarize).join("\n\n") : "No pending learnings.", { records });
    },
  });
}
