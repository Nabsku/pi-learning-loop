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
          timestamp: "2026-05-31T10:00:00.000Z",
          message: { role: "user", content: "Can you fix CI?" },
        },
        {
          id: "a1",
          type: "message",
          timestamp: "2026-05-31T10:01:00.000Z",
          message: { role: "assistant", content: "I will run the tests now." },
        },
        {
          id: "t1",
          type: "message",
          timestamp: "2026-05-31T10:02:00.000Z",
          message: { role: "tool", content: "pnpm test failed with exit code 1" },
        },
        {
          id: "a2",
          type: "message",
          timestamp: "2026-05-31T10:03:00.000Z",
          message: { role: "assistant", content: "All checks passed and CI is green." },
        },
        {
          id: "a3",
          type: "message",
          timestamp: "2026-05-31T10:04:00.000Z",
          message: { role: "assistant", content: "I updated README wording." },
        },
      ];
    },
  },
} as never;

const turns = recentPickableTurns(ctx, 10);

assert(turns[0]?.id === "a2", "suspicious assistant overclaim after a failing tool result should rank first");
assert(turns[0]?.label.startsWith("⚠ assistant"), "top suspicious option should use warning-first assistant label");
assert(turns[0]?.label.includes("after tool failure t1"), "label should identify the specific failing tool turn");
assert(turns[0]?.label.includes("pnpm test failed"), "label should include the contradictory tool output excerpt");
assert(turns[0]?.label.includes("All checks passed"), "label should keep the useful excerpt");
assert(turns.some((turn) => turn.id === "__last_assistant__"), "picker should include a fast-path last assistant option");
const lastAssistant = turns.find((turn) => turn.id === "__last_assistant__");
assert(lastAssistant?.sourceTurnId === "a3", "last assistant fast path should point to the latest assistant turn");
assert(lastAssistant?.label.includes("Last assistant turn"), "fast path should be plainly labeled");

console.log(`picker-quality top=${turns[0]?.id} last=${lastAssistant?.sourceTurnId}`);
