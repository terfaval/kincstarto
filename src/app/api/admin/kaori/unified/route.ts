import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getAdminSecret } from "@/lib/adminSession";
import { readKaori, initializeKaori, writeKaori, restoreKaori, readKaoriBackup,
  KaoriStoreConflict, KaoriStoreNotInitialized, KaoriStoreUnknownOutcome } from "@/features/kaori/lib/store";
import { matchesPreviewToken, plan, previewToken, startup, KaoriValidationError } from "@/features/kaori/lib/unified";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store, max-age=0"};
export async function GET(){
  const denied=await requireAdmin();if(denied)return denied;
  try {const live=await readKaori();return NextResponse.json(startup(live.catalog,live.sha),{headers});}
  catch(e){return NextResponse.json({error:e instanceof KaoriStoreNotInitialized?"A privát Kaori-katalógust előbb inicializálni kell.":"A privát Kaori-tároló nem elérhető. Ellenőrizd a konfigurációt.",needsInit:e instanceof KaoriStoreNotInitialized},{status:503,headers});}
}
export async function POST(request:Request){
  const denied=await requireAdmin(request);if(denied)return denied;
  try {
    const raw=await request.text();if(Buffer.byteLength(raw,"utf8")>2_000_000)return NextResponse.json({error:"Túl nagy JSON (max. 2 MB)."},{status:413,headers});
    const p=JSON.parse(raw) as {action?:unknown;source?:unknown;confirm?:unknown;baseSha?:unknown;baseEtag?:unknown;previewToken?:unknown;backupPath?:unknown};
    if(!p||typeof p!=="object")throw new KaoriValidationError("Hibás kérés.");
    if(p.action==="initialize") {
      if(p.confirm!=="ÚJ KAORI")throw new KaoriValidationError("Az új, üres tárolóhoz explicit megerősítés kell.");
      await initializeKaori();return NextResponse.json({ok:true,message:"Az üres privát Kaori-katalógus létrejött."},{headers});
    }
    if(!["preview","apply","restore_preview","restore_apply"].includes(String(p.action)))throw new KaoriValidationError("Ismeretlen művelet.");
    const live=await readKaori();
    if(p.action==="restore_preview"||p.action==="restore_apply") {
      if(typeof p.backupPath!=="string" || !live.catalog.releases.some(r=>r.backupPath===p.backupPath))throw new KaoriValidationError("Ismeretlen vagy érvénytelen visszaállítási pont.");
      const old=await readKaoriBackup(p.backupPath);
      const secret=getAdminSecret();if(!secret)throw new Error("Admin secret missing");
      const signature=previewToken(live.sha,live.etag,old,secret);
      if(p.action==="restore_preview")return NextResponse.json({ok:true,baseSha:live.sha,baseEtag:live.etag,
        previewToken:signature,summary:{from:live.catalog.releases.at(-1)?.id??"initial",to:p.backupPath,
          teas:old.published.teas.length,ingredients:old.published.ingredients.length}}, {headers});
      if(p.confirm!=="VISSZAÁLLÍTÁS"||p.baseSha!==live.sha||p.baseEtag!==live.etag||!matchesPreviewToken(p.previewToken,signature))
        throw new KaoriStoreConflict();
      const restored=await restoreKaori(live,p.backupPath);
      return NextResponse.json({ok:true,result:restored},{headers});
    }
    const candidate=plan(live.catalog,p.source,live.sha);
    const secret=getAdminSecret();if(!secret)throw new Error("Admin secret missing");
    const signature=previewToken(live.sha,live.etag,candidate.candidate,secret);
    if(p.action==="preview")return NextResponse.json({ok:true,baseSha:live.sha,baseEtag:live.etag,previewToken:signature,
      summary:candidate.summary,changeCount:candidate.total},{headers});
    if(p.confirm!=="IMPORTÁLÁS"||p.baseSha!==live.sha||p.baseEtag!==live.etag||!matchesPreviewToken(p.previewToken,signature))
      throw new KaoriStoreConflict();
    const result=await writeKaori(live,candidate.candidate,candidate.summary.changes);
    return NextResponse.json({ok:true,result,summary:candidate.summary},{headers});
  } catch(e){
    if(e instanceof KaoriValidationError)return NextResponse.json({error:e.message},{status:400,headers});
    if(e instanceof KaoriStoreConflict)return NextResponse.json({error:e.message},{status:409,headers});
    if(e instanceof KaoriStoreUnknownOutcome)return NextResponse.json({error:e.message,outcomeUnknown:true},{status:502,headers});
    console.error("[kaori-unified]",e instanceof Error?e.name:"Unknown");
    return NextResponse.json({error:"A művelet nem végezhető el biztonságosan. Ellenőrizd a tárat és az exportot."},{status:503,headers});
  }
}
