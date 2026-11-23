import type { Metadata } from "next";
import KaoriApp from "@/features/kaori/components/KaoriApp";
import { readKaori, KaoriStoreNotInitialized } from "@/features/kaori/lib/store";
import { publicKaori } from "@/features/kaori/lib/public";
import { freshCatalog } from "@/features/kaori/lib/unified";
export const metadata: Metadata={title:"Kaori – A teásdoboz | Kincstartó"};
export const dynamic="force-dynamic";
export const revalidate=0;
export default async function KaoriPage(){
  let unavailable=false;
  let catalog=publicKaori(freshCatalog());
  try{catalog=publicKaori((await readKaori()).catalog);}
  catch(e){if(!(e instanceof KaoriStoreNotInitialized))unavailable=true;}
  return <KaoriApp catalog={catalog} unavailable={unavailable}/>;
}
