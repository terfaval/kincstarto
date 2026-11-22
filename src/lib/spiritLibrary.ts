import { join } from "node:path";
import { SpiritLibrary, validateSpiritLibrary } from "./spiritSchema";
import { readJsonStore } from "./jsonStore";
import { readSpiritJsonBlob } from "./spiritJsonBlob";
import { privateShioriReady, readShioriPrivateBlob } from "./shioriPrivateBlob";
import { mergeShioriPrivateState, publicShioriHasPersonalFields } from "./shioriPrivateState";

const LIBRARY_PATH = join(process.cwd(), "data", "spirit", "library.json");
const LIBRARY_BLOB_PATH = "spirit/library.json";

export async function loadSpiritLibrary(options: { includePrivate?: boolean } = {}): Promise<SpiritLibrary> {
  if (privateShioriReady()) {
    // Never fall back to stale repository data after a private-state migration.
    const live = await readSpiritJsonBlob();
    if (publicShioriHasPersonalFields(JSON.parse(live.raw))) {
      throw new Error("A Shiori publikus Blob még személyes adatokat tartalmaz. Publikus betöltés letiltva.");
    }
    if (!options.includePrivate) return live.library;
    const { state } = await readShioriPrivateBlob();
    return mergeShioriPrivateState(live.library, state);
  }
  const parsed = await readJsonStore<unknown>({
    blobPath: LIBRARY_BLOB_PATH,
    filePath: LIBRARY_PATH,
    fallbackValue: null,
    seedIfMissing: false,
    createIfMissing: false,
  });
  return validateSpiritLibrary(parsed);
}

// Legacy unconditional whole-document writes could re-publish private data.
// Route handlers must use the versioned editorial/public and private-state APIs.
export async function saveSpiritLibrary(_library: SpiritLibrary): Promise<never> {
  throw new Error("Elavult Shiori-mentés. Használd a verzióvédett JSON/import vagy privát állapot útvonalat.");
}
