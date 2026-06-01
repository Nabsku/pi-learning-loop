import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strict as assert } from "node:assert";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { classifyIssueWithModel } from "../src/draft.ts";

const root = mkdtempSync(join(tmpdir(), "pll-model-classify-"));
writeFileSync(join(root, ".pi-learning-loop-test-root"), "");
mkdirSync(join(root, ".pi"), { recursive: true });
writeFileSync(join(root, ".pi/learning-loop.json"), JSON.stringify({
  version: 1,
  modelOverrides: {
    classifyIssue: { model: "fake-provider/fake-classifier", thinkingLevel: "minimal" },
  },
}, null, 2));

const fakeModel = { provider: "fake-provider", id: "fake-classifier", api: "fake-api" };
const ctx = {
  modelRegistry: {
    find(provider: string, modelId: string) {
      assert.equal(provider, "fake-provider");
      assert.equal(modelId, "fake-classifier");
      return fakeModel;
    },
    async getApiKeyAndHeaders(model: unknown) {
      assert.equal(model, fakeModel);
      return { ok: true, apiKey: "fake-key" };
    },
  },
} as unknown as ExtensionContext;

const classification = await classifyIssueWithModel(root, "Assistant used npm in a pnpm repo", ctx, {
  complete: async (_model, context, options) => {
    assert.deepEqual(options, { reasoning: "minimal", apiKey: "fake-key", headers: undefined });
    assert.match(JSON.stringify(context), /Assistant used npm/);
    return {
      role: "assistant",
      api: "fake-api",
      provider: "fake-provider",
      model: "fake-classifier",
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      stopReason: "stop",
      timestamp: Date.now(),
      content: [{ type: "text", text: JSON.stringify({ classification: "wrong_tool" }) }],
    };
  },
});

assert.equal(classification, "wrong_tool");
console.log("model-classify ok");
