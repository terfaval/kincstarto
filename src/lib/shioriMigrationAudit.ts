/** Typed adapter for the dependency-free, read-only 05C audit core. */
import type { SpiritLibrary } from "./spiritSchema";
import {
  extractShioriPrivateState,
  mergeShioriPrivateState,
  publicShioriHasPersonalFields,
  publicShioriJson,
  validateShioriPrivateState,
} from "./shioriPrivateState";
import { auditShioriMigrationData as coreAudit } from "../../scripts/qa/shiori-migration-audit-core.mjs";

export type ShioriMigrationDataAudit = {
  books: number;
  paths: number;
  nonDefaultStatuses: number;
  booksWithNotes: number;
  pathsWithProgress: number;
  pathComments: number;
  editorialProjectionLossless: boolean;
  privateRoundtripLossless: boolean;
  ambiguousLegacyNotes: boolean;
  ownershipReviewRequired: true;
  eligibleForAutomaticMigration: false;
};

export function auditShioriMigrationData(raw: unknown, parsed: SpiritLibrary): ShioriMigrationDataAudit {
  return coreAudit(raw, parsed, {
    extractShioriPrivateState,
    mergeShioriPrivateState,
    publicShioriHasPersonalFields,
    publicShioriJson,
    validateShioriPrivateState,
  }) as ShioriMigrationDataAudit;
}
