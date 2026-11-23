import { randomUUID } from "node:crypto";
import { get, head, put } from "@vercel/blob";
import { Catalog, validateLinks, type KaoriCatalog } from "./schema";
import { freshCatalog, hash, serialize } from "./unified";

const PATH="kaori/catalog.v1.json";
export class KaoriStoreConflict extends Error {constructor(){super("A Kaori katalógus megváltozott. Tölts le új Startup Kitet.");}}
export class KaoriStoreUnknownOutcome extends Error {constructor(){super("A tároló írásának eredménye bizonytalan. NE próbálj újra importálni; először ellenőrizd az aktuális exportot.");}}
export class KaoriStoreNotInitialized extends Error {constructor(){super("A Kaori privát tárolója még nincs inicializálva.");}}
function storeId(value:string):string|null {
  const parts=value.split("_");
  return parts.length>=5&&parts[0]==="vercel"&&parts[1]==="blob"&&parts[2]==="rw"&&/^[A-Za-z0-9-]{8,128}$/.test(parts[3])?parts[3]:null;
}
function token():string {
  const value=process.env.KAORI_PRIVATE_BLOB_READ_WRITE_TOKEN;
  const id=value&&storeId(value);
  const publicId=process.env.BLOB_READ_WRITE_TOKEN&&storeId(process.env.BLOB_READ_WRITE_TOKEN);
  const shioriToken=process.env.SHIORI_PRIVATE_BLOB_READ_WRITE_TOKEN||process.env.SHIORI_PRIVATE_BLOB_TOKEN;
  const shioriId=shioriToken&&storeId(shioriToken);
  if(!value||!id||!publicId||!shioriId||id===publicId||id===shioriId) {
    throw new Error("A Kaori külön privát Blob-tárolója nincs biztonságosan konfigurálva.");
  }
  return value;
}
const isConflict=(e:unknown)=>!!e&&typeof e==="object"&&
 ((e as {statusCode?:number}).statusCode===412||(e as {name?:string}).name==="BlobPreconditionFailedError");
function etagOk(tag:unknown):tag is string {return typeof tag==="string"&&/^"[^"\s]+"$/.test(tag);}
export async function readKaori() {
  const t=token();
  let reply;
  try {reply=await get(PATH,{access:"private",token:t,useCache:false});}
  catch(e){if((e as {statusCode?:number}).statusCode===404 || (e as {name?:string}).name==="BlobNotFoundError")throw new KaoriStoreNotInitialized();throw e;}
  if(!reply?.stream||reply.statusCode!==200||reply.blob?.pathname!==PATH) throw new KaoriStoreNotInitialized();
  const raw=await new Response(reply.stream).text();
  const meta=await head(PATH,{token:t});
  if(meta.pathname!==PATH || !etagOk(meta.etag) || reply.blob.etag!==meta.etag || meta.size!==Buffer.byteLength(raw,"utf8")) throw new KaoriStoreConflict();
  const parsed=Catalog.safeParse(JSON.parse(raw));
  if(!parsed.success)throw new Error("Az éles Kaori katalógus sémája ismeretlen. Import zárolva.");
  validateLinks(parsed.data.editorial);
  validateLinks(parsed.data.published);
  return {catalog:parsed.data,sha:hash(raw),etag:meta.etag,raw};
}
/** One-time explicit admin initialization; never called during GET or via the public route. */
export async function initializeKaori() {
  const t=token();
  const initial=serialize(freshCatalog());
  // A parallel bootstrap or existing live object is not permitted to be overwritten.
  try {
    await put(PATH,initial,{access:"private",token:t,allowOverwrite:false,contentType:"application/json",cacheControlMaxAge:60});
  } catch {throw new KaoriStoreConflict();}
  try {const verified=await readKaori();if(verified.raw!==initial)throw new Error("mismatch");return verified;}
  catch {throw new KaoriStoreUnknownOutcome();}
}
export async function writeKaori(previous:Awaited<ReturnType<typeof readKaori>>,candidate:KaoriCatalog,counts:Record<string,number>) {
  const t=token();
  const backupId=randomUUID().replaceAll("-","");
  const backupPath=`kaori/backups/${backupId}.json`;
  // Save a complete private previous snapshot BEFORE attempting the only mutable catalog write.
  try {
    const saved=await put(backupPath,previous.raw,{access:"private",token:t,allowOverwrite:false,contentType:"application/json"});
    if(saved.pathname!==backupPath)throw new Error("Backup path mismatch");
    const backupMeta=await head(backupPath,{token:t});
    if(saved.etag!==backupMeta.etag||backupMeta.size!==Buffer.byteLength(previous.raw))throw new Error("Backup metadata mismatch");
  } catch {throw new Error("A kötelező Kaori-mentés nem igazolható. Import leállítva.");}
  const id=`rel_${backupId.slice(0,30)}`;
  const next:KaoriCatalog={...candidate,releases:[...candidate.releases.slice(-98),{
    id,at:new Date().toISOString(),backupPath,previousSha:previous.sha,nextSha:hash(serialize(candidate.editorial)),counts,
  }]};
  const raw=serialize(Catalog.parse(next));
  let uploaded:Awaited<ReturnType<typeof put>>;
  try {
    uploaded=await put(PATH,raw,{access:"private",token:t,allowOverwrite:true,ifMatch:previous.etag,contentType:"application/json",cacheControlMaxAge:60});
  } catch(e){if(isConflict(e))throw new KaoriStoreConflict();throw new KaoriStoreUnknownOutcome();}
  try {
    const after=await head(PATH,{token:t});
    if(uploaded.pathname!==PATH || uploaded.etag!==after.etag || after.etag===previous.etag || after.size!==Buffer.byteLength(raw))throw new Error("Mismatched write");
  } catch {throw new KaoriStoreUnknownOutcome();}
  return {releaseId:id,backupPath,sha:hash(raw),counts};
}
/** Explicit, guarded restore: old snapshot becomes a NEW release with a new backup of current state. */
export async function readKaoriBackup(backupPath:string) {
  if(!/^kaori\/backups\/[a-f0-9]{32}\.json$/.test(backupPath))throw new Error("Érvénytelen Kaori-mentésazonosító.");
  const t=token();
  const old=await get(backupPath,{access:"private",token:t,useCache:false});
  if(!old?.stream||old.blob.pathname!==backupPath||old.statusCode!==200)throw new Error("Nem érhető el a mentés.");
  const raw=await new Response(old.stream).text();
  const meta=await head(backupPath,{token:t});
  if(meta.etag!==old.blob.etag||meta.size!==Buffer.byteLength(raw))throw new KaoriStoreConflict();
  const restored=Catalog.parse(JSON.parse(raw));
  validateLinks(restored.editorial);validateLinks(restored.published);
  return restored;
}
/** Explicit restore: old snapshot becomes a NEW release with a backup of current state. */
export async function restoreKaori(previous:Awaited<ReturnType<typeof readKaori>>,backupPath:string) {
  const restored=await readKaoriBackup(backupPath);
  return writeKaori(previous,{...restored,releases:previous.catalog.releases},{restore:1});
}
