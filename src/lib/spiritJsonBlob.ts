import { createHash } from "node:crypto";
import { get, head, put, type BlobAccessType } from "@vercel/blob";
import { validateSpiritLibrary, type SpiritLibrary } from "./spiritSchema";
import { privateShioriReady, readShioriPrivateBlob } from "./shioriPrivateBlob";
import { publicShioriHasPersonalFields, publicShioriJson } from "./shioriPrivateState";

const PATH = "spirit/library.json";

export class SpiritJsonBlobConflict extends Error {
  constructor() {
    super("A könyvtár időközben módosult. Tölts le új exportot, és készíts új előnézetet.");
    this.name = "SpiritJsonBlobConflict";
  }
}
export const shioriRawSha = (raw: string) => createHash("sha256").update(raw).digest("hex");

// Zod strips unknown keys by default. Before an editorial import, ensure
// serializing its parsed candidate would not silently drop future schema fields.
function hasDroppedFields(original: unknown, parsed: unknown): boolean {
  if (Array.isArray(original)) {
    return !Array.isArray(parsed) || original.length !== parsed.length ||
      original.some((value, index) => hasDroppedFields(value, parsed[index]));
  }
  if (original !== null && typeof original === "object") {
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return true;
    return Object.entries(original).some(([key, value]) =>
      !Object.hasOwn(parsed, key) || hasDroppedFields(value, (parsed as Record<string, unknown>)[key]));
  }
  return original !== parsed;
}
function comparableTag(etag: string | undefined) {
  if (!etag) return null;
  const value = etag.startsWith("W/") ? etag.slice(2) : etag;
  return /^"[^"\x00-\x20\x7f]+"$/.test(value) ? value : null;
}

export async function readSpiritJsonBlob(): Promise<{
  library: SpiritLibrary;
  raw: string;
  etag: string;
  sha256: string;
  access: BlobAccessType;
  schemaCompatible: boolean;
}> {
  // NEVER use the repo's outdated fallback snapshot for JSON import/export.
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("Nincs csatlakoztatott Vercel Blob. Az export/import nem használhat helyi tartalékot.");
  }
  const access: BlobAccessType = process.env.BLOB_ACCESS === "private" ? "private" : "public";
  if (privateShioriReady() && access !== "public") {
    throw new Error("A Shiori publikus katalógusa nem használhatja a privát Blob hozzáférési módot.");
  }
  const result = await get(PATH, access === "private" ? { access, useCache: false } : { access });
  if (!result?.stream || result.statusCode !== 200 || result.blob?.pathname !== PATH) {
    throw new Error("Nem olvasható a Shiori éles Blob-fájlja. A művelet leállt.");
  }
  const raw = await new Response(result.stream).text();
  const meta = await head(PATH);
  if (meta?.pathname !== PATH || comparableTag(meta.etag) !== meta.etag ||
      comparableTag(result.blob.etag) !== meta.etag ||
      meta.size !== Buffer.byteLength(raw, "utf8")) {
    throw new SpiritJsonBlobConflict();
  }
  const original = JSON.parse(raw) as unknown;
  const library = validateSpiritLibrary(original);
  return { library, raw, etag: meta.etag, sha256: shioriRawSha(raw), access,
    schemaCompatible: !hasDroppedFields(original, library) };
}

export async function writeSpiritJsonBlob(
  snapshot: Awaited<ReturnType<typeof readSpiritJsonBlob>>,
  library: SpiritLibrary,
) {
  if (!privateShioriReady()) throw new Error("A biztonságos Shiori-import a privát tároló aktiválásáig szünetel.");
  if (publicShioriHasPersonalFields(JSON.parse(snapshot.raw))) {
    throw new Error("A publikus katalógus még személyes mezőket tartalmaz. Először végezd el a Shiori migrációját.");
  }
  // Fail closed if private state is missing: never publish a full legacy library.
  await readShioriPrivateBlob();
  const raw = publicShioriJson(library);
  let uploaded;
  try {
    uploaded = await put(PATH, raw, {
      access: snapshot.access, contentType: "application/json",
      allowOverwrite: true, ifMatch: snapshot.etag,
    });
  } catch (error) {
    if ((error as { name?: string; statusCode?: number })?.name === "BlobPreconditionFailedError" ||
      (error as { statusCode?: number })?.statusCode === 412) {
      throw new SpiritJsonBlobConflict();
    }
    throw new Error("A feltöltés eredménye bizonytalan. NE próbáld ismételni; előbb ellenőrizd az éles exportot.");
  }
  try {
    const after = await head(PATH);
    if (uploaded.pathname !== PATH || after.pathname !== PATH ||
        !uploaded.etag || uploaded.etag === snapshot.etag ||
        uploaded.etag !== after.etag || after.size !== Buffer.byteLength(raw, "utf8")) {
      throw new Error("Metadata mismatch");
    }
  } catch {
    throw new Error("A feltöltés megtörténhetett, de az utóellenőrzés nem sikerült. NE importáld újra; ellenőrizd az exportot.");
  }
  return { sha256: shioriRawSha(raw), books: library.books.length, paths: library.paths?.length ?? 0 };
}
