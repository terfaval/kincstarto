import type { Anatomy, Pose } from "./yogiKnowledgeSchema";

type PoseSpec = {
  hands?: string;
  feet?: string;
  knees?: string;
  hips?: string;
  pelvis?: string;
  spine?: string;
  neck?: string;
  shoulders?: string;
  head?: string;
  gaze?: string;
  arms?: string;
  legs?: string;
  elbows?: string;
  wrists?: string;
  ankles?: string;
  toes?: string;
  chest?: string;
  core?: string;
  weight?: string;
  orientation?: string;
  symmetry?: string;
};

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function cleanLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function toSentence(value: string) {
  const cleaned = cleanLine(value).replace(/[;:]/g, ",");
  if (!cleaned) return "";
  const next = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return /[.!?]$/.test(next) ? next : `${next}.`;
}

function isPromptLikeLine(line: string) {
  const lower = normalize(line);
  return (
    lower.includes("image spec") ||
    lower.includes("pose structure") ||
    lower.includes("mannequin:") ||
    lower.includes("style lock:") ||
    lower.includes("mat:") ||
    lower.includes("view:") ||
    lower.startsWith("cue:")
  );
}

function isInstructionalLine(line: string) {
  const lower = normalize(line);

  const huStarts = [
    "tedd",
    "helyezd",
    "hajlitsd",
    "emeld",
    "hosszitsd",
    "nyujtsd",
    "forditsd",
    "igazitsd",
    "sullyeszd",
    "tartsd",
    "lepj",
    "engedd",
    "nyomd",
    "huzd",
    "tamaszkodj",
    "aktivald",
    "forgasd",
    "melegitsd",
    "lazitsd",
    "nyisd",
    "zard",
    "billentsd",
    "maradj",
    "figyeld",
  ];

  const huIncludes = [
    "szukseg eseten",
    "ne eroltesd",
    "ne dolj",
    "belegzesre",
    "kilegzesre",
    "ismeteld",
    "bemelegites",
    "melegitsd be",
    "cserelj oldalt",
    "tartsd ki",
    "legzes",
  ];

  const enStarts = [
    "place ",
    "put ",
    "keep ",
    "bend ",
    "lift ",
    "draw ",
    "reach ",
    "extend ",
    "press ",
    "lengthen ",
    "engage ",
    "move ",
    "rest ",
    "avoid ",
    "breathe ",
    "repeat ",
    "switch ",
    "warm up ",
    "ground ",
    "lower ",
    "raise ",
    "straighten ",
    "align ",
    "soften ",
  ];

  const enIncludes = [
    "if needed",
    "if necessary",
    "hold for",
    "repeat",
    "switch sides",
    "warm up",
    "avoid pain",
    "listen to your body",
  ];

  return (
    huStarts.some((prefix) => lower.startsWith(prefix)) ||
    huIncludes.some((part) => lower.includes(part)) ||
    enStarts.some((prefix) => lower.startsWith(prefix)) ||
    enIncludes.some((part) => lower.includes(part))
  );
}

function splitSentences(value?: string | null) {
  if (!value) return [];
  return value
    .replace(/\s+/g, " ")
    .trim()
    .split(/[.!?]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function collectPoseLines(pose: Pose) {
  const lines = [
    ...splitSentences(pose.hold),
  ];

  return lines
    .map(cleanLine)
    .filter(Boolean)
    .filter((line) => !isPromptLikeLine(line));
}

function setIfEmpty(
  spec: PoseSpec,
  key: keyof PoseSpec,
  value: string | undefined | null,
) {
  if (!value) return;
  if (!spec[key]) spec[key] = toSentence(value);
}

function fillSpecFromLine(spec: PoseSpec, line: string) {
  const lower = normalize(line);

  // hands
  if (
    lower.includes("tenyer") &&
    (lower.includes("talaj") || lower.includes("matrac") || lower.includes("mat"))
  ) {
    setIfEmpty(spec, "hands", "Hands grounded on the mat");
  } else if (
    lower.includes("kez") &&
    (lower.includes("talaj") || lower.includes("matrac") || lower.includes("mat"))
  ) {
    setIfEmpty(spec, "hands", "Hands grounded on the mat");
  } else if (
    lower.includes("imatarto") ||
    (lower.includes("tenyer") && lower.includes("mellkas"))
  ) {
    setIfEmpty(spec, "hands", "Hands together at the chest");
  }

  // wrists
  if (
    lower.includes("csuklo") &&
    lower.includes("vall")
  ) {
    setIfEmpty(spec, "wrists", "Wrists aligned under the shoulders");
  }

  // elbows
  if (lower.includes("konyok") && lower.includes("hajl")) {
    setIfEmpty(spec, "elbows", "Elbows bent close to the body");
  } else if (lower.includes("konyok") && lower.includes("nyujt")) {
    setIfEmpty(spec, "elbows", "Elbows extended without locking");
  }

  // arms
  if (lower.includes("kar") && lower.includes("oldal")) {
    setIfEmpty(spec, "arms", "Arms extended horizontally to the sides");
  } else if (
    lower.includes("kar") &&
    (lower.includes("elore") || lower.includes("elore"))
  ) {
    setIfEmpty(spec, "arms", "Arms extended forward");
  } else if (
    lower.includes("kar") &&
    (lower.includes("magas") || lower.includes("fej folott"))
  ) {
    setIfEmpty(spec, "arms", "Arms reaching overhead");
  } else if (lower.includes("kar") && (lower.includes("nyujt") || lower.includes("hosszu"))) {
    setIfEmpty(spec, "arms", "Arms long and active");
  } else if (lower.includes("kar") && lower.includes("aktiv")) {
    setIfEmpty(spec, "arms", "Arms active and engaged");
  }

  // shoulders
  if (
    lower.includes("vall") &&
    (lower.includes("le") || lower.includes("ful"))
  ) {
    setIfEmpty(spec, "shoulders", "Shoulders down and away from the ears");
  } else if (lower.includes("vall") && lower.includes("stabil")) {
    setIfEmpty(spec, "shoulders", "Shoulders stable over the arms");
  }

  // feet
  if (
    (lower.includes("lab") || lower.includes("talp")) &&
    lower.includes("csiposzeles")
  ) {
    setIfEmpty(spec, "feet", "Feet hip-width apart");
  } else if (lower.includes("labfej") && lower.includes("parhuzamos")) {
    setIfEmpty(spec, "feet", "Feet parallel");
  } else if (
    lower.includes("sarok") &&
    (lower.includes("talaj") || lower.includes("mat"))
  ) {
    setIfEmpty(spec, "feet", "Heels grounded on the mat");
  } else if (lower.includes("terpesz")) {
    setIfEmpty(spec, "feet", "Feet in a wide stance");
  } else if (
    lower.includes("elulso") &&
    lower.includes("lab")
  ) {
    setIfEmpty(spec, "feet", "Front foot grounded, back foot stable");
  }

  // toes
  if (lower.includes("labujj") && lower.includes("elore")) {
    setIfEmpty(spec, "toes", "Toes pointing forward");
  } else if (lower.includes("labujj") && lower.includes("hatra")) {
    setIfEmpty(spec, "toes", "Toes pointing back");
  }

  // ankles
  if (lower.includes("boka") && lower.includes("stabil")) {
    setIfEmpty(spec, "ankles", "Ankles stable and aligned");
  }

  // knees
  if (lower.includes("terd") && lower.includes("hajl")) {
    setIfEmpty(spec, "knees", "Knees bent in line with the toes");
  } else if (lower.includes("terd") && lower.includes("nyujt")) {
    setIfEmpty(spec, "knees", "Knees straight but not locked");
  }

  // legs
  if (lower.includes("lab") && lower.includes("aktiv")) {
    setIfEmpty(spec, "legs", "Legs active and steady");
  } else if (lower.includes("comb") && lower.includes("aktiv")) {
    setIfEmpty(spec, "legs", "Thighs active, legs steady");
  } else if (
    lower.includes("hatso lab") &&
    lower.includes("nyujt")
  ) {
    setIfEmpty(spec, "legs", "Back leg extended long behind the body");
  }

  // weight
  if (lower.includes("suly") && lower.includes("eloszt")) {
    setIfEmpty(spec, "weight", "Weight evenly distributed");
  } else if (
    lower.includes("suly") &&
    (lower.includes("talp") || lower.includes("lab"))
  ) {
    setIfEmpty(spec, "weight", "Weight grounded through the feet");
  }

  // hips
  if (
    lower.includes("csipo") &&
    (lower.includes("emelt") || lower.includes("fent") || lower.includes("magas"))
  ) {
    setIfEmpty(spec, "hips", "Hips elevated");
  } else if (
    lower.includes("csipo") &&
    (lower.includes("sullyeszt") || lower.includes("leenged") || lower.includes("alacsony"))
  ) {
    setIfEmpty(spec, "hips", "Hips lowered");
  } else if (
    lower.includes("csipo") &&
    (lower.includes("kozep") || lower.includes("szint"))
  ) {
    setIfEmpty(spec, "hips", "Hips centered and level");
  }

  // pelvis
  if (lower.includes("medence") && lower.includes("billent")) {
    setIfEmpty(spec, "pelvis", "Pelvis gently tipped to neutral");
  } else if (
    lower.includes("medence") &&
    (lower.includes("semleges") || lower.includes("neutral"))
  ) {
    setIfEmpty(spec, "pelvis", "Pelvis neutral and level");
  } else if (
    lower.includes("medence") &&
    (lower.includes("kozep") || lower.includes("igazit"))
  ) {
    setIfEmpty(spec, "pelvis", "Pelvis centered and level");
  }

  // spine
  if (
    lower.includes("gerinc") &&
    (lower.includes("semleges") || lower.includes("neutral"))
  ) {
    setIfEmpty(spec, "spine", "Spine neutral and long");
  } else if (
    lower.includes("gerinc") &&
    (lower.includes("hosszu") || lower.includes("megnyujt"))
  ) {
    setIfEmpty(spec, "spine", "Spine long and straight");
  } else if (
    (lower.includes("hat") || lower.includes("gerinc")) &&
    lower.includes("hajl")
  ) {
    setIfEmpty(spec, "spine", "Spine in a gentle backbend");
  } else if (
    lower.includes("torzs") &&
    lower.includes("hosszu")
  ) {
    setIfEmpty(spec, "spine", "Torso long through the spine");
  }

  // neck
  if (
    lower.includes("nyak") &&
    (lower.includes("hosszu") || lower.includes("megnyujt"))
  ) {
    setIfEmpty(spec, "neck", "Neck long and aligned with the spine");
  }

  // head
  if (lower.includes("fej") && lower.includes("semleges")) {
    setIfEmpty(spec, "head", "Head neutral");
  } else if (
    lower.includes("fej") &&
    (lower.includes("elore") || lower.includes("felfele") || lower.includes("lefele"))
  ) {
    setIfEmpty(spec, "head", "Head aligned clearly with the pose");
  }

  // gaze
  if (
    lower.includes("tekintet") &&
    (lower.includes("elore") || lower.includes("előre"))
  ) {
    setIfEmpty(spec, "gaze", "Gaze forward");
  } else if (
    lower.includes("tekintet") &&
    (lower.includes("le") || lower.includes("lefele") || lower.includes("lefelé"))
  ) {
    setIfEmpty(spec, "gaze", "Gaze downward");
  } else if (
    lower.includes("tekintet") &&
    (lower.includes("fel") || lower.includes("felfele") || lower.includes("felfelé"))
  ) {
    setIfEmpty(spec, "gaze", "Gaze upward");
  } else if (lower.includes("tekintet") && lower.includes("oldal")) {
    setIfEmpty(spec, "gaze", "Gaze to the side");
  }

  // chest
  if (lower.includes("mellkas") && lower.includes("nyit")) {
    setIfEmpty(spec, "chest", "Chest open");
  } else if (
    (lower.includes("szegycsont") || lower.includes("mellkas")) &&
    (lower.includes("emel") || lower.includes("lift"))
  ) {
    setIfEmpty(spec, "chest", "Chest lifted");
  }

  // core
  if (lower.includes("has") && lower.includes("aktiv")) {
    setIfEmpty(spec, "core", "Core gently engaged");
  } else if (
    lower.includes("koldok") &&
    (lower.includes("behuz") || lower.includes("befele"))
  ) {
    setIfEmpty(spec, "core", "Navel draws gently inward");
  }

  // orientation
  if (
    lower.includes("torzs") &&
    (lower.includes("elore") || lower.includes("előre"))
  ) {
    setIfEmpty(spec, "orientation", "Torso facing forward");
  } else if (
    lower.includes("mellkas") &&
    (lower.includes("elore") || lower.includes("nyit"))
  ) {
    setIfEmpty(spec, "orientation", "Chest open and facing forward");
  } else if (
    lower.includes("torzs") &&
    lower.includes("oldal")
  ) {
    setIfEmpty(spec, "orientation", "Torso oriented to the side");
  }

  // symmetry
  if (lower.includes("szimmet")) {
    setIfEmpty(spec, "symmetry", "Left-right symmetry preserved");
  }
}

function buildPoseSpecSentences(spec: PoseSpec) {
  const order: Array<keyof PoseSpec> = [
    "hands",
    "wrists",
    "elbows",
    "arms",
    "shoulders",
    "feet",
    "toes",
    "ankles",
    "knees",
    "legs",
    "weight",
    "hips",
    "pelvis",
    "spine",
    "neck",
    "head",
    "gaze",
    "chest",
    "core",
    "orientation",
    "symmetry",
  ];

  const sentences: string[] = [];

  for (const key of order) {
    const value = spec[key];
    if (value) sentences.push(value);
  }

  return sentences.slice(0, 18);
}

function forceMissingBodyParts(spec: PoseSpec) {
  if (!spec.hands) spec.hands = "Hands clearly placed.";
  if (!spec.wrists) spec.wrists = "Wrists aligned with forearms.";
  if (!spec.elbows) spec.elbows = "Elbows softly extended.";
  if (!spec.arms) spec.arms = "Arms long and active.";
  if (!spec.shoulders) spec.shoulders = "Shoulders stable.";
  if (!spec.neck) spec.neck = "Neck long.";
  if (!spec.head) spec.head = "Head neutral.";
  if (!spec.gaze) spec.gaze = "Gaze steady.";
  if (!spec.chest) spec.chest = "Chest open.";

  if (!spec.feet) spec.feet = "Feet clearly placed on the mat.";
  if (!spec.toes) spec.toes = "Toes aligned with foot direction.";
  if (!spec.ankles) spec.ankles = "Ankles stable.";
  if (!spec.knees) spec.knees = "Knees aligned with toes.";
  if (!spec.legs) spec.legs = "Legs active.";
  if (!spec.weight) spec.weight = "Weight grounded through the base.";

  if (!spec.hips) spec.hips = "Hips positioned for the pose.";
  if (!spec.pelvis) spec.pelvis = "Pelvis positioned for the pose.";
  if (!spec.core) spec.core = "Core engaged.";
  if (!spec.spine) spec.spine = "Spine long.";

  if (!spec.orientation) spec.orientation = "Torso oriented with the pose.";
  if (!spec.symmetry) spec.symmetry = "Left-right alignment preserved where applicable.";
}

export function buildPoseImageSpec(pose: Pose) {
  const spec: PoseSpec = {};
  const lines = collectPoseLines(pose);

  for (const line of lines) {
    fillSpecFromLine(spec, line);
  }

  forceMissingBodyParts(spec);

  const sentences = buildPoseSpecSentences(spec);

  const name = pose.name_en || pose.name_hu || pose.slug;
  const identity = name
    ? `Pose identity: ${name}. Do not substitute with a different pose.`
    : "Pose identity must be preserved. Do not substitute with a different pose.";

  return [identity, ...sentences].join(" ");
}

export function buildAnatomyImageSpec(anatomy: Anatomy) {
  const parts: string[] = [];
  const name = anatomy.name_en || anatomy.name_hu;

  parts.push(`Target structure: ${name}.`);
  if (anatomy.name_latin) parts.push(`Latin name: ${anatomy.name_latin}.`);
  if (anatomy.region) parts.push(`Region: ${anatomy.region}.`);
  if (anatomy.type) parts.push(`Type: ${anatomy.type}.`);
  parts.push("Only the target region is shown. Surrounding anatomy is simplified.");

  return parts.join(" ");
}
