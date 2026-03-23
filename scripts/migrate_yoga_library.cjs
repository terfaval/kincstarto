const fs = require("node:fs");
const path = require("node:path");

const DATA_DIR = path.join(process.cwd(), "data", "body");
const LOGS_PATH = path.join(DATA_DIR, "activity-logs.json");
const LIBRARY_PATH = path.join(DATA_DIR, "yoga-library.json");

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(LOGS_PATH)) fs.writeFileSync(LOGS_PATH, "[]", "utf-8");
}

function createYogaId() {
  if (globalThis.crypto && "randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `yoga_${stamp}_${rand}`;
}

function extractLink(metadata) {
  if (!metadata || typeof metadata !== "object") return null;
  const link = metadata.link;
  return typeof link === "string" && link.trim() ? link.trim() : null;
}

function yogaEntryKey(entry) {
  if (entry.link) return `link:${entry.link.trim()}`;
  return `meta:${entry.category}|${entry.label}|${entry.duration_minutes ?? ""}|${entry.intensity ?? ""}`;
}

function run() {
  ensureStorage();
  const raw = fs.readFileSync(LOGS_PATH, "utf-8");
  const logs = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
  const libraryMap = new Map();
  const now = new Date().toISOString();

  const updatedLogs = logs.map((log) => {
    if (log.activity_type !== "yoga") return log;
    const link = extractLink(log.metadata);
    const entryCandidate = {
      label: log.label,
      category: log.category,
      duration_minutes: log.duration_minutes ?? null,
      intensity: log.intensity ?? null,
      link,
    };
    const key = yogaEntryKey(entryCandidate);
    let entry = libraryMap.get(key);
    if (!entry) {
      entry = {
        id: createYogaId(),
        label: entryCandidate.label,
        category: entryCandidate.category,
        duration_minutes: entryCandidate.duration_minutes,
        intensity: entryCandidate.intensity,
        link: entryCandidate.link,
        created_at: log.created_at ?? now,
        updated_at: log.updated_at ?? now,
      };
      libraryMap.set(key, entry);
    }
    return { ...log, yoga_id: entry.id };
  });

  fs.writeFileSync(LIBRARY_PATH, JSON.stringify(Array.from(libraryMap.values()), null, 2) + "\n", "utf-8");
  fs.writeFileSync(LOGS_PATH, JSON.stringify(updatedLogs, null, 2) + "\n", "utf-8");

  console.log(`Yoga library entries: ${libraryMap.size}`);
  console.log(`Logs updated: ${updatedLogs.length}`);
}

run();
