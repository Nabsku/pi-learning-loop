import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strict as assert } from "node:assert";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { classifyIssueWithModel } from "../src/draft.ts";

const root = mkdtempSync(join(tmpdir(), "pll-model-classify-"));
writeFileSync(join(root, ".pi-learnings-test-root"), "");
mkdirSync(join(root, ".pi"), { recursive: true });
writeFileSync(join(root, ".pi/learnings.json"), JSON.stringify({
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

const defaultRoot = mkdtempSync(join(tmpdir(), "pll-model-classify-default-"));
mkdirSync(join(defaultRoot, ".pi"), { recursive: true });
writeFileSync(join(defaultRoot, ".pi/learnings.json"), JSON.stringify({ version: 1, modelOverrides: {} }, null, 2));
const defaultModel = { provider: "user-provider", id: "user-default", api: "fake-api" };
const defaultCtx = {
  model: defaultModel,
  modelRegistry: {
    find() {
      throw new Error("default model path should not resolve a hardcoded override");
    },
    async getApiKeyAndHeaders(model: unknown) {
      assert.equal(model, defaultModel);
      return { ok: true, apiKey: "default-key", headers: { "x-default": "yes" } };
    },
  },
} as unknown as ExtensionContext;
const defaultClassification = await classifyIssueWithModel(defaultRoot, "Assistant made a weird mistake", defaultCtx, {
  complete: async (model, _context, options) => {
    assert.equal(model, defaultModel);
    assert.deepEqual(options, { reasoning: undefined, apiKey: "default-key", headers: { "x-default": "yes" } });
    return {
      role: "assistant",
      api: "fake-api",
      provider: "user-provider",
      model: "user-default",
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      stopReason: "stop",
      timestamp: Date.now(),
      content: [{ type: "text", text: JSON.stringify({ classification: "stale_data" }) }],
    };
  },
});
assert.equal(defaultClassification, "stale_data");

console.log("model-classify ok");
