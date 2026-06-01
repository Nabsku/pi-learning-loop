import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import type { LearningRecord, LearningStatus } from "./types.ts";
import { loadConfig } from "./config.ts";

export function repoRoot(cwd?: string): string {
  return resolve(cwd ?? process.cwd());
}

export function learningDir(root: string, status?: LearningStatus): string {
  const base = resolve(root, loadConfig(root).learningsDir);
  return status ? join(base, status) : base;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function makeLearningId(date = new Date()): string {
  const stamp = date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").replace("T", "_");
  return `learn_${stamp}_${randomBytes(3).toString("hex")}`;
}

export function safeLearningId(id: string): string {
  if (!/^learn_[A-Za-z0-9_Z]+_[a-f0-9]{6}$/.test(id)) throw new Error(`Invalid learning id: ${id}`);
  return id;
}

function recordPath(root: string, status: LearningStatus, id: string): string {
  const safeId = safeLearningId(id);
  const path = resolve(learningDir(root, status), `${safeId}.json`);
  const base = resolve(learningDir(root));
  if (!path.startsWith(`${base}/`)) throw new Error("Learning path escaped repo");
  return path;
}

function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

export function createLearning(root: string, partial: Pick<LearningRecord, "source" | "issue" | "classification" | "recommendedTarget">): LearningRecord {
  const at = nowIso();
  const record: LearningRecord = { version: 1, id: makeLearningId(), createdAt: at, updatedAt: at, root, status: "pending", ...partial };
  writeJson(recordPath(root, "pending", record.id), record);
  return record;
}

export function readLearning(root: string, id: string): LearningRecord {
  for (const status of ["pending", "applied", "rejected"] as const) {
    const path = recordPath(root, status, id);
    if (existsSync(path)) return JSON.parse(readFileSync(path, "utf8")) as LearningRecord;
  }
  throw new Error(`Learning not found: ${id}`);
}

export function saveLearning(root: string, record: LearningRecord): LearningRecord {
  record.updatedAt = nowIso();
  writeJson(recordPath(root, record.status, record.id), record);
  return record;
}

export function moveLearning(root: string, record: LearningRecord, status: LearningStatus): LearningRecord {
  const oldPath = recordPath(root, record.status, record.id);
  record.status = status;
  record.updatedAt = nowIso();
  const newPath = recordPath(root, status, record.id);
  writeJson(newPath, record);
  if (existsSync(oldPath) && oldPath !== newPath) renameSync(oldPath, `${oldPath}.moved`);
  return record;
}

export function listLearnings(root: string, status: LearningStatus = "pending"): LearningRecord[] {
  const dir = learningDir(root, status);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => name.endsWith(".json")).sort().map((name) => JSON.parse(readFileSync(join(dir, name), "utf8")) as LearningRecord);
}

export function bounded(text: string, max = 4000): string {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}\n...[truncated]`;
}
