export const flavorIds = ["fresh", "sweet", "sour", "spicy", "floral", "fruity", "earthy", "bitter", "pungent", "umami"] as const;
export type FlavorId = typeof flavorIds[number];
export const flavorNames: Record<FlavorId, string> = {
  fresh: "Friss / növényi", sweet: "Édeskés", sour: "Savanykás", spicy: "Fűszeres", floral: "Virágos",
  fruity: "Gyümölcsös", earthy: "Földes", bitter: "Kesernyés", pungent: "Csípős", umami: "Umami",
};
export const flavorColors: Record<FlavorId, string> = {
  fresh: "#25866b", sweet: "#d8a12d", sour: "#d97636", spicy: "#b56238", floral: "#c44f73",
  fruity: "#a64f91", earthy: "#846c41", bitter: "#627645", pungent: "#ac463f", umami: "#5279a3",
};
