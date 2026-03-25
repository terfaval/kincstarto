import type { Meditation, MeditationCategory, MeditationLevel } from "./meditation-types";

export const CATEGORY_ORDER: MeditationCategory[] = ["ALV", "STR", "FOK", "ENR", "SPC"];

export type RingLayoutItem = {
  id: string;
  angle: number;
  index: number;
  radiusMult: number;
  category: MeditationCategory;
  meditation: Meditation;
};

const LEVEL_RADIUS: Record<MeditationLevel, number> = {
  1: 0.62,
  2: 0.82,
  3: 1,
};

export function getCategoryAngle(category: MeditationCategory) {
  const index = CATEGORY_ORDER.indexOf(category);
  const step = 360 / CATEGORY_ORDER.length;
  const base = step * (index === -1 ? 0 : index) - 90;
  const rotationOffset = -108;
  return base + rotationOffset;
}

export function buildRingLayout(items: Meditation[]): RingLayoutItem[] {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => {
    if (a.category !== b.category) {
      return CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    }
    if (a.level !== b.level) return a.level - b.level;
    return a.order_in_category - b.order_in_category;
  });

  const groups = new Map<MeditationCategory, Meditation[]>();
  for (const meditation of sorted) {
    const list = groups.get(meditation.category) ?? [];
    list.push(meditation);
    groups.set(meditation.category, list);
  }

  const layout: RingLayoutItem[] = [];
  let index = 0;

  for (const category of CATEGORY_ORDER) {
    const list = groups.get(category) ?? [];
    if (list.length === 0) continue;
    const baseAngle = getCategoryAngle(category);
    const perLevel = new Map<MeditationLevel, Meditation[]>();
    for (const meditation of list) {
      const levelList = perLevel.get(meditation.level) ?? [];
      levelList.push(meditation);
      perLevel.set(meditation.level, levelList);
    }

    const levels: MeditationLevel[] = [1, 2, 3];
    for (const level of levels) {
      const levelList = perLevel.get(level) ?? [];
      if (levelList.length === 0) continue;
      const count = levelList.length;
      const baseSpread = Math.min(14, 4 + count * 2.5);
      const levelSpreadMult = 1 + (level - 1) * 0.55;
      const maxSpread = Math.min(26, baseSpread * levelSpreadMult);
      const step = count === 1 ? 0 : maxSpread / (count - 1);

      levelList.forEach((meditation, idx) => {
        const offset = count === 1 ? 0 : -maxSpread / 2 + step * idx;
        layout.push({
          id: meditation.id,
          angle: baseAngle + offset,
          index,
          radiusMult: LEVEL_RADIUS[meditation.level] ?? 1,
          category: meditation.category,
          meditation,
        });
        index += 1;
      });
    }
  }

  return layout;
}
