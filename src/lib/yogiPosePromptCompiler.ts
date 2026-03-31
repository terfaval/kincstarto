const CONTACT_KEYWORDS = ["grounded", "on the mat", "supported", "resting"];
const RELATION_KEYWORDS = ["in front of", "behind", "close to", "across", "toward", "towards"];

const LOWER_BODY_LABEL_HINTS = [
  "pelvis/hips",
  "front leg",
  "back leg",
  "base/weight",
  "critical relation",
  "visibility constraint",
];

const UPPER_BODY_LABEL_HINTS = [
  "head/neck/gaze",
  "arms/shoulders/hands",
  "chest/spine",
];

const LOWER_BODY_TEXT_HINTS = [
  "pelvis",
  "hip",
  "hips",
  "shin",
  "thigh",
  "leg",
  "knee",
  "foot",
  "feet",
  "ankle",
  "ankles",
  "mat",
  "grounded",
  "supported",
  "resting",
];

const UPPER_BODY_TEXT_HINTS = [
  "hand",
  "hands",
  "arm",
  "arms",
  "shoulder",
  "shoulders",
  "chest",
  "spine",
  "head",
  "neck",
  "gaze",
];

const DEBUG_PROMPT_COMPILER =
  typeof window === "undefined"
    ? process.env.YOGI_PROMPT_DEBUG === "1"
    : process.env.NEXT_PUBLIC_YOGI_PROMPT_DEBUG === "1";

type SentenceEntry = {
  raw: string;
  clean: string;
  label: string | null;
};

function cleanSentence(value: string) {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function extractLabel(value: string): string | null {
  const trimmed = value.replace(/\s+/g, " ").trim();

  if (/^pose identity:\s*/i.test(trimmed)) return "pose identity";
  if (/^pose axis\s*/i.test(trimmed)) return "pose axis";
  if (/^head\/neck\/gaze\s*/i.test(trimmed)) return "head/neck/gaze";
  if (/^arms\/shoulders\/hands\s*/i.test(trimmed)) return "arms/shoulders/hands";
  if (/^chest\/spine\s*/i.test(trimmed)) return "chest/spine";
  if (/^pelvis\/hips\s*/i.test(trimmed)) return "pelvis/hips";
  if (/^front leg\s*/i.test(trimmed)) return "front leg";
  if (/^back leg\s*/i.test(trimmed)) return "back leg";
  if (/^base\/weight\s*/i.test(trimmed)) return "base/weight";
  if (/^critical relation\s*\d*\s*/i.test(trimmed)) return "critical relation";
  if (/^visibility constraint\s*/i.test(trimmed)) return "visibility constraint";
  if (/^negative constraint\s*/i.test(trimmed)) return "negative constraint";
  if (/^pose structure:\s*/i.test(trimmed)) return "pose structure";

  return null;
}

function stripLabelPrefix(value: string) {
  return value
    .replace(/^pose identity:\s*/i, "")
    .replace(/^pose axis\s*/i, "")
    .replace(/^head\/neck\/gaze\s*/i, "")
    .replace(/^arms\/shoulders\/hands\s*/i, "")
    .replace(/^chest\/spine\s*/i, "")
    .replace(/^pelvis\/hips\s*/i, "")
    .replace(/^front leg\s*/i, "")
    .replace(/^back leg\s*/i, "")
    .replace(/^base\/weight\s*/i, "")
    .replace(/^critical relation\s*\d*\s*/i, "")
    .replace(/^visibility constraint\s*/i, "")
    .replace(/^negative constraint\s*/i, "")
    .replace(/^pose structure:\s*/i, "")
    .trim();
}

function splitSentences(spec: string) {
  return spec
    .split(/[.!?]+/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

function containsAny(value: string, keywords: string[]) {
  const lower = value.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

function isNegative(value: string) {
  const lower = value.toLowerCase();
  return lower.includes("do not") || lower.startsWith("not ");
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function uniqueNormalizedLines(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const cleaned = value.replace(/\s+/g, " ").trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }

  return result;
}

export function compilePoseSpecFromLines(lines?: string[] | null): string | null {
  if (!lines || lines.length === 0) return null;

  const cleaned = uniqueNormalizedLines(lines).map(cleanSentence).filter(Boolean);

  if (cleaned.length === 0) return null;

  return cleaned.join(" ");
}

function buildEntries(spec: string): SentenceEntry[] {
  return splitSentences(spec)
    .map((raw) => ({
      raw,
      label: extractLabel(raw),
      clean: stripLabelPrefix(raw).replace(/\s+/g, " ").trim(),
    }))
    .filter((entry) => entry.clean)
    .filter((entry) => !isNegative(entry.clean))
    .filter((entry) => entry.label !== "pose identity")
    .filter((entry) => entry.label !== "negative constraint");
}

function isLowerBodyEntry(entry: SentenceEntry) {
  if (entry.label && LOWER_BODY_LABEL_HINTS.includes(entry.label)) return true;
  return containsAny(entry.clean, LOWER_BODY_TEXT_HINTS);
}

function isUpperBodyEntry(entry: SentenceEntry) {
  if (entry.label && UPPER_BODY_LABEL_HINTS.includes(entry.label)) return true;
  return containsAny(entry.clean, UPPER_BODY_TEXT_HINTS);
}

function isContactEntry(entry: SentenceEntry) {
  return containsAny(entry.clean, CONTACT_KEYWORDS);
}

function isRelationEntry(entry: SentenceEntry) {
  return containsAny(entry.clean, RELATION_KEYWORDS);
}

function isPrimaryContactEntry(entry: SentenceEntry) {
  const lower = entry.clean.toLowerCase();
  const hasShinOrLowerLeg = lower.includes("shin") || lower.includes("lower leg");
  const hasSupportLanguage =
    lower.includes("on the mat") ||
    lower.includes("supported") ||
    lower.includes("resting") ||
    lower.includes("rests");

  return hasShinOrLowerLeg && hasSupportLanguage;
}

function isSecondaryContactEntry(entry: SentenceEntry) {
  const lower = entry.clean.toLowerCase();
  return (
    lower.includes("back thigh grounded") ||
    (lower.includes("thigh") && lower.includes("grounded")) ||
    (lower.includes("back knee") && lower.includes("grounded"))
  );
}

function isGenericWeightEntry(entry: SentenceEntry) {
  const lower = entry.clean.toLowerCase();

  if (entry.label !== "base/weight" && !lower.startsWith("weight ")) {
    return false;
  }

  const strongSpecificityHints = [
    "pelvis",
    "back thigh",
    "front thigh",
    "shin",
    "hands",
    "feet",
    "foot",
    "knee",
    "knees",
    "forearm",
    "forearms",
  ];

  return !containsAny(lower, strongSpecificityHints);
}

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function sentenceComplexityPenalty(entry: SentenceEntry) {
  const lower = entry.clean.toLowerCase();
  let penalty = 0;

  const words = wordCount(entry.clean);
  if (words > 18) penalty += 2;
  if (words > 24) penalty += 2;

  const commaCount = (entry.clean.match(/,/g) || []).length;
  penalty += commaCount;

  if (lower.includes("with the")) penalty += 1;
  if (lower.includes("rather than")) penalty += 1;
  if (lower.includes("and the")) penalty += 1;
  if (lower.includes("creating ")) penalty += 1;

  return penalty;
}

function contactPriority(entry: SentenceEntry) {
  const lower = entry.clean.toLowerCase();

  if (isPrimaryContactEntry(entry)) return 8;
  if (isSecondaryContactEntry(entry)) return 6;
  if (lower.includes("foot")) return 2;
  if (isGenericWeightEntry(entry)) return 0;

  return 1;
}

function entryScore(entry: SentenceEntry) {
  let score = 0;

  if (isLowerBodyEntry(entry)) score += 4;
  if (isUpperBodyEntry(entry)) score += 1;

  if (isContactEntry(entry)) {
    score += 4 + contactPriority(entry);
  }

  if (entry.label === "front leg") score += 3;
  if (entry.label === "back leg") score += 3;
  if (entry.label === "pelvis/hips") score += 2;
  if (entry.label === "base/weight" && !isGenericWeightEntry(entry)) score += 2;
  if (entry.label === "critical relation") score += 3;
  if (entry.label === "visibility constraint") score += 3;
  if (entry.label === "arms/shoulders/hands") score += 2;
  if (entry.label === "chest/spine") score += 2;
  if (entry.label === "head/neck/gaze") score += 1;
  if (entry.label === "pose axis") score += 0;
  if (isRelationEntry(entry)) score += 2;

  if (isGenericWeightEntry(entry)) score -= 3;
  if (isUpperBodyEntry(entry) && !isLowerBodyEntry(entry)) score -= 1;

  score -= sentenceComplexityPenalty(entry);

  return score;
}

function normalizedTokenSet(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .filter((token) => token.length > 2)
  );
}

function overlapRatio(a: string, b: string) {
  const aSet = normalizedTokenSet(a);
  const bSet = normalizedTokenSet(b);

  if (aSet.size === 0 || bSet.size === 0) return 0;

  let overlap = 0;
  for (const token of aSet) {
    if (bSet.has(token)) overlap += 1;
  }

  return overlap / Math.min(aSet.size, bSet.size);
}

function isTooSimilar(candidate: SentenceEntry, selected: string[]) {
  return selected.some((existing) => overlapRatio(candidate.clean, existing) >= 0.6);
}

function pickBest(entries: SentenceEntry[], selected: string[]) {
  const candidates = entries
    .filter((entry) => !selected.includes(entry.clean))
    .filter((entry) => !isTooSimilar(entry, selected))
    .sort((a, b) => entryScore(b) - entryScore(a));

  return candidates[0] ?? null;
}

function pickBestShort(entries: SentenceEntry[], selected: string[]) {
  const candidates = entries
    .filter((entry) => !selected.includes(entry.clean))
    .filter((entry) => !isTooSimilar(entry, selected))
    .sort((a, b) => {
      const scoreDiff = entryScore(b) - entryScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      return wordCount(a.clean) - wordCount(b.clean);
    });

  return candidates[0] ?? null;
}

function debugCompiler(spec: string, entries: SentenceEntry[], compiledSpec: string, compilerMode: string) {
  if (!DEBUG_PROMPT_COMPILER) return;

  console.log({
    rawSpec: spec,
    compilerEntries: entries.map((entry) => ({
      label: entry.label,
      clean: entry.clean,
      lowerBody: isLowerBodyEntry(entry),
      upperBody: isUpperBodyEntry(entry),
      contact: isContactEntry(entry),
      relation: isRelationEntry(entry),
      primaryContact: isPrimaryContactEntry(entry),
      secondaryContact: isSecondaryContactEntry(entry),
      genericWeight: isGenericWeightEntry(entry),
      wordCount: wordCount(entry.clean),
      complexityPenalty: sentenceComplexityPenalty(entry),
      contactPriority: contactPriority(entry),
      score: entryScore(entry),
    })),
    compiledSpec,
    compilerMode,
  });
}

export function compilePoseSpec(spec: string): string {
  const entries = buildEntries(spec);

  const lowerBodyEntries = entries.filter(isLowerBodyEntry);
  const upperBodyEntries = entries.filter(isUpperBodyEntry);

  const primaryContacts = lowerBodyEntries.filter(isPrimaryContactEntry);
  const secondaryContacts = lowerBodyEntries.filter(isSecondaryContactEntry);
  const otherContacts = lowerBodyEntries.filter(
    (entry) =>
      isContactEntry(entry) &&
      !isPrimaryContactEntry(entry) &&
      !isSecondaryContactEntry(entry) &&
      !isGenericWeightEntry(entry)
  );

  const criticalOrVisibility = entries.filter(
    (entry) => entry.label === "critical relation" || entry.label === "visibility constraint"
  );

  const relationEntries = entries.filter(isRelationEntry);
  const poseAxisEntries = entries.filter((entry) => entry.label === "pose axis");
  const strongUpperBodyEntries = upperBodyEntries.filter(
    (entry) => entry.label === "arms/shoulders/hands" || entry.label === "chest/spine"
  );
  const nonGenericLowerBodyEntries = lowerBodyEntries.filter((entry) => !isGenericWeightEntry(entry));
  const nonGenericWeightEntries = entries.filter(
    (entry) => entry.label === "base/weight" && !isGenericWeightEntry(entry)
  );

  const selected: string[] = [];

  const firstPrimary = pickBestShort(primaryContacts, selected);
  if (firstPrimary) selected.push(firstPrimary.clean);

  const firstSecondary = pickBestShort(secondaryContacts, selected);
  if (firstSecondary) selected.push(firstSecondary.clean);

  if (selected.length < 3) {
    const structuralThird =
      pickBestShort(criticalOrVisibility, selected) ??
      pickBestShort(relationEntries, selected) ??
      pickBestShort(strongUpperBodyEntries, selected) ??
      pickBestShort(nonGenericWeightEntries, selected) ??
      pickBestShort(otherContacts, selected) ??
      pickBestShort(nonGenericLowerBodyEntries, selected) ??
      pickBest(entries, selected);

    if (structuralThird) selected.push(structuralThird.clean);
  }

  if (selected.length < 4) {
    const structuralFourth =
      pickBestShort(criticalOrVisibility, selected) ??
      pickBestShort(strongUpperBodyEntries, selected) ??
      pickBestShort(relationEntries, selected) ??
      pickBestShort(nonGenericWeightEntries, selected) ??
      pickBestShort(nonGenericLowerBodyEntries, selected) ??
      pickBestShort(poseAxisEntries, selected) ??
      pickBest(entries, selected);

    if (structuralFourth) selected.push(structuralFourth.clean);
  }

  const compiled = unique(selected)
    .slice(0, 4)
    .map(cleanSentence)
    .filter(Boolean)
    .join(" ");

  if (compiled) {
    debugCompiler(spec, entries, compiled, "structured-fallback");
    return compiled;
  }

  const fallbackEntry =
    pickBestShort(criticalOrVisibility, []) ??
    pickBestShort(nonGenericLowerBodyEntries, []) ??
    pickBestShort(strongUpperBodyEntries, []) ??
    pickBest(nonGenericWeightEntries, []) ??
    pickBest(entries, []);

  if (fallbackEntry) {
    const fallbackCompiled = cleanSentence(fallbackEntry.clean);
    debugCompiler(spec, entries, fallbackCompiled, "single-line-fallback");
    return fallbackCompiled;
  }

  const rawFallback = cleanSentence(spec.trim());
  debugCompiler(spec, entries, rawFallback, "raw-spec-fallback");
  return rawFallback;
}