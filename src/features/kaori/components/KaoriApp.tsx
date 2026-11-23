"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { flavorColors, flavorIds, flavorNames, type FlavorId } from "../lib/flavors";
import { resolveTeaCardVisual } from "../lib/teaCardMandala";
import type { PublicKaori } from "../lib/public";
import { scaledDose } from "../lib/preparationMath";
import { kitchenSpoonDisplay } from "../lib/spoonMeasure";
import type { CSSProperties, ReactNode } from "react";
import styles from "./KaoriApp.module.css";

type Tea = PublicKaori["teas"][number];
type Profile = PublicKaori["preparationProfiles"][number];
const ALL = "all";
function useResponsiveCount(){
  const [count,setCount]=useState(9);
  useEffect(()=>{
    const update=()=>setCount(window.innerWidth<=600?2:window.innerWidth<=1024?4:9);
    update();window.addEventListener("resize",update);return()=>window.removeEventListener("resize",update);
  },[]);
  return count;
}
function flavorList(taste:Tea["tasteProfile"]){
  return flavorIds.filter(id=>taste[id]>0).sort((a,b)=>taste[b]-taste[a]);
}
const formatSec=(n:number)=>{
  const total=Math.max(0,Math.floor(n));
  const hours=Math.floor(total/3600);
  const minutes=String(Math.floor((total%3600)/60)).padStart(2,"0");
  const seconds=String(total%60).padStart(2,"0");
  return hours>0?`${String(hours).padStart(2,"0")}:${minutes}:${seconds}`:`${minutes}:${seconds}`;
};
function FocusDialog({children,onClose,label}:{children:ReactNode;onClose:()=>void;label:string}){
  const root=useRef<HTMLDivElement>(null);
  const closeRef=useRef(onClose);
  // Keep the latest callback without mutating a ref during render.
  useEffect(()=>{closeRef.current=onClose;},[onClose]);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    const old=document.body.style.overflow;document.body.style.overflow="hidden";
    const node=root.current;
    node?.querySelector<HTMLElement>("button,[href],input,select")?.focus();
    const key=(e:KeyboardEvent)=>{
      if(e.key==="Escape"){e.preventDefault();closeRef.current();}
      if(e.key!=="Tab"||!node)return;
      const items=[...node.querySelectorAll<HTMLElement>('button:not(:disabled),[href],input:not(:disabled),select:not(:disabled),[tabindex="0"]')];
      if(items.length===0)return;
      if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items[items.length-1].focus();}
      if(!e.shiftKey&&document.activeElement===items[items.length-1]){e.preventDefault();items[0].focus();}
    };
    window.addEventListener("keydown",key);
    return()=>{window.removeEventListener("keydown",key);document.body.style.overflow=old;previous?.focus();};
  },[]);
  return <div className={styles.overlay} onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={label} ref={root}>{children}</div>
  </div>;
}
function Preparation({tea,profiles,methods,ingredients,onBack,onLeave,onDone}:{tea:Tea;profiles:Profile[];methods:PublicKaori["methods"];ingredients:PublicKaori["ingredients"];onBack:()=>void;onLeave:()=>void;onDone:()=>void}){
  const [profileId,setProfileId]=useState(profiles[0]?.id??"");
  const [ml,setMl]=useState(()=>profiles[0]?.baseVolumeMl??250);
  const [stage,setStage]=useState<"choose"|"prepare"|"steep"|"done">("choose");
  const bodyRef=useRef<HTMLElement>(null);
  const [stepIndex,setStepIndex]=useState(0);
  const [remaining,setRemaining]=useState(()=>{
    const first=profiles[0]?.steps[0];
    return first?.type==="timer"?first.durationSeconds:0;
  });
  const [target,setTarget]=useState<number|null>(null);
  const [now,setNow]=useState(()=>Date.now());
  const profile=profiles.find(p=>p.id===profileId)??profiles[0];
  const method=methods.find(m=>m.id===profile?.methodId);
  const step=profile?.steps[stepIndex];
  const seconds=step?.type==="timer"?step.durationSeconds:0;
  // A new wizard screen starts at its heading, even if the previous one was scrolled.
  useEffect(()=>{bodyRef.current?.scrollTo({top:0,behavior:"auto"});},[stage,stepIndex,profileId]);
  const left=target===null?remaining:Math.max(0,Math.ceil((target-now)/1000));
  useEffect(()=>{if(target===null)return;
    const tick=()=>setNow(Date.now());tick();
    const timer=window.setInterval(tick,250);
    document.addEventListener("visibilitychange",tick);window.addEventListener("focus",tick);
    return()=>{window.clearInterval(timer);document.removeEventListener("visibilitychange",tick);window.removeEventListener("focus",tick);};
  },[target]);
  const values=profile&&ml>=25&&ml<=10000?scaledDose(profile.leafGrams,profile.baseVolumeMl,tea.ingredients.map(i=>i.sharePct),ml):null;
  const start=()=>{setNow(Date.now());setTarget(Date.now()+Math.max(0,remaining)*1000);};
  const pause=()=>{setRemaining(left);setTarget(null);};
  const reset=()=>{setTarget(null);setRemaining(seconds);};
  const next=()=>{
    setTarget(null);
    const upcoming=profile?.steps[stepIndex+1];
    if(upcoming){
      setRemaining(upcoming.type==="timer"?upcoming.durationSeconds:0);
      setStepIndex(i=>i+1);
    }else setStage("done");
  };
  const select=(id:string)=>{
    setProfileId(id);
    const p=profiles.find(p=>p.id===id);
    setMl(p?.baseVolumeMl??250);
    setStepIndex(0);
    setTarget(null);
    const first=p?.steps[0];
    setRemaining(first?.type==="timer"?first.durationSeconds:0);
  };
  return <>
    <div className={styles.dialogTop}><div><span className={styles.eyebrow}>KAORI · TEA ELKÉSZÍTÉSE</span><h2>{tea.title}</h2></div><button onClick={onLeave} aria-label="Kilépés az elkészítésből" className={styles.close}>✕</button></div>
    <div className={styles.stages} aria-label="Elkészítési szakaszok">
      {[["choose","Választás"],["prepare","Előkészítés"],["steep","Áztatás / elkészítés"],["done","Elkészült"]].map(([key,label],i)=><span key={key} aria-current={stage===key?"step":undefined} className={stage===key?styles.stageActive:""}>{i+1}. {label}</span>)}
    </div>
    {stage==="choose"&&<section className={styles.dialogBody} ref={bodyRef}>
      <p>Válaszd ki a módszert és a készítendő mennyiséget.</p>
      <label className={styles.field}>Elkészítési módszer<select value={profileId} onChange={e=>select(e.target.value)}>{profiles.map(p=><option key={p.id} value={p.id}>{methods.find(m=>m.id===p.methodId)?.title??p.methodId}</option>)}</select></label>
      <label className={styles.field}>Víz mennyisége (ml)<input type="number" min="25" max="10000" step="25" value={ml} onChange={e=>setMl(Number(e.target.value))}/></label>
      {method&&<p className={styles.muted}>{method.description}</p>}
      {values&&<p><strong>{values.total.toLocaleString("hu-HU")} g</strong> tea · {ml} ml víz</p>}
    </section>}
    {stage==="prepare"&&<section className={styles.dialogBody} ref={bodyRef}>
      <h3>Amire szükséged lesz</h3><p>{method?.equipment.join(" · ")||"A módszerhez nincs megadott eszköz."}</p>
      <h3>Hozzávalók és víz</h3><ul className={styles.doseList}>{tea.ingredients.map((i,index)=>{
        const ingredient=ingredients.find(item=>item.id===i.ingredientId);
        const grams=values?.grams[index];
        const spoons=grams==null?null:kitchenSpoonDisplay(grams,ingredient?.gramsPerLevelTeaspoon);
        return <li key={i.ingredientId}><span>{ingredient?.name??i.ingredientId}</span><span className={styles.doseAmount}>
          <strong>{spoons??`${grams?.toLocaleString("hu-HU")??"–"} g`}</strong>
          {spoons&&<small>{grams?.toLocaleString("hu-HU")} g</small>}
        </span></li>;
      })}</ul>
      <p>{ml} ml víz {profile?.temperatureC!=null?`· ${profile.temperatureC} °C`:"· Hőfok nincs külön megadva"}</p>
      <p className={styles.muted}>A kanálmérték közelítő, csapott 5 ml-es mérő-teáskanál (tk) vagy 15 ml-es mérő-evőkanál (ek). Csak alapanyaghoz dokumentált átváltás esetén jelenik meg; egyébként a pontos grammérték marad.</p>
    </section>}
    {stage==="steep"&&step&&<section className={styles.dialogBody} ref={bodyRef}>
      <span className={styles.eyebrow}>{stepIndex+1}. művelet / {profile?.steps.length}</span><h3>{step.title}</h3>
      {step.type==="timer"?<div className={styles.timerPanel}>
        <strong className={styles.timer} aria-label={`Hátralévő idő ${formatSec(left)}`}>{formatSec(left)}</strong>
        <div className={styles.actions}>{target===null?<button onClick={start} disabled={left===0} className={styles.primary}>Indítás / Folytatás</button>:<button onClick={pause}>Szünet</button>}<button onClick={reset}>Újraindítás</button></div>
        {left===0&&<p role="status">Az idő letelt. Ha készen állsz, folytasd a következő művelettel.</p>}
      </div>:<p className={styles.muted}>Ez a lépés kézzel történik; nincs hozzá mesterséges időzítés.</p>}
      <button className={styles.primary} onClick={next}>{stepIndex+1===(profile?.steps.length??0)?"Elkészült":"Következő művelet"}</button>
    </section>}
    {stage==="done"&&<section className={styles.dialogBody} ref={bodyRef}><h3>Elkészült a teád.</h3><p>{profile?.servingNotes||"Jó teázást!"}</p><p>Az elkészítés lezárult. Nincs értékelési kötelezettség.</p></section>}
    <div className={styles.dialogFooter}>
      {stage==="choose"?<><button onClick={onBack}>Vissza a teához</button><button disabled={!profile||!Number.isFinite(ml)||ml<25||ml>10000} onClick={()=>setStage("prepare")} className={styles.primary}>Tovább az előkészítéshez</button></>:
       stage==="prepare"?<><button onClick={()=>setStage("choose")}>Vissza</button><button onClick={()=>{
         setStepIndex(0);
         setTarget(null);
         const first=profile?.steps[0];
         setRemaining(first?.type==="timer"?first.durationSeconds:0);
         setStage("steep");
       }} className={styles.primary}>Kezdhetjük</button></>:
       stage==="steep"?<button onClick={()=>{setTarget(null);setStage("prepare");}}>Vissza az előkészítéshez</button>:
       <><button onClick={onBack}>Vissza a teához</button><button className={styles.primary} onClick={onDone}>Vissza a teásdobozhoz</button></>}
    </div>
    <p className={styles.tiny}>Az oldal újratöltése megszakítja az aktuális elkészítési folyamatot; a háttérben futó időzítő a rendszerórához igazodik, értesítést nem küld.</p>
  </>;
}

export default function KaoriApp({catalog,unavailable=false,qaCount}:{catalog:PublicKaori;unavailable?:boolean;qaCount?:number}){
  const count=useResponsiveCount();
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState<string>(ALL);
  const [page,setPage]=useState(0);
  const [selected,setSelected]=useState<Tea|null>(null);
  const [preparing,setPreparing]=useState(false);
  const [details,setDetails]=useState(false);
  const ingredientMap=useMemo(()=>new Map(catalog.ingredients.map(x=>[x.id,x])),[catalog]);
  const teaVisuals=useMemo(()=>new Map(catalog.teas.map(tea=>[tea.id,resolveTeaCardVisual(tea)])),[catalog.teas]);
  const methods=useMemo(()=>catalog.methods,[catalog]);
  const profiles=catalog.preparationProfiles;
  const filtered=useMemo(()=>catalog.teas.filter(t=>{
    const haystack=[t.title,t.cardLine,t.modalDescription,...t.ingredients.map(i=>ingredientMap.get(i.ingredientId)?.name??"")].join(" ").toLocaleLowerCase("hu");
    return haystack.includes(query.toLocaleLowerCase("hu"))&&(filter===ALL||t.tasteProfile[filter as FlavorId]>0);
  }),[catalog.teas,ingredientMap,query,filter]);
  const pages=Math.max(1,Math.ceil(filtered.length/count));
  const current=Math.min(page,pages-1);
  const pageTeas=filtered.slice(current*count,(current+1)*count);
  const selectedProfiles=selected?profiles.filter(p=>selected.preparationIds.includes(p.id)):[];
  const close=()=>{
    if(preparing&&!window.confirm("Megszakítod a tea elkészítését? Az aktuális lépés és az időzítő állapota elveszik."))return;
    setPreparing(false);setSelected(null);
  };
  return <main className={styles.page}>
    <div className={styles.garden} aria-hidden="true" />
    <div className={styles.shell}>
      {qaCount!==undefined&&<aside className={styles.qaBanner} role="note">
        <strong>ADMIN QA · CSAK MINTAADATOK</strong>
        <p>Ez nem a valódi Kaori-katalógus. A tesztteák és az elkészítési számok kizárólag felületellenőrzésre valók; a privát tárolót ez az oldal nem olvassa és nem módosítja.</p>
        <nav aria-label="Tesztkatalógus mérete">{[0,1,2,9,10,11].map(n=><Link key={n} href={`/admin/kaori/preview?count=${n}`} aria-current={qaCount===n?"page":undefined}>{n} tea</Link>)}<Link href="/admin/kaori">Vissza az adminba</Link></nav>
      </aside>}
      <nav className={styles.back}><Link href="/">← Kincstartó</Link></nav>
      <header className={styles.header}>
        <span className={styles.monSeal} aria-hidden="true"><Image src="/symbols/mon-kaori-ink.svg" alt="" width={76} height={76} className={styles.mon}/></span>
        <div className={styles.headingCopy}><span className={styles.eyebrow}>香り · KAORI</span><h1>A teásdoboz</h1><p>Válassz egy teát, és készítsd el a saját ritmusodban.</p></div>
        <Image src="/symbols/hanko-kaori.svg" alt="" width={42} height={42} className={styles.hanko}/>
      </header>
      <div className={styles.tools}>
        <label className={styles.search}><span className={styles.visuallyHidden}>Keresés a teák között</span><input type="search" placeholder="Tea vagy alapanyag keresése…" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}} /></label>
        <label className={styles.filter}>Ízjegy <select value={filter} onChange={e=>{setFilter(e.target.value);setPage(0);}}><option value={ALL}>Mindegyik</option>{flavorIds.map(id=><option key={id} value={id}>{flavorNames[id]}</option>)}</select></label>
      </div>
      {unavailable?<div className={styles.notice} role="alert">A Kaori-katalógus most nem érhető el. A teák helyett nem jelenítünk meg régi vagy mintaadatot.</div>:<>
        {catalog.teas.length===0&&<p className={styles.notice}>A teásdoboz még üres. Az első saját recepteket a Kaori Unifieddel állítjuk össze és publikáljuk.</p>}
        {catalog.teas.length>0&&filtered.length===0&&<p className={styles.notice}>Erre a keresésre nem találok teát. <button onClick={()=>{setQuery("");setFilter(ALL);setPage(0);}}>Szűrők törlése</button></p>}
        <div className={styles.teaBox} aria-label="Rekeszes teásdoboz">
          {Array.from({length:count},(_,i)=>{
            const tea=pageTeas[i];
            const visual=tea?teaVisuals.get(tea.id):null;
            const top=visual?.topFlavor??(tea&&flavorList(tea.tasteProfile)[0])??"fresh";
            return <div key={i} className={styles.compartment}>
              {tea?<button type="button" className={styles.teaCard} onClick={()=>{setDetails(false);setSelected(tea);}} style={{
                "--flavor":flavorColors[top],
                "--mandala-image":`url(${visual?.mandalaPath??"/kaori/teacard_background/Mandala.svg"})`,
                "--mandala-position-x":`${((visual?.focusX??0.5)*100).toFixed(2)}%`,
                "--mandala-position-y":`${((visual?.focusY??0.5)*100).toFixed(2)}%`,
                "--mandala-scale":`${visual?.scale??1.5}`,
                "--mandala-rotation":`${visual?.rotationDeg??0}deg`,
              } as CSSProperties}>
                <span className={styles.cardMandalaFrame} aria-hidden="true">
                  <span className={styles.cardMandala}/>
                  <span className={styles.cardMandalaWash}/>
                </span>
                <span className={styles.cardNumber} aria-hidden="true">{String(current*count+i+1).padStart(2,"0")}</span>
                <span className={styles.cardText}><span className={styles.teaName}>{tea.title}</span><span className={styles.teaCharacter}>{tea.cardLine}</span></span>
                {top&&<span className={styles.flavorChip}><span className={styles.flavorPin} aria-hidden="true"/>{flavorNames[top]}</span>}
              </button>:<span className={styles.emptySlot} aria-hidden="true"><span className={styles.emptyMark}/></span>}
            </div>;
          })}
        </div>
        <div className={styles.pagination}>
          <span>{filtered.length} tea · {current+1} / {pages}. oldal</span>
          <div><button disabled={current===0} onClick={()=>setPage(current-1)}>← Előző</button><button disabled={current>=pages-1} onClick={()=>setPage(current+1)}>Következő →</button></div>
        </div>
      </>}
    </div>
    {selected&&<FocusDialog label={preparing?`${selected.title} elkészítése`:selected.title} onClose={close}>
      {preparing?<Preparation key={selected.id} tea={selected} profiles={selectedProfiles} methods={methods} ingredients={catalog.ingredients} onBack={()=>setPreparing(false)} onLeave={close} onDone={()=>{setPreparing(false);setSelected(null);}}/>:<>
        <div className={styles.dialogTop}><div><span className={styles.eyebrow}>TEA A DOBOZBÓL</span><h2>{selected.title}</h2><span className={styles.muted}>{selected.cardLine}</span></div><button className={styles.close} onClick={close} aria-label="Tea bezárása">✕</button></div>
        <div className={styles.dialogBody}>
          <p className={styles.description}>{selected.modalDescription}</p>
          <div className={styles.modalColumns}>
            <section><h3>Összetevők</h3><ul className={styles.ingredientList}>{selected.ingredients.map(i=>{const ingredient=ingredientMap.get(i.ingredientId);return <li key={i.ingredientId}><span className={styles.dot} style={{background:flavorColors[ingredient?.primaryFlavor??"fresh"]}}/><span>{ingredient?.name??i.ingredientId}</span><strong>{i.sharePct}%</strong></li>;})}</ul></section>
            <section><h3>Ízvilág</h3><ul className={styles.flavorList}>{flavorList(selected.tasteProfile).slice(0,4).map(id=><li key={id}><span className={styles.dot} style={{background:flavorColors[id]}}/>{flavorNames[id]}<small>{selected.tasteProfile[id]}/3</small></li>)}</ul><p className={styles.tiny}>Szerkesztett ízjellemzés, nem laboratóriumi mérés.</p></section>
          </div>
          {selectedProfiles.length>0&&<div className={styles.prepBrief}><h3>Elkészítés</h3><p>{selectedProfiles.map(p=>{const m=methods.find(m=>m.id===p.methodId);return `${m?.title??"Módszer"}: ${p.leafGrams} g / ${p.baseVolumeMl} ml${p.temperatureC==null?"":` · ${p.temperatureC} °C`}`;}).join(" · ")}</p></div>}
          <button className={styles.detailsButton} onClick={()=>setDetails(!details)} aria-expanded={details}>{details?"Kevesebb részlet":"Összetevők részletei"}</button>
          {details&&<ul className={styles.detailsList}>{selected.ingredients.map(i=>{const ing=ingredientMap.get(i.ingredientId);return <li key={i.ingredientId}><strong>{ing?.name}</strong> – {ing?.publicProfile&&ing.summary?ing.summary:"Részletes alapanyagprofil még nem jelent meg."}</li>;})}</ul>}
        </div>
        <div className={styles.dialogFooter}><button onClick={close}>Vissza a teásdobozhoz</button><button className={styles.primary} disabled={!selectedProfiles.length} onClick={()=>setPreparing(true)}>Tea elkészítése</button></div>
      </>}
    </FocusDialog>}
  </main>;
}
