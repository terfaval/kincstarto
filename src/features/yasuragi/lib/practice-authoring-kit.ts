/** Minimal, portable Yasuragi authoring contract. No private drafts or asset URLs. */
import type { Pose } from "@/lib/yogiKnowledgeSchema";
import { YASURAGI_IMPORT_FORMAT } from "./practice-import";
import { YASURAGI_AUTHORING_FORMAT } from "./practice-authoring";

export const YASURAGI_KIT_FORMAT = "yasuragi.authoring-kit.v1";
export function buildYasuragiAuthoringKit(poses: readonly Pose[], allowedProps: readonly string[], generatedAt: string) {
  const library = poses.map((pose) => ({
    poseId: pose.id,
    slug: pose.slug,
    nameHu: pose.name_hu,
    nameEn: pose.name_en,
    status: pose.status,
    contentStatus: pose.content_status,
    validated: pose.validated,
    imageStatus: pose.mannequin_angled?.status ?? "missing",
    hasIllustration: Boolean(pose.mannequin_angled?.asset_ref),
  })).sort((a, b) => a.poseId.localeCompare(b.poseId));
  const examplePoseId = library.find((item) => item.status === "active")?.poseId ?? "REPLACE_WITH_EXISTING_POSE_ID";
  const examplePractice = {
    format: YASURAGI_IMPORT_FORMAT, status: "draft", practiceId: "example_replace_me", title: "Példa – írd át",
    version: "0.1-draft", durationSec: 120, startNodeId: "S0", endNodeId: "END",
    nodes: [{ id: "S0", type: "segment", name: "Példa – kényelmes megérkezés", startGlobalSec: 0, durationSec: 120,
      defaultPoseId: examplePoseId, posePool: [examplePoseId],
      poseVariants: { [examplePoseId]: { t: { full: "Helyezkedj el kényelmesen, találd meg a támaszaidat.", mini: "Helyezkedj el kényelmesen." }, equipment: [] } },
      cues: [{ id: "S0_M_01", atLocalSec: 15, latestStartLocalSec: 25, minVisibleSec: 10, maxVisibleSec: 20,
        appliesTo: "all_pool_poses", full: "Lazítsd el a válladat, majd térj vissza a természetes légzéshez.", mini: "Lazítsd el a válladat." }],
      nextNodeId: "END" }],
  };
  return {
    format: YASURAGI_KIT_FORMAT,
    generatedAt,
    purpose: "Yasuragi Unified Authoring: gyakorlás és szükség esetén új pózadatlap-javaslatok készítése.",
    importContract: { format: YASURAGI_AUTHORING_FORMAT, status: "draft", fallbackPracticeFormat: YASURAGI_IMPORT_FORMAT,
      limits: { maximumImportBytes: 600000, maximumNodes: 120, maximumPoseProposals: 32, practiceDurationSec: [60, 14400] },
      description: "Az output egyetlen UTF-8 JSON objektum: {format,status,projectId,practice,poseProposals}. A JSON-ban található status nem publikálás.",
    },
    exampleProject: { format: YASURAGI_AUTHORING_FORMAT, status: "draft", projectId: "example_replace_me", practice: examplePractice, poseProposals: [] },
    practiceFields: {
      required: ["format", "status", "practiceId", "title", "version", "durationSec", "startNodeId", "endNodeId", "nodes"],
      segment: ["id", "type=segment", "name", "startGlobalSec", "durationSec", "defaultPoseId", "posePool", "poseVariants", "cues", "nextNodeId"],
      poseVariant: ["t.full", "t.mini", "equipment[].catalogKey", "equipment[].tip"],
      cue: ["id", "atLocalSec", "latestStartLocalSec", "minVisibleSec", "maxVisibleSec", "appliesTo", "full", "mini"],
      decision: ["id", "type=decision", "name", "startGlobalSec", "durationSec", "defaultOptionId", "questionMini", "fullIntro", "options"],
      option: ["id", "label", "miniLabel", "imagePoseId", "nextNodeId", "default?", "availability?", "requiresPoseIds?"],
      note: "A minilejátszó a T és M szövegeket egyetlen prioritásos helyen jeleníti meg. A teljes nézet külön T és M-t használ. Minden élő útvonal időrésmentesen érjen a durationSec végéig.",
    },
    poseProposalFields: { required: ["poseId", "record", "illustration.brief"], note: "A record az aktuális PoseSchema teljes rekordja legyen. Kizárólag új draft rekordot javasolj: validated=false, mannequin_angled.status=missing, asset_ref=null. Ne találj ki létező azonosítót. A jelenlegi PoseSchema exportját külön mellékelni kell, ha új póz szükséges." },
    editorialRules: [
      "A közös alkotás beszélgetésben történik; a JSON-t csak jóváhagyott koncepció után exportáld.",
      "A létező pózokat az alábbi könyvtári ID-jukkal használd; a hiányzókat külön javaslatként kezeld.",
      "Nem állíthatod, hogy egy póz vagy illusztráció szakmailag validált, pusztán a generálástól.",
      "A T a póz hangulatos alapvezetése, az M időzített rövid mozgás/figyelem; az E a kontextuális segítség.",
      "Elágazásban az alapútvonal önmagában teljes értékű és végigjárható legyen.",
      "Nem szabad automatikusan képet feltölteni, jóváhagyást adni vagy gyakorlatot publikálni.",
    ],
    equipment: [...allowedProps],
    poses: library,
  };
}
