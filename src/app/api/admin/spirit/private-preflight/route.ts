/**
 * SHIORI-05B/2: authenticated, read-only Vercel-runtime Blob preflight.
 * Secrets configured as Vercel Secret cannot be recovered through `vercel env pull`.
 * This endpoint must NEVER return token values, URLs or raw catalog/private content.
 */
import { NextResponse } from "next/server";
import { get, head, list } from "@vercel/blob";
import { requireAdmin } from "@/lib/adminAuth";
import { resolveShioriPrivateBlobToken } from "@/lib/shioriPrivateStoreConfig";
import { validateSpiritLibrary } from "@/lib/spiritSchema";
import { publicShioriHasPersonalFields, validateShioriPrivateState } from "@/lib/shioriPrivateState";
import { preflight } from "../../../../../../scripts/qa/shiori-private-store-preflight.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

/** Environment variables are checked without ever returning their values. */
function resolveCredentials() {
  const publicToken = process.env.BLOB_READ_WRITE_TOKEN;
  const privateToken = resolveShioriPrivateBlobToken();
  if (!publicToken || !privateToken || publicToken === "[SENSITIVE]" || privateToken === "[SENSITIVE]") {
    throw new Error("Missing runtime credentials");
  }
  return { publicToken, privateToken };
}

export async function GET() {
  // Also protected by proxy.ts; repeat the check inside the privileged route.
  const rejected = await requireAdmin();
  if (rejected) return rejected;

  let stage = "CREDENTIALS";
  try {
    const credentials = resolveCredentials();
    const report = await preflight(credentials, {
      get: async (pathname: string, options: Parameters<typeof get>[1]) => {
        stage = pathname === "spirit/library.json" ? "PUBLIC_READ" : "PRIVATE_READ";
        return get(pathname, options);
      },
      head: async (pathname: string, options: Parameters<typeof head>[1]) => {
        stage = pathname === "spirit/library.json" ? "PUBLIC_METADATA" : "PRIVATE_METADATA";
        return head(pathname, options);
      },
      list: async (options: Parameters<typeof list>[0]) => {
        stage = "PRIVATE_LIST";
        return list(options);
      },
      validateLibrary: (value: unknown) => {
        stage = "PUBLIC_VALIDATION";
        return validateSpiritLibrary(value);
      },
      validateState: (value: unknown) => {
        stage = "PRIVATE_VALIDATION";
        return validateShioriPrivateState(value);
      },
      hasPersonal: publicShioriHasPersonalFields,
    });
    // Report is constrained by preflight: counts, hash and flags only.
    return NextResponse.json({ ok: true, ...report }, { status: 200, headers: HEADERS });
  } catch {
    // Deliberately omit upstream error details: they can echo credentials or URLs.
    return NextResponse.json({
      ok: false,
      mode: "READ_ONLY",
      action: "NO_WRITES",
      stage,
      result: "PREFLIGHT_STOPPED",
    }, { status: 503, headers: HEADERS });
  }
}
