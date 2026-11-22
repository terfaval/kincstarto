/**
 * SHIORI-05B static-token store boundary.
 * Both tokens must identify distinct stores; merely having different secrets
 * does not prove two different Blob stores.
 *
 * This module intentionally does not fall back to the default Blob token.
 * OIDC support requires a separate, audited migration to SDK >= 2.4.0.
 */

function tokenStoreId(token: string): string | null {
  // Vercel's read-write token format: vercel_blob_rw_<storeId>_<secret>.
  // Never return/log the credential itself.
  const parts = token.split("_");
  if (parts.length < 5 || parts[0] !== "vercel" || parts[1] !== "blob" || parts[2] !== "rw") {
    return null;
  }
  const id = parts[3];
  return /^[A-Za-z0-9-]{8,128}$/.test(id) ? id : null;
}

export function assertDistinctShioriBlobTokens(publicToken: string | undefined, privateToken: string | undefined) {
  if (!publicToken || !privateToken) {
    throw new Error("SHIORI-05B: a publikus es a kulon privát Blob-token is kotelezo.");
  }
  const publicId = tokenStoreId(publicToken);
  const privateId = tokenStoreId(privateToken);
  if (!publicId || !privateId) {
    throw new Error("SHIORI-05B: nem ellenorizheto a ket token taroloazonositoja; iras letiltva.");
  }
  if (publicId === privateId) {
    throw new Error("SHIORI-05B: a ket token ugyanarra a Blob-tarolora mutat; iras letiltva.");
  }
  return { publicToken, privateToken };
}

/** Prefer the environment variables automatically provisioned by the Vercel store connection. */
export function resolveShioriPrivateBlobToken(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const connected = env.SHIORI_PRIVATE_BLOB_READ_WRITE_TOKEN;
  const legacy = env.SHIORI_PRIVATE_BLOB_TOKEN;
  if (connected && legacy && connected !== legacy) {
    throw new Error("SHIORI-05B: ket eltero privat Blob-token konfiguracio; ellenorzes leallitva.");
  }
  return connected || legacy;
}

export function requireShioriPrivateBlobToken() {
  return assertDistinctShioriBlobTokens(
    process.env.BLOB_READ_WRITE_TOKEN,
    resolveShioriPrivateBlobToken(),
  ).privateToken;
}
