import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { applyRepoAgentsRule, previewRepoAgentsRule } from "./apply.ts";
import { classifyIssueWithModel, draftLearning, recommendTarget } from "./draft.ts";
import { runDraftReview, runInteractiveLearn } from "./interactive.ts";
import { bounded, createLearning, listLearnings, moveLearning, readLearning, repoRoot, saveLearning } from "./store.ts";
import { loadConfig } from "./config.ts";
import type { LearningClassification, LearningRecord } from "./types.ts";

const CLASSIFICATION_LABELS: Record<LearningClassification, string> = {
  verification_overclaim: "Verification overclaim",
  scope_drift: "Scope drift",
  unsafe_edit: "Unsafe edit",
  wrong_tool: "Wrong tool",
  context_miss: "Context miss",
  stale_data: "Stale data",
  transient: "Transient / note only",
  other: "Other",
};

function classificationLabel(classification: LearningClassification): string {
  return CLASSIFICATION_LABELS[classification] ?? classification;
}

function shortLine(text: string, max = 110): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max - 1)}…`;
}

function renderPendingSummary(records: LearningRecord[]): string {
  if (!records.length) return "No pending learnings.";
  const noun = records.length === 1 ? "learning" : "learnings";
  return [
    `${records.length} pending ${noun}:`,
    ...records.map((record) => `- ${record.id} · ${classificationLabel(record.classification)} · ${record.recommendedTarget.kind}:${record.recommendedTarget.path} · ${shortLine(record.issue.description)}`),
    "",
    "Next: /learn review or /learn show <id>",
  ].join("\n");
}

function statusNextAction(record: LearningRecord): string[] {
  if (record.status !== "pending") return [`next: no approval action; learning is ${record.status}.`];
  return [
    "next: /learn review",
    `CLI approve: /learn approve ${record.id} --confirm`,
    `reject: /learn reject ${record.id} Keep as note only / do not apply rule`,
  ];
}

function renderRecord(record: ReturnType<typeof readLearning>): string {
  const lines = [
    `# ${record.id}`,
    `status: ${record.status}`,
    `classification: ${classificationLabel(record.classification)}`,
    `target: ${record.recommendedTarget.kind}:${record.recommendedTarget.path}`,
    `issue: ${record.issue.description}`,
  ];
  if (record.draft) lines.push("", `section: ${record.draft.section}`, `rule: ${record.draft.proposedText || "(note-only)"}`, `rationale: ${record.draft.rationale}`, `duplicate: ${record.draft.duplicateCheck.similarExistingRule ?? "none"}`);
  lines.push("", ...statusNextAction(record));
  return lines.join("\n");
}

export function registerLearningCommand(pi: ExtensionAPI) {
  pi.registerCommand("learn", {
    description: "Learning loop: pick | review | note <issue> | draft <id> | show <id> | pending | approve <id> --confirm | reject <id> [reason]",
    getArgumentCompletions(prefix: string, ctx?: { cwd?: unknown }) {
      const trimmedStart = prefix.trimStart();
      const parts = trimmedStart.split(/\s+/);
      if (/\s/.test(trimmedStart)) {
        const sub = parts[0];
        if (sub === "note") return null;
        if (!["show", "draft", "approve", "reject"].includes(sub)) return null;
        const idPrefix = parts[1] ?? "";
        try {
          const root = repoRoot(typeof ctx?.cwd === "string" ? ctx.cwd : undefined);
          return listLearnings(root).filter((record) => record.id.startsWith(idPrefix)).map((record) => ({ value: record.id, label: record.id }));
        } catch {
          return [];
        }
      }
      const first = trimmedStart;
      return ["pick", "review", "note", "draft", "show", "pending", "approve", "reject", "help"].filter((value) => value.startsWith(first)).map((value) => ({ value, label: value }));
    },
    async handler(args, ctx) {
      const [subRaw, ...rest] = args.trim().split(/\s/).filter(Boolean);
      const sub = subRaw ?? "help";
      const root = repoRoot(ctx.cwd);
      const config = loadConfig(root);
      const send = (content: string, details?: unknown) => pi.sendMessage({ customType: "learning-loop", display: true, content, details });

      if (sub === "help") {
        send("usage: /learn pick | review | note <issue> | draft <id> | show <id> | pending | approve <id> --confirm | reject <id> [reason]\n\nUse /learn pick to create a draft from a bad turn. Use /learn review to pick, inspect, approve, or reject pending drafts. Direct approve without --confirm previews only.");
        return;
      }
      if (sub === "pick" || sub === "last") {
        const result = await runInteractiveLearn(root, ctx);
        send(result.message, result.ok ? result.record : result);
        return;
      }
      if (sub === "review" || sub === "drafts") {
        const result = await runDraftReview(root, ctx);
        send(result.message, result.ok ? result.record : result);
        return;
      }
      if (sub === "note") {
        const issue = rest.join(" ").trim();
        if (!issue) { send("usage: /learn note <what went wrong>"); return; }
        const classification = await classifyIssueWithModel(root, issue, ctx);
        const target = recommendTarget(classification);
        if (target.kind === "repo-agents") target.path = config.repoAgentsPath;
        const record = createLearning(root, { source: { selector: "manual", role: "unknown", excerpt: bounded(issue, config.maxExcerptChars) }, issue: { description: bounded(issue, 1000) }, classification, recommendedTarget: target });
        record.draft = await draftLearning(root, record, ctx);
        saveLearning(root, record);
        send(`pending learning created: ${record.id}\nProposed rule drafted; no repo rule applied yet.\nNext: /learn review\nTarget if approved: ${record.recommendedTarget.path}`, record);
        return;
      }
      if (sub === "pending") {
        const records = listLearnings(root);
        send(renderPendingSummary(records), { records });
        return;
      }
      if (sub === "show") {
        const id = rest[0];
        if (!id) { send("usage: /learn show <id>"); return; }
        const record = readLearning(root, id);
        send(renderRecord(record), record);
        return;
      }
      if (sub === "draft") {
        const id = rest[0];
        if (!id) { send("usage: /learn draft <id>"); return; }
        const record = readLearning(root, id);
        record.draft = await draftLearning(root, record, ctx);
        saveLearning(root, record);
        send(`${renderRecord(record)}\n\nApprove with: /learn approve ${record.id} --confirm`, record);
        return;
      }
      if (sub === "approve") {
        const id = rest[0];
        if (!id) { send("usage: /learn approve <id> --confirm"); return; }
        const record = readLearning(root, id);
        const confirmed = rest.length === 2 && rest[1] === "--confirm";
        const result = confirmed ? applyRepoAgentsRule(root, record) : previewRepoAgentsRule(root, record);
        if (result.applied) {
          record.appliedAt = new Date().toISOString();
          moveLearning(root, record, "applied");
        }
        send(result.message, result);
        return;
      }
      if (sub === "reject") {
        const id = rest[0];
        if (!id) { send("usage: /learn reject <id> [reason]"); return; }
        const record = readLearning(root, id);
        record.rejectionReason = rest.slice(1).join(" ").trim() || undefined;
        moveLearning(root, record, "rejected");
        send(`rejected: ${id}`, record);
        return;
      }
      send("usage: /learn pick | review | note <issue> | draft <id> | show <id> | pending | approve <id> --confirm | reject <id> [reason]");
    },
  });
}
