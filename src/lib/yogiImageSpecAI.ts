import OpenAI from "openai";
import type { Pose } from "./yogiKnowledgeSchema";

type SpecResult = {
  spec: string;
  warning?: string | null;
  warning_detail?: string | null;
};

type PoseSpecInput = Pick<Pose, "name_en" | "name_hu" | "slug" | "setup" | "entry" | "hold">;

const CORE_FIELDS = [
  "head_neck_gaze",
  "arms_shoulders_hands",
  "chest_spine",
  "pelvis_hips",
  "front_leg",
  "back_leg",
  "base_weight",
  "pose_axis",
  "critical_relation_1",
  "critical_relation_2",
  "visibility_constraint",
  "occlusion_rule",
] as const;

type CoreField = (typeof CORE_FIELDS)[number];

const FIELD_PREFIXES: Record<CoreField, string> = {
  head_neck_gaze: "Head/Neck/Gaze",
  arms_shoulders_hands: "Arms/Shoulders/Hands",
  chest_spine: "Chest/Spine",
  pelvis_hips: "Pelvis/Hips",
  front_leg: "Front Leg",
  back_leg: "Back Leg",
  base_weight: "Base/Weight",
  pose_axis: "Pose Axis",
  critical_relation_1: "Critical Relation 1",
  critical_relation_2: "Critical Relation 2",
  visibility_constraint: "Visibility Constraint",
  occlusion_rule: "Occlusion Rule",
};

const FORBIDDEN_PHRASES = [
  "if necessary",
  "if needed",
  "should ",
  "may ",
  "can ",
  "ensure",
  "as you",
  "breathe",
  "inhale",
  "exhale",
  "gently",
  "slowly",
  "carefully",
  "warm up",
  "repeat",
  "switch sides",
  "listen to your body",
  "avoid pain",
  "start ",
  "continue ",
];

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function toSentence(value: string) {
  const cleaned = cleanText(value);
  if (!cleaned) return "";
  const next = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return /[.!?]$/.test(next) ? next : `${next}.`;
}

function splitSentences(text: string) {
  return cleanText(text)
    .split(/[.!?]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeSpec(spec: string) {
  return cleanText(spec);
}

function fieldLabel(field: CoreField) {
  return FIELD_PREFIXES[field];
}

function hasForbiddenLanguage(text: string) {
  const lower = normalize(text);
  return FORBIDDEN_PHRASES.some((phrase) => lower.includes(normalize(phrase)));
}

function extractKeyFacts(text: string) {
  const keywords = [
    "shin",
    "tibia",
    "knee",
    "hip",
    "hips",
    "pelvis",
    "foot",
    "feet",
    "ankle",
    "thigh",
    "calf",
    "spine",
    "chest",
    "shoulder",
    "shoulders",
    "hand",
    "hands",
    "arm",
    "arms",
    "leg",
    "legs",
    "torso",
    "front",
    "back",
    "diagonal",
    "upright",
    "folded",
    "extended",
    "square",
    "level",
    "parallel",
  ];

  const sentences = splitSentences(text);
  const facts: string[] = [];

  for (const sentence of sentences) {
    const lower = normalize(sentence);
    if (!keywords.some((key) => lower.includes(key))) continue;
    facts.push(sentence);
    if (facts.length >= 8) break;
  }

  return facts;
}

function getPoseSpecificRule(pose: PoseSpecInput) {
  const slug = normalize(pose.slug || "");
  const name = normalize(`${pose.name_en || ""} ${pose.name_hu || ""}`);

  if (slug === "pigeon" || name.includes("pigeon") || name.includes("galamb")) {
    return [
      "Special rule for Pigeon Pose:",
      "the front shin must be described explicitly as placed diagonally across the front of the pose in front of the pelvis.",
      "The front shin must remain clearly visible and must not be described as hidden directly underneath the torso or front thigh unless the source text explicitly says so.",
      "The back leg must be described separately as extending straight behind the body.",
      "The pose is asymmetrical and the front side and back side must remain distinct.",
      "Do not turn this into a generic kneeling lunge, seated fold, or folded-leg-under-torso shape.",
      "Do not say that the front knee is substantially in front of the front ankle.",
    ].join(" ");
  }

  if (
    slug === "warrior_i" ||
    slug === "warrior_ii" ||
    slug === "triangle" ||
    slug === "extended_side_angle" ||
    slug === "half_moon"
  ) {
    return [
      "Special rule:",
      "if the pose is asymmetrical, the front side and back side must be described separately and must not collapse into a symmetrical standing shape.",
    ].join(" ");
  }

  return "";
}

function buildPoseSpecPrompt(pose: PoseSpecInput) {
  const name = pose.name_en || pose.name_hu || pose.slug;
  const setup = cleanText(pose.setup?.trim() ?? "");
  const entry = cleanText(pose.entry?.trim() ?? "");
  const hold = cleanText(pose.hold?.trim() ?? "");
  const combinedSource = [setup, entry, hold].filter(Boolean).join(" ");
  const keyFacts = extractKeyFacts(combinedSource);
  const poseSpecificRule = getPoseSpecificRule(pose);

  return `
You generate a geometry-first pose specification for a yoga mannequin image.

Pose identity: ${name}
Pose slug: ${pose.slug ?? ""}
Setup description: ${setup || "none"}
Entry description: ${entry || "none"}
Hold description: ${hold || "none"}

Key pose facts that must be preserved:
${keyFacts.length > 0 ? keyFacts.map((fact, i) => `${i + 1}. ${fact}`).join("\n") : "none"}

${poseSpecificRule ? `Pose-specific rule: ${poseSpecificRule}` : ""}

Global geometry rules:
- Output JSON only.
- Describe the authentic yoga pose only.
- Use plain English.
- Keep each field to exactly one factual sentence.
- No instructional, conditional, motivational, or breath-based language.
- No camera, lighting, style, background, environment, or mat-framing instructions.
- Preserve front/back asymmetry when present.
- Preserve exact limb geometry from the source text.
- Do not simplify asymmetrical leg positions into a generic folded-leg or kneeling shape.
- Maintain clear spatial separation between shin, thigh, pelvis, and torso when the pose requires it.
- Use negative constraints when needed, for example "must not be hidden under the torso".

Field requirements:
- head_neck_gaze: mention head, neck, and gaze.
- arms_shoulders_hands: mention arms, shoulders, elbows, wrists, and hands.
- chest_spine: mention chest and spine.
- pelvis_hips: mention pelvis and hips.
- front_leg: describe the front leg only; mention front knee, front shin, front ankle, front foot, and front toes where applicable.
- back_leg: describe the back leg only; mention back knee, back shin or calf, back ankle, back foot, and back toes where applicable.
- base_weight: describe the support base and weight distribution.
- pose_axis: describe the main orientation of the body in the pose.
- critical_relation_1: describe one critical anatomical relation that distinguishes the pose.
- critical_relation_2: describe another critical anatomical relation that distinguishes the pose.
- visibility_constraint: describe which crucial body part must remain clearly visible.
- occlusion_rule: describe what must not overlap or hide another body part incorrectly.

Return JSON with exactly these fields:
{
  "head_neck_gaze": "...",
  "arms_shoulders_hands": "...",
  "chest_spine": "...",
  "pelvis_hips": "...",
  "front_leg": "...",
  "back_leg": "...",
  "base_weight": "...",
  "pose_axis": "...",
  "critical_relation_1": "...",
  "critical_relation_2": "...",
  "visibility_constraint": "...",
  "occlusion_rule": "..."
}
  `.trim();
}

function buildRepairPrompt(original: Record<string, string>, pose: PoseSpecInput) {
  const poseSpecificRule = getPoseSpecificRule(pose);

  return `
Revise the following JSON fields to remove instructional or conditional language while preserving exact pose geometry.

Rules:
- Keep the same JSON keys.
- Keep each value to one factual sentence.
- Preserve exact front/back limb geometry.
- Preserve all critical anatomical relations.
- Do not simplify asymmetrical leg positions into a generic folded-leg or kneeling shape.
- Keep negative constraints if they help prevent a wrong pose reading.
- head_neck_gaze must mention head, neck, gaze.
- arms_shoulders_hands must mention arms, shoulders, elbows, wrists, hands.
- chest_spine must mention chest, spine.
- pelvis_hips must mention pelvis, hips.
- front_leg must describe the front leg only.
- back_leg must describe the back leg only.
- base_weight must describe support base and weight.
- pose_axis must describe overall body orientation.
- visibility_constraint must clearly state what must remain visible.
- occlusion_rule must clearly state what must not be hidden or overlap incorrectly.
- No camera, lighting, style, background, environment, or mat framing.
- No instructional language.

${poseSpecificRule ? `Pose-specific rule: ${poseSpecificRule}` : ""}

Return JSON only.

JSON to revise:
${JSON.stringify(original)}
  `.trim();
}

function ensurePrefixed(field: CoreField, sentence: string) {
  const label = fieldLabel(field);
  const cleaned = normalizeSpec(sentence);
  if (!cleaned) return "";
  if (cleaned.toLowerCase().startsWith(label.toLowerCase())) return cleaned;
  return `${label} ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`;
}

function buildSpecFromFields(fields: Record<string, string>) {
  const ordered: string[] = [];

  for (const key of CORE_FIELDS) {
    const value = fields[key] ?? "";
    const next = ensurePrefixed(key, value);
    if (next) ordered.push(toSentence(next));
  }

  return ordered.slice(0, 12).join(" ");
}

function getOutputText(response: any) {
  const direct = response?.output_text;
  if (typeof direct === "string" && direct.length > 0) return direct;
  const items = Array.isArray(response?.output) ? response.output : [];
  for (const item of items) {
    if (item?.type !== "message" || !Array.isArray(item?.content)) continue;
    const textPart = item.content.find((part: any) => part?.type === "output_text" || part?.type === "text");
    if (textPart?.text) return textPart.text as string;
  }
  return "";
}

function parseJson(text: string) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    throw new Error("Spec output was not strict JSON.");
  }
  return JSON.parse(trimmed) as Record<string, string>;
}

function enforceSentenceCount(spec: string) {
  const sentences = splitSentences(spec);
  let warning: string | null = null;

  if (sentences.length > 12) {
    warning = "spec_trimmed_to_12_sentences";
    return { spec: `${sentences.slice(0, 12).join(". ")}.`, warning };
  }

  if (sentences.length < 8) {
    const filler = [
      "Head/Neck/Gaze head neutral, neck long, gaze steady.",
      "Arms/Shoulders/Hands arms stable, shoulders aligned, elbows and wrists clear, hands placed consistently.",
      "Chest/Spine chest organized over a long spine.",
      "Pelvis/Hips pelvis clearly positioned with hips aligned for the pose.",
      "Front Leg front leg geometry remains clearly defined.",
      "Back Leg back leg geometry remains clearly defined.",
      "Base/Weight weight grounded through the support base.",
      "Pose Axis the overall body orientation remains clearly readable.",
    ];
    const needed = 8 - sentences.length;
    warning = "spec_extended_to_8_sentences";
    return { spec: `${[...sentences, ...filler.slice(0, needed)].join(". ")}.`, warning };
  }

  return { spec: `${sentences.join(". ")}.`, warning };
}

function postValidateFieldContent(fields: Record<string, string>, pose: PoseSpecInput) {
  const warnings: string[] = [];

  const frontLeg = normalize(fields.front_leg ?? "");
  const backLeg = normalize(fields.back_leg ?? "");
  const visibility = normalize(fields.visibility_constraint ?? "");
  const occlusion = normalize(fields.occlusion_rule ?? "");
  const critical1 = normalize(fields.critical_relation_1 ?? "");
  const critical2 = normalize(fields.critical_relation_2 ?? "");
  const slug = normalize(pose.slug || "");
  const name = normalize(`${pose.name_en || ""} ${pose.name_hu || ""}`);

  if (!frontLeg.includes("front")) warnings.push("front_leg_missing_front_reference");
  if (!backLeg.includes("back")) warnings.push("back_leg_missing_back_reference");
  if (!visibility.includes("visible")) warnings.push("visibility_constraint_missing_visible");
  if (!occlusion.includes("not")) warnings.push("occlusion_rule_missing_negative_constraint");

  if (slug === "pigeon" || name.includes("pigeon") || name.includes("galamb")) {
    const pigeonJoined = [frontLeg, critical1, critical2, visibility, occlusion].join(" ");

    if (!pigeonJoined.includes("shin")) warnings.push("pigeon_missing_shin_reference");
    if (!pigeonJoined.includes("diagonal")) warnings.push("pigeon_missing_diagonal_reference");
    if (pigeonJoined.includes("knee is substantially in front of the front ankle")) {
      warnings.push("pigeon_contains_bad_knee_ankle_relation");
    }
    if (!occlusion.includes("underneath the torso") && !occlusion.includes("under the torso")) {
      warnings.push("pigeon_missing_under_torso_negative_rule");
    }
  }

  return warnings;
}

export async function generatePoseImageSpecAI(pose: PoseSpecInput): Promise<SpecResult | null> {
  const model = process.env.YOGI_IMAGE_SPEC_MODEL || process.env.YOGI_AI_MODEL;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!model || !apiKey) {
    return {
      spec: "",
      warning: "spec_ai_disabled",
      warning_detail: "Missing YOGI_IMAGE_SPEC_MODEL (or YOGI_AI_MODEL) or OPENAI_API_KEY.",
    };
  }

  const client = new OpenAI({ apiKey });
  const prompt = buildPoseSpecPrompt(pose);

  try {
    const schema = {
      type: "object",
      additionalProperties: false,
      required: [...CORE_FIELDS],
      properties: {
        head_neck_gaze: { type: "string" },
        arms_shoulders_hands: { type: "string" },
        chest_spine: { type: "string" },
        pelvis_hips: { type: "string" },
        front_leg: { type: "string" },
        back_leg: { type: "string" },
        base_weight: { type: "string" },
        pose_axis: { type: "string" },
        critical_relation_1: { type: "string" },
        critical_relation_2: { type: "string" },
        visibility_constraint: { type: "string" },
        occlusion_rule: { type: "string" },
      },
    } as const;

    const response = await client.responses.create({
      model,
      input: [{ role: "user", content: prompt }],
      text: {
        format: {
          name: "yogi_pose_image_spec_v2",
          type: "json_schema",
          strict: true,
          schema,
        },
      },
    });

    const parsed = parseJson(getOutputText(response));

    const fields: Record<string, string> = {
      head_neck_gaze: parsed.head_neck_gaze ?? "",
      arms_shoulders_hands: parsed.arms_shoulders_hands ?? "",
      chest_spine: parsed.chest_spine ?? "",
      pelvis_hips: parsed.pelvis_hips ?? "",
      front_leg: parsed.front_leg ?? "",
      back_leg: parsed.back_leg ?? "",
      base_weight: parsed.base_weight ?? "",
      pose_axis: parsed.pose_axis ?? "",
      critical_relation_1: parsed.critical_relation_1 ?? "",
      critical_relation_2: parsed.critical_relation_2 ?? "",
      visibility_constraint: parsed.visibility_constraint ?? "",
      occlusion_rule: parsed.occlusion_rule ?? "",
    };

    const needsRepair = Object.values(fields).some((value) => hasForbiddenLanguage(value));

    if (needsRepair) {
      const repair = await client.responses.create({
        model,
        input: [{ role: "user", content: buildRepairPrompt(fields, pose) }],
        text: {
          format: {
            name: "yogi_pose_image_spec_v2_repair",
            type: "json_schema",
            strict: true,
            schema,
          },
        },
      });

      const repaired = parseJson(getOutputText(repair));

      for (const key of CORE_FIELDS) {
        fields[key] = repaired[key] ?? fields[key];
      }
    }

    const validationWarnings = postValidateFieldContent(fields, pose);
    const spec = buildSpecFromFields(fields);

    if (!spec.trim()) return null;

    const { spec: finalSpec, warning } = enforceSentenceCount(spec);

    const combinedWarning =
      validationWarnings.length > 0
        ? [warning, ...validationWarnings].filter(Boolean).join("|")
        : warning ?? null;

    return {
      spec: finalSpec,
      warning: combinedWarning || null,
    };
  } catch (err) {
    return {
      spec: "",
      warning: "spec_ai_failed",
      warning_detail: (err as Error)?.message ?? "AI spec generation failed.",
    };
  }
}