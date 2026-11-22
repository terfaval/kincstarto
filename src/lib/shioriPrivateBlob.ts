import { get, head, put } from "@vercel/blob";
import { validateShioriPrivateState, type ShioriPrivateState } from "./shioriPrivateState";
import { requireShioriPrivateBlobToken } from "./shioriPrivateStoreConfig";

export const SHIORI_PRIVATE_PATH = "spirit/reading-state.json";

function privateToken() {
  return requireShioriPrivateBlobToken();
}

export function privateShioriReady() {
  return process.env.SHIORI_PRIVATE_STATE_READY === "1";
}

export async function readShioriPrivateBlob(): Promise<{ state: ShioriPrivateState; etag: string }> {
  const token = privateToken();
  const result = await get(SHIORI_PRIVATE_PATH, { access: "private", token, useCache: false });
  if (!result?.stream || result.statusCode !== 200 || result.blob?.pathname !== SHIORI_PRIVATE_PATH) {
    throw new Error("A privát olvasási adatok nem elérhetők. Mentés nem engedélyezett.");
  }
  const raw = await new Response(result.stream).text();
  const meta = await head(SHIORI_PRIVATE_PATH, { token });
  const comparableTag = (tag: string) => tag.startsWith("W/") ? tag.slice(2) : tag;
  if (meta.pathname !== SHIORI_PRIVATE_PATH || !/^"[^"\s]+"$/.test(meta.etag) ||
      comparableTag(result.blob.etag) !== meta.etag || Buffer.byteLength(raw) !== meta.size) {
    throw new Error("A privát olvasási állomány verziója nem egyezik. Mentés leállt.");
  }
  return { state: validateShioriPrivateState(JSON.parse(raw)), etag: meta.etag };
}

export async function updateShioriPrivateBlob(
  transform: (state: ShioriPrivateState) => ShioriPrivateState,
) {
  if (!privateShioriReady()) throw new Error("A privát Shiori-tároló még nincs aktiválva.");
  const snapshot = await readShioriPrivateBlob();
  const next = validateShioriPrivateState(transform(snapshot.state));
  const serialized = `${JSON.stringify(next, null, 2)}\n`;
  const token = privateToken();
  let written;
  try {
    written = await put(SHIORI_PRIVATE_PATH, serialized, {
      access: "private", token, allowOverwrite: true,
      ifMatch: snapshot.etag, contentType: "application/json", cacheControlMaxAge: 60,
    });
  } catch (error) {
    if ((error as { statusCode?: number; name?: string })?.statusCode === 412 ||
      (error as { name?: string })?.name === "BlobPreconditionFailedError") {
      throw new Error("A privát olvasási adatok időközben módosultak. Frissítsd az oldalt.");
    }
    throw new Error("A privát mentés kimenetele nem egyértelmű. Ne ismételd automatikusan.");
  }
  const after = await head(SHIORI_PRIVATE_PATH, { token });
  if (written.pathname !== SHIORI_PRIVATE_PATH || written.etag !== after.etag ||
      after.size !== Buffer.byteLength(serialized)) {
    throw new Error("A privát mentés utóellenőrzése sikertelen. Ellenőrizd az élő állapotot.");
  }
  return next;
}
