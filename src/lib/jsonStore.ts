import { get, put, type BlobAccessType } from "@vercel/blob";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const BLOB_WRITE_ENABLED = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const BLOB_READ_ENABLED = true;
const ENV_BLOB_ACCESS = process.env.BLOB_ACCESS?.toLowerCase();
const DEFAULT_ACCESS: BlobAccessType = ENV_BLOB_ACCESS === "private" ? "private" : "public";

async function readBlobJson<T>(pathname: string, access: BlobAccessType) {
  try {
    const result = await get(pathname, { access });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const text = await new Response(result.stream).text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch (err) {
    const status = (err as { statusCode?: number; status?: number })?.statusCode ?? (err as { status?: number })?.status;
    if (status === 403 || status === 404) return null;
    const message = (err as { message?: string })?.message ?? "";
    if (message.toLowerCase().includes("token")) return null;
    if (message.includes("403") || message.includes("404")) return null;
    throw err;
  }
}

async function writeBlobJson(pathname: string, value: unknown, access: BlobAccessType) {
  const payload = JSON.stringify(value, null, 2) + "\n";
  await put(pathname, payload, { access, contentType: "application/json", allowOverwrite: true });
}

async function readLocalJson<T>(
  filePath: string,
  fallbackValue: T,
  opts: { createIfMissing?: boolean } = {}
) {
  const createIfMissing = opts.createIfMissing ?? true;
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (err) {
    if (!createIfMissing) throw err;
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(fallbackValue, null, 2) + "\n", "utf-8");
    return fallbackValue;
  }
}

async function writeLocalJson(filePath: string, value: unknown) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2) + "\n", "utf-8");
}

type ReadJsonStoreOptions<T> = {
  blobPath: string;
  filePath?: string;
  fallbackValue: T;
  access?: BlobAccessType;
  seedIfMissing?: boolean;
  createIfMissing?: boolean;
};

type WriteJsonStoreOptions = {
  blobPath: string;
  filePath?: string;
  access?: BlobAccessType;
};

export function isBlobEnabled() {
  return BLOB_WRITE_ENABLED;
}

export async function readJsonStore<T>(options: ReadJsonStoreOptions<T>): Promise<T> {
  const {
    blobPath,
    filePath,
    fallbackValue,
    access = DEFAULT_ACCESS,
    seedIfMissing = true,
    createIfMissing = true,
  } = options;

  if (BLOB_READ_ENABLED) {
    const blobValue = await readBlobJson<T>(blobPath, access);
    if (blobValue !== null) return blobValue;
    if (!options.access) {
      const alternateAccess: BlobAccessType = access === "public" ? "private" : "public";
      const alternateValue = await readBlobJson<T>(blobPath, alternateAccess);
      if (alternateValue !== null) return alternateValue;
    }
  }

  if (filePath) {
    const localValue = await readLocalJson<T>(filePath, fallbackValue, { createIfMissing });
    if (BLOB_WRITE_ENABLED && seedIfMissing) {
      await writeBlobJson(blobPath, localValue, access);
    }
    return localValue;
  }

  return fallbackValue;
}

export async function writeJsonStore(options: WriteJsonStoreOptions, value: unknown) {
  const { blobPath, filePath, access = DEFAULT_ACCESS } = options;

  if (BLOB_WRITE_ENABLED) {
    await writeBlobJson(blobPath, value, access);
    return;
  }

  if (!filePath) {
    throw new Error("Missing filePath for local JSON write.");
  }
  await writeLocalJson(filePath, value);
}
