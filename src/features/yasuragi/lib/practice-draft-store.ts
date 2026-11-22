import "server-only";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { get, list, put } from "@vercel/blob";
import type { PracticeScript } from "./practice-types";
import type { AuthoringProject } from "./practice-authoring";
import { HISTORY_PAGE_SIZE, blobHistoryCursor, localHistoryCursor, localHistoryPage, nextBlobHistoryCursor, type HistoryPage } from "./practice-history";

const PREFIX = "yasuragi/practice-drafts/";
const LOCAL_DIR = join(process.cwd(), "private", "yasuragi-practice-drafts");
const FILE_RE = /^[0-9]{13}-[0-9a-f-]{36}\.json$/;

export type SavedPracticeDraft = {
  draftId: string;
  createdAt: string;
  sha256: string;
  script: PracticeScript;
  authoring?: AuthoringProject;
};
export type PracticeDraftSummary = {
  draftId: string;
  createdAt: string;
  sha256: string;
  practiceId: string;
  title: string;
  version: string;
  durationSec: number;
  nodeCount: number;
  poseProposalCount: number;
  projectId: string | null;
};

function privateToken() {
  const token = process.env.YASURAGI_PRIVATE_BLOB_TOKEN;
  if (!token) {
    if (process.env.NODE_ENV === "production") throw new Error("YASURAGI_PRIVATE_BLOB_TOKEN hiányzik. Éles tervezetmentés leállítva.");
    return null;
  }
  if (token === process.env.BLOB_READ_WRITE_TOKEN || token === process.env.SHIORI_PRIVATE_BLOB_TOKEN) {
    throw new Error("A Yasuragi privát Blob tokenje nem lehet azonos másik tároló tokenjével.");
  }
  return token;
}

function fileName(draftId: string) {
  if (!FILE_RE.test(draftId)) throw new Error("Érvénytelen tervezetazonosító.");
  return draftId;
}
function pathname(draftId: string) { return `${PREFIX}${fileName(draftId)}`; }
function toSummary(item: SavedPracticeDraft): PracticeDraftSummary {
  return {
    draftId: item.draftId, createdAt: item.createdAt, sha256: item.sha256,
    practiceId: item.script.practiceId,
    title: (item.script as PracticeScript & { title?: string }).title ?? item.script.practiceId,
    version: item.script.version,
    durationSec: item.script.durationSec,
    nodeCount: item.script.nodes.length,
    poseProposalCount: item.authoring?.poseProposals.length ?? 0,
    projectId: item.authoring?.projectId ?? null,
  };
}
function parseStored(raw: string, expectedId: string): SavedPracticeDraft {
  const parsed = JSON.parse(raw) as SavedPracticeDraft;
  if (!parsed || parsed.draftId !== expectedId || !parsed.script || !parsed.sha256) throw new Error("A mentett tervezet sérült.");
  const content = parsed.authoring ? { script: parsed.script, authoring: parsed.authoring } : parsed.script;
  if (createHash("sha256").update(JSON.stringify(content)).digest("hex") !== parsed.sha256) throw new Error("A mentett tervezet tartalma nem egyezik az ellenőrzőösszeggel.");
  return parsed;
}

export async function readPracticeDraft(draftId: string): Promise<SavedPracticeDraft | null> {
  fileName(draftId);
  const token = privateToken();
  if (token) {
    const response = await get(pathname(draftId), { access: "private", token, useCache: false });
    if (!response) return null;
    if (response.statusCode !== 200 || !response.stream || response.blob?.pathname !== pathname(draftId)) throw new Error("A privát tervezet nem olvasható megbízhatóan.");
    return parseStored(await new Response(response.stream).text(), draftId);
  }
  try { return parseStored(await readFile(join(LOCAL_DIR, draftId), "utf8"), draftId); }
  catch (cause) { if ((cause as NodeJS.ErrnoException).code === "ENOENT") return null; throw cause; }
}

/** Every save creates a new immutable revision. Never overwrite a previously imported script. */
export async function savePracticeDraft(script: PracticeScript, authoring?: AuthoringProject | null): Promise<SavedPracticeDraft> {
  const now = Date.now();
  const draftId = `${now}-${randomUUID()}.json`;
  const item: SavedPracticeDraft = {
    draftId, createdAt: new Date(now).toISOString(),
    sha256: createHash("sha256").update(JSON.stringify(authoring ? { script, authoring } : script)).digest("hex"), script,
    ...(authoring ? { authoring } : {}),
  };
  const value = `${JSON.stringify(item, null, 2)}\n`;
  const token = privateToken();
  if (token) {
    try {
      const written = await put(pathname(draftId), value, { token, access: "private", allowOverwrite: false, contentType: "application/json", cacheControlMaxAge: 60 });
      if (written.pathname !== pathname(draftId)) throw new Error("Blob path mismatch");
    } catch {
      throw new Error("A privát mentés kimenetele bizonytalan. Ne ismételd automatikusan; ellenőrizd a tervezetlistát.");
    }
    const verified = await readPracticeDraft(draftId);
    if (verified?.sha256 !== item.sha256) throw new Error("A tervezet visszaellenőrzése sikertelen. Ne ismételd automatikusan.");
  } else {
    await mkdir(LOCAL_DIR, { recursive: true });
    await writeFile(join(LOCAL_DIR, draftId), value, { flag: "wx", encoding: "utf8" });
  }
  return item;
}

/** Bounded private history; cursors are storage-specific and never become public URLs.
 * Blob lists in ascending pathname order, so history pages follow oldest -> newest.
 */
export async function listPracticeDrafts(cursor: string | null = null): Promise<HistoryPage<PracticeDraftSummary>> {
  const token = privateToken();
  let ids: string[];
  let nextCursor: string | null;
  if (token) {
    const page = await list({ prefix: PREFIX, limit: HISTORY_PAGE_SIZE, token, cursor: blobHistoryCursor(cursor) });
    ids = page.blobs.map((entry) => entry.pathname.slice(PREFIX.length)).filter((id) => FILE_RE.test(id));
    nextCursor = nextBlobHistoryCursor(page.hasMore, page.cursor);
  } else {
    const afterId = localHistoryCursor(cursor, FILE_RE);
    let allIds: string[];
    try { allIds = (await readdir(LOCAL_DIR)).filter((id) => FILE_RE.test(id)); }
    catch (cause) { if ((cause as NodeJS.ErrnoException).code === "ENOENT") return { items: [], hasMore: false, nextCursor: null }; throw cause; }
    const page = localHistoryPage(allIds, afterId);
    ids = page.items;
    nextCursor = page.nextCursor;
  }
  const fetched = await Promise.all(ids.map((id) => readPracticeDraft(id)));
  return { items: fetched.filter((item): item is SavedPracticeDraft => item !== null).map(toSummary),
    nextCursor, hasMore: nextCursor !== null };
}
