import type { SpiritBook, SpiritLevel, SpiritTradition } from "./spiritSchema";

const LEVEL_FLOW: SpiritLevel[] = ["kezdo", "kozep-halado", "halado"];

export type NextStepItem = {
  book: SpiritBook;
  score: number;
  reasons: string[];
};

export type NextStepResult = {
  ordered_ids: string[];
  explanations: string[];
  items: NextStepItem[];
};

export type LearningPathFilters = {
  tradition?: SpiritTradition;
  themes?: string[];
  startLevel?: SpiritLevel;
  minLength?: number;
  maxLength?: number;
};

export type LearningPathStep = {
  book: SpiritBook;
  reasons: string[];
};

export type LearningPathResult = {
  ordered_ids: string[];
  explanations: string[];
  steps: LearningPathStep[];
  flow: number;
};

function levelIndex(level: SpiritLevel) {
  return LEVEL_FLOW.indexOf(level);
}

function sharedThemes(a: SpiritBook, b: SpiritBook) {
  const set = new Set(a.themes);
  let count = 0;
  b.themes.forEach((theme) => {
    if (set.has(theme)) count += 1;
  });
  return count;
}

function isRelated(a: SpiritBook, b: SpiritBook) {
  return Boolean(a.related?.includes(b.id) || b.related?.includes(a.id));
}

function compareByTitle(a: SpiritBook, b: SpiritBook) {
  return a.title.localeCompare(b.title, "hu");
}

function buildReasonList(parts: string[]) {
  return parts.filter(Boolean);
}

export function getNextBookRecommendations(
  books: SpiritBook[],
  currentBookId: string,
  options?: { excludeCompleted?: boolean; minScore?: number; limit?: number }
): NextStepResult {
  const current = books.find((book) => book.id === currentBookId);
  if (!current) {
    return { ordered_ids: [], explanations: [], items: [] };
  }

  const minScore = options?.minScore ?? 5;
  const limit = options?.limit ?? 6;

  const scored = books
    .filter((book) => book.id !== current.id)
    .filter((book) => (options?.excludeCompleted ? book.status !== "befejezett" : true))
    .map((book) => {
      const related = isRelated(current, book);
      const shared = sharedThemes(current, book);
      const sameTradition = book.tradition === current.tradition;
      const sameFormat = book.format === current.format;
      const sameLanguage = book.language === current.language;
      const jump = Math.abs(levelIndex(book.level) - levelIndex(current.level));

      let score = 0;
      if (related) score += 12;
      score += shared * 5;
      if (sameTradition) score += 3;
      if (sameFormat) score += 1;
      if (sameLanguage) score += 1;
      if (jump > 1) score -= 4;
      if (current.level === "halado" && book.level === "kezdo") score -= 6;

      const reasons: string[] = [];
      if (related) reasons.push("Kapcsolódó könyv");
      if (shared > 0) reasons.push(`${shared} közös téma`);
      if (sameTradition) reasons.push("Azonos tradíció");
      if (sameFormat) reasons.push("Azonos formátum");
      if (sameLanguage) reasons.push("Azonos nyelv");
      if (jump > 1) reasons.push("Nagy szintugrás");
      if (current.level === "halado" && book.level === "kezdo") reasons.push("Visszalépés kezdőre");

      return { book, score, shared, reasons };
    })
    .filter((item) => item.score >= minScore)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.shared !== a.shared) return b.shared - a.shared;
      if (a.book.tradition !== b.book.tradition) return a.book.tradition.localeCompare(b.book.tradition, "hu");
      return compareByTitle(a.book, b.book);
    })
    .slice(0, limit)
    .map((item) => ({
      book: item.book,
      score: item.score,
      reasons: buildReasonList(item.reasons),
    }));

  return {
    ordered_ids: scored.map((item) => item.book.id),
    explanations: scored.map((item) => item.reasons.join(" · ")),
    items: scored,
  };
}

function baseThemeScore(book: SpiritBook, themes: string[]) {
  if (themes.length === 0) return 0;
  return themes.reduce((sum, theme) => (book.themes.includes(theme) ? sum + 4 : sum), 0);
}

function chainScore(prev: SpiritBook | null, candidate: SpiritBook) {
  if (!prev) return 0;
  const related = isRelated(prev, candidate);
  const shared = sharedThemes(prev, candidate);
  const sameFormat = prev.format === candidate.format;
  const sameLanguage = prev.language === candidate.language;
  const levelJump = levelIndex(candidate.level) - levelIndex(prev.level);

  let score = 0;
  if (related) score += 6;
  score += shared * 3;
  if (sameFormat) score += 1;
  if (sameLanguage) score += 1;
  if (levelJump < 0) score -= 2;
  if (levelJump > 1) score -= 3;
  return score;
}

function pickNext(
  candidates: SpiritBook[],
  prev: SpiritBook | null,
  themes: string[],
  tradition?: SpiritTradition
): SpiritBook | null {
  if (candidates.length === 0) return null;
  const scored = candidates
    .map((book) => {
      const score =
        chainScore(prev, book) +
        baseThemeScore(book, themes) +
        (tradition && book.tradition === tradition ? 2 : 0);
      return { book, score };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return compareByTitle(a.book, b.book);
    });

  return scored[0]?.book ?? null;
}

function buildStepReasons(prev: SpiritBook | null, book: SpiritBook, themes: string[]) {
  const reasons: string[] = [];
  if (prev && isRelated(prev, book)) reasons.push("Kapcsolódik az előzőhöz");
  const shared = prev ? sharedThemes(prev, book) : 0;
  if (shared > 0) reasons.push(`${shared} közös téma az előzővel`);
  const themeMatches = themes.filter((theme) => book.themes.includes(theme));
  if (themeMatches.length > 0) reasons.push("Illeszkedik a témaszűréshez");
  return buildReasonList(reasons);
}

function computeFlowQuality(books: SpiritBook[]) {
  if (books.length <= 1) return 1;
  let jumpScore = 0;
  let relatedPairs = 0;
  let pairCount = 0;
  for (let i = 1; i < books.length; i += 1) {
    const prev = books[i - 1];
    const current = books[i];
    const jump = Math.abs(levelIndex(current.level) - levelIndex(prev.level));
    jumpScore += jump <= 1 ? 1 : 0.4;
    if (isRelated(prev, current)) relatedPairs += 1;
    pairCount += 1;
  }
  const jumpQuality = jumpScore / pairCount;
  const relatedQuality = relatedPairs / pairCount;
  return Math.max(0, Math.min(1, 0.6 * jumpQuality + 0.4 * relatedQuality));
}

export function buildLearningPath(books: SpiritBook[], filters: LearningPathFilters): LearningPathResult {
  const themes = filters.themes ?? [];
  const minLength = filters.minLength ?? 5;
  const maxLength = filters.maxLength ?? 10;

  const candidates = books.filter((book) => {
    if (filters.tradition && book.tradition !== filters.tradition) return false;
    if (themes.length > 0 && !themes.some((theme) => book.themes.includes(theme))) return false;
    return true;
  });

  if (candidates.length === 0) {
    return { ordered_ids: [], explanations: [], steps: [], flow: 0 };
  }

  const startLevel =
    filters.startLevel ??
    (candidates.some((book) => book.level === "kezdo")
      ? "kezdo"
      : candidates.some((book) => book.level === "kozep-halado")
        ? "kozep-halado"
        : "halado");
  const startIndex = Math.max(0, levelIndex(startLevel));
  const levels = LEVEL_FLOW.slice(startIndex);

  const availableByLevel = new Map<SpiritLevel, SpiritBook[]>();
  levels.forEach((level) => {
    availableByLevel.set(
      level,
      candidates.filter((book) => book.level === level).sort(compareByTitle)
    );
  });

  const targetLength = Math.min(maxLength, Math.max(minLength, candidates.length));
  const baseCounts = levels.map((_, idx) => {
    if (levels.length === 3) return idx === 0 ? 2 : idx === 1 ? 2 : 1;
    if (levels.length === 2) return 2;
    return 3;
  });

  const counts = baseCounts.map((count, idx) => {
    const level = levels[idx];
    const available = availableByLevel.get(level)?.length ?? 0;
    return Math.min(count, available);
  });

  let total = counts.reduce((sum, value) => sum + value, 0);
  const priority = levels.length === 3 ? [1, 0, 2] : levels.length === 2 ? [0, 1] : [0];

  while (total < targetLength) {
    let added = false;
    for (const idx of priority) {
      const level = levels[idx];
      const available = availableByLevel.get(level)?.length ?? 0;
      if (counts[idx] < available) {
        counts[idx] += 1;
        total += 1;
        added = true;
        break;
      }
    }
    if (!added) break;
  }

  const used = new Set<string>();
  const steps: LearningPathStep[] = [];
  let prev: SpiritBook | null = null;

  levels.forEach((level, idx) => {
    const bucket = (availableByLevel.get(level) ?? []).filter((book) => !used.has(book.id));
    for (let i = 0; i < counts[idx]; i += 1) {
      const next = pickNext(bucket.filter((book) => !used.has(book.id)), prev, themes, filters.tradition);
      if (!next) break;
      used.add(next.id);
      steps.push({ book: next, reasons: buildStepReasons(prev, next, themes) });
      prev = next;
    }
  });

  const ordered_ids = steps.map((step) => step.book.id);
  const explanations = steps.map((step) => step.reasons.join(" · "));
  const flow = computeFlowQuality(steps.map((step) => step.book));

  return {
    ordered_ids,
    explanations,
    steps,
    flow,
  };
}
