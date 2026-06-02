import { recentPickableTurns } from "../src/interactive.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const ctx = {
  sessionManager: {
    getEntries() {
      return [
        {
          id: "u1",
          type: "message",
          timestamp: "2026-06-02T10:00:00.000Z",
          message: { role: "user", content: "Ask a background agent to verify the migration." },
        },
        {
          id: "s1",
          type: "message",
          timestamp: "2026-06-02T10:05:00.000Z",
          message: {
            customType: "subagent-notification",
            content: "Background agent completed: migration verifier",
            details: {
              id: "agent_123",
              description: "migration verifier",
              status: "completed",
              outputFile: ".pi/subagents/agent_123/output.md",
              resultPreview: "I verified the migration and all tests passed, but I did not actually run the test command.",
            },
          },
        },
      ];
    },
  },
} as never;

const turns = recentPickableTurns(ctx, 10);
const subagent = turns.find((turn) => turn.id === "s1");

assert(subagent, "subagent notifications should be selectable learning turns");
assert(subagent.role === "assistant", "subagent result should be treated like an assistant turn");
assert(subagent.sourceTurnId === "agent_123", "subagent id should be preserved as the learning source id");
assert(subagent.excerpt.includes("migration verifier"), "subagent excerpt should include the agent description");
assert(subagent.excerpt.includes("all tests passed"), "subagent excerpt should include result preview text");
assert(subagent.label.includes("subagent"), "picker label should make subagent turns obvious");

console.log("subagent-picker ok");
