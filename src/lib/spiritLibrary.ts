import { join } from "node:path";
import { SpiritLibrary, validateSpiritLibrary } from "./spiritSchema";
import { readJsonStore, writeJsonStore } from "./jsonStore";

const LIBRARY_PATH = join(process.cwd(), "data", "spirit", "library.json");
const LIBRARY_BLOB_PATH = "spirit/library.json";

export async function loadSpiritLibrary(): Promise<SpiritLibrary> {
  const parsed = await readJsonStore<unknown>({
    blobPath: LIBRARY_BLOB_PATH,
    filePath: LIBRARY_PATH,
    fallbackValue: null,
    createIfMissing: false,
  });
  return validateSpiritLibrary(parsed);
}

export async function saveSpiritLibrary(library: SpiritLibrary) {
  await writeJsonStore(
    {
      blobPath: LIBRARY_BLOB_PATH,
      filePath: LIBRARY_PATH,
    },
    library
  );
}
