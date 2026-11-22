import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { get, list, put } from "@vercel/blob";
import { YASURAGI_REVIEW_FORMAT, type EditorialAttestations } from "./practice-publication";
import { HISTORY_PAGE_SIZE, blobHistoryCursor, localHistoryCursor, localHistoryPage, nextBlobHistoryCursor, type HistoryPage } from "./practice-history";

const PREFIX = "yasuragi/practice-reviews/";
const LOCAL = join(process.cwd(), "private", "yasuragi-practice-reviews");
const DRAFT_RE = /^[0-9]{13}-[0-9a-f-]{36}\.json$/;
const ENTRY_RE = /^[0-9]{13}-[0-9a-f-]{36}\.json$/;
export type PracticeReviewReceipt = {
  format: typeof YASURAGI_REVIEW_FORMAT;
  receiptId: string;
  draftId: string;
  scriptSha256: string;
  librarySha256: string;
  createdAt: string;
  attestations: EditorialAttestations;
  kind: "editorial-signoff";
};
export const digestReviewInput = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const safeDraft = (draftId: string) => {
  if (!DRAFT_RE.test(draftId)) throw new Error("Érvénytelen gyakorlásverzió.");
  return draftId.slice(0, -5);
};
function token() {
  const value = process.env.YASURAGI_PRIVATE_BLOB_TOKEN;
  if (!value) {
    if (process.env.NODE_ENV === "production") throw new Error("A privát Yasuragi tároló nincs konfigurálva.");
    return null;
  }
  if (value === process.env.BLOB_READ_WRITE_TOKEN || value === process.env.SHIORI_PRIVATE_BLOB_TOKEN) throw new Error("A privát Yasuragi token nem osztható meg másik tárolóval.");
  return value;
}
function path(draftId: string, receiptId: string) { return `${PREFIX}${safeDraft(draftId)}/${receiptId}`; }
function checked(value: string, draftId: string): PracticeReviewReceipt {
  const record = JSON.parse(value) as PracticeReviewReceipt;
  if (record?.format !== YASURAGI_REVIEW_FORMAT || record.draftId !== draftId || !ENTRY_RE.test(record.receiptId) ||
      !/^[a-f0-9]{64}$/.test(record.scriptSha256) || !/^[a-f0-9]{64}$/.test(record.librarySha256) ||
      record.attestations?.scriptReviewed !== true || record.attestations.movementReviewed !== true ||
      record.attestations.previewChecked !== true || record.kind !== "editorial-signoff") throw new Error("A jóváhagyási napló sérült.");
  return record;
}
export async function saveReviewReceipt(draftId: string, scriptSha256: string, librarySha256: string, attestations: EditorialAttestations): Promise<PracticeReviewReceipt> {
  safeDraft(draftId);
  const now = Date.now();
  const receipt: PracticeReviewReceipt = {
    format: YASURAGI_REVIEW_FORMAT, receiptId: `${now}-${randomUUID()}.json`,
    draftId, scriptSha256, librarySha256, createdAt: new Date(now).toISOString(),
    kind: "editorial-signoff", attestations,
  };
  const contents = `${JSON.stringify(receipt, null, 2)}\n`;
  const storeToken = token();
  if (storeToken) {
    try {
      const written = await put(path(draftId, receipt.receiptId), contents, { token: storeToken, access: "private", allowOverwrite: false, contentType: "application/json", cacheControlMaxAge: 60 });
      if (written.pathname !== path(draftId, receipt.receiptId)) throw new Error("Review receipt path mismatch");
    } catch { throw new Error("A jóváhagyás mentésének kimenetele bizonytalan. Ellenőrizd a naplót; ne ismételd automatikusan."); }
    const confirmed = await readReviewReceipt(draftId, receipt.receiptId);
    if (!confirmed || confirmed.librarySha256 !== librarySha256) throw new Error("A jóváhagyás visszaellenőrzése sikertelen. Ne ismételd automatikusan.");
  } else {
    await mkdir(join(LOCAL, safeDraft(draftId)), { recursive: true });
    await writeFile(join(LOCAL, safeDraft(draftId), receipt.receiptId), contents, { encoding: "utf8", flag: "wx" });
  }
  return receipt;
}
async function readReviewReceipt(draftId: string, receiptId: string): Promise<PracticeReviewReceipt | null> {
  if (!ENTRY_RE.test(receiptId)) throw new Error("Érvénytelen naplóazonosító.");
  const storeToken = token();
  if (storeToken) {
    const result = await get(path(draftId, receiptId), { access: "private", token: storeToken, useCache: false });
    if (!result) return null;
    if (result.statusCode !== 200 || result.blob?.pathname !== path(draftId, receiptId) || !result.stream) throw new Error("Nem biztonságos naplóolvasás.");
    return checked(await new Response(result.stream).text(), draftId);
  }
  try { return checked(await readFile(join(LOCAL, safeDraft(draftId), receiptId), "utf8"), draftId); }
  catch (cause) { if ((cause as NodeJS.ErrnoException).code === "ENOENT") return null; throw cause; }
}
/** Read one bounded page of immutable receipts, ordered by ascending receipt ID. */
export async function listReviewReceipts(draftId: string, cursor: string | null = null): Promise<HistoryPage<PracticeReviewReceipt>> {
  const prefix = `${PREFIX}${safeDraft(draftId)}/`;
  const storeToken = token();
  let ids: string[];
  let nextCursor: string | null;
  if (storeToken) {
    const page = await list({ prefix, token: storeToken, limit: HISTORY_PAGE_SIZE, cursor: blobHistoryCursor(cursor) });
    ids = page.blobs.map((item) => item.pathname.slice(prefix.length)).filter((id) => ENTRY_RE.test(id));
    nextCursor = nextBlobHistoryCursor(page.hasMore, page.cursor);
  } else {
    const afterId = localHistoryCursor(cursor, ENTRY_RE);
    let allIds: string[];
    try { allIds = (await readdir(join(LOCAL, safeDraft(draftId)))).filter((id) => ENTRY_RE.test(id)); }
    catch (cause) { if ((cause as NodeJS.ErrnoException).code === "ENOENT") return { items: [], nextCursor: null, hasMore: false }; throw cause; }
    const page = localHistoryPage(allIds, afterId);
    ids = page.items;
    nextCursor = page.nextCursor;
  }
  const items = await Promise.all(ids.map((id) => readReviewReceipt(draftId, id)));
  return { items: items.filter((item): item is PracticeReviewReceipt => item !== null),
    nextCursor, hasMore: nextCursor !== null };
}

/** Scan only object names, then fetch the newest receipt once. Never assume 100 is enough. */
export async function latestReviewReceipt(draftId: string): Promise<PracticeReviewReceipt | null> {
  const prefix = `${PREFIX}${safeDraft(draftId)}/`;
  const storeToken = token();
  if (!storeToken) {
    let ids: string[];
    try { ids = (await readdir(join(LOCAL, safeDraft(draftId)))).filter((id) => ENTRY_RE.test(id)); }
    catch (cause) { if ((cause as NodeJS.ErrnoException).code === "ENOENT") return null; throw cause; }
    ids.sort();
    return ids.length ? readReviewReceipt(draftId, ids[ids.length - 1]) : null;
  }
  let cursor: string | undefined;
  let newest: string | null = null;
  const seen = new Set<string>();
  for (let page = 0; page < 1000; page++) {
    const result = await list({ prefix, token: storeToken, limit: 1000, cursor });
    for (const entry of result.blobs) {
      const id = entry.pathname.slice(prefix.length);
      if (ENTRY_RE.test(id) && (!newest || id > newest)) newest = id;
    }
    if (!result.hasMore) return newest ? readReviewReceipt(draftId, newest) : null;
    if (!result.cursor || seen.has(result.cursor)) throw new Error("A jóváhagyási napló lapozása nem halad előre.");
    seen.add(result.cursor);
    cursor = result.cursor;
  }
  throw new Error("A jóváhagyási napló meghaladta a biztonságos olvasási határt.");
}
