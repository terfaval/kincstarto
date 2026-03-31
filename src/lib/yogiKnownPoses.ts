import poseSpecsRaw from "../../data/yogi/pose-image-specs.v1.json";
import { normalizeSlug } from "./slug";

export type KnownPose = {
  slug: string;
  name_hu: string;
  name_en: string;
  aliases?: string[];
};

type PoseSpecEntry = {
  slug: string;
  display_name: string;
  aliases?: string[];
};

type PoseSpecLibrary = {
  poses: PoseSpecEntry[];
};

const poseSpecs = poseSpecsRaw as PoseSpecLibrary;

const LEGACY_KNOWN_POSES: KnownPose[] = [
  { slug: "downward_facing_dog", name_hu: "Lefele nezo kutya", name_en: "Downward-Facing Dog" },
  { slug: "child_pose", name_hu: "Gyermekpoz", name_en: "Child's Pose" },
  { slug: "mountain", name_hu: "Hegyallas", name_en: "Mountain Pose" },
  { slug: "plank", name_hu: "Plank", name_en: "Plank" },
  { slug: "chaturanga", name_hu: "Chaturanga", name_en: "Chaturanga" },
  { slug: "upward_facing_dog", name_hu: "Felfele nezo kutya", name_en: "Upward-Facing Dog" },
  { slug: "cobra", name_hu: "Kobra", name_en: "Cobra Pose" },
  { slug: "warrior_i", name_hu: "Harcos I", name_en: "Warrior I" },
  { slug: "warrior_ii", name_hu: "Harcos II", name_en: "Warrior II" },
  { slug: "triangle", name_hu: "Haromszog", name_en: "Triangle Pose" },
  { slug: "tree", name_hu: "Fa", name_en: "Tree Pose" },
  { slug: "bridge", name_hu: "Hid", name_en: "Bridge Pose" },
  { slug: "seated_forward_fold", name_hu: "Ulo elorehajlas", name_en: "Seated Forward Fold" },
  { slug: "cat_cow", name_hu: "Macska-tehen", name_en: "Cat-Cow" },
  { slug: "low_lunge", name_hu: "Alacsony kitore", name_en: "Low Lunge" },
  { slug: "high_lunge", name_hu: "Magas kitore", name_en: "High Lunge" },
  { slug: "pigeon", name_hu: "Galamb", name_en: "Pigeon Pose" },
  { slug: "garland", name_hu: "Guggolo fuzer", name_en: "Garland Pose" },
  { slug: "staff", name_hu: "Botpoz", name_en: "Staff Pose" },
  { slug: "boat", name_hu: "Csonak", name_en: "Boat Pose" },
  { slug: "half_moon", name_hu: "Felhold", name_en: "Half Moon Pose" },
  { slug: "extended_side_angle", name_hu: "Nyujtott oldalszog", name_en: "Extended Side Angle" },
  { slug: "eagle", name_hu: "Sas", name_en: "Eagle Pose" },
  { slug: "corpse", name_hu: "Hullapoz", name_en: "Corpse Pose" },
];

const LEGACY_SLUG_MAP: Record<string, string> = {
  child_pose: "childs_pose",
  mountain: "mountain_pose",
  plank: "plank_pose",
  cobra: "cobra_pose",
  bridge: "bridge_pose",
  extended_side_angle: "extended_side_angle_pose",
  half_moon: "half_moon_pose",
  staff: "staff_pose",
  corpse: "corpse_pose",
};

const overridesBySlug = new Map<string, KnownPose>();
for (const entry of LEGACY_KNOWN_POSES) {
  const mappedSlug = LEGACY_SLUG_MAP[entry.slug] ?? entry.slug;
  overridesBySlug.set(normalizeSlug(mappedSlug), { ...entry, slug: mappedSlug });
}

const specKnownPoses: KnownPose[] = (poseSpecs.poses ?? []).map((pose) => {
  const override = overridesBySlug.get(normalizeSlug(pose.slug));
  return {
    slug: pose.slug,
    name_hu: override?.name_hu ?? pose.display_name,
    name_en: override?.name_en ?? pose.display_name,
    aliases: pose.aliases ?? [],
  };
});

const specSlugSet = new Set(specKnownPoses.map((pose) => normalizeSlug(pose.slug)));
const extraLegacyPoses = LEGACY_KNOWN_POSES.filter(
  (pose) => !specSlugSet.has(normalizeSlug(LEGACY_SLUG_MAP[pose.slug] ?? pose.slug))
);

export const KNOWN_POSES: KnownPose[] = [...specKnownPoses, ...extraLegacyPoses];

const LEGACY_SANSKRIT_BY_SLUG: Record<string, string> = {
  downward_facing_dog: "Adho Mukha Svanasana",
  child_pose: "Balasana",
  mountain: "Tadasana",
  plank: "Phalakasana",
  chaturanga: "Chaturanga Dandasana",
  upward_facing_dog: "Urdhva Mukha Svanasana",
  cobra: "Bhujangasana",
  warrior_i: "Virabhadrasana I",
  warrior_ii: "Virabhadrasana II",
  triangle: "Trikonasana",
  tree: "Vrksasana",
  bridge: "Setu Bandha Sarvangasana",
  seated_forward_fold: "Paschimottanasana",
  cat_cow: "Marjaryasana-Bitilasana",
  low_lunge: "Anjaneyasana",
  high_lunge: "Alanasana",
  pigeon: "Eka Pada Rajakapotasana",
  garland: "Malasana",
  staff: "Dandasana",
  boat: "Navasana",
  half_moon: "Ardha Chandrasana",
  extended_side_angle: "Utthita Parsvakonasana",
  eagle: "Garudasana",
  corpse: "Savasana",
};

const mappedSanskritEntries = Object.entries(LEGACY_SANSKRIT_BY_SLUG).reduce(
  (acc, [slug, value]) => {
    const mapped = LEGACY_SLUG_MAP[slug];
    if (mapped && !acc[mapped]) acc[mapped] = value;
    return acc;
  },
  {} as Record<string, string>
);

export const KNOWN_POSE_SANSKRIT: Record<string, string> = {
  ...LEGACY_SANSKRIT_BY_SLUG,
  ...mappedSanskritEntries,
};
