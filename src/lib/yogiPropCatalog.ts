import type { Pose } from "./yogiKnowledgeSchema";

export type PropCatalogItem = {
  key: string;
  label: string;
  slug: string;
  count: number;
};

export const ALLOWED_PROPS = [
  "fal",
  "szék",
  "takaró",
  "jóga tégla",
  "heveder",
  "párna",
  "habhenger",
  "jógaszőnyeg",
  "törölköző",
  "ék",
  "csuklótámasz",
];

function normalizeToken(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(token: string, candidates: string[]) {
  return candidates.some((candidate) => token.includes(candidate));
}

export function normalizePropLabel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const token = normalizeToken(trimmed);

  if (includesAny(token, ["fal"])) return "fal";
  if (includesAny(token, ["szek"])) return "szék";
  if (includesAny(token, ["korlat", "ballet"])) return "";
  if (includesAny(token, ["szemtakaro"])) return "";
  if (includesAny(token, ["terdalatet"])) return "";
  if (includesAny(token, ["habhenger"])) return "habhenger";
  if (includesAny(token, ["takaro", "pokroc", "pled"])) return "takaró";
  if (includesAny(token, ["torolkozo"])) return "törölköző";
  if (includesAny(token, ["heveder", "pant", "szij", "jogaszij"])) return "heveder";
  if (includesAny(token, ["bolster", "hengerparna", "henger parna"])) return "habhenger";
  if (includesAny(token, ["parna"])) return "párna";
  if (includesAny(token, ["csuklotamasz"])) return "csuklótámasz";
  if (includesAny(token, ["ek"])) return "ék";
  if (includesAny(token, ["tegl", "blokk", "block"])) return "jóga tégla";
  if (includesAny(token, ["jogaszonyeg", "szonyeg", "matrac"])) return "jógaszőnyeg";

  return "";
}

export function normalizePoseProps(props: string[] | null | undefined): string[] {
  if (!Array.isArray(props)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  props.forEach((prop) => {
    const normalized = normalizePropLabel(String(prop));
    if (!normalized) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });
  return result;
}

export function propLabelToSlug(label: string) {
  return normalizeToken(label).replace(/ /g, "-");
}

export function collectPropCatalog(poses: Pose[]): PropCatalogItem[] {
  const counts = new Map<string, number>();
  poses.forEach((pose) => {
    normalizePoseProps(pose.props).forEach((prop) => {
      counts.set(prop, (counts.get(prop) ?? 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .map(([label, count]) => ({
      key: label,
      label,
      slug: propLabelToSlug(label),
      count,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "hu"));
}
