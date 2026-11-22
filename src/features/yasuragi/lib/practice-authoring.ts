/** One proposal-only authoring project: a practice plus the library work it needs.
 * This is NOT a pose/image import API and is never published automatically.
 */
import { PoseSchema, type Pose } from "@/lib/yogiKnowledgeSchema";
import type { PosePreview, PracticeScript } from "./practice-types";
import { inspectPracticeImport, type ImportIssue, type ImportReport, YASURAGI_IMPORT_FORMAT } from "./practice-import";
import { validatePrototypeScript } from "./practice-engine";

export const YASURAGI_AUTHORING_FORMAT = "yasuragi.authoring.v1";
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
type Obj = Record<string, unknown>;
const isObj = (value: unknown): value is Obj => Boolean(value) && typeof value === "object" && !Array.isArray(value);

export type PoseProposal = {
  poseId: string;
  record: Pose;
  illustration: { brief: string };
};
export type AuthoringProject = {
  format: typeof YASURAGI_AUTHORING_FORMAT;
  status: "draft";
  projectId: string;
  practice: PracticeScript;
  poseProposals: PoseProposal[];
};
export type PoseDependency = {
  poseId: string;
  label: string;
  state: "ready" | "review_needed" | "image_missing" | "proposal_pending" | "missing";
  proposed: boolean;
  occurrenceCount: number;
};
export type AuthoringImportReport = ImportReport & {
  mode: "practice" | "authoring";
  previewReady: boolean;
  dependencies: PoseDependency[];
  poseProposalCount: number;
};
export type InspectedAuthoringImport = {
  script: PracticeScript | null;
  authoring: AuthoringProject | null;
  report: AuthoringImportReport;
};

function referencedPoses(script: PracticeScript) {
  const ids = new Map<string, number>();
  const count = (id: string) => { ids.set(id, (ids.get(id) ?? 0) + 1); };
  for (const node of script.nodes) {
    if (node.type === "segment") {
      for (const id of node.posePool) if (ID.test(id)) count(id);
    } else {
      for (const option of node.options) {
        if (ID.test(option.imagePoseId)) count(option.imagePoseId);
        for (const id of option.requiresPoseIds ?? []) if (ID.test(id)) count(id);
      }
    }
  }
  return ids;
}

function dependenciesFor(script: PracticeScript, poses: Record<string, PosePreview>, proposals: Map<string, PoseProposal>): PoseDependency[] {
  return [...referencedPoses(script)].map(([poseId, occurrenceCount]) => {
    const pose = poses[poseId];
    const proposal = proposals.get(poseId);
    const state: PoseDependency["state"] = !pose
      ? proposal ? "proposal_pending" : "missing"
      : !pose.imageUrl ? "image_missing" : !pose.validated ? "review_needed" : "ready";
    return { poseId, label: pose?.name ?? proposal?.record.name_hu ?? poseId, state, proposed: Boolean(proposal), occurrenceCount };
  });
}

/** Validate both forms without writing to either the practice store or the pose library.
 * Missing pose proposals are virtual ONLY during topology validation, never in the live player.
 */
export function inspectAuthoringImport(
  source: unknown,
  livePoses: Record<string, PosePreview>,
  allowedEquipmentKeys: readonly string[],
): InspectedAuthoringImport {
  const unified = isObj(source) && source.format === YASURAGI_AUTHORING_FORMAT;
  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  const issue = (path: string, code: string, message: string) => errors.push({ path, code, message });
  let practiceSource: unknown = source;
  let project: AuthoringProject | null = null;
  const proposals = new Map<string, PoseProposal>();

  if (unified && isObj(source)) {
    practiceSource = source.practice;
    if (source.status !== "draft") issue("status", "AUTHORING_STATUS", "Az authoring projekt státusza draft legyen.");
    if (typeof source.projectId !== "string" || !ID.test(source.projectId)) issue("projectId", "PROJECT_ID", "Érvényes, stabil projektazonosító szükséges.");
    if (!Array.isArray(source.poseProposals) || source.poseProposals.length > 32) {
      issue("poseProposals", "POSE_PROPOSALS", "A pózjavaslatok listája kötelező (max. 32 elem). Már meglévő pózokhoz lehet üres.");
    } else for (const [i, value] of source.poseProposals.entries()) {
      const path = `poseProposals[${i}]`;
      if (!isObj(value) || typeof value.poseId !== "string" || !ID.test(value.poseId) ||
          !isObj(value.illustration) || typeof value.illustration.brief !== "string" || value.illustration.brief.trim().length < 20 || value.illustration.brief.length > 3000) {
        issue(path, "PROPOSAL", "Pózazonosító és 20–3000 karakteres képi brief szükséges.");
        continue;
      }
      if (proposals.has(value.poseId)) { issue(`${path}.poseId`, "PROPOSAL_DUPLICATE", "Egy pózhoz legfeljebb egy javaslat tartozhat."); continue; }
      const parsed = PoseSchema.safeParse(value.record);
      if (!parsed.success) {
        issue(`${path}.record`, "POSE_SCHEMA", `A pózadatlap nem felel meg a könyvtári sémának: ${parsed.error.issues.slice(0, 4).map((e: { path: PropertyKey[] }) => e.path.join(".")).join(", ")}`);
        continue;
      }
      const record = parsed.data;
      if (record.id !== value.poseId || record.status !== "draft" || record.content_status !== "draft" || record.validated !== false ||
          record.mannequin_angled.asset_ref !== null || record.mannequin_angled.status !== "missing") {
        issue(`${path}.record`, "PROPOSAL_STATE", "Azonos ID, draft státusz, validated=false és még nem hozzárendelt illusztráció szükséges.");
        continue;
      }
      proposals.set(value.poseId, { poseId: value.poseId, record, illustration: { brief: value.illustration.brief } });
      if (livePoses[value.poseId]) warnings.push({ path, code: "ALREADY_IN_LIBRARY", message: `${value.poseId} már aktív a könyvtárban. Import előtt ellenőrizd az esetleges ütközést.` });
    }
  }

  // The proposal-only placeholders let the topology validator examine future paths without
  // claiming the missing images exist in the real library.
  const virtualPoses: Record<string, PosePreview> = Object.assign(Object.create(null), livePoses);
  if (unified && isObj(practiceSource) && Array.isArray(practiceSource.nodes)) {
    const ids = new Set<string>();
    for (const node of practiceSource.nodes) {
      if (!isObj(node)) continue;
      if (Array.isArray(node.posePool)) for (const id of node.posePool) if (typeof id === "string" && ID.test(id)) ids.add(id);
      if (Array.isArray(node.options)) for (const option of node.options) {
        if (!isObj(option)) continue;
        if (typeof option.imagePoseId === "string" && ID.test(option.imagePoseId)) ids.add(option.imagePoseId);
        if (Array.isArray(option.requiresPoseIds)) for (const id of option.requiresPoseIds) if (typeof id === "string" && ID.test(id)) ids.add(id);
      }
    }
    for (const id of ids) if (!virtualPoses[id]) virtualPoses[id] = {
      id, name: proposals.get(id)?.record.name_hu ?? id, sanskrit: null,
      imageUrl: "/__yasuragi_authoring_only_placeholder__", setup: "", modifications: [], cautionAreas: [], validated: false,
    };
  }
  const structural = inspectPracticeImport(practiceSource, virtualPoses, allowedEquipmentKeys);
  const real = unified ? inspectPracticeImport(practiceSource, livePoses, allowedEquipmentKeys) : structural;
  const script = structural.script;
  if (unified && script && proposals.size) {
    const referenced = referencedPoses(script);
    for (const poseId of proposals.keys()) if (!referenced.has(poseId)) warnings.push({ path: "poseProposals", code: "UNREFERENCED_POSE", message: `A gyakorlás nem hivatkozik erre a pózra: ${poseId}` });
  }
  // A draft may retain a future/unillustrated default, but a playable route
  // must never substitute a different branch silently. Surface the blocker.
  if (script) for (const node of script.nodes) {
    if (node.type !== "decision") continue;
    const fallback = node.options.find((option) => option.id === node.defaultOptionId);
    if (!fallback || fallback.availability?.startsWith("blocked") || !livePoses[fallback.imagePoseId]?.imageUrl ||
        fallback.requiresPoseIds?.some((poseId) => !livePoses[poseId]?.imageUrl)) {
      warnings.push({ path: `nodes.${node.id}.defaultOptionId`, code: "DEFAULT_UNAVAILABLE",
        message: "Az alapértelmezett döntési ág nem elérhető. A tervezet menthető, de a lejátszáshoz rendezni kell ezt az ágat." });
    }
  }
  const fullErrors = [...errors, ...structural.report.errors];
  const fullWarnings = [...warnings, ...structural.report.warnings];
  const deps = script ? dependenciesFor(script, livePoses, proposals) : [];
  const report: AuthoringImportReport = {
    ...structural.report,
    ok: fullErrors.length === 0,
    errors: fullErrors,
    warnings: fullWarnings,
    mode: unified ? "authoring" : "practice",
    previewReady: fullErrors.length === 0 && real.report.ok && real.report.availableRouteCount > 0 && script !== null && validatePrototypeScript(script, livePoses).length === 0,
    dependencies: deps,
    poseProposalCount: proposals.size,
  };
  if (unified && isObj(source) && report.ok && script) project = {
    format: YASURAGI_AUTHORING_FORMAT,
    status: "draft", projectId: source.projectId as string,
    practice: script,
    poseProposals: [...proposals.values()],
  };
  return { script: report.ok ? script : null, authoring: project, report };
}

/** A saved authoring project can be opened for manual pose-review/export; never autosaved to the library. */
export function isUnifiedAuthoringSource(value: unknown): boolean {
  return isObj(value) && value.format === YASURAGI_AUTHORING_FORMAT;
}

export function isPracticeSource(value: unknown): boolean {
  return isObj(value) && value.format === YASURAGI_IMPORT_FORMAT;
}
