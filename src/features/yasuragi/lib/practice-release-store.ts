import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { BlobNotFoundError, BlobPreconditionFailedError, get, head, list, put } from "@vercel/blob";
import {
  HEAD_FORMAT, PUBLICATION_ID, RELEASE_FORMAT, RELEASE_ID, PublicationConflict,
  assertPublicationTransition, digestRelease, publicSummary, publishedRelease, validHead, validRelease,
  type PublicationHead, type PublicRelease, type PublicPracticeSummary,
} from "./practice-release-core";
import type { PosePreview, PracticeScript } from "./practice-types";

const HEADS = "yasuragi/publication-heads/";
const RELEASES = "yasuragi/publication-releases/";
const LOCAL = join(process.cwd(), "private", "yasuragi-publications");
const MAX_PAGES = 200;

function assertPracticeId(id: string) {
  if (!PUBLICATION_ID.test(id)) throw new Error("Érvénytelen gyakorlásazonosító.");
}
function storageToken(): string | null {
  const token = process.env.YASURAGI_PUBLICATION_BLOB_TOKEN;
  if (!token) {
    if (process.env.NODE_ENV === "production") throw new Error("A Yasuragi kiadástárolója nincs konfigurálva.");
    return null;
  }
  if ([process.env.YASURAGI_PRIVATE_BLOB_TOKEN, process.env.BLOB_READ_WRITE_TOKEN, process.env.SHIORI_PRIVATE_BLOB_TOKEN]
      .filter(Boolean).includes(token)) throw new Error("A kiadástároló kizárólagos, privát Blob-tokent igényel.");
  return token;
}
const headPath = (id: string) => `${HEADS}${id}.json`;
const releasePath = (id: string, releaseId: string) => `${RELEASES}${id}/${releaseId}`;
const localHead = (id: string) => join(LOCAL, "heads", `${id}.json`);
const localRelease = (id: string, releaseId: string) => join(LOCAL, "releases", id, releaseId);

async function blobHead(id: string, token: string): Promise<{ value: PublicationHead; etag: string } | null> {
  let info: Awaited<ReturnType<typeof head>>;
  try { info = await head(headPath(id), { token }); }
  catch (cause) { if (cause instanceof BlobNotFoundError) return null; throw cause; }
  const response = await get(headPath(id), { token, access: "private", useCache: false });
  if (!response || response.statusCode !== 200 || !response.stream || response.blob.pathname !== headPath(id) || response.blob.etag !== info.etag) {
    throw new Error("A kiadási pointer nem olvasható konzisztensen.");
  }
  const value: unknown = JSON.parse(await new Response(response.stream).text());
  const again = await head(headPath(id), { token });
  if (again.etag !== info.etag || !validHead(value, id)) throw new Error("A kiadási pointer megváltozott vagy sérült.");
  return { value, etag: info.etag };
}
async function readHead(id: string): Promise<{ value: PublicationHead; etag: string | null } | null> {
  assertPracticeId(id);
  const token = storageToken();
  if (token) return blobHead(id, token);
  try {
    const raw = await readFile(localHead(id), "utf8");
    const value: unknown = JSON.parse(raw);
    if (!validHead(value, id)) throw new Error("Sérült helyi kiadási pointer.");
    return { value, etag: null };
  } catch (cause) { if ((cause as NodeJS.ErrnoException).code === "ENOENT") return null; throw cause; }
}
async function readRelease(id: string, releaseId: string): Promise<PublicRelease> {
  assertPracticeId(id);
  if (!RELEASE_ID.test(releaseId)) throw new Error("Érvénytelen kiadásazonosító.");
  const token = storageToken();
  let raw: string;
  if (token) {
    const response = await get(releasePath(id, releaseId), { token, access: "private", useCache: false });
    if (!response || response.statusCode !== 200 || !response.stream || response.blob.pathname !== releasePath(id, releaseId)) {
      throw new Error("A publikált kiadási pillanatkép nem elérhető.");
    }
    raw = await new Response(response.stream).text();
  } else raw = await readFile(localRelease(id, releaseId), "utf8");
  const value: unknown = JSON.parse(raw);
  if (!validRelease(value, id, releaseId)) throw new Error("Sérült gyakorláskiadás.");
  return value;
}

export async function readPublicPractice(id: string): Promise<PublicRelease | null> {
  assertPracticeId(id);
  const state = await readHead(id);
  if (!state || state.value.status !== "published") return null;
  const release = await readRelease(id, state.value.releaseId);
  if (!publishedRelease(state.value, release)) throw new Error("A kiadás ellenőrzőösszege hibás.");
  // A concurrent revocation must never leave a stale public playback result.
  const after = await readHead(id);
  if (!after || after.value.status !== "published" || after.value.releaseId !== state.value.releaseId ||
      after.value.releaseSha256 !== state.value.releaseSha256) return null;
  return release;
}

async function listPracticeIds(): Promise<string[]> {
  const token = storageToken();
  if (!token) {
    try { return (await readdir(join(LOCAL, "heads"))).filter((x) => x.endsWith(".json") && PUBLICATION_ID.test(x.slice(0, -5))).map((x) => x.slice(0, -5)).sort(); }
    catch (cause) { if ((cause as NodeJS.ErrnoException).code === "ENOENT") return []; throw cause; }
  }
  const ids = new Set<string>();
  const seen = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = await list({ prefix: HEADS, token, limit: 1000, ...(cursor ? { cursor } : {}) });
    for (const item of batch.blobs) {
      const file = item.pathname.slice(HEADS.length);
      if (file.endsWith(".json") && PUBLICATION_ID.test(file.slice(0, -5))) ids.add(file.slice(0, -5));
    }
    if (!batch.hasMore) return [...ids].sort();
    if (!batch.cursor || seen.has(batch.cursor)) throw new Error("A publikus katalógus lapozása megakadt.");
    seen.add(batch.cursor); cursor = batch.cursor;
  }
  throw new Error("A kiadásindex túl nagy; lapozható indexre van szükség.");
}

export async function listActivePublicReleases(): Promise<PublicRelease[]> {
  const ids = await listPracticeIds();
  // Bound simultaneous Blob reads to keep the public catalogue predictable.
  const releases: PublicRelease[] = [];
  for (let start = 0; start < ids.length; start += 12) {
    const batch = await Promise.all(ids.slice(start, start + 12).map((id) => readPublicPractice(id)));
    for (const release of batch) if (release) releases.push(release);
  }
  return releases;
}

export async function listPublicPractices(): Promise<PublicPracticeSummary[]> {
  return (await listActivePublicReleases()).map(publicSummary)
    .sort((a, b) => a.title.localeCompare(b.title, "hu") || a.practiceId.localeCompare(b.practiceId));
}

export async function readPublicationStatus(id: string): Promise<{ status: "none" | "published" | "revoked"; releaseId: string | null; updatedAt: string | null }> {
  const value = (await readHead(id))?.value;
  return { status: value?.status ?? "none", releaseId: value?.releaseId ?? null, updatedAt: value?.updatedAt ?? null };
}

async function commitHead(id: string, next: PublicationHead, expectedReleaseId: string | null, expectedStatus: "none" | "published" | "revoked"): Promise<void> {
  const token = storageToken();
  if (token) {
    const current = await blobHead(id, token);
    assertPublicationTransition(current?.value ?? null, expectedReleaseId, expectedStatus);
    try {
      await put(headPath(id), JSON.stringify(next), {
        token, access: "private", contentType: "application/json", cacheControlMaxAge: 60,
        ...(current ? { allowOverwrite: true, ifMatch: current.etag } : { allowOverwrite: false }),
      });
    } catch (cause) {
      if (cause instanceof BlobPreconditionFailedError || [409, 412].includes((cause as { statusCode?: number }).statusCode ?? 0) ||
          (cause instanceof Error && /already exists/i.test(cause.message))) throw new PublicationConflict();
      throw new Error("A kiadási pointer mentése bizonytalan. Ellenőrizd az állapotot; ne ismételd automatikusan.");
    }
    return;
  }
  const path = localHead(id);
  const lock = `${path}.lock`;
  await mkdir(join(LOCAL, "heads"), { recursive: true });
  try { await mkdir(lock); }
  catch (cause) { if ((cause as NodeJS.ErrnoException).code === "EEXIST") throw new PublicationConflict("A gyakorlás kiadása éppen módosul. Ellenőrizd az állapotot."); throw cause; }
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    const existing = await readHead(id);
    assertPublicationTransition(existing?.value ?? null, expectedReleaseId, expectedStatus);
    await writeFile(temp, JSON.stringify(next), { encoding: "utf8", flag: "wx" });
    await rename(temp, path);
  } finally {
    await rm(temp, { force: true }).catch(() => undefined);
    await rm(lock, { recursive: true, force: true });
  }
}

export async function publishPractice(input: { script: PracticeScript; poses: Record<string, PosePreview>; librarySha256: string }): Promise<PublicRelease> {
  const script = input.script;
  assertPracticeId(script.practiceId);
  const previous = await readHead(script.practiceId);
  const now = Date.now();
  const releaseId = `${now}-${randomUUID()}.json`;
  const release: PublicRelease = {
    format: RELEASE_FORMAT, releaseId, practiceId: script.practiceId,
    version: script.version, title: (script as PracticeScript & { title?: string }).title ?? script.practiceId,
    durationSec: script.durationSec, publishedAt: new Date(now).toISOString(), librarySha256: input.librarySha256,
    script: JSON.parse(JSON.stringify(script)) as PracticeScript,
    poses: JSON.parse(JSON.stringify(input.poses)) as Record<string, PosePreview>,
  };
  if (!validRelease(release, release.practiceId, release.releaseId)) throw new Error("Érvénytelen kiadási adatok.");
  const token = storageToken();
  const value = JSON.stringify(release);
  if (token) {
    const saved = await put(releasePath(script.practiceId, releaseId), value, { token, access: "private", allowOverwrite: false, contentType: "application/json" });
    if (saved.pathname !== releasePath(script.practiceId, releaseId)) throw new Error("A kiadás mentése nem ellenőrizhető.");
  } else {
    await mkdir(join(LOCAL, "releases", script.practiceId), { recursive: true });
    await writeFile(localRelease(script.practiceId, releaseId), value, { encoding: "utf8", flag: "wx" });
  }
  if (digestRelease(await readRelease(script.practiceId, releaseId)) !== digestRelease(release)) throw new Error("A kiadás visszaellenőrzése nem sikerült.");
  await commitHead(script.practiceId, {
    format: HEAD_FORMAT, practiceId: script.practiceId, status: "published", releaseId,
    releaseSha256: digestRelease(release), updatedAt: new Date().toISOString(),
  }, previous?.value.releaseId ?? null, previous?.value.status ?? "none");
  return release;
}

export async function revokePractice(id: string, expectedReleaseId: string): Promise<void> {
  assertPracticeId(id);
  if (!RELEASE_ID.test(expectedReleaseId)) throw new Error("Érvénytelen kiadásazonosító.");
  const previous = await readHead(id);
  if (!previous || previous.value.status !== "published" || previous.value.releaseId !== expectedReleaseId) throw new PublicationConflict();
  await commitHead(id, { ...previous.value, status: "revoked", updatedAt: new Date().toISOString() }, expectedReleaseId, "published");
}
