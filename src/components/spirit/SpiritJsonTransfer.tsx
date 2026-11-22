"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {Plus, X, Download, Upload} from "lucide-react";
import styles from "./SpiritJsonTransfer.module.css";
import { waitForShioriRevision } from "@/lib/shioriImportRefresh";
const API = "/api/admin/spirit/unified";
type Preview = {baseSha:string;baseEtag:string;changeCount:number;summary:{booksAdded:number;booksUpdated:number;bookFields:{id:string;fields:string[]}[];tagLabels:string[];pills:string[];paths:string[]}};
export default function SpiritJsonTransfer({triggerClassName}:{triggerClassName:string}) {
  const router=useRouter();
  const [open,setOpen]=useState(false);
  const [source,setSource]=useState<unknown>(null);
  const [file,setFile]=useState("");
  const [preview,setPreview]=useState<Preview|null>(null);
  const [confirmed,setConfirmed]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const [unknown,setUnknown]=useState(false);
  const [pendingSha,setPendingSha]=useState<string|null>(null);
  const reset=()=>{setPreview(null);setConfirmed(false);setError("");setSuccess("");};
  async function readFile(selected?:File) {
    reset();setSource(null);setFile("");if(!selected)return;
    try {if(selected.size>1_500_000)throw new Error("A Result JSON túl nagy (max. 1,5 MB).");
      const parsed:unknown=JSON.parse(await selected.text());
      if(!parsed||typeof parsed!=="object"||!("format" in parsed)||(parsed as {format:unknown}).format!=="shiori.result.v1")throw new Error("shiori.result.v1 fájl szükséges.");
      setSource(parsed);setFile(selected.name);
    } catch(e){setError(e instanceof Error?e.message:"Érvénytelen JSON.");}
  }
  async function exportKit(){setBusy(true);reset();try{
    const r=await fetch(API,{cache:"no-store"});const data=await r.json();if(!r.ok)throw new Error(data.error??"Export hiba.");
    const blob=new Blob([JSON.stringify(data,null,2)+"\n"],{type:"application/json"});const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=`shiori-startup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
    setSuccess("A személyes adatokat nem tartalmazó Startup Kit elkészült.");
  }catch(e){setError(e instanceof Error?e.message:"Export hiba.");}finally{setBusy(false);}}
  // Verify the exact committed public revision before refreshing the server page.
  // This is read-only: a delayed Blob response must never trigger another import.
  async function refreshWhenReadable(sha: string) {
    setBusy(true);
    setError("");
    const readable = await waitForShioriRevision(sha, async () => {
      const response = await fetch(API, { cache: "no-store" });
      if (!response.ok) return null;
      const kit: unknown = await response.json();
      if (!kit || typeof kit !== "object" || !("format" in kit) ||
          (kit as { format: unknown }).format !== "shiori.startup.v1" ||
          !("baseSha" in kit) || typeof kit.baseSha !== "string") return null;
      return kit.baseSha;
    });
    setBusy(false);
    if (readable) {
      setPendingSha(null);
      setSuccess("A mentés sikerült, a frissített könyvtár visszaolvasható.");
      router.refresh();
    } else {
      setSuccess("A mentés sikerült, de az új könyvtárverzió még nem olvasható. Ne importáld újra!");
    }
  }
  async function submit(action:"preview"|"apply"){
    if(!source)return;setBusy(true);setError("");setSuccess("");
    try{
      const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify({action,source,...(action==="apply"?{baseSha:preview?.baseSha,baseEtag:preview?.baseEtag,confirm:"IMPORTÁLÁS"}:{})})});
      const data=await r.json();if(!r.ok){if(data.outcomeUnknown)setUnknown(true);throw new Error(data.error??"Import hiba.");}
      if(action==="preview"){setPreview(data as Preview);setConfirmed(false);}else{
        const sha = data?.result?.sha256;
        setPreview(null);setConfirmed(false);setSource(null);setFile("");
        if(typeof sha !== "string" || !/^[a-f0-9]{64}$/.test(sha)) {
          setUnknown(true);
          setError("A mentés választ adott, de a visszaellenőrizhető verzióazonosító hiányzik. Ne importáld újra; ellenőrizd az exportot.");
        } else {
          setPendingSha(sha);
          setSuccess("A mentés sikerült. Ellenőrzöm, hogy a friss könyvtár már biztonságosan visszaolvasható-e…");
          await refreshWhenReadable(sha);
        }
      }
    }catch(e){setError(e instanceof Error?e.message:"Import hiba.");if(action==="apply"){setPreview(null);setConfirmed(false);}}finally{setBusy(false);}
  }
  return <>
    <button type="button" className={triggerClassName} onClick={()=>setOpen(true)} aria-label="Shiori Könyvtárműhely" title="Shiori Könyvtárműhely"><Plus size={20}/></button>
    {open&&<div className="admin-overlay-backdrop" onClick={()=>{if(!busy)setOpen(false);}}><div className={`admin-overlay-panel ${styles.panel}`} role="dialog" aria-modal="true" aria-labelledby="shiori-unified-title" onClick={e=>e.stopPropagation()}>
      <header className={styles.heading}><div><p className={styles.eyebrow}>Shiori · Unified Authoring</p><h2 id="shiori-unified-title" className={styles.headingTitle}>Könyvtárműhely</h2><p className={styles.hint}>Egy Startup JSON · egy Result JSON · jóváhagyott katalógusfrissítés</p></div><button type="button" className={styles.closeButton} disabled={busy} aria-label="Bezárás" onClick={()=>setOpen(false)}><X size={19}/></button></header>
      <section className={styles.exportCard}><Download size={24}/><h3>1 · Startup Kit exportálása</h3><p>Az élő könyvtár könyvei, témái, címkéi, kapcsolatai, olvasási útjai, a szerkesztési útmutató és a Result-séma mintája. Személyes olvasási státuszok és jegyzetek nélkül.</p><button type="button" className={styles.primaryButton} disabled={busy} onClick={exportKit}><Download size={17} className={styles.downloadIcon}/>{busy?"Feldolgozás…":"Startup JSON letöltése"}</button></section>
      <section className={styles.importBody}><div className={styles.intro}><h3>2 · Result JSON importálása</h3><p>A ChatGPT-ben elkészített shiori.result.v1 fájl a könyveket, címkeszótárat, témákat és olvasási utakat egyben frissítheti. Előnézet nélkül nincs mentés.</p></div>
      <label className={styles.filePick}><Upload size={23}/><strong>{file||"Result JSON kiválasztása"}</strong><span>shiori.result.v1 · max. 1,5 MB</span><input type="file" accept=".json,application/json" disabled={busy||unknown||!!pendingSha} onChange={e=>{void readFile(e.target.files?.[0]);e.target.value="";}}/></label>
      <div className={styles.actionsRow}><button type="button" className={styles.primaryButton} disabled={!source||busy||unknown||!!pendingSha} onClick={()=>void submit("preview")}>Változások ellenőrzése</button></div>
      {preview&&<section className={styles.preview}><div className={styles.previewHeader}><h3>3 · Változások előnézete</h3><p>Összes módosítási egység: {preview.changeCount}</p></div><div className={styles.stats}><div><strong>{preview.summary.booksAdded}</strong><span>Új könyv</span></div><div><strong>{preview.summary.booksUpdated}</strong><span>Frissülő könyv</span></div><div><strong>{preview.summary.tagLabels.length}</strong><span>Címkefelirat</span></div><div><strong>{preview.summary.paths.length+preview.summary.pills.length}</strong><span>Téma / út</span></div></div>
      {!!preview.summary.bookFields.length&&<details className={styles.previewDetails}><summary>Könyvmezők</summary><ul className={styles.changes}>{preview.summary.bookFields.map(b=><li key={b.id}>{b.id}: {b.fields.join(", ")}</li>)}</ul></details>}
      {!!preview.summary.tagLabels.length&&<p>Címkefeliratok: {preview.summary.tagLabels.join(", ")}</p>}
      {!!preview.summary.pills.length&&<p>Témák: {preview.summary.pills.join(", ")}</p>}
      {!!preview.summary.paths.length&&<p>Olvasási utak: {preview.summary.paths.join(", ")}</p>}
      <p className={styles.safetyNote}>Az előnézet nem ír adatot. Az import a Startup alapverziójához kötött; ha a katalógus azóta változott, új export szükséges. A privát olvasási adatok változatlanok.</p>
      {preview.changeCount>0?<div className={styles.approval}><label className={styles.confirm}><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>Átnéztem a módosításokat, van mentésem, és jóváhagyom az éles importot.</span></label><button type="button" className={styles.dangerButton} disabled={!confirmed||busy||unknown||!!pendingSha} onClick={()=>void submit("apply")}>Jóváhagyott import</button></div>:<p>Nincs mentendő változás.</p>}</section>}
      </section><section className={styles.exportCard}><h3>Shiori Authoring Skill</h3><p>A repóban a skills/shiori-authoring mappában található skill a Startup JSON-ból kompatibilis Result JSON-t készít. A ChatGPT-be külön telepíthető.</p></section>
      {pendingSha && !busy && !unknown && <button type="button" className={styles.primaryButton} onClick={() => void refreshWhenReadable(pendingSha)}>Könyvtár frissítésének ellenőrzése</button>}
      {error&&<p className="admin-message admin-message--error" role="alert">{error}</p>}{success&&<p className="admin-message" role="status">{success}</p>}{unknown&&<p className="admin-message admin-message--error">A mentés kimenetele bizonytalan. Ne ismételd meg; előbb ellenőrizd az élő könyvtárat.</p>}
    </div></div>}
  </>;
}
