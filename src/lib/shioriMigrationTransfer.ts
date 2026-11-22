/** One-admin, private-first migration plan. No storage operations in this module. */
import { createHash } from "node:crypto";
import type { SpiritLibrary } from "./spiritSchema";
import { auditShioriMigrationData } from "./shioriMigrationAudit";
import {
  extractShioriPrivateState,
  publicShioriHasPersonalFields,
  publicShioriJson,
  validateShioriPrivateState,
} from "./shioriPrivateState";

export const SHIORI_REVIEWED_SHA256 = "18ee5992ed904606c203afad635ea13f5967476a932be98aec1f85fe799911e3";
export const SHIORI_PRIVATE_CONFIRM = "PRIVATE FIRST";
export const SHIORI_PUBLIC_CONFIRM = "REDACT PUBLIC";
export const SHIORI_PRIVATE_PATH = "spirit/reading-state.json";
export const SHIORI_PUBLIC_PATH = "spirit/library.json";
export const digestSha256 = (raw: string) => createHash("sha256").update(raw).digest("hex");

/** Legacy `notes` are admin-only editorial notes, never public or book-detail fields. */
export function planShioriTransfer(raw: unknown, library: SpiritLibrary, sourceSha: string) {
  if (sourceSha !== SHIORI_REVIEWED_SHA256) throw new Error("Source differs from reviewed snapshot");
  const audit = auditShioriMigrationData(raw, library);
  if (audit.books !== 94 || audit.paths !== 8 ||
      audit.nonDefaultStatuses !== 22 || audit.booksWithNotes !== 10 ||
      audit.pathsWithProgress !== 8 || audit.pathComments !== 0 ||
      !audit.editorialProjectionLossless || !audit.privateRoundtripLossless) {
    throw new Error("Data shape or roundtrip differs from reviewed snapshot");
  }
  const privateState = validateShioriPrivateState(extractShioriPrivateState(library));
  const publicJson = publicShioriJson(library);
  if (publicShioriHasPersonalFields(JSON.parse(publicJson))) throw new Error("Public redaction incomplete");
  const privateJson = `${JSON.stringify(privateState, null, 2)}\n`;
  return {
    privateState,
    privateJson,
    publicJson,
    publicSha256: digestSha256(publicJson),
    privateSha256: digestSha256(privateJson),
    counts: { books: audit.books, paths: audit.paths, statuses: audit.nonDefaultStatuses,
      adminEditorialNotes: audit.booksWithNotes, pathProgress: audit.pathsWithProgress },
  };
}
