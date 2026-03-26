import { NextResponse } from "next/server";
import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireAdmin } from "@/lib/adminAuth";
import type { ReaderBlock, ReaderTone } from "@/features/meditations/lib/meditation-types";

export const runtime = "nodejs";

const MEDITATIONS_DIR = join(process.cwd(), "data", "meditations");
const ID_RE = /^[A-Za-z0-9_-]+$/;

const TONE_SET = new Set<ReaderTone>(["soft", "neutral", "deep"]);

function isValidBlock(block: any): block is ReaderBlock {
  if (!block || typeof block !== "object") return false;
  if (block.type === "text") {
    return typeof block.content === "string" && TONE_SET.has(block.tone);
  }
  if (block.type === "pause") {
    return Number.isFinite(block.duration_ms) && block.duration_ms >= 0;
  }
  return false;
}

export async function POST(request: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const payload = await request.json().catch(() => null);
  if (!payload?.id || !payload?.blocks) {
    return NextResponse.json({ error: "Missing id or blocks" }, { status: 400 });
  }

  const id = String(payload.id);
  if (!ID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  if (!Array.isArray(payload.blocks) || !payload.blocks.every(isValidBlock)) {
    return NextResponse.json({ error: "Invalid blocks" }, { status: 400 });
  }

  const filePath = join(MEDITATIONS_DIR, `${id}.json`);
  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch (error) {
    return NextResponse.json({ error: "Meditation not found" }, { status: 404 });
  }

  let meditation: any;
  try {
    meditation = JSON.parse(raw);
  } catch (error) {
    return NextResponse.json({ error: "Invalid meditation JSON" }, { status: 400 });
  }

  if (!meditation || meditation.id !== id) {
    return NextResponse.json({ error: "Meditation id mismatch" }, { status: 400 });
  }

  if (!meditation.reader || !Array.isArray(meditation.reader.blocks)) {
    meditation.reader = { ...(meditation.reader ?? {}), blocks: [] };
  }

  meditation.reader.blocks = payload.blocks;

  const tmp = `${filePath}.tmp`;
  try {
    await writeFile(tmp, JSON.stringify(meditation, null, 2) + "\n", "utf-8");
    await rename(tmp, filePath);
  } catch (error) {
    return NextResponse.json({ error: "Failed to write meditation file" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
