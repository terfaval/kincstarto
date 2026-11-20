import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/adminAuth";
import { getYogiKnowledgeStore } from "@/lib/yogiKnowledgeStore";
import { saveYogiImageAsset } from "@/lib/yogiImageStore";
import { normalizeSlug } from "@/lib/slug";
import { isBlobEnabled } from "@/lib/jsonStore";
import { cleanupSupersededYogiImage } from "@/lib/yogiOldImageCleanup";

export const runtime = "nodejs";

// A server-side multipart upload must fit Vercel's request-body limit.
// Larger exports should first be converted to WebP or optimized PNG.
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_DIMENSION = 4096;

type ImageFormat = "png" | "webp";

function error(detail: string, status: number) {
  return NextResponse.json({ error: detail }, { status });
}

function getPngDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24) return null;
  if (!buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return null;
  }
  if (buffer.readUInt32BE(8) !== 13 || buffer.toString("ascii", 12, 16) !== "IHDR") return null;
  if (buffer.subarray(-8, -4).toString("ascii") !== "IEND") return null;
  if (!buffer.includes(Buffer.from("IDAT"))) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function getWebpDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 30 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    return null;
  }
  if (buffer.readUInt32LE(4) + 8 !== buffer.length) return null;
  const kind = buffer.toString("ascii", 12, 16);
  if (kind === "VP8X") {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }
  if (kind === "VP8L" && buffer[20] === 0x2f) {
    return {
      width: 1 + (((buffer[22] & 0x3f) << 8) | buffer[21]),
      height: 1 + (((buffer[24] & 0x0f) << 10) | (buffer[23] << 2) | (buffer[22] >> 6)),
    };
  }
  if (kind === "VP8 " && buffer.toString("hex", 23, 26) === "9d012a") {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }
  return null;
}

function detectFormat(buffer: Buffer): ImageFormat | null {
  if (getPngDimensions(buffer)) return "png";
  if (getWebpDimensions(buffer)) return "webp";
  return null;
}

export async function POST(request: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  // Keep production writes disabled if the deployment has no real admin secret.
  if (process.env.NODE_ENV === "production" && !(process.env.ADMIN_KEY ?? process.env.ADMIN_PASSWORD)) {
    return error("A szerveren nincs admin hitelesítés beállítva.", 503);
  }
  if (process.env.NODE_ENV === "production" && !isBlobEnabled()) {
    return error("A Vercel Blob íráshoz hiányzik a BLOB_READ_WRITE_TOKEN.", 503);
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return error("Másik eredetről indított feltöltés nem engedélyezett.", 403);
  }
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_BYTES + 32_768) {
    return error("Túl nagy kérés. Legfeljebb 4 MB-os PNG vagy WebP tölthető fel.", 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error("Nem sikerült beolvasni a feltöltött képet.", 400);
  }

  const poseId = form.get("pose_id");
  const expectedRef = form.get("expected_asset_ref");
  const file = form.get("file");
  if (typeof poseId !== "string" || !poseId.trim() || typeof expectedRef !== "string" || !(file instanceof File)) {
    return error("Hiányzik a pózazonosító, a jelenlegi képhivatkozás vagy a fájl.", 400);
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return error("A fájl mérete 1 bájt és 4 MB között lehet.", 413);
  }
  if (!["image/png", "image/webp", "application/octet-stream", ""].includes(file.type)) {
    return error("Csak PNG vagy WebP illusztráció tölthető fel.", 415);
  }

  const store = getYogiKnowledgeStore();
  const poses = await store.listPoses();
  const target = poses.find((pose) => pose.id === poseId);
  if (!target) return error("A megadott póz nem található.", 404);
  const previousRef = target.mannequin_angled?.asset_ref ?? "";
  if (previousRef !== expectedRef) {
    return error("A képet időközben módosították. Frissítsd az oldalt, és nézd meg újra.", 409);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const format = detectFormat(buffer);
  if (!format) return error("A fájl nem érvényes, támogatott PNG vagy WebP kép.", 415);
  const dimensions = format === "png" ? getPngDimensions(buffer) : getWebpDimensions(buffer);
  if (!dimensions || dimensions.width < 128 || dimensions.height < 128 || dimensions.width > MAX_DIMENSION || dimensions.height > MAX_DIMENSION) {
    return error("A kép mindkét oldala 128 és 4096 pixel közé kell essen.", 400);
  }

  let saved: { url: string; blobPath: string | null };
  try {
    saved = await saveYogiImageAsset({
      slug: normalizeSlug(target.slug) || normalizeSlug(target.id),
      slot: `illustration-${randomUUID().slice(0, 8)}`,
      format,
      buffer,
    });
  } catch {
    return error("A kép feltöltése nem sikerült. A jelenlegi illusztráció változatlan.", 502);
  }

  // Write just the image slot, based on freshly fetched pose data.
  // Old-image cleanup runs separately after the new reference is committed.
  try {
    const current = await store.listPoses();
    const index = current.findIndex((pose) => pose.id === poseId);
    if (index < 0 || (current[index].mannequin_angled?.asset_ref ?? "") !== expectedRef) {
      return error("Közben másik csere történt. A korábbi kép változatlan; frissítsd az oldalt.", 409);
    }
    const pose = current[index];
    const updated = {
      ...pose,
      mannequin_angled: {
        ...pose.mannequin_angled,
        asset_ref: saved.url,
        status: "verified" as const,
        warning: null,
        warning_detail: null,
      },
    };
    current[index] = updated;
    await store.savePoses(current);
    // The image is already committed. Old Blob cleanup is independently guarded
    // by a production-only switch and an operator-provided verified-backup marker.
    const cleanup = await cleanupSupersededYogiImage({
      previousUrl: previousRef,
      currentUrl: saved.url,
    });
    return NextResponse.json({
      ok: true,
      pose: updated,
      previous_asset_ref: previousRef || null,
      storage: saved.blobPath ? "blob" : "local",
      previous_blob_cleanup: cleanup,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return error("A kép feltöltődött, de az adatbázis mentése nem sikerült. A régi kép maradt aktív.", 500);
  }
}
