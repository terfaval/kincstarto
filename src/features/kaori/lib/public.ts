import type { KaoriCatalog } from "./schema";

/** Explicit field projection. Never serialize editorial status, safety review, references or drafts. */
export function publicKaori(c:KaoriCatalog) {
  const p=c.published;
  const teas=p.teas.map(t=>({
    id:t.id,title:t.title,cardLine:t.cardLine,modalDescription:t.modalDescription,
    ingredients:t.ingredients.map(i=>({ingredientId:i.ingredientId,sharePct:i.sharePct})),
    tasteProfile:t.tasteProfile,preparationIds:t.preparationIds,visual:t.visual??null,revision:t.revision,
  }));
  const ingredients=p.ingredients.map(i=>({id:i.id,name:i.name,summary:i.publicProfile?i.summary:"",
    primaryFlavor:i.primaryFlavor,tasteProfile:i.tasteProfile,publicProfile:i.publicProfile,
    gramsPerLevelTeaspoon:i.spoonMeasure && i.sourceRefs.includes(i.spoonMeasure.evidenceUrl)
      ? i.spoonMeasure.gramsPerLevelTeaspoon : null}));
  const methods=p.methods.map(m=>({id:m.id,title:m.title,description:m.description,equipment:m.equipment,
    operations:m.operations}));
  const preparationProfiles=p.preparationProfiles.map(p=>({id:p.id,teaId:p.teaId,methodId:p.methodId,
    baseVolumeMl:p.baseVolumeMl,leafGrams:p.leafGrams,temperatureC:p.temperatureC,steps:p.steps,servingNotes:p.servingNotes}));
  return {teas,ingredients,methods,preparationProfiles};
}
export type PublicKaori = ReturnType<typeof publicKaori>;
