import type { Meditation } from "./meditation-types";

export type RingLayoutItem = {
  id: string;
  angle: number;
  index: number;
  meditation: Meditation;
};

export function buildRingLayout(items: Meditation[]): RingLayoutItem[] {
  if (items.length === 0) return [];
  const step = 360 / items.length;
  return items.map((meditation, index) => ({
    id: meditation.id,
    angle: step * index - 90,
    index,
    meditation,
  }));
}

