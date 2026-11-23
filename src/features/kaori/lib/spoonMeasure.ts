/** Kitchen display only. Canonical preparation doses always remain measured grams. */
const fractions = ["", "⅛", "¼", "⅜", "½", "⅝", "¾", "⅞"] as const;

function fraction(value: number): string {
  const eighths = Math.round(value * 8);
  const whole = Math.floor(eighths / 8);
  const part = eighths % 8;
  return `${whole || ""}${part ? `${whole ? " " : ""}${fractions[part]}` : ""}` || "0";
}

/**
 * Only use an explicitly sourced *level* 5 ml teaspoon mass for this ingredient.
 * Return null rather than claim excessive precision for a small or awkward dose.
 * 1 level tbsp = 15 ml = 3 level tsp, by volume, not by grams.
 */
export function kitchenSpoonDisplay(grams: number, gramsPerLevelTeaspoon: number | null | undefined): string | null {
  if (gramsPerLevelTeaspoon == null || !Number.isFinite(gramsPerLevelTeaspoon) || gramsPerLevelTeaspoon <= 0 ||
      !Number.isFinite(grams) || grams <= 0) return null;
  const raw = grams / gramsPerLevelTeaspoon;
  const eighths = Math.round(raw * 8);
  if (eighths < 1 || Math.abs(eighths / 8 - raw) / raw > 0.10) return null;
  const tbsp = Math.floor(eighths / 24);
  const remainder = eighths - tbsp * 24;
  if (tbsp === 0) return `${fraction(eighths / 8)} tk`;
  return `${tbsp} ek${remainder ? ` + ${fraction(remainder / 8)} tk` : ""}`;
}
