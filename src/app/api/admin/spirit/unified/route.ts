import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { validateSpiritLibrary } from "@/lib/spiritSchema";
import { readSpiritJsonBlob, writeSpiritJsonBlob, SpiritJsonBlobConflict } from "@/lib/spiritJsonBlob";
import { privateShioriReady, readShioriPrivateBlob } from "@/lib/shioriPrivateBlob";
import { publicShioriHasPersonalFields } from "@/lib/shioriPrivateState";
import { startup, planUnified } from "@/lib/shioriUnified";
import { SpiritJsonImportError } from "@/lib/spiritJsonImport";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {"Cache-Control":"private, no-store, max-age=0"};
export async function GET() {
  const denied = await requireAdmin(); if (denied) return denied;
  let stage = "activation";
  try {
    if (!privateShioriReady()) throw new Error("migration");
    stage = "public-read";
    const live = await readSpiritJsonBlob();
    stage = "public-personal-fields";
    if (publicShioriHasPersonalFields(JSON.parse(live.raw))) throw new Error("personal");
    stage = "private-read";
    await readShioriPrivateBlob();
    stage = "startup-build";
    return NextResponse.json(startup(live.library, live.sha256), {headers});
  } catch (error) {
    // Never expose Blob credentials, raw library content or private reading state.
    // The stage is a fixed internal label, not derived from the exception.
    console.error("[shiori-unified-startup]", stage, error instanceof Error ? error.name : "unknown");
    return NextResponse.json({
      error: "A biztonságos Startup export jelenleg nem elérhető.",
      diagnosticStage: stage,
    }, {status:503,headers});
  }
}
export async function POST(request: Request) {
  const denied = await requireAdmin(request); if (denied) return denied;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000) return NextResponse.json({error:"A JSON túl nagy."},{status:413,headers});
    const payload = JSON.parse(raw);
    if (!payload || (payload.action !== "preview" && payload.action !== "apply")) throw new SpiritJsonImportError("Érvénytelen művelet.");
    if (!privateShioriReady()) return NextResponse.json({error:"A privát migráció még nem aktív."},{status:503,headers});
    const live = await readSpiritJsonBlob();
    if (publicShioriHasPersonalFields(JSON.parse(live.raw))) return NextResponse.json({error:"A publikus katalógus személyes adatokat tartalmaz."},{status:409,headers});
    await readShioriPrivateBlob();
    if (!live.schemaCompatible) return NextResponse.json({error:"Az élő katalógus sémája nem kompatibilis."},{status:409,headers});
    const plan = planUnified(live.library, payload.source, live.sha256);
    let validated;
    try { validated = validateSpiritLibrary(plan.candidate); }
    catch { throw new SpiritJsonImportError("Érvénytelen könyv-, téma-, kapcsolat- vagy útvonalhivatkozás. A mentés nem történt meg."); }
    if (payload.action === "preview") return NextResponse.json({ok:true,summary:plan.summary,changeCount:plan.changeCount,baseSha:live.sha256,baseEtag:live.etag},{headers});
    if (payload.confirm !== "IMPORTÁLÁS" || !plan.changeCount || payload.baseSha !== live.sha256 || payload.baseEtag !== live.etag) throw new SpiritJsonBlobConflict();
    const result = await writeSpiritJsonBlob(live, validated);
    return NextResponse.json({ok:true,result,summary:plan.summary},{headers});
  } catch (error) {
    if (error instanceof SpiritJsonImportError) return NextResponse.json({error:error.message},{status:400,headers});
    if (error instanceof SpiritJsonBlobConflict) return NextResponse.json({error:error.message},{status:409,headers});
    const message = error instanceof Error ? error.message : "";
    if (message.includes("NE importáld újra") || message.includes("NE próbáld ismételni")) return NextResponse.json({error:message,outcomeUnknown:true},{status:502,headers});
    return NextResponse.json({error:"A művelet nem sikerült; ellenőrizd a katalógus aktuális állapotát."},{status:503,headers});
  }
}
