import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ActivityLogRow } from "@/types/activity";

const DATA_DIR = join(process.cwd(), "data", "body");
const LOGS_PATH = join(DATA_DIR, "activity-logs.json");

async function ensureStorage() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await readFile(LOGS_PATH, "utf-8");
  } catch {
    await writeFile(LOGS_PATH, "[]", "utf-8");
  }
}

export async function readActivityLogs(): Promise<ActivityLogRow[]> {
  await ensureStorage();
  const raw = await readFile(LOGS_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed as ActivityLogRow[];
}

export async function writeActivityLogs(logs: ActivityLogRow[]) {
  await ensureStorage();
  await writeFile(LOGS_PATH, JSON.stringify(logs, null, 2), "utf-8");
}

export function createLogId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `log_${stamp}_${rand}`;
}

