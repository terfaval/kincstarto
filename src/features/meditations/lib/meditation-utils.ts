import type { MeditationCategory } from "./meditation-types";

const CATEGORY_LABELS: Record<MeditationCategory, string> = {
  ALV: "Alvas",
  STR: "Stressz",
  FOK: "Fokusz",
  ENR: "Energia",
  SPC: "Special",
};

const CATEGORY_COLORS: Record<MeditationCategory, string> = {
  ALV: "rgba(120, 178, 255, 0.8)",
  STR: "rgba(255, 162, 120, 0.8)",
  FOK: "rgba(150, 255, 198, 0.8)",
  ENR: "rgba(255, 210, 120, 0.8)",
  SPC: "rgba(195, 165, 255, 0.8)",
};

export function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "-";
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} perc`;
}

export function getCategoryLabel(category: MeditationCategory) {
  return CATEGORY_LABELS[category] ?? category;
}

export function getCategoryColor(category: MeditationCategory) {
  return CATEGORY_COLORS[category] ?? "rgba(170, 190, 220, 0.7)";
}

