/** Exact measured grams per baseline ml; no estimated spoon-to-gram conversions. */
export function scaledDose(leafGrams:number,baseVolumeMl:number,shares:number[],volumeMl:number){
  if(![leafGrams,baseVolumeMl,volumeMl,...shares].every(Number.isFinite) || leafGrams<=0 || baseVolumeMl<=0 || volumeMl<25 || volumeMl>10000 || shares.length===0 || Math.abs(shares.reduce((a,b)=>a+b,0)-100)>1e-6)throw new Error("Érvénytelen adagolási értékek.");
  const total=Math.round(leafGrams*volumeMl/baseVolumeMl*100)/100;
  const grams=shares.map(s=>Math.round(total*s)/100);
  grams[grams.length-1]=Math.round((total-grams.slice(0,-1).reduce((a,b)=>a+b,0))*100)/100;
  return {total,grams};
}
