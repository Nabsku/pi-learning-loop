import { recentPickableTurns } from "../src/interactive.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const ctx = {
  sessionManager: {
    getEntries() {
      return [
        { id: "u1", type: "message", timestamp: "2026-06-01T10:00:00.000Z", message: { role: "user", content: "Check all files" } },
        { id: "t1", type: "message", timestamp: "2026-06-01T10:01:00.000Z", message: { role: "tool", content: "npm test failed with exit code 1" } },
        { id: "t2", type: "message", timestamp: "2026-06-01T10:02:00.000Z", message: { role: "tool", content: "pnpm lint failed with exit code 1" } },
        { id: "a1", type: "message", timestamp: "2026-06-01T10:03:00.000Z", message: { role: "assistant", content: "I will fix both." } },
        { id: "a2", type: "message", timestamp: "2026-06-01T10:04:00.000Z", message: { role: "assistant", content: "I verified it works." } },
        { id: "a3", type: "message", timestamp: "2026-06-01T10:05:00.000Z", message: { role: "assistant", content: "I checked again." } },
      ];
    },
  },
} as never;

const turns = recentPickableTurns(ctx, 10);
const labels = turns.map((turn) => turn.label);
assert(new Set(labels).size === labels.length, `picker labels must be unique for index-based selection: ${labels.join("|")}`);
assert(!labels.some((label) => label.includes("npm test failed") || label.includes("pnpm lint failed") || label.includes("verified it works")), "unique labels must still avoid excerpts/evidence");

console.log("picker-label-unique ok");
