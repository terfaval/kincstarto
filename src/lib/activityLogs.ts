import { join } from "node:path";
import type { ActivityLogRow } from "@/types/activity";
import { readJsonStore, writeJsonStore } from "@/lib/jsonStore";

const DATA_DIR = join(process.cwd(), "data", "body");
const LOGS_PATH = join(DATA_DIR, "activity-logs.json");
const LOGS_BLOB_PATH = "body/activity-logs.json";

export async function readActivityLogs(): Promise<ActivityLogRow[]> {
  const parsed = await readJsonStore<ActivityLogRow[]>({
    blobPath: LOGS_BLOB_PATH,
    filePath: LOGS_PATH,
    fallbackValue: [],
  });
  return Array.isArray(parsed) ? parsed : [];
}

export async function writeActivityLogs(logs: ActivityLogRow[]) {
  await writeJsonStore(
    {
      blobPath: LOGS_BLOB_PATH,
      filePath: LOGS_PATH,
    },
    logs
  );
}

export function createLogId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `log_${stamp}_${rand}`;
}
