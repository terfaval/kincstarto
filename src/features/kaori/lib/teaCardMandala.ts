import { flavorIds, type FlavorId } from "./flavors";

export const teaCardMandalaKeys = [
  "default",
  "calm-bloom",
  "cool-bright",
  "deep-earth",
  "focus-bitter",
  "fresh-green",
  "fruit-harvest",
  "herbal-quiet",
  "spice-fire",
  "warm-sweet",
] as const;

export type TeaCardMandalaKey = typeof teaCardMandalaKeys[number];

const BASE_PATH = "/kaori/teacard_background";

export const teaCardMandalaPaths: Record<TeaCardMandalaKey, string> = {
  default: `${BASE_PATH}/Mandala.svg`,
  "calm-bloom": `${BASE_PATH}/Mandala_Csendes_Ido.svg`,
  "cool-bright": `${BASE_PATH}/Mandala_Husito_Kortyok.svg`,
  "deep-earth": `${BASE_PATH}/Mandala_Kinai_Klasszikusok.svg`,
  "focus-bitter": `${BASE_PATH}/Mandala_Tiszta_Fokusz.svg`,
  "fresh-green": `${BASE_PATH}/Mandala_Japan_Zold.svg`,
  "fruit-harvest": `${BASE_PATH}/Mandala_Evszakok_Zamata.svg`,
  "herbal-quiet": `${BASE_PATH}/Mandala_Europai_Gyogyfuvek.svg`,
  "spice-fire": `${BASE_PATH}/Mandala_Indiai_Chai.svg`,
  "warm-sweet": `${BASE_PATH}/Mandala_Alom_Kapu.svg`,
};

const flavorMandala: Record<FlavorId, TeaCardMandalaKey> = {
  fresh: "fresh-green",
  sweet: "warm-sweet",
  sour: "cool-bright",
  spicy: "spice-fire",
  floral: "calm-bloom",
  fruity: "fruit-harvest",
  earthy: "deep-earth",
  bitter: "focus-bitter",
  pungent: "spice-fire",
  umami: "herbal-quiet",
};

export type TeaCardVisualOverride = {
  mandalaKey?: TeaCardMandalaKey;
  focusX?: number;
  focusY?: number;
  scale?: number;
  rotationDeg?: number;
};

type TeaLike = {
  id: string;
  tasteProfile: Record<FlavorId, number>;
  visual?: TeaCardVisualOverride | null;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const spread = (min: number, max: number, unit: number) => min + (max - min) * unit;

function hashUnit(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

export function dominantFlavor(tasteProfile: Record<FlavorId, number>): FlavorId {
  return flavorIds.reduce((best, candidate) => {
    if (tasteProfile[candidate] > tasteProfile[best]) return candidate;
    return best;
  }, flavorIds[0]);
}

export function resolveTeaCardVisual(tea: TeaLike) {
  const topFlavor = dominantFlavor(tea.tasteProfile);
  const override = tea.visual ?? undefined;
  const mandalaKey = override?.mandalaKey ?? flavorMandala[topFlavor] ?? "default";
  const focusX = clamp(override?.focusX ?? spread(0.18, 0.82, hashUnit(`${tea.id}:focusX`)), 0.08, 0.92);
  const focusY = clamp(override?.focusY ?? spread(0.18, 0.82, hashUnit(`${tea.id}:focusY`)), 0.08, 0.92);
  const scale = clamp(override?.scale ?? spread(1.35, 1.85, hashUnit(`${tea.id}:scale`)), 1.1, 2.4);
  const rotationDeg = clamp(override?.rotationDeg ?? Math.round(spread(-10, 10, hashUnit(`${tea.id}:rotation`))), -18, 18);
  return {
    topFlavor,
    mandalaKey,
    mandalaPath: teaCardMandalaPaths[mandalaKey],
    focusX,
    focusY,
    scale,
    rotationDeg,
  };
}
