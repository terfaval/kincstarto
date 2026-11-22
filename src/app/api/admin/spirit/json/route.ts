import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { validateSpiritLibrary } from "@/lib/spiritSchema";
import { planSpiritJsonImport, SpiritJsonImportError, type SpiritJsonImportMode } from "@/lib/spiritJsonImport";
import { readSpiritJsonBlob, SpiritJsonBlobConflict, writeSpiritJsonBlob } from "@/lib/spiritJsonBlob";
import { privateShioriReady, readShioriPrivateBlob } from "@/lib/shioriPrivateBlob";
import { mergeShioriPrivateState, publicShioriHasPersonalFields } from "@/lib/shioriPrivateState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };
const MAX_BODY_BYTES = 1_500_000;

export async function GET() {
  const rejected = await requireAdmin();
  if (rejected) return rejected;
  try {
    if (!privateShioriReady()) {
      return NextResponse.json({ error: "A Shiori privát adattárolási migrációja még nincs aktiválva." }, { status: 503, headers: PRIVATE_HEADERS });
    }
    const { raw, library } = await readSpiritJsonBlob();
    if (publicShioriHasPersonalFields(JSON.parse(raw))) throw new Error("Publikus állomány nem szanitizált");
    const { state } = await readShioriPrivateBlob();
    const privateExport = `${JSON.stringify(mergeShioriPrivateState(library, state), null, 2)}\n`;
    const date = new Date().toISOString().slice(0, 10);
    return new Response(privateExport, {
      status: 200,
      headers: {
        ...PRIVATE_HEADERS,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="shiori-teljes-konyvtar-${date}.json"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof SpiritJsonBlobConflict) return NextResponse.json({ error: error.message }, { status: 409, headers: PRIVATE_HEADERS });
    return NextResponse.json({ error: "A teljes éles könyvtár nem exportálható. Ellenőrizd a Blob-kapcsolatot." }, { status: 503, headers: PRIVATE_HEADERS });
  }
}

export async function POST(request: Request) {
  const rejected = await requireAdmin(request);
  if (rejected) return rejected;
  const length = Number(request.headers.get("content-length"));
  if (length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Túl nagy JSON (maximum 1,5 MB)." }, { status: 413, headers: PRIVATE_HEADERS });
  }
  let payload: unknown;
  try {
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) throw new SpiritJsonImportError("Túl nagy JSON (maximum 1,5 MB).");
    payload = JSON.parse(text);
  } catch (error) {
    const message = error instanceof SpiritJsonImportError ? error.message : "Érvénytelen JSON.";
    return NextResponse.json({ error: message }, { status: 400, headers: PRIVATE_HEADERS });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "Hiányzó importkérés." }, { status: 400, headers: PRIVATE_HEADERS });
  }
  const requestData = payload as Record<string, unknown>;
  if (requestData.action !== "preview" && requestData.action !== "apply") {
    return NextResponse.json({ error: "Érvénytelen művelet." }, { status: 400, headers: PRIVATE_HEADERS });
  }
  if (requestData.mode !== "add" && requestData.mode !== "upsert") {
    return NextResponse.json({ error: "Válassz importmódot." }, { status: 400, headers: PRIVATE_HEADERS });
  }
  try {
    if (!privateShioriReady()) {
      return NextResponse.json({ error: "Az import a privát tárolási migráció aktiválásáig szünetel." }, { status: 503, headers: PRIVATE_HEADERS });
    }
    const live = await readSpiritJsonBlob();
    if (publicShioriHasPersonalFields(JSON.parse(live.raw))) {
      return NextResponse.json({ error: "A publikus Blob még személyes mezőket tartalmaz. Migráció szükséges." }, { status: 409, headers: PRIVATE_HEADERS });
    }
    // Import never touches private state, but must verify that it is available.
    await readShioriPrivateBlob();
    if (!live.schemaCompatible) {
      return NextResponse.json({ error: "Az éles Blob a jelenlegi sémán kívüli mezőket tartalmaz. Biztonsági okból az import leállt; a teljes export továbbra is letölthető." },
        { status: 409, headers: PRIVATE_HEADERS });
    }
    const { candidate, summary } = planSpiritJsonImport(live.library, requestData.source, requestData.mode as SpiritJsonImportMode);
    let validated;
    try {
      validated = validateSpiritLibrary(candidate);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Érvénytelen kapcsolatok vagy mezők.";
      // Never return Zod's input values (could include personal fields).
      if (detail.startsWith("Spirit library validation failed:")) throw new SpiritJsonImportError(detail.slice(0, 500));
      throw new SpiritJsonImportError("A könyvtár nem felel meg a sémának. Ellenőrizd a kötelező mezőket és a JSON-t.");
    }
    const changeCount = summary.added.length + summary.updated.length;
    if (requestData.action === "preview") {
      return NextResponse.json({
        ok: true, summary, changeCount, liveBooks: live.library.books.length,
        livePaths: live.library.paths?.length ?? 0,
        baseEtag: live.etag, baseSha: live.sha256,
        ignored: ["status", "notes", "paths", "thematic_pills", "tag_labels", "library_version"],
      }, { headers: PRIVATE_HEADERS });
    }
    if (typeof requestData.baseEtag !== "string" || typeof requestData.baseSha !== "string" ||
      requestData.baseEtag !== live.etag || requestData.baseSha !== live.sha256) {
      throw new SpiritJsonBlobConflict();
    }
    if (!changeCount || requestData.confirm !== "IMPORTÁLÁS") {
      return NextResponse.json({ error: "Nincs változás, vagy hiányzik az import megerősítése." }, { status: 400, headers: PRIVATE_HEADERS });
    }
    const result = await writeSpiritJsonBlob(live, validated);
    return NextResponse.json({ ok: true, summary, result }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    if (error instanceof SpiritJsonImportError) {
      return NextResponse.json({ error: error.message }, { status: 400, headers: PRIVATE_HEADERS });
    }
    if (error instanceof SpiritJsonBlobConflict) {
      return NextResponse.json({ error: error.message }, { status: 409, headers: PRIVATE_HEADERS });
    }
    const message = error instanceof Error ? error.message : "Ismeretlen hiba";
    if (message.includes("NE importáld újra") || message.includes("NE próbáld ismételni")) {
      return NextResponse.json({ error: message, outcomeUnknown: true }, { status: 502, headers: PRIVATE_HEADERS });
    }
    return NextResponse.json({ error: "A Blob-művelet nem sikerült. Nem történt jóváhagyott import." }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
