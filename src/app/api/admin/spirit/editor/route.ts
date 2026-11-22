import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { validateSpiritLibrary } from "@/lib/spiritSchema";
import { readSpiritJsonBlob, SpiritJsonBlobConflict, writeSpiritJsonBlob } from "@/lib/spiritJsonBlob";
import { privateShioriReady, readShioriPrivateBlob } from "@/lib/shioriPrivateBlob";
import { publicShioriHasPersonalFields } from "@/lib/shioriPrivateState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status, headers });
const slug = (value: unknown): value is string => typeof value === "string" && /^[a-z0-9_]+$/.test(value) && value.length <= 80;
const distinct = (items: string[]) => new Set(items).size === items.length;

type Change = { bookId?: string; tags?: string[]; related?: string[]; labelKey?: string; labelValue?: string; renameFrom?: string; renameTo?: string };

export async function POST(request: Request) {
  const rejected = await requireAdmin(request);
  if (rejected) return rejected;
  let body: { action?: string; change?: Change; baseEtag?: string; baseSha?: string; confirm?: string };
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 100_000) return fail("Túl nagy szerkesztési kérés.", 413);
    body = JSON.parse(raw);
  } catch { return fail("Érvénytelen kérés."); }
  if (body?.action !== "preview" && body?.action !== "apply") return fail("Érvénytelen művelet.");
  const change = body.change;
  if (!change || typeof change !== "object") return fail("Hiányzó módosítás.");
  try {
    if (!privateShioriReady()) return fail("A privát tárolási migráció nincs aktiválva.", 503);
    const live = await readSpiritJsonBlob();
    if (!live.schemaCompatible || publicShioriHasPersonalFields(JSON.parse(live.raw))) return fail("A publikus katalógus nem biztonságosan szerkeszthető.", 409);
    await readShioriPrivateBlob();
    const library = structuredClone(live.library);
    const changes: string[] = [];
    if (change.bookId !== undefined) {
      const book = library.books.find((item) => item.id === change.bookId);
      if (!book) return fail("Ismeretlen könyvazonosító.");
      if (change.tags !== undefined) {
        if (!Array.isArray(change.tags) || change.tags.length > 30 || !change.tags.every(slug) || !distinct(change.tags)) return fail("Érvénytelen vagy ismétlődő címkék.");
        if (JSON.stringify(book.tags ?? []) !== JSON.stringify(change.tags)) { book.tags = change.tags; changes.push(`Címkék: ${book.title}`); }
      }
      if (change.related !== undefined) {
        const ids = new Set(library.books.map((item) => item.id));
        if (!Array.isArray(change.related) || change.related.length > 4 || !change.related.every((id) => typeof id === "string" && ids.has(id) && id !== book.id) || !distinct(change.related)) return fail("Érvénytelen kapcsolódó művek (legfeljebb négy, önhivatkozás nélkül).");
        if (JSON.stringify(book.related ?? []) !== JSON.stringify(change.related)) { book.related = change.related; changes.push(`Kapcsolatok: ${book.title}`); }
      }
    }
    if (change.labelKey !== undefined || change.labelValue !== undefined) {
      if (!slug(change.labelKey) || typeof change.labelValue !== "string" || !change.labelValue.trim() || change.labelValue.length > 120) return fail("Érvénytelen címkekulcs vagy felirat.");
      library.tag_labels ??= {};
      if (library.tag_labels[change.labelKey] !== change.labelValue.trim()) { library.tag_labels[change.labelKey] = change.labelValue.trim(); changes.push(`Címkefelirat: ${change.labelKey}`); }
    }
    if (change.renameFrom !== undefined || change.renameTo !== undefined) {
      if (!slug(change.renameFrom) || !slug(change.renameTo) || change.renameFrom === change.renameTo) return fail("Érvénytelen címke-összevonás.");
      const from = change.renameFrom, to = change.renameTo;
      const affected = library.books.filter((book) => book.tags?.includes(from));
      if (!affected.length) return fail("A forráscímkét egyetlen könyv sem használja.");
      for (const book of affected) book.tags = [...new Set((book.tags ?? []).map((tag) => tag === from ? to : tag))];
      library.tag_labels ??= {};
      if (!library.tag_labels[to] && library.tag_labels[from]) library.tag_labels[to] = library.tag_labels[from];
      delete library.tag_labels[from];
      changes.push(`Címke-összevonás: ${from} → ${to} (${affected.length} könyv)`);
    }
    if (!changes.length) return fail("Nincs tényleges változás.");
    const validated = validateSpiritLibrary(library);
    if (body.action === "preview") return NextResponse.json({ ok: true, changes, baseEtag: live.etag, baseSha: live.sha256 }, { headers });
    if (body.baseEtag !== live.etag || body.baseSha !== live.sha256) throw new SpiritJsonBlobConflict();
    if (body.confirm !== "MENTÉS") return fail("Hiányzó mentési megerősítés.");
    const result = await writeSpiritJsonBlob(live, validated);
    return NextResponse.json({ ok: true, changes, result }, { headers });
  } catch (error) {
    if (error instanceof SpiritJsonBlobConflict) return fail(error.message, 409);
    const message = error instanceof Error ? error.message : "Ismeretlen hiba";
    if (message.includes("NE importáld") || message.includes("NE próbáld")) return NextResponse.json({ error: message, outcomeUnknown: true }, { status: 502, headers });
    return fail("A szerkesztés nem sikerült. Ellenőrizd az éles exportot és a mezők érvényességét.", 503);
  }
}
