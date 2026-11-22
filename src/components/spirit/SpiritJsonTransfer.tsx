"use client";

import { useEffect, useState } from "react";
import { Download, Plus, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import styles from "./SpiritJsonTransfer.module.css";

type ImportMode = "add" | "upsert";
type Summary = {
  received: number;
  added: string[];
  updated: { id: string; fields: string[]; relatedBefore?: string[]; relatedAfter?: string[] }[];
  unchanged: number;
  skippedExisting: number;
  ignoredPersonalFields: number;
};
type Preview = {
  summary: Summary;
  changeCount: number;
  liveBooks: number;
  livePaths: number;
  baseEtag: string;
  baseSha: string;
};
const ENDPOINT = "/api/admin/spirit/json";
const MAX_FILE_BYTES = 1_000_000;

async function responsePayload(response: Response) {
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? `Sikertelen kérés (${response.status}).`);
  return data;
}

export default function SpiritJsonTransfer({ triggerClassName }: { triggerClassName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"import" | "export">("import");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [mode, setMode] = useState<ImportMode>("add");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [reviewKey, setReviewKey] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<"export" | "preview" | "apply" | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [outcomeUnknown, setOutcomeUnknown] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy]);

  const invalidate = () => {
    setPreview(null);
    setReviewKey("");
    setConfirmed(false);
    setSuccess("");
    setError("");
  };

  const readSource = () => {
    if (text.length > MAX_FILE_BYTES) throw new Error("A JSON túl nagy (maximum 1 MB).");
    try { return JSON.parse(text); }
    catch { throw new Error("Érvénytelen JSON. Ellenőrizd a vesszőket, idézőjeleket és zárójeleket."); }
  };

  const requestImport = async (action: "preview" | "apply") => {
    const source = readSource();
    const signature = JSON.stringify([text, mode]);
    if (action === "apply" && (!preview || reviewKey !== signature || !confirmed)) {
      throw new Error("Előbb ellenőrizd az aktuális JSON-t, és erősítsd meg az importot.");
    }
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        action, mode, source,
        ...(action === "apply" ? { baseEtag: preview?.baseEtag, baseSha: preview?.baseSha, confirm: "IMPORTÁLÁS" } : {}),
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      if (data?.outcomeUnknown) setOutcomeUnknown(true);
      throw new Error(data?.error ?? `Importkérés hiba (${response.status}).`);
    }
    return { data, signature };
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    invalidate();
    if (file.size > MAX_FILE_BYTES) {
      setText("");
      setFileName("");
      setError("A fájl túl nagy (maximum 1 MB).");
      return;
    }
    try {
      setText(await file.text());
      setFileName(file.name);
    } catch {
      setText("");
      setFileName("");
      setError("Nem sikerült beolvasni a fájlt.");
    }
  };

  const exportAll = async () => {
    setBusy("export");
    setError("");
    setSuccess("");
    try {
      const response = await fetch(ENDPOINT, { cache: "no-store" });
      if (!response.ok) await responsePayload(response);
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `shiori-teljes-konyvtar-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
      setSuccess("A teljes, élő könyvtár JSON-exportja elkészült.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Exportálási hiba.");
    } finally { setBusy(null); }
  };

  const runPreview = async () => {
    setBusy("preview");
    setPreview(null);
    setConfirmed(false);
    setError("");
    setSuccess("");
    try {
      const result = await requestImport("preview");
      setPreview(result.data as Preview);
      setReviewKey(result.signature);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Az előnézet nem sikerült.");
    } finally { setBusy(null); }
  };

  const apply = async () => {
    setBusy("apply");
    setError("");
    setSuccess("");
    try {
      const result = await requestImport("apply");
      const data = result.data as { result: { books: number; paths: number } };
      setSuccess(`Mentés megtörtént a Vercel Blobban: ${data.result.books} könyv, ${data.result.paths} olvasási út. A polcok frissülnek; a publikus gyorsítótár még rövid ideig a régit mutathatja.`);
      setPreview(null);
      setConfirmed(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mentési hiba.");
      setPreview(null);
      setConfirmed(false);
    } finally { setBusy(null); }
  };

  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => { setOpen(true); setError(""); }}
        aria-label="Könyv hozzáadása vagy módosítása JSON-nal" title="JSON import / export">
        <Plus size={20} aria-hidden="true" />
      </button>
      {open && (
        <div className="admin-overlay-backdrop" onClick={() => { if (!busy) setOpen(false); }}>
          <div className={`admin-overlay-panel ${styles.panel}`} role="dialog" aria-modal="true"
            aria-labelledby="shiori-json-title" onClick={(event) => event.stopPropagation()}>
            <header className={styles.heading}>
              <div>
                <p className={styles.eyebrow}>Shiori · Könyvtárkezelés</p>
                <h2 id="shiori-json-title" className={styles.headingTitle}>Könyvtári adatok</h2>
                <p className={styles.hint}>Biztonságos könyvimport és külön teljes export</p>
              </div>
              <button type="button" className={styles.closeButton} aria-label="Bezárás"
                disabled={Boolean(busy)} onClick={() => setOpen(false)}><X size={19}/></button>
            </header>
            <nav className={styles.tabs} aria-label="Könyvtári adatművelet">
              <button type="button" aria-current={view === "import" ? "page" : undefined} disabled={Boolean(busy)}
                onClick={() => { setView("import"); setError(""); setSuccess(""); }}><Upload size={17}/> Importálás</button>
              <button type="button" aria-current={view === "export" ? "page" : undefined} disabled={Boolean(busy)}
                onClick={() => { setView("export"); setError(""); setSuccess(""); }}><Download size={17}/> Teljes export</button>
            </nav>
            {view === "export" ? (
              <section className={styles.exportCard} aria-label="Teljes könyvtár exportálása">
                <Download size={27} aria-hidden="true"/>
                <h3>Teljes könyvtár mentése</h3>
                <p>Az éles könyvtár aktuális JSON-állományát töltöd le. A fájl akár privát bejegyzéseket is tartalmazhat: őrizd biztonságos helyen, Gitbe ne töltsd fel.</p>
                <button type="button" className={styles.primaryButton} onClick={exportAll} disabled={Boolean(busy)}>
                  <Download size={18}/> {busy === "export" ? "Exportálás…" : "Teljes JSON letöltése"}
                </button>
              </section>
            ) : (
              <section className={styles.importBody} aria-label="Könyvek importálása">
                <div className={styles.steps} aria-label="Importálási folyamat">
                  <span className={!preview ? styles.stepActive : styles.stepComplete}>1 · Forrás</span>
                  <span className={preview ? styles.stepActive : ""}>2 · Változások</span>
                  <span className={preview && confirmed ? styles.stepActive : ""}>3 · Jóváhagyás</span>
                </div>
                <div className={styles.intro}>
                  <h3>Könyvek importálása</h3>
                  <p>Válassz egy JSON-fájlt, ellenőrizd a változásokat, majd külön hagyd jóvá az éles mentést. Az előnézet nem módosít adatot.</p>
                </div>
                <label className={styles.filePick}>
                  <Upload size={25} aria-hidden="true"/>
                  <strong>{fileName || "JSON-fájl kiválasztása"}</strong>
                  <span>{fileName ? "Másik fájlt is választhatsz" : "Könyv, könyvtömb vagy teljes export · max. 1 MB"}</span>
                  <input type="file" accept=".json,application/json" disabled={Boolean(busy)}
                    onChange={(event) => { void handleFile(event.target.files?.[0]); event.target.value = ""; }}/>
                </label>
                <fieldset className={styles.modeFieldset} disabled={Boolean(busy)}>
                  <legend>Importálási mód</legend>
                  <label className={styles.modeOption}><input type="radio" name="spirit-json-mode" checked={mode === "add"}
                    onChange={() => { setMode("add"); invalidate(); }}/><span><strong>Csak új könyvek</strong><small>A már létező azonosítók kimaradnak.</small></span></label>
                  <label className={styles.modeOption}><input type="radio" name="spirit-json-mode" checked={mode === "upsert"}
                    onChange={() => { setMode("upsert"); invalidate(); }}/><span><strong>Újak és szerkesztői frissítések</strong><small>Meglévő könyv esetén csak a megadott szerkesztői mezők módosulhatnak.</small></span></label>
                </fieldset>
                <details className={styles.advanced}>
                  <summary>Haladó lehetőség: nyers JSON beillesztése</summary>
                  <label htmlFor="shiori-json-text">JSON-forrás</label>
                  <textarea id="shiori-json-text" className={styles.textarea} spellCheck={false}
                    value={text} disabled={Boolean(busy)} onChange={(event) => { setText(event.target.value); setFileName(""); invalidate(); }}
                    placeholder={'{\n  "books": [\n    { "id": "meglevo_konyv", "title": "Cím" }\n  ]\n}'} />
                  <p className={styles.hint}>A hiányzó mező változatlan marad. `null` vagy `[]` explicit törlés lehet; a `related` teljes listaként frissül. Könyvtörlés nincs.</p>
                </details>
                <div className={styles.actionsRow}>
                  <button type="button" className={styles.primaryButton} disabled={!text.trim() || Boolean(busy) || outcomeUnknown}
                    onClick={runPreview}><Upload size={17}/>{busy === "preview" ? "Ellenőrzés…" : preview ? "Előnézet újraellenőrzése" : "Ellenőrzés és előnézet"}</button>
                </div>
                {preview && <section className={styles.preview} aria-label="Ellenőrzött módosítások">
                  <div className={styles.previewHeader}>
                    <h3>Változások előnézete</h3>
                    <p>Az élő könyvtárban jelenleg {preview.liveBooks} könyv szerepel.</p>
                  </div>
                  <div className={styles.stats}>
                    <div><strong>{preview.summary.added.length}</strong><span>Új</span></div>
                    <div><strong>{preview.summary.updated.length}</strong><span>Módosul</span></div>
                    <div><strong>{preview.summary.unchanged}</strong><span>Változatlan</span></div>
                    <div><strong>{preview.summary.skippedExisting}</strong><span>Kihagyott</span></div>
                  </div>
                  {preview.summary.added.length > 0 && <details className={styles.previewDetails}>
                    <summary>Új könyvek ({preview.summary.added.length})</summary>
                    <ul className={styles.changes}>{preview.summary.added.map((id) => <li key={id}>{id}</li>)}</ul>
                  </details>}
                  {preview.summary.updated.length > 0 && <details className={styles.previewDetails} open>
                    <summary>Frissülő könyvek és mezők ({preview.summary.updated.length})</summary>
                    <ul className={styles.changes}>
                      {preview.summary.updated.map((item) => <li key={item.id}>
                        <strong>{item.id}</strong> <span>{item.fields.join(" · ")}</span>
                        {item.relatedBefore && item.relatedAfter && <span className={styles.relatedDiff}>
                          Kapcsolatok: {item.relatedBefore.join(", ") || "(nincs)"} → {item.relatedAfter.join(", ") || "(nincs)"}
                        </span>}
                      </li>)}
                    </ul>
                  </details>}
                  <div className={styles.safetyNote}>
                    A visszajelzés szerint {preview.summary.ignoredPersonalFields} személyes mező marad figyelmen kívül. Az olvasási utak és címkefeliratok nem módosulnak ezen az importútvonalon. A mezőlista nem teljes értékű régi → új érték összehasonlítás; annak backendbővítéséig az adatok külön ellenőrzése szükséges.
                  </div>
                  {preview.changeCount > 0 ? <div className={styles.approval}>
                    <label className={styles.confirm}><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={Boolean(busy)}/>
                      <span>Átnéztem a változásokat, rendelkezem biztonsági mentéssel, és jóváhagyom az éles módosítást.</span></label>
                    <button type="button" className={styles.dangerButton} disabled={!confirmed || Boolean(busy) || outcomeUnknown} onClick={apply}>
                      {busy === "apply" ? "Mentés folyamatban…" : `Éles mentés · ${preview.changeCount} könyv`}
                    </button>
                  </div> : <p className={styles.hint}>Nincs mentendő változás.</p>}
                </section>}
              </section>
            )}
            {error && <p className="admin-message admin-message--error" role="alert">{error}</p>}
            {success && <p className="admin-message" role="status">{success}</p>}
            {outcomeUnknown && <p className="admin-message admin-message--error">A feltöltés kimenetele bizonytalan. Ne ismételd meg az importot. Ellenőrizd az élő könyvtár exportját.</p>}
          </div>
        </div>
      )}
    </>
  );
}
