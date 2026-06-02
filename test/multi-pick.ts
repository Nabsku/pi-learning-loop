import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import learningLoop from "../index.ts";

type Command = { handler: (args: string, ctx: Record<string, unknown>) => Promise<void> };
const commands: Record<string, Command> = {};
const messages: Array<{ content: string; details?: unknown }> = [];

learningLoop({
  on() {},
  registerTool() {},
  registerCommand(name: string, command: Command) { commands[name] = command; },
  sendMessage(message: { content: string; details?: unknown }) { messages.push(message); },
} as never);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const root = mkdtempSync(join(tmpdir(), "pi-learnings-multi-pick-"));
writeFileSync(join(root, "AGENTS.md"), "# Repo Rules\n", "utf8");

let pickerCount = 0;
let previewCount = 0;
const ctx = {
  cwd: root,
  hasUI: true,
  sessionManager: {
    getEntries() {
      return [
        { id: "u1", type: "message", timestamp: "2026-06-02T12:00:00.000Z", message: { role: "user", content: "Verify the branch." } },
        { id: "t1", type: "message", timestamp: "2026-06-02T12:01:00.000Z", message: { role: "tool", content: "pnpm test failed with exit code 1" } },
        { id: "a1", type: "message", timestamp: "2026-06-02T12:02:00.000Z", message: { role: "assistant", content: "All checks passed." } },
        { id: "a2", type: "message", timestamp: "2026-06-02T12:03:00.000Z", message: { role: "assistant", content: "I also updated README.md." } },
      ];
    },
  },
  ui: {
    async select(title: string, options: string[]) {
      if (title === "Select the turn to learn from") {
        pickerCount += 1;
        if (pickerCount === 1) return options.find((option) => option.includes("#a1")) ?? options[0];
        assert(options.some((option) => option.includes("1 selected")), "second picker should show selected count");
        return options.find((option) => option === "[last] last assistant response") ?? options[1];
      }
      if (title === "Use this turn?") {
        previewCount += 1;
        assert(options.includes("Add this turn and pick another"), "preview action should support adding another turn");
        assert(options.includes("Use selected turns"), "preview action should allow finishing with selected turns");
        return previewCount === 1 ? "Add this turn and pick another" : "Use selected turns";
      }
      throw new Error(`unexpected select ${title}`);
    },
    async input(title: string, placeholder?: string) {
      assert(title === "What went wrong?", "issue prompt should happen after multi-pick is complete");
      assert(placeholder?.includes("Multiple selected turns"), "multi-pick issue placeholder should mention multiple turns");
      return "Two turns together show an overclaim and then extra undocumented file-change claim.";
    },
    async editor(title: string, prefill?: string) {
      if (title === "Read-only preview: selected turn") return prefill;
      assert(title === "What should Pi do differently next time?", "desired behavior prompt should still run once");
      return "Ground summaries in the exact failed command and selected evidence turns.";
    },
  },
};

await commands.learn.handler("pick", ctx);

const content = messages.at(-1)?.content ?? "";
const id = /learn_[A-Za-z0-9_Z]+_[a-f0-9]{6}/.exec(content)?.[0];
assert(id, "created message should include id");
assert(existsSync(join(root, ".pi/learnings/pending", `${id}.json`)), "multi-pick should write one pending record");
const record = JSON.parse(readFileSync(join(root, ".pi/learnings/pending", `${id}.json`), "utf8"));
assert(record.source.turnId === "a1,a2", `combined record should preserve both source turn ids, got ${record.source.turnId}`);
assert(record.source.excerpt.includes("--- selected turn 1/2"), "combined excerpt should mark first selected turn");
assert(record.source.excerpt.includes("--- selected turn 2/2"), "combined excerpt should mark second selected turn");
assert(record.source.excerpt.includes("evidence excerpt"), "combined excerpt should retain evidence snippets");
assert(record.issue.description.includes("Two turns together"), "single issue should be recorded for the selected group");

console.log(`multi-pick ok id=${id}`);
