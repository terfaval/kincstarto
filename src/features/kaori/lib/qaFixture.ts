import type { PublicKaori } from "./public";

/** Admin-only UI fixture. No connection to the Kaori store or publication workflow. */
export const KAORI_QA_COUNTS = [0, 1, 2, 9, 10, 11] as const;

const freshTaste = {
  fresh: 3, sweet: 1, sour: 0, spicy: 0, floral: 1,
  fruity: 0, earthy: 0, bitter: 0, pungent: 0, umami: 0,
};
const spicyTaste = {
  fresh: 0, sweet: 1, sour: 0, spicy: 3, floral: 0,
  fruity: 1, earthy: 1, bitter: 0, pungent: 0, umami: 0,
};

export function makeKaoriQAFixture(count: number): PublicKaori {
  if (!KAORI_QA_COUNTS.some(n => n === count)) {
    throw new Error("Unsupported Kaori QA count");
  }
  if (count === 0) return { teas: [], ingredients: [], methods: [], preparationProfiles: [] };

  const ingredients: PublicKaori["ingredients"] = [
    { id: "ingredient_qa_a", name: "Minta-összetevő A", summary: "Kitalált próbaösszetevő.",
      primaryFlavor: "fresh", tasteProfile: freshTaste, publicProfile: true,
      gramsPerLevelTeaspoon: 1.2 },
    { id: "ingredient_qa_b", name: "Minta-összetevő B", summary: "Kitalált próbaösszetevő.",
      primaryFlavor: "spicy", tasteProfile: spicyTaste, publicProfile: true,
      gramsPerLevelTeaspoon: 0.8 },
  ];
  const methods: PublicKaori["methods"] = [
    { id: "method_qa_short", title: "Rövid tesztmódszer",
      description: "Kizárólag az időzítő kipróbálására szolgáló módszer.",
      equipment: ["Próbaedény", "Tesztóra"],
      operations: [{ type: "manual", title: "Próbalépés" }, { type: "timer", title: "Tesztidőzítő", durationSeconds: 12 }] },
    { id: "method_qa_multi", title: "Többlépéses tesztmódszer",
      description: "Manuális művelet és két független tesztidőzítő.",
      equipment: ["Próbaedény"],
      operations: [{ type: "manual", title: "Előkészítési próba" },
        { type: "timer", title: "Első tesztidőzítő", durationSeconds: 8 },
        { type: "timer", title: "Második tesztidőzítő", durationSeconds: 6 }] },
    { id: "method_qa_long", title: "Hosszú időzítő teszt",
      description: "A 24 órán túli időformátum vizuális ellenőrzéséhez.",
      equipment: ["Tesztóra"],
      operations: [{ type: "timer", title: "Hosszú tesztidőzítő", durationSeconds: 90000 }] },
  ];
  const teas: PublicKaori["teas"] = [];
  const preparationProfiles: PublicKaori["preparationProfiles"] = [];
  for (let i = 1; i <= count; i++) {
    const suffix = String(i).padStart(2, "0");
    const id = `tea_qa_${suffix}`;
    const profileId = `profile_qa_${suffix}`;
    const isSecond = i === 2;
    teas.push({
      id, revision: 1, title: `Teszttea ${suffix}`,
      cardLine: i === 11 ? "A tizenegyedik tesztkártya keresési próbája" : `Minta ${suffix} · kizárólag admin QA`,
      modalDescription: "Ez egy mesterséges felületi próbarekord. Az arányok és idők kizárólag működési tesztet szolgálnak. Nem fogyasztási vagy elkészítési ajánlás.",
      ingredients: i % 2 === 0 ? [{ ingredientId: "ingredient_qa_a", sharePct: 100 }] : [
        { ingredientId: "ingredient_qa_a", sharePct: 60 }, { ingredientId: "ingredient_qa_b", sharePct: 40 },
      ],
      tasteProfile: i % 2 === 0 ? freshTaste : spicyTaste,
      preparationIds: i === 1 ? [profileId, "profile_qa_multi"] : [profileId],
      visual: null,
    });
    const methodId = isSecond ? "method_qa_long" : "method_qa_short";
    preparationProfiles.push({
      id: profileId, teaId: id, methodId, baseVolumeMl: 250, leafGrams: 4, temperatureC: null,
      steps: isSecond ? [{ type: "timer", title: "25 órás időzítő próba", durationSeconds: 90000 }] : [
        { type: "manual", title: "Manuális próbalépés" },
        { type: "timer", title: "12 másodperces időzítő próba", durationSeconds: 12 },
      ], servingNotes: "Mintaadat — nincs valódi tea.",
    });
  }
  preparationProfiles.push({
    id: "profile_qa_multi", teaId: "tea_qa_01", methodId: "method_qa_multi",
    baseVolumeMl: 250, leafGrams: 4, temperatureC: null,
    steps: [{ type: "manual", title: "Előkészítési próba" },
      { type: "timer", title: "Első időzítő", durationSeconds: 8 },
      { type: "timer", title: "Második időzítő", durationSeconds: 6 }],
    servingNotes: "Mintaadat — nincs valódi tea.",
  });
  return { teas, ingredients, methods, preparationProfiles };
}
