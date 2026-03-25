import { NextResponse } from "next/server";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const DIAG_DIR = join(process.cwd(), "data", "diagnostics");
const LOG_PATH = join(DIAG_DIR, "client-errors.jsonl");

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const ua = request.headers.get("user-agent") ?? "unknown";
  console.error("[client-error]", { ua, payload });
  try {
    await mkdir(DIAG_DIR, { recursive: true });
    const entry = {
      ts: new Date().toISOString(),
      ua,
      payload,
    };
    await appendFile(LOG_PATH, `${JSON.stringify(entry)}\n`, "utf-8");
  } catch (error) {
    console.error("[client-error] failed to persist", error);
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  try {
    const raw = await readFile(LOG_PATH, "utf-8");
    const lines = raw.trim().split("\n").slice(-100);
    const entries = lines
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    return NextResponse.json({ ok: true, entries });
  } catch {
    return NextResponse.json({ ok: true, entries: [] });
  }
}
