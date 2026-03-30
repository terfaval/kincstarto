const CONTACT_KEYWORDS = ["grounded", "on the mat", "supported", "resting"];
const RELATION_KEYWORDS = ["in front of", "behind", "close to", "across"];
const DEBUG_PROMPT_COMPILER =
  typeof window === "undefined"
    ? process.env.YOGI_PROMPT_DEBUG === "1"
    : process.env.NEXT_PUBLIC_YOGI_PROMPT_DEBUG === "1";

function cleanSentence(value: string) {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
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

export function compilePoseSpec(spec: string): string {
  const sentences = splitSentences(spec);

  const cleaned = sentences
    .map(stripLabelPrefix)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((line) => !isNegative(line))
    .filter((line) => !line.toLowerCase().startsWith("pose identity"));

  const contact = cleaned.filter((line) => containsAny(line, CONTACT_KEYWORDS));
  const relations = cleaned.filter((line) => containsAny(line, RELATION_KEYWORDS));

  const selected: string[] = [];

  selected.push(...contact.slice(0, 2));
  if (selected.length < 3) {
    const next = relations.find((line) => !selected.includes(line));
    if (next) selected.push(next);
  }
  if (selected.length < 4) {
    const next = cleaned.find((line) => !selected.includes(line));
    if (next) selected.push(next);
  }

  const compiled = unique(selected)
    .slice(0, 4)
    .map(cleanSentence)
    .filter(Boolean)
    .join(" ");

  if (DEBUG_PROMPT_COMPILER) {
    console.log({
      rawSpec: spec,
      compiledSpec: compiled,
    });
  }

  if (compiled) return compiled;

  const fallback = cleaned[0] ? cleanSentence(cleaned[0]) : "";
  return fallback || cleanSentence(spec.trim());
}
