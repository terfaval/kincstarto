import type { PosePreview, PracticeScript } from "./practice-types";

export const YASURAGI_IMPORT_FORMAT = "yasuragi.practice.v1";
export const YASURAGI_MAX_IMPORT_BYTES = 600_000;
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;

export type ImportIssue = { path: string; code: string; message: string };
export type ImportReport = {
  ok: boolean;
  errors: ImportIssue[];
  warnings: ImportIssue[];
  practiceId: string;
  title: string;
  version: string;
  durationSec: number;
  nodeCount: number;
  availableRouteCount: number;
};
export type ValidatedImport = { script: PracticeScript | null; report: ImportReport };

type Obj = Record<string, unknown>;
const obj = (value: unknown): value is Obj => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const integer = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value);
const blocked = (value: unknown) => typeof value === "string" && value.startsWith("blocked");

/** No transformation or field stripping: the saved proposal is byte-equivalent as JSON data. */
export function inspectPracticeImport(
  source: unknown,
  poses: Record<string, PosePreview>,
  allowedEquipmentKeys: readonly string[],
): ValidatedImport {
  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  const error = (path: string, code: string, message: string) => { if (errors.length < 120) errors.push({ path, code, message }); };
  const warn = (path: string, code: string, message: string) => { if (warnings.length < 120) warnings.push({ path, code, message }); };
  const empty: ImportReport = { ok: false, errors, warnings, practiceId: "", title: "", version: "", durationSec: 0, nodeCount: 0, availableRouteCount: 0 };
  if (!obj(source)) { error("$", "NOT_OBJECT", "A gyakorlatnak JSON-objektumnak kell lennie."); return { script: null, report: empty }; }
  if (source.format !== YASURAGI_IMPORT_FORMAT) error("format", "FORMAT", `A P02 importformátuma: ${YASURAGI_IMPORT_FORMAT}. A design-fixture külön konverziót igényel.`);
  if (source.status !== "draft") error("status", "STATUS", "Kizárólag status='draft' tervezetek importálhatók.");
  if (!text(source.practiceId) || !ID.test(source.practiceId)) error("practiceId", "ID", "A gyakorlásazonosító 1–80 karakteres, betű/szám/_/- lehet.");
  if (!text(source.title) || source.title.length > 160) error("title", "TITLE", "Rövid, nem üres cím szükséges (max. 160 karakter).");
  if (!text(source.version) || source.version.length > 80) error("version", "VERSION", "A scriptverzió hiányzik vagy túl hosszú.");
  if (!integer(source.durationSec) || source.durationSec < 60 || source.durationSec > 14_400) error("durationSec", "DURATION", "Az időtartam 60 és 14 400 másodperc között lehet.");
  if (!text(source.startNodeId) || !ID.test(source.startNodeId)) error("startNodeId", "START", "Érvénytelen kezdő csomópont.");
  if (!text(source.endNodeId) || !ID.test(source.endNodeId)) error("endNodeId", "END", "Érvénytelen záró jelölő.");
  if (!Array.isArray(source.nodes) || source.nodes.length < 1 || source.nodes.length > 120) {
    error("nodes", "NODE_COUNT", "1–120 csomópont szükséges.");
    return { script: null, report: { ...empty, practiceId: text(source.practiceId) ? source.practiceId : "", title: text(source.title) ? source.title : "" } };
  }
  const nodes = new Map<string, Obj>();
  let availableRouteCount = 0;
  const allowedKeys = new Set(allowedEquipmentKeys);
  const poseIds = new Set<string>();
  const addPoseDependency = (poseId: string, path: string, required: boolean) => {
    poseIds.add(poseId);
    if (!poses[poseId]) (required ? error : warn)(path, "POSE_MISSING", `Nincs aktív könyvtári póz: ${poseId}`);
    else if (!poses[poseId].validated) warn(path, "POSE_UNVERIFIED", `A könyvtári póz nincs szakmailag jóváhagyva: ${poseId}`);
    else if (!poses[poseId].imageUrl) warn(path, "POSE_IMAGE_MISSING", `Nincs kép: ${poseId}`);
  };
  source.nodes.forEach((rawNode: unknown, i: number) => {
    const path = `nodes[${i}]`;
    if (!obj(rawNode)) { error(path, "NODE", "Érvénytelen csomópont."); return; }
    if (!text(rawNode.id) || !ID.test(rawNode.id)) { error(`${path}.id`, "NODE_ID", "Érvénytelen csomópontazonosító."); return; }
    if (nodes.has(rawNode.id)) error(`${path}.id`, "DUPLICATE_NODE", `Duplikált csomópont: ${rawNode.id}`);
    nodes.set(rawNode.id, rawNode);
    if (!text(rawNode.name) || rawNode.name.length > 240) error(`${path}.name`, "NAME", "Hiányzó vagy túl hosszú szakasznév.");
    if (!integer(rawNode.startGlobalSec) || rawNode.startGlobalSec < 0) error(`${path}.startGlobalSec`, "TIME", "Nemnegatív egész másodperc szükséges.");
    if (!integer(rawNode.durationSec) || rawNode.durationSec < 1) error(`${path}.durationSec`, "TIME", "Pozitív egész szakaszhossz szükséges.");
    if (integer(rawNode.startGlobalSec) && integer(rawNode.durationSec) && integer(source.durationSec) && rawNode.startGlobalSec + rawNode.durationSec > source.durationSec) {
      error(path, "OUT_OF_RANGE", "A szakasz túlnyúlik a gyakorlás végén.");
    }
    if (rawNode.type === "segment") {
      if (!text(rawNode.nextNodeId) || !ID.test(rawNode.nextNodeId)) error(`${path}.nextNodeId`, "NEXT", "Érvénytelen következő csomópont.");
      if (!Array.isArray(rawNode.posePool) || rawNode.posePool.length < 1 || rawNode.posePool.length > 12 ||
          rawNode.posePool.some((id: unknown) => !text(id) || !ID.test(id))) {
        error(`${path}.posePool`, "POSE_POOL", "1–12 érvényes pózazonosító szükséges.");
      }
      const pool: string[] = Array.isArray(rawNode.posePool) ? rawNode.posePool.filter((id): id is string => text(id) && ID.test(id)) : [];
      if (new Set(pool).size !== pool.length) error(`${path}.posePool`, "POSE_DUPLICATE", "A poolban ismétlődő póz van.");
      if (!text(rawNode.defaultPoseId) || !pool.includes(rawNode.defaultPoseId)) error(`${path}.defaultPoseId`, "DEFAULT_POSE", "Az alappóznak a poolban kell szerepelnie.");
      if (!obj(rawNode.poseVariants)) error(`${path}.poseVariants`, "VARIANTS", "A pool pózaihoz saját T-változat szükséges.");
      for (const poseId of pool) {
        const variantPath = `${path}.poseVariants.${poseId}`;
        const variant: unknown = obj(rawNode.poseVariants) ? rawNode.poseVariants[poseId] : null;
        if (!obj(variant) || !obj(variant.t) || !text(variant.t.full) || !text(variant.t.mini) || variant.t.full.length > 1800 || variant.t.mini.length > 600) {
          error(variantPath, "T_TEXT", "Hiányzó vagy túl hosszú T-szöveg (full és mini szükséges).");
        }
        if (obj(variant) && variant.equipment !== undefined) {
          if (!Array.isArray(variant.equipment) || variant.equipment.length > 12) error(`${variantPath}.equipment`, "EQUIPMENT", "Maximum 12 equipment-tipp lehet.");
          else variant.equipment.forEach((entry: unknown, j: number) => {
            if (!obj(entry) || !text(entry.catalogKey) || !text(entry.tip) || entry.tip.length > 600) error(`${variantPath}.equipment[${j}]`, "EQUIPMENT_TIP", "Érvényes eszközazonosító és rövid tipp szükséges.");
            else if (!allowedKeys.has(entry.catalogKey)) warn(`${variantPath}.equipment[${j}]`, "EQUIPMENT_UNKNOWN", `A jelenlegi katalógus nem ismeri: ${entry.catalogKey}`);
          });
        }
        if (!blocked(rawNode.availability)) addPoseDependency(poseId, `${path}.posePool`, poseId === rawNode.defaultPoseId);
      }
      if (!Array.isArray(rawNode.cues) || rawNode.cues.length > 240) error(`${path}.cues`, "CUES", "A szakasznak legfeljebb 240 M-eseménye lehet.");
      else {
        const cueIds = new Set<string>();
        const segmentDurationSec = integer(rawNode.durationSec) ? rawNode.durationSec : 0;
        rawNode.cues.forEach((rawCue: unknown, j: number) => {
          const cp = `${path}.cues[${j}]`;
          if (!obj(rawCue)) { error(cp, "CUE", "Érvénytelen M-esemény."); return; }
          if (!text(rawCue.id) || !ID.test(rawCue.id) || cueIds.has(rawCue.id)) error(`${cp}.id`, "CUE_ID", "Hiányzó, érvénytelen vagy ismétlődő cue ID.");
          else cueIds.add(rawCue.id);
          if (!text(rawCue.full) || !text(rawCue.mini) || rawCue.full.length > 1800 || rawCue.mini.length > 600) error(cp, "M_TEXT", "Hiányzó vagy túl hosszú M-szöveg (full és mini szükséges).");
          if (!integer(rawCue.atLocalSec) || !integer(rawCue.latestStartLocalSec) || !integer(rawCue.minVisibleSec) || !integer(rawCue.maxVisibleSec) ||
              rawCue.atLocalSec < 0 || rawCue.latestStartLocalSec < rawCue.atLocalSec || rawCue.minVisibleSec < 1 ||
              rawCue.maxVisibleSec < rawCue.minVisibleSec || rawCue.latestStartLocalSec >= segmentDurationSec ||
              rawCue.latestStartLocalSec + rawCue.minVisibleSec > segmentDurationSec) error(cp, "M_WINDOW", "Hibás megjelenési időablak vagy nincs idő a minimum megjelenítésre.");
          if (!(rawCue.appliesTo === "all_pool_poses" || (text(rawCue.appliesTo) && pool.includes(rawCue.appliesTo)) ||
              (Array.isArray(rawCue.appliesTo) && rawCue.appliesTo.length > 0 && rawCue.appliesTo.every((id: unknown) => text(id) && pool.includes(id))))) {
            error(`${cp}.appliesTo`, "M_TARGET", "A cue csak az adott pool pózaira hivatkozhat.");
          }
        });
      }
    } else if (rawNode.type === "decision") {
      if (!text(rawNode.questionMini) || !text(rawNode.fullIntro) || rawNode.questionMini.length > 600 || rawNode.fullIntro.length > 1800) error(path, "DECISION_TEXT", "A döntés kérdése és teljes bevezetője szükséges.");
      if (!Array.isArray(rawNode.options) || rawNode.options.length < 1 || rawNode.options.length > 8) error(`${path}.options`, "OPTIONS", "1–8 útvonalopció szükséges.");
      else {
        const optionIds = new Set<string>();
        rawNode.options.forEach((rawOption: unknown, j: number) => {
          const op = `${path}.options[${j}]`;
          if (!obj(rawOption)) { error(op, "OPTION", "Érvénytelen opció."); return; }
          if (!text(rawOption.id) || !ID.test(rawOption.id) || optionIds.has(rawOption.id)) error(`${op}.id`, "OPTION_ID", "Hiányzó, érvénytelen vagy ismétlődő opcióazonosító.");
          else optionIds.add(rawOption.id);
          if (!text(rawOption.label) || !text(rawOption.miniLabel) || rawOption.label.length > 160 || rawOption.miniLabel.length > 100) error(op, "OPTION_LABEL", "Az opció teljes és mini címkéje szükséges.");
          if (!text(rawOption.nextNodeId) || !ID.test(rawOption.nextNodeId)) error(`${op}.nextNodeId`, "OPTION_TARGET", "Érvénytelen ágcél.");
          if (!text(rawOption.imagePoseId) || !ID.test(rawOption.imagePoseId)) error(`${op}.imagePoseId`, "OPTION_IMAGE", "Érvénytelen illusztrációhivatkozás.");
          if (rawOption.requiresPoseIds !== undefined && (!Array.isArray(rawOption.requiresPoseIds) || rawOption.requiresPoseIds.some((id: unknown) => !text(id) || !ID.test(id)))) error(`${op}.requiresPoseIds`, "POSE_REQUIRES", "Érvénytelen pózfüggőségek.");
          if (text(rawOption.imagePoseId) && !blocked(rawOption.availability)) {
            addPoseDependency(rawOption.imagePoseId, `${op}.imagePoseId`, false);
            if (!poses[rawOption.imagePoseId]?.imageUrl || (Array.isArray(rawOption.requiresPoseIds) && rawOption.requiresPoseIds.some((id: unknown) => !text(id) || !poses[id]?.imageUrl))) {
              warn(op, "OPTION_UNAVAILABLE", "Ez az útvonal nem lesz választható, amíg a library és az illusztráció hiányos.");
            }
          }
          if (blocked(rawOption.availability)) warn(op, "OPTION_BLOCKED", "Ez a tervezett útvonal az előnézetben szándékosan tiltott.");
        });
        if (!text(rawNode.defaultOptionId) || !optionIds.has(rawNode.defaultOptionId)) error(`${path}.defaultOptionId`, "DEFAULT_OPTION", "Az alapútvonalnak létező opcióra kell mutatnia.");
      }
    } else error(`${path}.type`, "NODE_TYPE", "Csak segment és decision típusú csomópont támogatható.");
  });

  if (text(source.startNodeId) && !nodes.has(source.startNodeId)) error("startNodeId", "MISSING_START", "A kezdő csomópont nem található.");
  if (text(source.endNodeId) && nodes.has(source.endNodeId)) error("endNodeId", "END_COLLISION", "A záró jelölő nem lehet valódi csomópont.");
  if (text(source.endNodeId)) {
    for (const [nodeId, node] of nodes) {
      if (node.type === "segment" && text(node.nextNodeId) && node.nextNodeId !== source.endNodeId && !nodes.has(node.nextNodeId)) error(`nodes.${nodeId}.nextNodeId`, "DANGLING", "Hiányzó következő csomópont.");
      if (node.type === "decision" && Array.isArray(node.options)) for (const option of node.options) {
        if (obj(option) && text(option.nextNodeId) && option.nextNodeId !== source.endNodeId && !nodes.has(option.nextNodeId)) error(`nodes.${nodeId}.options`, "DANGLING", `Hiányzó ágcél: ${option.nextNodeId}`);
      }
    }
  }
  // Check every live route, not merely the default. Blocked branches remain in the draft but do not run.
  if (!errors.length) {
    const dfs = (id: string, expectedStart: number, seen: Set<string>) => {
      if (availableRouteCount >= 256 || errors.length) return;
      if (id === source.endNodeId) {
        if (expectedStart !== source.durationSec) error(`route.${id}`, "ROUTE_DURATION", `Útvonalhossz: ${expectedStart}, várt: ${source.durationSec}.`);
        else availableRouteCount++;
        return;
      }
      if (seen.has(id)) { error(`route.${id}`, "CYCLE", "Ciklus az útvonalban."); return; }
      const node = nodes.get(id);
      if (!node) { error(`route.${id}`, "MISSING", "Nem létező csomópont."); return; }
      if (blocked(node.availability)) { error(`route.${id}`, "BLOCKED_TARGET", "Aktív ág blokkolt csomópontba fut."); return; }
      if (node.startGlobalSec !== expectedStart) { error(`route.${id}`, "ROUTE_TIME", `Időrés vagy átfedés: ${expectedStart} helyett ${node.startGlobalSec}.`); return; }
      const nextSeen = new Set([...seen, id]);
      if (node.type === "segment") dfs(node.nextNodeId as string, expectedStart + (node.durationSec as number), nextSeen);
      else {
        const options = (node.options as Obj[]).filter((o) => !blocked(o.availability) && Boolean(poses[o.imagePoseId as string]?.imageUrl) &&
          (!Array.isArray(o.requiresPoseIds) || o.requiresPoseIds.every((poseId) => text(poseId) && Boolean(poses[poseId]?.imageUrl))));
        if (!options.length) { error(`route.${id}`, "NO_OPTIONS", "A döntésnek nincs elérhető, illusztrált ága."); return; }
        if (!options.some((o) => o.id === node.defaultOptionId)) warn(`route.${id}`, "DEFAULT_UNAVAILABLE", "Az alapág jelenleg nem elérhető: a tervezet menthető, de a próbalеjátszás az alapág rendezéséig nem indítható.");
        for (const option of options) dfs(option.nextNodeId as string, expectedStart + (node.durationSec as number), nextSeen);
      }
    };
    dfs(source.startNodeId as string, 0, new Set());
    if (availableRouteCount >= 256) error("nodes", "TOO_MANY_ROUTES", "Túl sok bejárható útvonal (maximum 255).");
  }
  if (poseIds.size > 0 && [...poseIds].some((id) => !poses[id])) warn("nodes", "LIBRARY_GAPS", "A tervezet hiányzó opcionális pózokat tartalmaz; a lejátszó elrejti őket.");
  const report: ImportReport = {
    ok: errors.length === 0, errors, warnings,
    practiceId: text(source.practiceId) ? source.practiceId : "",
    title: text(source.title) ? source.title : "",
    version: text(source.version) ? source.version : "",
    durationSec: integer(source.durationSec) ? source.durationSec : 0,
    nodeCount: source.nodes.length, availableRouteCount,
  };
  return { script: report.ok ? source as PracticeScript : null, report };
}
