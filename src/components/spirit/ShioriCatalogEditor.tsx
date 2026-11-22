"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Tags, X } from "lucide-react";
import type { SpiritLibrary } from "@/lib/spiritSchema";
import styles from "./ShioriCatalogEditor.module.css";

type Change = { bookId?: string; tags?: string[]; related?: string[]; labelKey?: string; labelValue?: string; renameFrom?: string; renameTo?: string };
type Preview = { changes: string[]; baseEtag: string; baseSha: string };
const endpoint = "/api/admin/spirit/editor";

export default function ShioriCatalogEditor({ library }: { library: SpiritLibrary }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"books" | "labels" | "merge">("books");
  const [bookId, setBookId] = useState(library.books[0]?.id ?? "");
  const book = library.books.find((item) => item.id === bookId);
  const [tags, setTags] = useState<string[]>([]);
  const [related, setRelated] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [relatedQuery, setRelatedQuery] = useState("");
  const [labelKey, setLabelKey] = useState("");
  const [labelValue, setLabelValue] = useState("");
  const [renameFrom, setRenameFrom] = useState("");
  const [renameTo, setRenameTo] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [reviewSignature, setReviewSignature] = useState("");
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [unknown, setUnknown] = useState(false);
  useEffect(() => { setTags(book?.tags ?? []); setRelated(book?.related ?? []); setPreview(null); setApproved(false); }, [bookId, library, book?.id]);
  const usage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of library.books) for (const tag of item.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    return [...counts].sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0], "hu"));
  }, [library]);
  const choices = library.books.filter((item) => item.id !== bookId && !related.includes(item.id) && `${item.title} ${item.author}`.toLocaleLowerCase("hu").includes(relatedQuery.toLocaleLowerCase("hu"))).slice(0, 12);
  const change: Change = tab === "books" ? { bookId, tags, related } : tab === "labels" ? { labelKey: labelKey.trim(), labelValue: labelValue.trim() } : { renameFrom: renameFrom.trim(), renameTo: renameTo.trim() };
  const signature = JSON.stringify(change);
  const invalidate = () => { setPreview(null); setApproved(false); setError(""); setSuccess(""); };
  const send = async (action: "preview" | "apply") => {
    setBusy(true); setError(""); setSuccess("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ action, change, ...(action === "apply" ? { baseEtag: preview?.baseEtag, baseSha: preview?.baseSha, confirm: "MENTÉS" } : {}) }) });
      const result = await response.json();
      if (!response.ok) { if (result.outcomeUnknown) setUnknown(true); throw new Error(result.error ?? "Sikertelen kérés."); }
      if (action === "preview") { setPreview(result); setReviewSignature(signature); setApproved(false); }
      else { setPreview(null); setApproved(false); setSuccess("A katalógus módosítása megtörtént. A friss adatok betöltődnek."); router.refresh(); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Ismeretlen hiba."); if (action === "apply") setPreview(null); }
    finally { setBusy(false); }
  };
  return <>
    <button className={styles.launch} type="button" onClick={() => setOpen(true)} title="Címkék és kapcsolatok szerkesztése"><Tags size={18}/> <span>Címkék és kapcsolatok</span></button>
    {open && <div className="admin-overlay-backdrop" onClick={() => { if (!busy) setOpen(false); }}>
      <div className={`admin-overlay-panel ${styles.panel}`} role="dialog" aria-modal="true" aria-label="Shiori katalógusszerkesztő" onClick={(event) => event.stopPropagation()}>
        <header className={styles.header}><div><small>Shiori · közös katalógus</small><h2>Címkék és kapcsolatok</h2><p>Csak publikus szerkesztői adatokat módosít. A privát olvasási állapot érintetlen marad.</p></div><button type="button" onClick={() => setOpen(false)} disabled={busy} aria-label="Bezárás"><X size={20}/></button></header>
        <nav className={styles.tabs}>{([ ["books","Könyvek"], ["labels","Címkeszótár"], ["merge","Címkék összevonása"] ] as const).map(([id,label]) => <button key={id} type="button" aria-current={tab === id ? "page" : undefined} onClick={() => { setTab(id); invalidate(); }} disabled={busy}>{label}</button>)}</nav>
        {tab === "books" && <div className={styles.body}>
          <label>Könyv<select value={bookId} onChange={(event) => setBookId(event.target.value)}>{[...library.books].sort((a,b)=>a.title.localeCompare(b.title,"hu")).map((item)=><option key={item.id} value={item.id}>{item.title} — {item.author}</option>)}</select></label>
          <div><strong>Címkék ({tags.length})</strong><div className={styles.chips}>{tags.map((tag) => <button type="button" key={tag} title="Címke eltávolítása" onClick={() => { setTags(tags.filter((x)=>x!==tag)); invalidate(); }}>{library.tag_labels?.[tag] ?? tag} ×</button>)}</div></div>
          <label>Új címke kulcsa (kisbetű, szám, aláhúzás)<div className={styles.inline}><input value={tagInput} onChange={(event)=>setTagInput(event.target.value)} placeholder="pl. zazen"/><button type="button" onClick={()=>{ if (/^[a-z0-9_]+$/.test(tagInput) && !tags.includes(tagInput)) {setTags([...tags,tagInput]); setTagInput(""); invalidate();} }}>Hozzáadás</button></div></label>
          <div><strong>Kapcsolódó művek ({related.length}/4)</strong><div className={styles.chips}>{related.map((id) => <button key={id} type="button" title="Kapcsolat eltávolítása" onClick={()=>{setRelated(related.filter((x)=>x!==id)); invalidate();}}>{library.books.find((item)=>item.id===id)?.title ?? id} ×</button>)}</div></div>
          <label>Kapcsolódó mű keresése<input value={relatedQuery} onChange={(event)=>setRelatedQuery(event.target.value)} placeholder="Cím vagy szerző" /></label>
          {relatedQuery && <div className={styles.choices}>{choices.map((item)=><button type="button" key={item.id} disabled={related.length>=4} onClick={()=>{setRelated([...related,item.id]); setRelatedQuery(""); invalidate();}}>{item.title} · {item.author}</button>)}</div>}
        </div>}
        {tab === "labels" && <div className={styles.body}><p>A címkefelirat megváltoztatása nem módosítja a könyvek címkekulcsait.</p><label>Címkekulcs<input value={labelKey} onChange={(e)=>{setLabelKey(e.target.value);setLabelValue(library.tag_labels?.[e.target.value] ?? "");invalidate();}} list="shiori-tags" placeholder="pl. zazen"/></label><datalist id="shiori-tags">{usage.map(([key])=><option key={key} value={key}/>)}</datalist><label>Megjelenítési felirat<input value={labelValue} onChange={(e)=>{setLabelValue(e.target.value);invalidate();}} placeholder="pl. Zazen"/></label><p>{usage.find(([key])=>key===labelKey)?.[1] ?? 0} könyv használja ezt a kulcsot.</p><details><summary>Címkék és gyakoriságuk</summary><div className={styles.usage}>{usage.map(([key,count])=><button type="button" key={key} onClick={()=>{setLabelKey(key);setLabelValue(library.tag_labels?.[key] ?? "");invalidate();}}>{library.tag_labels?.[key] ?? key} · {count}</button>)}</div></details></div>}
        {tab === "merge" && <div className={styles.body}><p>A forráscímke minden előfordulását a célcímkére cseréli, és eltávolítja a régi feliratkulcsot. A célcímke meglévő felirata megmarad.</p><label>Régi címkekulcs<input list="shiori-merge-tags" value={renameFrom} onChange={(e)=>{setRenameFrom(e.target.value);invalidate();}}/></label><datalist id="shiori-merge-tags">{usage.map(([key])=><option key={key} value={key}/>)}</datalist><label>Célcímkekulcs<input value={renameTo} onChange={(e)=>{setRenameTo(e.target.value);invalidate();}} placeholder="pl. hatha_joga"/></label><p>Érintett könyvek: {usage.find(([key])=>key===renameFrom)?.[1] ?? 0}</p></div>}
        <div className={styles.footer}><button type="button" disabled={busy || unknown} onClick={()=>send("preview")}>Változások előnézete</button>{preview && reviewSignature===signature && <section className={styles.preview}><strong>Mentés előnézete</strong>{preview.changes.map((item)=><p key={item}>{item}</p>)}<label><input type="checkbox" checked={approved} onChange={(e)=>setApproved(e.target.checked)}/> Ellenőriztem a módosítást.</label><button type="button" disabled={!approved || busy || unknown} onClick={()=>send("apply")}>Módosítás mentése</button></section>}{error && <p role="alert" className={styles.error}>{error}</p>}{success && <p role="status">{success}</p>}{unknown && <p role="alert">A mentés eredménye bizonytalan. Előbb ellenőrizd az éles exportot; ne próbáld újra.</p>}</div>
      </div>
    </div>}
  </>;
}
