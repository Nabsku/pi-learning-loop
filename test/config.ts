import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import learningLoop from "../index.ts";

type Command = { handler: (args: string, ctx: { cwd: string }) => Promise<void> };

const commands: Record<string, Command> = {};
const messages: Array<{ content: string; details?: unknown }> = [];

learningLoop({
  registerTool() {},
  registerCommand(name: string, command: Command) { commands[name] = command; },
  sendMessage(message: { content: string; details?: unknown }) { messages.push(message); },
} as never);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const root = mkdtempSync(join(tmpdir(), "pi-learning-loop-config-"));

await commands.learn.handler("init-config", { cwd: root });
const configPath = join(root, ".pi/learning-loop.json");
assert(existsSync(configPath), "init-config should create .pi/learning-loop.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));
assert(config.learningsDir === ".pi/learnings", "default config should set learningsDir");
assert(config.repoAgentsPath === "AGENTS.md", "default config should set repoAgentsPath");
assert(config.modelOverrides.draftRule.model === "openai-codex/gpt-5.5", "default config should set draftRule model override");
assert(config.modelOverrides.classifyIssue.model === "openai-codex/gpt-5.4-mini", "default config should set classifyIssue model override");

writeFileSync(configPath, JSON.stringify({
  version: 1,
  learningsDir: ".pi/custom-learnings",
  repoAgentsPath: "docs/AGENTS.md",
  maxExcerptChars: 12,
  modelOverrides: {
    draftRule: { model: "openai-codex/gpt-5.5", thinkingLevel: "high" },
    classifyIssue: { model: "openai-codex/gpt-5.4-mini", thinkingLevel: "minimal" },
  },
}, null, 2), "utf8");
mkdirSync(join(root, "docs"), { recursive: true });
writeFileSync(join(root, "docs/AGENTS.md"), "# Docs Rules\n", "utf8");

await commands.learn.handler("note tests passed claim used no command", { cwd: root });
const id = /learn_[A-Za-z0-9_Z]+_[a-f0-9]{6}/.exec(messages.at(-1)?.content ?? "")?.[0];
assert(id, "created message should include id");
assert(existsSync(join(root, ".pi/custom-learnings/pending", `${id}.json`)), "custom learningsDir should be used");

await commands.learn.handler(`draft ${id}`, { cwd: root });
await commands.learn.handler(`approve ${id}`, { cwd: root });
const docsAgents = readFileSync(join(root, "docs/AGENTS.md"), "utf8");
assert(docsAgents.includes("## Agent Learnings"), "custom repoAgentsPath should receive approved rule");
assert(!existsSync(join(root, "AGENTS.md")), "default AGENTS.md should not be created when repoAgentsPath is configured");

console.log(`config root=${root} id=${id}`);
