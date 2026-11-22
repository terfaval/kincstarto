/** SHIORI-05C/2: gated, two-stage, one-time migration; never automatic. */
import { isDeepStrictEqual } from "node:util";
import { get, head, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { readSpiritJsonBlob } from "@/lib/spiritJsonBlob";
import { readShioriPrivateBlob } from "@/lib/shioriPrivateBlob";
import { assertDistinctShioriBlobTokens, resolveShioriPrivateBlobToken } from "@/lib/shioriPrivateStoreConfig";
import { validateShioriPrivateState } from "@/lib/shioriPrivateState";
import {
  planShioriTransfer, digestSha256,
  SHIORI_PUBLIC_CONFIRM, SHIORI_PRIVATE_CONFIRM,
  SHIORI_PRIVATE_PATH, SHIORI_PUBLIC_PATH, SHIORI_REVIEWED_SHA256,
} from "@/lib/shioriMigrationTransfer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const HEADERS = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
const confirmed = () => process.env.VERCEL_ENV === "preview" &&
  process.env.SHIORI_05C2_WRITE_ENABLED === "1" &&
  process.env.SHIORI_PRIVATE_STATE_READY !== "1";
function tokens() {
  const publicToken = process.env.BLOB_READ_WRITE_TOKEN;
  const privateToken = resolveShioriPrivateBlobToken();
  if (publicToken === "[SENSITIVE]" || privateToken === "[SENSITIVE]") throw new Error("Unavailable credentials");
  return assertDistinctShioriBlobTokens(publicToken, privateToken);
}
function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: HEADERS });
}
function comparableEtag(tag: unknown) {
  if (typeof tag !== "string" || !/^(W\/)?.*"$/.test(tag)) return null;
  const value = tag.replace(/^W\//, "");
  return /^"[^"\s]+"$/.test(value) ? value : null;
}
async function readPrivateExact(token: string) {
  const result = await get(SHIORI_PRIVATE_PATH, { access: "private", token, useCache: false });
  if (!result) return null;
  if (result.statusCode !== 200 || !result.stream || result.blob?.pathname !== SHIORI_PRIVATE_PATH) {
    throw new Error("Private read unsuccessful");
  }
  const raw = await new Response(result.stream).text();
  const metadata = await head(SHIORI_PRIVATE_PATH, { token });
  if (metadata?.pathname !== SHIORI_PRIVATE_PATH || !comparableEtag(metadata.etag) ||
      comparableEtag(result.blob.etag) !== metadata.etag || metadata.size !== Buffer.byteLength(raw)) {
    throw new Error("Private metadata mismatch");
  }
  return { raw, state: validateShioriPrivateState(JSON.parse(raw)), etag: metadata.etag };
}

export async function GET() {
  const rejected = await requireAdmin();
  if (rejected) return rejected;
  return reply({ ok: true, mode: "MANUAL_TWO_STEP", action: "NO_WRITES",
    enabled: confirmed(), reviewedSourceSha256: SHIORI_REVIEWED_SHA256,
    phases: ["private", "public"], notesPolicy: "EDITORIAL_ADMIN_ONLY",
    owner: "SINGLE_ADMIN", postcheckRequired: true });
}

export async function POST(request: Request) {
  const rejected = await requireAdmin(request);
  if (rejected) return rejected;
  if (!confirmed()) return reply({ ok: false, stage: "DISABLED", action: "NO_WRITES" }, 403);
  if ((Number(request.headers.get("content-length")) || 0) > 2048) return reply({ ok: false, stage: "BODY_TOO_LARGE" }, 413);
  let stage = "BODY";
  let writeAttempted = false;
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody) > 2048) return reply({ ok: false, stage: "BODY_TOO_LARGE" }, 413);
    const body = JSON.parse(rawBody) as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        Object.keys(body).some((key) => !["phase", "sourceSha256", "confirm"].includes(key))) {
      return reply({ ok: false, stage: "BODY_INVALID" }, 400);
    }
    const phase = body.phase;
    if ((phase !== "private" && phase !== "public") ||
        body.sourceSha256 !== SHIORI_REVIEWED_SHA256 ||
        body.confirm !== (phase === "private" ? SHIORI_PRIVATE_CONFIRM : SHIORI_PUBLIC_CONFIRM)) {
      return reply({ ok: false, stage: "CONFIRMATION_MISSING" }, 400);
    }
    stage = "CREDENTIALS";
    const { publicToken, privateToken } = tokens();
    stage = "SOURCE";
    const source = await readSpiritJsonBlob();
    if (source.access !== "public" || source.sha256 !== SHIORI_REVIEWED_SHA256 || !source.schemaCompatible) {
      return reply({ ok: false, stage: "SOURCE_CHANGED", action: "NO_WRITES" }, 409);
    }
    stage = "CANDIDATE";
    const candidate = planShioriTransfer(JSON.parse(source.raw), source.library, source.sha256);
    stage = "PRIVATE_READ";
    const existing = await readPrivateExact(privateToken);

    if (phase === "private") {
      // No retries or overwrite: a preexisting private object must be reviewed first.
      if (existing) return reply({ ok: false, stage: "PRIVATE_OBJECT_EXISTS", action: "NO_WRITES" }, 409);
      stage = "PRIVATE_WRITE";
      writeAttempted = true;
      const written = await put(SHIORI_PRIVATE_PATH, candidate.privateJson, {
        token: privateToken, access: "private", contentType: "application/json",
        addRandomSuffix: false, allowOverwrite: false,
      });
      stage = "PRIVATE_VERIFY";
      const verified = await readPrivateExact(privateToken);
      if (!verified || written.pathname !== SHIORI_PRIVATE_PATH ||
          digestSha256(verified.raw) !== candidate.privateSha256 ||
          !isDeepStrictEqual(verified.state, candidate.privateState)) {
        throw new Error("Private postwrite mismatch");
      }
      return reply({ ok: true, mode: "MANUAL_TWO_STEP", phase, action: "PRIVATE_VERIFIED",
        sourceSha256: source.sha256, ...candidate.counts, nextStep: "SEPARATE_PUBLIC_CONFIRMATION" });
    }

    if (!existing || digestSha256(existing.raw) !== candidate.privateSha256 ||
        !isDeepStrictEqual(existing.state, candidate.privateState)) {
      return reply({ ok: false, stage: "PRIVATE_UNVERIFIED", action: "NO_WRITES" }, 409);
    }
    // Verify private object a second time using the same protected read helper.
    stage = "PRIVATE_VERIFIED";
    const readback = await readShioriPrivateBlob();
    if (!isDeepStrictEqual(readback.state, candidate.privateState) || readback.etag !== existing.etag) {
      return reply({ ok: false, stage: "PRIVATE_CHANGED", action: "NO_WRITES" }, 409);
    }
    stage = "PUBLIC_RECHECK";
    const immediate = await readSpiritJsonBlob();
    if (immediate.etag !== source.etag || immediate.sha256 !== source.sha256) {
      return reply({ ok: false, stage: "SOURCE_CHANGED", action: "NO_WRITES" }, 409);
    }
    stage = "PUBLIC_WRITE";
    writeAttempted = true;
    const updated = await put(SHIORI_PUBLIC_PATH, candidate.publicJson, {
      token: publicToken, access: "public", contentType: "application/json",
      allowOverwrite: true, ifMatch: source.etag,
    });
    stage = "PUBLIC_VERIFY";
    const after = await head(SHIORI_PUBLIC_PATH, { token: publicToken });
    if (updated.pathname !== SHIORI_PUBLIC_PATH || !updated.etag ||
        updated.etag === source.etag || updated.etag !== after.etag ||
        after.pathname !== SHIORI_PUBLIC_PATH || after.size !== Buffer.byteLength(candidate.publicJson)) {
      throw new Error("Public postwrite mismatch");
    }
    return reply({ ok: true, mode: "MANUAL_TWO_STEP", phase, action: "PUBLIC_REDACTION_WRITTEN",
      targetPublicSha256: candidate.publicSha256, ...candidate.counts,
      nextStep: "INDEPENDENT_POSTCHECK_BEFORE_ACTIVATION" });
  } catch {
    // Blob writes can commit even if their response fails. Never advertise a safe retry.
    return reply({ ok: false, stage, action: writeAttempted ? "OUTCOME_UNCERTAIN_DO_NOT_RETRY" : "NO_WRITES",
      outcomeUnknown: writeAttempted }, writeAttempted ? 502 : 503);
  }
}
