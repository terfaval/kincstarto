import { NextResponse } from "next/server";
import { readKaori, KaoriStoreNotInitialized } from "@/features/kaori/lib/store";
import { publicKaori } from "@/features/kaori/lib/public";
import { freshCatalog } from "@/features/kaori/lib/unified";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
  try {const live=await readKaori();return NextResponse.json(publicKaori(live.catalog),{headers:{"Cache-Control":"no-store"}});}
  catch(e){if(e instanceof KaoriStoreNotInitialized)return NextResponse.json(publicKaori(freshCatalog()),{headers:{"Cache-Control":"no-store"}});
    return NextResponse.json({error:"A Kaori teák átmenetileg nem érhetők el."},{status:503,headers:{"Cache-Control":"no-store"}});}
}
