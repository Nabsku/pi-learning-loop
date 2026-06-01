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

assert(turns[0]?.id === "__last_assistant__", "last assistant fast path should be first");
assert(turns[0]?.sourceTurnId === "a3", "last assistant fast path should point to the latest assistant turn");
assert(turns[0]?.label === "[last] last assistant response", "fast path should use a short stable last label");
assert(!turns.some((turn) => turn.id === "a3"), "last assistant should be deduped from ranked options");
const likely = turns.find((turn) => turn.id === "a2");
assert(likely?.label === "[likely] claimed success after failed tool · assistant · #a2", "suspicious assistant overclaim should use a concise likely label with stable disambiguator");
assert(likely?.evidenceExcerpt?.includes("pnpm test failed"), "contradictory tool output should remain available for preview");
assert(!likely?.label.includes("pnpm test failed"), "picker label should not include evidence excerpts");
assert(!likely?.label.includes("All checks passed"), "picker label should not include selected excerpts");
const lastAssistant = turns[0];

console.log(`picker-quality top=${turns[0]?.id} last=${lastAssistant?.sourceTurnId}`);
