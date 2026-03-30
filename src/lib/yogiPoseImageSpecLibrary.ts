import poseSpecs from "@/data/yogi/pose-image-specs.v1.json";

type PoseInput = {
  slug?: string;
  name_en?: string;
  name_hu?: string;
  setup?: string;
  entry?: string;
  hold?: string;
};

type ResolvedSpec = {
  spec: string | null;
  source: "library" | "none";
  poseId?: string;
  variationId?: string;
};

function normalize(value?: string) {
  return (value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function findPoseEntry(pose: PoseInput) {
  const slug = normalize(pose.slug);
  const name = normalize(`${pose.name_en || ""} ${pose.name_hu || ""}`);

  return poseSpecs.poses.find((p) => {
    const base = normalize(p.slug);
    if (base === slug) return true;

    if (p.aliases?.some((a) => normalize(a) === slug)) return true;

    if (name.includes(base)) return true;
    if (p.aliases?.some((a) => name.includes(normalize(a)))) return true;

    return false;
  });
}

function selectVariation(entry: any, pose: PoseInput) {
  const text = normalize(
    `${pose.setup || ""} ${pose.entry || ""} ${pose.hold || ""}`
  );

  if (!entry.variations || entry.variations.length === 0) return null;

  for (const v of entry.variations) {
    if (v.match_tokens?.some((t: string) => text.includes(normalize(t)))) {
      return v;
    }
  }

  return entry.variations.find((v: any) => v.id === entry.default_variation) || entry.variations[0];
}

function buildSpecString(entry: any, variation: any) {
  const parts: string[] = [];

  parts.push(`Pose identity: ${entry.display_name}. Do not substitute with a different pose.`);

  const body = variation.body;

  parts.push(`Head/Neck/Gaze ${body.head_neck_gaze}.`);
  parts.push(`Arms/Shoulders/Hands ${body.arms_shoulders_hands}.`);
  parts.push(`Chest/Spine ${body.chest_spine}.`);
  parts.push(`Pelvis/Hips ${body.pelvis_hips}.`);
  parts.push(`Front Leg ${body.front_leg}.`);
  parts.push(`Back Leg ${body.back_leg}.`);
  parts.push(`Base/Weight ${body.base_weight}.`);
  parts.push(`Pose Axis ${body.pose_axis}.`);

  variation.critical_relations?.forEach((r: string, i: number) => {
    parts.push(`Critical Relation ${i + 1} ${r}.`);
  });

  variation.visibility_constraints?.forEach((v: string) => {
    parts.push(`Visibility Constraint ${v}.`);
  });

  variation.negative_constraints?.forEach((n: string) => {
    parts.push(`Occlusion Rule ${n}.`);
  });

  return parts.join(" ");
}

export function resolvePoseImageSpecFromLibrary(pose: PoseInput): ResolvedSpec {
  const entry = findPoseEntry(pose);
  if (!entry) return { spec: null, source: "none" };

  const variation = selectVariation(entry, pose);
  if (!variation) return { spec: null, source: "none" };

  const spec = buildSpecString(entry, variation);

  return {
    spec,
    source: "library",
    poseId: entry.id,
    variationId: variation.id,
  };
}

export default resolvePoseImageSpecFromLibrary;
