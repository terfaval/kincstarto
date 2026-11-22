/** SHIORI-05C/1: read-only, admin-only migration audit. NOT an apply endpoint. */
import { createHash } from "node:crypto";
import { get, head, list } from "@vercel/blob";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { resolveShioriPrivateBlobToken } from "@/lib/shioriPrivateStoreConfig";
import { validateSpiritLibrary } from "@/lib/spiritSchema";
import { validateShioriPrivateState, publicShioriHasPersonalFields } from "@/lib/shioriPrivateState";
import { auditShioriMigrationData } from "@/lib/shioriMigrationAudit";
import { preflight } from "../../../../../../scripts/qa/shiori-private-store-preflight.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PATH = "spirit/library.json";
// The last observed 94/8 snapshot (from the authenticated 05B/2 report).
// A change triggers RE-REVIEW, never automatic migration or overwrite.
const LAST_OBSERVED_SHA256 = "18ee5992ed904606c203afad635ea13f5967476a932be98aec1f85fe799911e3";
const HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

function credentials() {
  const publicToken = process.env.BLOB_READ_WRITE_TOKEN;
  const privateToken = resolveShioriPrivateBlobToken();
  if (!publicToken || !privateToken || [publicToken, privateToken].some((t) => t === "[SENSITIVE]")) {
    throw new Error("Unavailable credentials");
  }
  return { publicToken, privateToken };
}

const comparableEtag = (tag: unknown): string | null =>
  typeof tag === "string" && /^(W\/)?"[^"\s]+"$/.test(tag) ? tag.replace(/^W\//, "") : null;

export async function GET() {
  const rejected = await requireAdmin();
  if (rejected) return rejected;
  let stage = "CREDENTIALS";
  try {
    const { publicToken, privateToken } = credentials();
    stage = "DUAL_STORE_PREFLIGHT";
    const report = await preflight({ publicToken, privateToken }, {
      get, head, list,
      validateLibrary: validateSpiritLibrary,
      validateState: validateShioriPrivateState,
      hasPersonal: publicShioriHasPersonalFields,
    });

    stage = "SOURCE_VERSION";
    const response = await get(PATH, { access: "public", token: publicToken });
    if (!response?.stream || response.statusCode !== 200 || response.blob?.pathname !== PATH) {
      throw new Error("Public catalog unreadable");
    }
    const raw = await new Response(response.stream).text();
    const metadata = await head(PATH, { token: publicToken });
    if (metadata?.pathname !== PATH || metadata.size !== Buffer.byteLength(raw) ||
        !comparableEtag(metadata.etag) || comparableEtag(response.blob.etag) !== metadata.etag) {
      throw new Error("Source changed or ETag mismatch");
    }
    const sha256 = createHash("sha256").update(raw).digest("hex");
    if (sha256 !== report.publicSha256) {
      throw new Error("Concurrent catalog change; review again");
    }

    stage = "DATA_INTEGRITY";
    const original = JSON.parse(raw) as unknown;
    const library = validateSpiritLibrary(original);
    const audit = auditShioriMigrationData(original, library);
    const sourceMatchesLastObserved = sha256 === LAST_OBSERVED_SHA256;
    // Operator has classified all legacy notes as admin-only editorial text.
    // Legacy statuses and path progress belong to the single admin.
    const reviewRequired = !audit.editorialProjectionLossless || !audit.privateRoundtripLossless ||
      report.privateObjectExists || !sourceMatchesLastObserved;
    // Deliberate: always READ_ONLY; never returns private contents, IDs, URLs or tokens.
    return NextResponse.json({
      ok: true,
      mode: "READ_ONLY",
      action: "NO_WRITES",
      catalogSha256: sha256,
      sourceMatchesLastObserved,
      publicPersonalFieldsPresent: report.publicPersonalFieldsPresent,
      privateObjectExists: report.privateObjectExists,
      privateAccessVerifiedFromExistingObject: report.privateAccessVerifiedFromExistingObject,
      ...audit,
      ambiguousLegacyNotes: false, ownershipReviewRequired: false,
      classificationConfirmed: true,
      notesPolicy: "EDITORIAL_ADMIN_ONLY", ownerPolicy: "SINGLE_ADMIN",
      reviewRequired,
      nextStep: "MANUAL_TWO_STAGE_TRANSFER_WITH_SEPARATE_APPROVAL",
    }, { status: 200, headers: HEADERS });
  } catch {
    // Intentionally do not include raw errors: upstream errors can echo secrets and URLs.
    return NextResponse.json({
      ok: false, mode: "READ_ONLY", action: "NO_WRITES", stage,
      result: "MIGRATION_AUDIT_STOPPED",
    }, { status: 503, headers: HEADERS });
  }
}
