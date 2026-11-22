/** Post-migration independent safety check: GET only, authenticated, no writes. */
import { isDeepStrictEqual } from "node:util";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { readSpiritJsonBlob } from "@/lib/spiritJsonBlob";
import { privateShioriReady, readShioriPrivateBlob } from "@/lib/shioriPrivateBlob";
import { assertDistinctShioriBlobTokens, resolveShioriPrivateBlobToken } from "@/lib/shioriPrivateStoreConfig";
import { validateSpiritLibrary } from "@/lib/spiritSchema";
import {
  extractShioriPrivateState, mergeShioriPrivateState,
  publicShioriHasPersonalFields, publicShioriJson, validateShioriPrivateState,
} from "@/lib/shioriPrivateState";
import { planShioriTransfer, SHIORI_REVIEWED_SHA256 } from "@/lib/shioriMigrationTransfer";
import { auditShioriActivation } from "../../../../../../scripts/qa/shiori-activation-audit-core.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const HEADERS = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };

export async function GET() {
  const rejected = await requireAdmin();
  if (rejected) return rejected;
  let stage = "CREDENTIALS";
  try {
    // The public and private credentials must refer to distinct stores.
    assertDistinctShioriBlobTokens(process.env.BLOB_READ_WRITE_TOKEN, resolveShioriPrivateBlobToken());
    stage = "PUBLIC_READ";
    const publicResult = await readSpiritJsonBlob();
    if (publicResult.access !== "public" || !publicResult.schemaCompatible) {
      throw new Error("Public source incompatible");
    }
    stage = "PRIVATE_READ";
    const privateResult = await readShioriPrivateBlob();
    stage = "INTEGRITY";
    if (publicResult.sha256 === SHIORI_REVIEWED_SHA256) {
      if (privateShioriReady()) throw new Error("Private reader activated before public redaction");
      const expected = planShioriTransfer(JSON.parse(publicResult.raw), publicResult.library, publicResult.sha256);
      // Verified pre-redaction snapshot, already present in the separate private store.
      const clean = (value: unknown) => JSON.parse(JSON.stringify(value));
      if (!isDeepStrictEqual(clean(privateResult.state), clean(expected.privateState))) {
        throw new Error("Private backup does not match reviewed legacy snapshot");
      }
      return NextResponse.json({
        ok: true, mode: "READ_ONLY", action: "NO_WRITES", phase: "PRE_REDACTION",
        publicSha256: publicResult.sha256, expectedPublicSha256: expected.publicSha256,
        privateObjectVerified: true, publicPersonalFieldsPresent: true,
        ...expected.counts,
        nextStep: "SEPARATE_PUBLIC_CONFIRMATION",
      }, { headers: HEADERS });
    }
    const result = auditShioriActivation(publicResult.raw, privateResult.state, {
      validateLibrary: validateSpiritLibrary,
      validateState: validateShioriPrivateState,
      publicJson: publicShioriJson,
      hasPersonal: publicShioriHasPersonalFields,
      extract: extractShioriPrivateState,
      merge: mergeShioriPrivateState,
    });
    return NextResponse.json({
      ok: true, mode: "READ_ONLY", action: "NO_WRITES", phase: "POST_REDACTION", ...result,
      privateObjectVerified: true, publicPersonalFieldsPresent: false,
      privateStateReady: privateShioriReady(),
      nextStep: privateShioriReady() ? "VERIFY_ADMIN_PRODUCTION" : "ACTIVATE_PRIVATE_READER_AFTER_DEPLOY",
    }, { headers: HEADERS });
  } catch {
    return NextResponse.json({
      ok: false, mode: "READ_ONLY", action: "NO_WRITES", stage,
      result: "ACTIVATION_POSTCHECK_STOPPED",
    }, { status: 503, headers: HEADERS });
  }
}
