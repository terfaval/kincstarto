import type { CatalogGroups } from "./schema";

/** Referential/percentage invariants, independent of parsing or persistence. */
export function validateLinks(g: CatalogGroups) {
  for (const kind of ["ingredients","methods","teas","preparationProfiles"] as const) {
    const ids=g[kind].map(r=>r.id);
    if(new Set(ids).size!==ids.length)throw new Error(`Duplikált azonosító: ${kind}`);
  }
  for (const ingredient of g.ingredients) {
    if (ingredient.spoonMeasure && !ingredient.sourceRefs.includes(ingredient.spoonMeasure.evidenceUrl))
      throw new Error(`Kanálmértékhez hiányzó hivatkozás: ${ingredient.id}`);
  }
  const ingredients=new Set(g.ingredients.map(r=>r.id));
  const methods=new Set(g.methods.map(r=>r.id));
  const teas=new Set(g.teas.map(r=>r.id));
  const profiles=new Map(g.preparationProfiles.map(r=>[r.id,r]));
  const pairs=new Set<string>();
  for(const p of g.preparationProfiles){
    if(!teas.has(p.teaId)||!methods.has(p.methodId))throw new Error(`Hiányzó tea vagy módszer: ${p.id}`);
    const pair=`${p.teaId}/${p.methodId}`;
    if(pairs.has(pair))throw new Error(`Duplikált tea-módszer pár: ${pair}`);
    pairs.add(pair);
  }
  for(const t of g.teas){
    if(new Set(t.ingredients.map(i=>i.ingredientId)).size!==t.ingredients.length)throw new Error(`Ismétlődő alapanyag: ${t.id}`);
    if(Math.abs(t.ingredients.reduce((sum,i)=>sum+i.sharePct,0)-100)>0.000001)throw new Error(`Az összetevők aránya nem 100%: ${t.id}`);
    if(new Set(t.preparationIds).size!==t.preparationIds.length)throw new Error(`Duplikált elkészítési profil: ${t.id}`);
    for(const i of t.ingredients)if(!ingredients.has(i.ingredientId))throw new Error(`Ismeretlen alapanyag: ${i.ingredientId}`);
    for(const pId of t.preparationIds)if(!profiles.has(pId)||profiles.get(pId)?.teaId!==t.id)throw new Error(`Érvénytelen elkészítési profil: ${pId}`);
  }
}
