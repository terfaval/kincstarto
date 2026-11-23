import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { Catalog, EMPTY_CATALOG, Groups, Result, kinds, recordSchemas, validateLinks,
  flavorIds, type CatalogGroups, type KaoriCatalog, type Kind } from "./schema";

export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const serialize = (value: unknown) => `${JSON.stringify(value)}\n`;
const noHtml = (value: string) => !/<\/?[a-z][^>]*>/i.test(value);
const dangerousClaim = /\b(?:detox|gyógyít|gyógyhatás|immunerősít|terápiás|rákellenes|betegség|gyógyszer|véralvadás|alkohol|fermentál|nitro|füstöl|mérgező|terhes|várandós|allergiás reakció)\b/i;
const everyString = (value: unknown, fn: (s:string)=>boolean):boolean => {
  if (typeof value === "string") return fn(value);
  if (Array.isArray(value)) return value.every(v=>everyString(v,fn));
  if (value && typeof value === "object") return Object.values(value).every(v=>everyString(v,fn));
  return true;
};
const eligible = (record: {editorialStatus:string;requiresExpertReview:boolean;sourceRefs:string[]}) =>
  record.editorialStatus === "approved" && !record.requiresExpertReview && record.sourceRefs.length > 0 &&
  everyString(record, s=>!dangerousClaim.test(s));

function upsert<T extends {id:string}>(array: T[], record:T):T[] {
  const index = array.findIndex(x=>x.id===record.id);
  if(index<0)return [...array,record];
  return array.map((old,i)=>i===index?record:old);
}
function buildPublic(previous:CatalogGroups, editorial:CatalogGroups, publish:boolean, allowed:Set<string>):CatalogGroups {
  const pub:CatalogGroups=structuredClone(previous);
  if (!publish) return pub;
  for (const i of editorial.ingredients) if(allowed.has(`ingredients/${i.id}`)&&eligible(i)&&i.identityVerified) pub.ingredients=upsert(pub.ingredients,i);
  for (const m of editorial.methods) if(allowed.has(`methods/${m.id}`)&&eligible(m)&&m.riskClass==="standard") pub.methods=upsert(pub.methods,m);
  // Profile publication cannot happen without a published tea. Build a candidate index first.
  const readyProfiles=editorial.preparationProfiles.filter(p=>allowed.has(`preparationProfiles/${p.id}`)&&eligible(p)&&pub.methods.some(m=>m.id===p.methodId && m.riskClass==="standard"));
  const usableProfiles=[...pub.preparationProfiles];
  for(const t of editorial.teas){
    const sourceReady=t.ingredients.every(i=>pub.ingredients.some(p=>p.id===i.ingredientId && p.identityVerified));
    const recipesReady=t.preparationIds.every(id=>readyProfiles.some(p=>p.id===id&&p.teaId===t.id)||usableProfiles.some(p=>p.id===id&&p.teaId===t.id));
    const sentences=t.modalDescription.split(/[.!?]+/).map(s=>s.trim()).filter(Boolean).length;
    if(allowed.has(`teas/${t.id}`)&&eligible(t)&&sourceReady&&recipesReady&&sentences>=3&&sentences<=5){
      pub.teas=upsert(pub.teas,t);
      for(const pid of t.preparationIds){
        const p=readyProfiles.find(p=>p.id===pid&&p.teaId===t.id);
        if(p)pub.preparationProfiles=upsert(pub.preparationProfiles,p);
      }
    }
  }
  // A published tea's new, individually approved preparation profile can also be published later.
  for(const p of readyProfiles){
    if(pub.teas.some(t=>t.id===p.teaId&&t.preparationIds.includes(p.id)))
      pub.preparationProfiles=upsert(pub.preparationProfiles,p);
  }
  validateLinks(pub);
  return pub;
}

export class KaoriValidationError extends Error {}
function parseOrExplain<T>(schema:z.ZodType<T>, value:unknown, label:string):T {
  const result=schema.safeParse(value);
  if(!result.success) throw new KaoriValidationError(`${label}: ${result.error.issues.slice(0,5).map(x=>`${x.path.join(".")}: ${x.message}`).join("; ")}`);
  return result.data;
}

export function plan(current:KaoriCatalog, source:unknown, baseSha:string) {
  const result=parseOrExplain(Result,source,"Hibás Result JSON");
  if (result.baseSha!==baseSha) throw new KaoriValidationError("A Startup Kit elavult. Tölts le friss verziót.");
  const edited:CatalogGroups=structuredClone(current.editorial);
  const counts:Record<string,number>={};
  let total=0;
  const changedIds=new Set<string>();
  for(const kind of kinds){
    const changes=result.changes[kind] as Array<{op:string;id:string;record?:unknown;set?:Record<string,unknown>;clear?:string[];expectedRevision?:number}>;
    if(new Set(changes.map(c=>c.id)).size!==changes.length)throw new KaoriValidationError(`Duplikált Result azonosító: ${kind}`);
    counts[kind]=changes.length; total+=changes.length;
    for(const change of changes){
      changedIds.add(`${kind}/${change.id}`);
      const existing=(edited[kind] as Array<{id:string;revision:number}>).find(x=>x.id===change.id);
      if(change.op==="create" && existing)throw new KaoriValidationError(`Már létező rekord: ${kind}/${change.id}`);
      if(change.op==="patch" && (!existing || change.expectedRevision!==existing.revision))throw new KaoriValidationError(`Revízióütközés: ${kind}/${change.id}`);
      let proposed:unknown;
      if(change.op==="create") proposed=change.record;
      else{
        const set=change.set??{};
        if(!Object.keys(set).length && !(change.clear?.length))throw new KaoriValidationError(`Üres módosítás: ${change.id}`);
        const before=existing as unknown as Record<string,unknown>;
        // Allow adding new optional fields even when absent from an existing legacy record.
        const allowed=Object.keys(recordSchemas[kind].shape).filter(x=>!(["id","revision"].includes(x)));
        if(Object.keys(set).some(x=>!allowed.includes(x)) || (change.clear??[]).some(x=>!allowed.includes(x)))
          throw new KaoriValidationError(`Ismeretlen vagy védett mező: ${kind}/${change.id}`);
        if(Object.values(set).some(v=>v===null))throw new KaoriValidationError("Null törlés nem engedélyezett; használd az explicit clear mezőt.");
        const cleared:Record<string,unknown>={};
        for (const key of change.clear??[]) {
          // Only these optional fields can safely be explicitly cleared.
          if(!(["botanicalName","servingNotes","aliases","cautions","publicProfile","spoonMeasure"].includes(key)))throw new KaoriValidationError(`Nem törölhető mező: ${key}`);
          cleared[key]=key==="botanicalName"?null:key==="servingNotes"?"":key==="publicProfile"?false:key==="spoonMeasure"?undefined:[];
        }
        proposed={...before,...cleared,...set,revision:before.revision as number+1};
      }
      const obj=parseOrExplain<{id:string;revision:number}>(recordSchemas[kind],proposed,`${kind}/${change.id}`);
      if(obj.id!==change.id)throw new KaoriValidationError(`ID nem egyezik: ${kind}/${change.id}`);
      if(change.op==="create" && obj.revision!==1)throw new KaoriValidationError(`Új rekord revíziója 1 legyen: ${change.id}`);
      if(!everyString(obj,noHtml))throw new KaoriValidationError(`HTML tartalom nem engedélyezett: ${change.id}`);
      // Discriminant at runtime validated above; groups share ID/revision and are all strict schemas.
      const group=edited[kind] as Array<{id:string;revision:number}>;
      (edited as unknown as Record<Kind,unknown>)[kind]=upsert(group,obj as {id:string;revision:number});
    }
  }
  if(total===0)throw new KaoriValidationError("A Result nem tartalmaz változtatást.");
  parseOrExplain(Groups,edited,"Katalógus");
  try {validateLinks(edited);} catch(e) {throw new KaoriValidationError(e instanceof Error?e.message:"Hibás kapcsolatok.");}
  let pub:CatalogGroups;
  try{pub=buildPublic(current.published,edited,result.publicationIntent==="publish_eligible",changedIds);}
  catch(e){throw new KaoriValidationError(`Publikált kapcsolatok hibásak: ${e instanceof Error?e.message:"ismeretlen"}`);}
  const next:KaoriCatalog={...current,editorial:edited,published:pub};
  const publishedCounts=Object.fromEntries(kinds.map(k=>[k,pub[k].length-current.published[k].length]));
  const unpublished=kinds.flatMap(k=>edited[k].filter(r=>changedIds.has(`${k}/${r.id}`)&&!pub[k].some(p=>p.id===r.id && p.revision===r.revision)).map(r=>`${k}/${r.id}`));
  return {candidate:parseOrExplain(Catalog,next,"Katalógus"),summary:{changes:counts,published:publishedCounts,remainingDrafts:unpublished,publicationIntent:result.publicationIntent},total};
}
export function startup(current:KaoriCatalog,baseSha:string) {
  return {format:"kaori.startup.v1",schemaVersion:"kaori.catalog.v1",baseSha,generatedAt:new Date().toISOString(),
    instructions:"A kaori.result.v1 changes mezőiben hozz létre vagy módosíts pontosan azonosított rekordokat. Ne találj ki botanikai azonosítást, forrást, dózist, hatást vagy időt. A források jelenléte nem bizonyít ellenőrzést. Minden create rekord revision=1. A patch op esetén id + expectedRevision + set (változtatott mezők) és opcionális explicit clear szükséges; hiányzó mező változatlan. Minden tea részaránya pontosan 100%, és legyen hozzá ellenőrzött tea×módszer profil. A veszélyes/szakmai témák vázlatban maradjanak. A Result publikációs kérelme önmagában nem szakmai jóváhagyás. Az első publikáláshoz a felhasználó ellenőrzése és megerősítése szükséges.",
    catalog:{...current.editorial,flavorVocabulary:flavorIds},releases:current.releases,constraints:{acceptedChangeTypes:["create","patch"],revisionPolicy:"strict",publicationIntents:["save_draft","publish_eligible"]},
    schemas:{result:z.toJSONSchema(Result),records:Object.fromEntries(Object.entries(recordSchemas).map(([k,v])=>[k,z.toJSONSchema(v)]))},
    resultExample:{format:"kaori.result.v1",baseSha,changes:{ingredients:[],methods:[],teas:[],preparationProfiles:[]},publicationIntent:"save_draft",editorialNotes:[]}};
}
export function previewToken(baseSha:string,etag:string,candidate:KaoriCatalog,secret:string) {
  return createHmac("sha256",secret).update(`${baseSha}:${etag}:${hash(serialize(candidate))}`).digest("hex");
}
export function matchesPreviewToken(given:unknown,expected:string):boolean {
  if(typeof given!=="string" || !/^[a-f0-9]{64}$/.test(given))return false;
  return timingSafeEqual(Buffer.from(given,"hex"),Buffer.from(expected,"hex"));
}
export const freshCatalog = () => structuredClone(EMPTY_CATALOG);
