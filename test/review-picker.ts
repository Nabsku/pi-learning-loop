import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import learningLoop from "../index.ts";

type Command = { handler: (args: string, ctx: Record<string, unknown>) => Promise<void> };

const commands: Record<string, Command> = {};
const messages: Array<{ content: string; details?: unknown }> = [];
const uiCalls: string[] = [];

learningLoop({
  on() {},
  registerTool() {},
  registerCommand(name: string, command: Command) { commands[name] = command; },
  sendMessage(message: { content: string; details?: unknown }) { messages.push(message); },
} as never);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const root = mkdtempSync(join(tmpdir(), "pi-learning-loop-review-"));
writeFileSync(join(root, "AGENTS.md"), "# Repo Rules\n", "utf8");
const longIssue = `claimed tests passed without running them ${"with lots of surrounding context ".repeat(20)}`;

await commands.learn.handler(`note ${longIssue}`, { cwd: root });
const id = /learn_[A-Za-z0-9_Z]+_[a-f0-9]{6}/.exec(messages.at(-1)?.content ?? "")?.[0];
assert(id, "created message should include id");
await commands.learn.handler(`draft ${id}`, { cwd: root });

const ctx = {
  cwd: root,
  hasUI: true,
  ui: {
    async select(title: string, options: string[]) {
      uiCalls.push(`select:${title}:${options.join("|")}`);
      if (title.includes("Select draft")) {
        assert(options.some((option) => option.includes(id)), "draft picker should show pending draft id");
        assert(options.some((option) => option.includes("Do not claim a check passed")), "draft picker should show rule preview");
        return options.find((option) => option.includes(id));
      }
      if (title.includes("Approve or reject")) return options.find((option) => option.startsWith("Approve"));
      throw new Error(`unexpected select title: ${title}`);
    },
    async editor(title: string, prefill: string) {
      uiCalls.push(`editor:${title}:${prefill.length}`);
      assert(title.includes("Review learning draft"), "review picker should show a full draft editor/overflow view");
      assert(prefill.includes("source excerpt:"), "full draft view should include source excerpt");
      assert(prefill.includes("Do not claim a check passed"), "full draft view should include proposed rule");
      assert(prefill.includes("lots of surrounding context"), "full draft view should preserve long context instead of select-label truncation");
      return prefill;
    },
  },
};

await commands.learn.handler("review", ctx);
const agents = readFileSync(join(root, "AGENTS.md"), "utf8");
assert(agents.includes("Do not claim a check passed"), "approving through review picker should apply draft");
assert(existsSync(join(root, ".pi/learnings/applied", `${id}.json`)), "review-approved draft should move to applied");
assert(uiCalls.some((call) => call.startsWith("select:Select draft")), "draft picker should be used");
assert(uiCalls.some((call) => call.startsWith("editor:Review learning draft")), "full overflow review should be used");

console.log(`review-picker root=${root} id=${id}`);
