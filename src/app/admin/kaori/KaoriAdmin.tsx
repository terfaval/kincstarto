"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { KaoriCatalog } from "@/features/kaori/lib/schema";
import styles from "./admin.module.css";

type Kit={format:string;baseSha:string;generatedAt:string;releases:KaoriCatalog["releases"];catalog:KaoriCatalog["editorial"] & {flavorVocabulary:string[]};schemas:unknown;instructions:string;resultExample:unknown};
type Preview={ok:true;baseSha:string;baseEtag:string;previewToken:string;changeCount:number;summary:{changes:Record<string,number>;published:Record<string,number>;remainingDrafts:string[];publicationIntent:string}};
const URL="/api/admin/kaori/unified";
function saveJSON(value:unknown,filename:string){const blob=new Blob([JSON.stringify(value,null,2)+"\n"],{type:"application/json"});const url=window.URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;a.click();window.setTimeout(()=>window.URL.revokeObjectURL(url),1500);}
export default function KaoriAdmin(){
  const [kit,setKit]=useState<Kit|null>(null);const [error,setError]=useState("");const [status,setStatus]=useState("");const [needsInit,setNeedsInit]=useState(false);const [busy,setBusy]=useState(false);
  const [source,setSource]=useState<unknown|null>(null);const [fileName,setFileName]=useState("");const [preview,setPreview]=useState<Preview|null>(null);const [lastBackup,setLastBackup]=useState<{backupPath:string;releaseId:string;sha:string}|null>(null);
  const [editor,setEditor]=useState<{kind:"ingredients"|"methods"|"teas"|"preparationProfiles";id:string;json:string}|null>(null);
  const [restoreMode,setRestoreMode]=useState(false);
  const [selectedBackup,setSelectedBackup]=useState("");
  const load=useCallback(async()=>{
    setError("");try{
      const response=await fetch(URL,{cache:"no-store"});const json=await response.json();
      if(!response.ok){setKit(null);setNeedsInit(Boolean(json.needsInit));throw new Error(json.error||"Nem sikerült az export.");}
      setKit(json);setNeedsInit(false);
    } catch(e){setError(e instanceof Error?e.message:"Ismeretlen hiba.");}
  },[]);
  useEffect(()=>{void load();},[load]);
  async function send(data:unknown){const response=await fetch(URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data),cache:"no-store"});const result=await response.json();if(!response.ok)throw new Error(result.error||"A művelet nem sikerült.");return result;}
  async function bootstrap(){if(!window.confirm("Egy új, ÜRES, külön privát Kaori-katalógust hozzunk létre? Már létező tárolót soha nem írunk felül."))return;
    setBusy(true);try{await send({action:"initialize",confirm:"ÚJ KAORI"});setStatus("Az új Kaori-katalógus létrejött.");await load();}catch(e){setError(e instanceof Error?e.message:"Nem sikerült.");}finally{setBusy(false);}}
  async function onFile(file:File|undefined){setPreview(null);setLastBackup(null);setError("");setStatus("");setSource(null);if(!file)return;
    if(file.size>1_600_000){setError("A fájl túl nagy (max. 1,6 MB). ");return;}
    try{const parsed=JSON.parse(await file.text());if(parsed?.format!=="kaori.result.v1")throw new Error("A fájl nem kaori.result.v1.");setSource(parsed);setFileName(file.name);}catch(e){setError(e instanceof Error?e.message:"Hibás JSON.");}}
  async function doPreview(candidate:unknown=source){if(!kit||!candidate)return;
    setBusy(true);setError("");setPreview(null);setLastBackup(null);
    try{const result=await send({action:"preview",source:candidate});setPreview(result);setSource(candidate);setStatus("Előnézet kész. Az adatok még nem módosultak.");}
    catch(e){setError(e instanceof Error?e.message:"Ellenőrzési hiba.");}
    finally{setBusy(false);}}
  async function apply(){if(!kit||!source||!preview)return;
    const drafts=preview.summary.remainingDrafts.length;
    if(!window.confirm(`Alkalmazod a(z) ${preview.changeCount} rekordmódosítást?\n${drafts} rekord vagy verzió nem publikálható, vázlatban marad.\n\nCsak a valóban ellenőrzött, alacsony kockázatú adatokat hagyd jóvá.`))return;
    setBusy(true);setError("");
    try{const result=await send({action:"apply",source,confirm:"IMPORTÁLÁS",baseSha:preview.baseSha,baseEtag:preview.baseEtag,previewToken:preview.previewToken});
      setStatus(`Módosítások alkalmazva: ${result.result.releaseId}.`);setLastBackup(result.result);setPreview(null);setSource(null);setFileName("");setEditor(null);await load();}
    catch(e){setPreview(null);setError((e instanceof Error?e.message:"Mentési hiba")+" Ha a mentés bizonytalan, ne ismételd automatikusan; először friss exporttal ellenőrizd az állapotot.");}
    finally{setBusy(false);}}
  async function restore(){if(!selectedBackup||!restoreMode)return;
    setBusy(true);setError("");
    try{
      const pre=await send({action:"restore_preview",backupPath:selectedBackup});
      if(!window.confirm(`A mentés ${pre.summary.teas} publikus teát tartalmaz. Visszaállítod?\nEz új kiadásként mentődik, a jelenlegi állapot külön backupba kerül.`))return;
      const restored=await send({action:"restore_apply",backupPath:selectedBackup,confirm:"VISSZAÁLLÍTÁS",baseSha:pre.baseSha,baseEtag:pre.baseEtag,previewToken:pre.previewToken});
      setStatus(`Visszaállítás megtörtént: ${restored.result.releaseId}`);setLastBackup(restored.result);setSelectedBackup("");setRestoreMode(false);setPreview(null);setSource(null);await load();
    }catch(e){setError((e instanceof Error?e.message:"Visszaállítási hiba")+" Bizonytalan kimenetelnél először exporttal ellenőrizd az állapotot.");}
    finally{setBusy(false);}}
  function prepareEdit(){if(!editor||!kit)return;
    try{const original=kit.catalog[editor.kind].find(r=>r.id===editor.id) as {id:string;revision:number}|undefined;
      if(!original)throw new Error("A rekord nem található.");
      const parsed=JSON.parse(editor.json) as Record<string,unknown>;
      if(parsed.id!==original.id||parsed.revision!==original.revision)throw new Error("ID/revision nem módosítható az editorban.");
      const set=Object.fromEntries(Object.entries(parsed).filter(([key,value])=>key!=="id"&&key!=="revision"&&JSON.stringify((original as unknown as Record<string,unknown>)[key])!==JSON.stringify(value)));
      if(!Object.keys(set).length)throw new Error("Nincs módosítás.");
      const changes={ingredients:[],methods:[],teas:[],preparationProfiles:[]} as Record<string,unknown[]>;
      changes[editor.kind]=[{op:"patch",id:original.id,expectedRevision:original.revision,set}];
      const result={format:"kaori.result.v1",baseSha:kit.baseSha,changes,publicationIntent:"save_draft",editorialNotes:["Kézi kivételes módosítás, először csak vázlatként."]};
      void doPreview(result);
    }catch(e){setError(e instanceof Error?e.message:"A szerkesztett JSON hibás.");}}
  return <main className={styles.page}>
    <nav className={styles.nav}><Link href="/admin">← Admin</Link><Link href="/kaori">Publikus Kaori ↗</Link><Link href="/admin/kaori/preview?count=11">QA-előnézet (csak minták) ↗</Link></nav>
    <header><span className={styles.kicker}>香り · KAORI UNIFIED</span><h1>A teák közös tudástára</h1><p>Az elsődleges munkamód: aktuális Startup Kit → közös tervezés ChatGPT-vel → egyetlen Result JSON → ellenőrzés és alkalmazás.</p></header>
    {error&&<div className={styles.error} role="alert">{error}</div>}{status&&<div className={styles.success} role="status">{status}</div>}
    {needsInit&&<section className={styles.section}><h2>Új Kaori-tudástár</h2><p>Még nincs inicializált privát katalógus. Ez egyszeri művelet, és csak új, külön tárolóban végezhető.</p><button disabled={busy} onClick={bootstrap}>Üres Kaori-tároló létrehozása</button></section>}
    <section className={styles.workflow}>
      <div className={styles.panel}><span className={styles.step}>01 · EXPORT</span><h2>Startup Kit letöltése</h2><p>Mindig az aktuális privát katalóguson alapul. Tartalmazza a sémát, szabályokat és rekordokat.</p><button disabled={!kit||busy} onClick={()=>kit&&saveJSON(kit,"kaori-startup-v1.json")}>Startup Kit letöltése</button><button className={styles.subtle} disabled={busy} onClick={()=>void load()}>Frissítés</button></div>
      <div className={styles.panel}><span className={styles.step}>02 · IMPORT</span><h2>Result JSON feltöltése</h2><p>Az együtt elkészített Resultot itt tudod feltölteni. A fájl kiválasztása önmagában nem ír adatot.</p><label className={styles.file}>JSON-fájl kiválasztása<input type="file" accept=".json,application/json" disabled={busy||!kit} onChange={e=>void onFile(e.target.files?.[0])}/></label>{fileName&&<p>{fileName}</p>}<button disabled={!source||busy} onClick={()=>void doPreview()}>Ellenőrzés</button></div>
      <div className={styles.panel}><span className={styles.step}>03 · ALKALMAZÁS</span><h2>Egy összesített jóváhagyás</h2><p>Csak a sikeres előnézet után jelenik meg a mentési lehetőség.</p>{preview?<><p><strong>{preview.changeCount}</strong> változás</p><p>{Object.entries(preview.summary.changes).filter(([,n])=>n).map(([k,n])=>`${k}: ${n}`).join(" · ")}</p><p>Vázlatként marad: <strong>{preview.summary.remainingDrafts.length}</strong></p>{preview.summary.remainingDrafts.length>0&&<details><summary>Részletes kivétellista</summary><ul>{preview.summary.remainingDrafts.map(id=><li key={id}>{id}</li>)}</ul></details>}<button className={styles.action} disabled={busy} onClick={()=>void apply()}>Változások alkalmazása</button></>:<p className={styles.dim}>Nincs jóváhagyásra váró előnézet.</p>}</div>
    </section>
    {kit&&kit.releases.length>0&&<section className={styles.section}>
      <details><summary><strong>Verziók és visszaállítás</strong> · {kit.releases.length} kiadás</summary>
        <p>Korábbi privát snapshot csak külön ellenőrző előnézettel és megerősítéssel állítható vissza. A jelenlegi verzió a visszaállításkor is mentésre kerül.</p>
        <label>Visszaállítási pont
          <select value={selectedBackup} onChange={e=>setSelectedBackup(e.target.value)}>
            <option value="">Válassz korábbi állapotot…</option>
            {[...kit.releases].reverse().map(r=><option key={r.id} value={r.backupPath}>{new Date(r.at).toLocaleString("hu-HU")} · {r.id}</option>)}
          </select>
        </label>
        <label className={styles.confirm}><input type="checkbox" checked={restoreMode} onChange={e=>setRestoreMode(e.target.checked)} /> Megértettem a visszaállítás hatását.</label>
        <button disabled={busy||!selectedBackup||!restoreMode} onClick={()=>void restore()}>Visszaállítás előnézete és megerősítése</button>
      </details>
      {lastBackup&&<p>Legutóbbi release: {lastBackup.releaseId}</p>}
    </section>}
    {kit&&<section className={styles.section}><h2>Katalógus és ritka kézi javítások</h2><p>Az alábbi rekordok privát szerkesztői adatok. A rekord kiválasztásával a teljes JSON szerkeszthető; mentés előtt ugyanaz az ellenőrző fut le, és alapból csak vázlatként változik.</p>
      <div className={styles.recGrid}>{(["teas","ingredients","methods","preparationProfiles"] as const).map(kind=><div key={kind}><h3>{kind} ({kit.catalog[kind].length})</h3><div className={styles.recList}>{kit.catalog[kind].map(record=><button key={record.id} onClick={()=>{setEditor({kind,id:record.id,json:JSON.stringify(record,null,2)});setError("");}}>{"title" in record?record.title:"name" in record?record.name:record.id} <small>rev {record.revision}</small></button>)}</div></div>)}</div>
      {editor&&<div className={styles.editor}><h3>{editor.kind} / {editor.id}</h3><textarea aria-label="Rekord JSON szerkesztése" spellCheck={false} rows={20} value={editor.json} onChange={e=>setEditor({...editor,json:e.target.value})}/><div className={styles.btnRow}><button onClick={()=>setEditor(null)}>Bezárás</button><button disabled={busy} onClick={prepareEdit}>Ellenőrzés vázlatként</button></div></div>}
    </section>}
    <footer className={styles.footer}>Nem kerül át a Mirachai régi teakatalógusa. Az éles teák kizárólag ellenőrzött Kaori Unified-kiadásból jelennek meg.</footer>
  </main>;
}
