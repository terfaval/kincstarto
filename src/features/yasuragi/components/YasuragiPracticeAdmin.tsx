"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { AlertCircle, BookOpen, CheckCircle2, FileJson2, Upload, Download, Layers3, Image as ImageIcon } from "lucide-react";
import type { AuthoringImportReport, PoseProposal } from "../lib/practice-authoring";
import type { ProjectReview } from "../lib/practice-review";
import type { PublicationGate, EditorialAttestations } from "../lib/practice-publication";
import type { PracticeReviewReceipt } from "../lib/practice-approval-store";
import type { PracticeDraftSummary, SavedPracticeDraft } from "../lib/practice-draft-store";
import { createWorkflowReport, planPracticeWorkflow } from "../lib/practice-workflow";
import styles from "../styles/YasuragiPracticeAdmin.module.css";

const ENDPOINT = "/api/admin/yasuragi/practices";
const MAX_FILE_BYTES = 580_000;
const APPROVAL_ENDPOINT = `${ENDPOINT}/approval`;
const PUBLICATION_ENDPOINT = `${ENDPOINT}/publication`;
type PublicationStatus = { ok?: boolean; error?: string; status?: "none" | "published" | "revoked"; releaseId?: string | null; updatedAt?: string | null; publiclyAccessible?: boolean };
type ApprovalStatus = { ok?: boolean; error?: string; gate?: PublicationGate; librarySha256?: string; receipt?: PracticeReviewReceipt | null; receiptCurrent?: boolean; publication?: string };

type ApiResponse = {
  ok?: boolean;
  error?: string;
  report?: AuthoringImportReport;
  draft?: SavedPracticeDraft;
  review?: ProjectReview;
  draftId?: string;
  items?: PracticeDraftSummary[];
  nextCursor?: string | null;
  hasMore?: boolean;
};

export default function YasuragiPracticeAdmin() {
  const activeDraftIdRef = useRef<string | null>(null);
  const [source, setSource] = useState<unknown>(null);
  const [fileName, setFileName] = useState("");
  const [report, setReport] = useState<AuthoringImportReport | null>(null);
  const [openedDraft, setOpenedDraft] = useState<SavedPracticeDraft | null>(null);
  const [openedReport, setOpenedReport] = useState<AuthoringImportReport | null>(null);
  const [projectReview, setProjectReview] = useState<ProjectReview | null>(null);
  const [approval, setApproval] = useState<ApprovalStatus | null>(null);
  const [publication, setPublication] = useState<PublicationStatus | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publicationError, setPublicationError] = useState("");
  const [approvalError, setApprovalError] = useState("");
  const [approving, setApproving] = useState(false);
  const [attestations, setAttestations] = useState<EditorialAttestations>({ scriptReviewed: false, movementReviewed: false, previewChecked: false });
  const [workError, setWorkError] = useState("");
  const [workMessage, setWorkMessage] = useState("");
  const [writingPose, setWritingPose] = useState("");
  const [poseFiles, setPoseFiles] = useState<Record<string, File | null>>({});
  const [imageConfirmed, setImageConfirmed] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedId, setSavedId] = useState("");
  const [items, setItems] = useState<PracticeDraftSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [receiptHistory, setReceiptHistory] = useState<PracticeReviewReceipt[]>([]);
  const [receiptHistoryCursor, setReceiptHistoryCursor] = useState<string | null>(null);
  const [receiptHistoryLoaded, setReceiptHistoryLoaded] = useState(false);
  const [receiptHistoryBusy, setReceiptHistoryBusy] = useState(false);
  const [receiptHistoryError, setReceiptHistoryError] = useState("");
  const [listError, setListError] = useState("");
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(ENDPOINT, { cache: "no-store", credentials: "same-origin" });
      const body = await response.json() as ApiResponse;
      if (!response.ok || !body.ok || !body.items) throw new Error(body.error ?? "A lista nem elérhető.");
      setItems(body.items); setNextCursor(body.nextCursor ?? null); setListError("");
    } catch (cause) { setListError(cause instanceof Error ? cause.message : "Listaolvasási hiba"); }
    finally { setLoaded(true); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function loadMoreDrafts() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true); setListError("");
    try {
      const response = await fetch(`${ENDPOINT}?cursor=${encodeURIComponent(nextCursor)}`, { cache: "no-store", credentials: "same-origin" });
      const body = await response.json() as ApiResponse;
      if (!response.ok || !body.ok || !body.items) throw new Error(body.error ?? "A következő oldal nem olvasható.");
      const received = body.items;
      setItems((existing) => {
        const known = new Set(existing.map((item) => item.draftId));
        return [...existing, ...received.filter((item) => !known.has(item.draftId))];
      });
      setNextCursor(body.nextCursor ?? null);
    } catch (cause) { setListError(cause instanceof Error ? cause.message : "Lapozási hiba."); }
    finally { setLoadingMore(false); }
  }

  async function loadApprovalHistory(draftId: string, cursor: string | null = null) {
    if (receiptHistoryBusy) return;
    setReceiptHistoryBusy(true); setReceiptHistoryError("");
    try {
      const url = `${APPROVAL_ENDPOINT}?draft=${encodeURIComponent(draftId)}&history=1${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
      const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
      const body = await response.json() as { ok?: boolean; error?: string; items?: PracticeReviewReceipt[]; nextCursor?: string | null };
      if (!response.ok || !body.ok || !body.items) throw new Error(body.error ?? "A jóváhagyási előzmények nem olvashatók.");
      if (activeDraftIdRef.current !== draftId) return;
      const received = body.items;
      setReceiptHistory((existing) => {
        const known = new Set(cursor ? existing.map((item) => item.receiptId) : []);
        return [...(cursor ? existing : []), ...received.filter((item) => !known.has(item.receiptId))];
      });
      setReceiptHistoryCursor(body.nextCursor ?? null);
      setReceiptHistoryLoaded(true);
    } catch (cause) { if (activeDraftIdRef.current === draftId) setReceiptHistoryError(cause instanceof Error ? cause.message : "Előzményolvasási hiba."); }
    finally { setReceiptHistoryBusy(false); }
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    activeDraftIdRef.current = null;
    setSource(null); setReport(null); setSavedId(""); setError(""); setFileName(file?.name ?? ""); setOpenedDraft(null); setOpenedReport(null); setProjectReview(null); setApproval(null); setApprovalError(""); setPublication(null); setPublicationError(""); setWorkError(""); setWorkMessage("");
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { setError("A fájl túl nagy. A P02 legfeljebb 580 KB-os gyakorlást fogad el."); return; }
    try { setSource(JSON.parse(await file.text()) as unknown); }
    catch { setError("A kiválasztott fájl nem érvényes JSON."); }
  }

  async function refreshApproval(draftId: string) {
    try {
      const response = await fetch(`${APPROVAL_ENDPOINT}?draft=${encodeURIComponent(draftId)}`, { credentials: "same-origin", cache: "no-store" });
      const payload = await response.json() as ApprovalStatus;
      if (!response.ok || !payload.ok || !payload.gate) throw new Error(payload.error ?? "A jóváhagyási kapu nem érhető el.");
      if (activeDraftIdRef.current !== draftId) return;
      setApproval(payload); setApprovalError("");
    } catch (cause) {
      if (activeDraftIdRef.current !== draftId) return;
      setApproval(null);
      setApprovalError(cause instanceof Error ? cause.message : "A jóváhagyási állapot nem elérhető.");
    }
  }

  async function refreshPublicationStatus(practiceId: string, draftId: string) {
    try {
      const response = await fetch(`${PUBLICATION_ENDPOINT}?practiceId=${encodeURIComponent(practiceId)}`, { credentials: "same-origin", cache: "no-store" });
      const body = await response.json() as PublicationStatus;
      if (!response.ok || !body.ok) throw new Error(body.error ?? "A kiadási állapot nem elérhető.");
      if (activeDraftIdRef.current !== draftId) return;
      setPublication(body); setPublicationError("");
    } catch (cause) {
      if (activeDraftIdRef.current !== draftId) return;
      setPublication(null); setPublicationError(cause instanceof Error ? cause.message : "A kiadási állapot nem olvasható.");
    }
  }

  async function changePublication(action: "publish" | "revoke") {
    if (!openedDraft || publishing || !publication) return;
    if (action === "publish" && (!approval?.receiptCurrent || !approval.librarySha256 || !approval.gate?.eligible)) return;
    if (action === "revoke" && (publication.status !== "published" || !publication.releaseId)) return;
    const message = action === "publish"
      ? `Nyilvánosan publikálod a(z) „${openedDraft.script.practiceId}” gyakorlás ellenőrzött változatát? Ez a katalógusban is megjelenik.`
      : `Visszavonod a(z) „${openedDraft.script.practiceId}” nyilvános kiadását? A publikus lejátszás és a katalóguslink megszűnik.`;
    if (!window.confirm(message)) return;
    setPublishing(true); setPublicationError(""); setWorkMessage("");
    try {
      const body = action === "publish" ? {
        action, draftId: openedDraft.draftId, expectedSha256: openedDraft.sha256,
        expectedLibrarySha256: approval?.librarySha256,
      } : { action, practiceId: openedDraft.script.practiceId, expectedReleaseId: publication.releaseId };
      const response = await fetch(PUBLICATION_ENDPOINT, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const payload = await response.json() as PublicationStatus;
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "A kiadási művelet nem sikerült.");
      if (activeDraftIdRef.current === openedDraft.draftId) setWorkMessage(action === "publish" ? "A kiadás aktiválva. A gyakorlás megjelent a publikus Yasuragi-katalógusban." : "A kiadás visszavonva. A publikus elérés megszűnt.");
      await refreshPublicationStatus(openedDraft.script.practiceId, openedDraft.draftId);
      await refreshApproval(openedDraft.draftId);
    } catch (cause) { if (activeDraftIdRef.current === openedDraft.draftId) setPublicationError(cause instanceof Error ? cause.message : "A kiadási művelet állapota bizonytalan. Frissítsd a listát."); }
    finally { setPublishing(false); }
  }

  async function recordSignoff() {
    if (!openedDraft || approving || !approval?.gate?.eligible) return;
    if (!attestations.scriptReviewed || !attestations.movementReviewed || !attestations.previewChecked) return;
    if (!window.confirm("Rögzíted a három kézi ellenőrzést ehhez a konkrét gyakorlásverzióhoz és könyvtári állapothoz? Ez NEM publikálja a gyakorlást.")) return;
    setApproving(true); setApprovalError("");
    try {
      const response = await fetch(APPROVAL_ENDPOINT, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "signoff", draftId: openedDraft.draftId, expectedSha256: openedDraft.sha256, expectedLibrarySha256: approval.librarySha256, attestations }) });
      const payload = await response.json() as ApprovalStatus;
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "A szerkesztői ellenőrzés nem rögzíthető.");
      await refreshApproval(openedDraft.draftId);
      setWorkMessage("A szerkesztői ellenőrzés immutable naplóba került. Nyilvános publikálás nem történt.");
    } catch (cause) { setApprovalError(cause instanceof Error ? cause.message : "Jóváhagyási hiba."); }
    finally { setApproving(false); }
  }

  async function openDraft(draftId: string) {
    activeDraftIdRef.current = draftId;
    setError(""); setOpenedDraft(null); setOpenedReport(null); setProjectReview(null);
    setApproval(null); setApprovalError(""); setPublication(null); setPublicationError("");
    setWorkMessage(""); setWorkError("");
    try {
      const response = await fetch(`${ENDPOINT}?draft=${encodeURIComponent(draftId)}`, { credentials: "same-origin", cache: "no-store" });
      const payload = await response.json() as ApiResponse;
      if (!response.ok || !payload.ok || !payload.draft) throw new Error(payload.error ?? "A tervezet nem tölthető be.");
      if (activeDraftIdRef.current !== draftId) return;
      setOpenedDraft(payload.draft); setOpenedReport(payload.report ?? null); setProjectReview(payload.review ?? null);
      setReceiptHistory([]); setReceiptHistoryCursor(null); setReceiptHistoryLoaded(false); setReceiptHistoryError("");
      setAttestations({ scriptReviewed: false, movementReviewed: false, previewChecked: false });
      await Promise.all([refreshApproval(draftId), refreshPublicationStatus(payload.draft.script.practiceId, draftId)]);
    } catch (cause) { if (activeDraftIdRef.current === draftId) setError(cause instanceof Error ? cause.message : "Nem sikerült megnyitni a tervezetet."); }
  }

  async function createPoseDraft(proposal: PoseProposal) {
    if (!openedDraft || writingPose) return;
    const confirmed = window.confirm(`Új, jóváhagyatlan ászanarekord felvétele az élő könyvtárba: ${proposal.record.name_hu} (${proposal.poseId})? A meglévő rekordokhoz nem nyúlunk.`);
    if (!confirmed) return;
    setWritingPose(proposal.poseId); setWorkError(""); setWorkMessage("");
    try {
      const response = await fetch(`${ENDPOINT}/pose`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: openedDraft.draftId, expectedSha256: openedDraft.sha256, poseId: proposal.poseId, confirm: true }),
      });
      const body = await response.json() as { ok?: boolean; error?: string; warnings?: string[] };
      if (!response.ok || !body.ok) throw new Error(body.error ?? "A póztervezet felvétele nem sikerült.");
      setWorkMessage(`${proposal.record.name_hu}: draft póz létrehozva. Következő lépés a kép és a szakmai ellenőrzés.`);
      await openDraft(openedDraft.draftId);
    } catch (cause) { setWorkError(cause instanceof Error ? cause.message : "Pózimportálási hiba."); }
    finally { setWritingPose(""); }
  }

  async function uploadPoseImage(proposal: PoseProposal) {
    if (!openedDraft || writingPose || !imageConfirmed[proposal.poseId]) return;
    const row = projectReview?.items.find((item) => item.poseId === proposal.poseId);
    const file = poseFiles[proposal.poseId];
    if (!row?.exists || row.libraryStatus !== "draft" || row.imageAssetRef || !file) return;
    if (file.size === 0 || file.size > 4 * 1024 * 1024 || !/\.(png|webp)$/i.test(file.name)) {
      setWorkError("Legfeljebb 4 MB-os PNG vagy WebP illusztráció szükséges."); return;
    }
    setWritingPose(proposal.poseId); setWorkError(""); setWorkMessage("");
    try {
      const form = new FormData();
      form.set("pose_id", proposal.poseId);
      form.set("expected_asset_ref", "");
      form.set("file", file);
      const response = await fetch("/api/admin/yogi-knowledge/illustration", { method: "POST", credentials: "same-origin", body: form });
      const body = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Az illusztráció hozzárendelése sikertelen.");
      setPoseFiles((value) => ({ ...value, [proposal.poseId]: null }));
      setImageConfirmed((value) => ({ ...value, [proposal.poseId]: false }));
      setWorkMessage(`${proposal.record.name_hu}: illusztráció hozzárendelve. A póz szövegének és anatómiai tartalmának jóváhagyása továbbra is külön szükséges.`);
      await openDraft(openedDraft.draftId);
    } catch (cause) { setWorkError(cause instanceof Error ? cause.message : "Képfeltöltési hiba."); }
    finally { setWritingPose(""); }
  }

  function downloadJson(file: string, value: unknown) {
    const objectUrl = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2) + "\n"], { type: "application/json;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = objectUrl; link.download = file; link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  async function execute(action: "preview" | "save") {
    if (source === null || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ action, source }),
      });
      const payload = await response.json() as ApiResponse;
      if (payload.report) setReport(payload.report);
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? (payload.report ? "A tervezet hibáit javítani kell." : "Az import nem sikerült."));
      if (action === "save" && payload.draftId) { setSavedId(payload.draftId); await refresh(); await openDraft(payload.draftId); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Az import nem sikerült."); }
    finally { setBusy(false); }
  }

  const workflowPlan = planPracticeWorkflow({ gate: approval?.gate ?? null, receiptCurrent: approval?.receiptCurrent === true, publication });

  return <main className={styles.page}>
    <nav className={styles.nav}><Link href="/admin">← Admin főmenü</Link><Link href="/admin/yasuragi?fixture=1">P01 lejátszópróba (helyi)</Link><Link href="/admin/yogis-choice">Ászanatár</Link></nav>
    <header className={styles.header}>
      <p className={styles.eyebrow}>YASURAGI · ADMIN P04</p>
      <h1>Egységes gyakorlástervezés</h1>
      <p>Egy projektben kezelheted a teljes gyakorlásscriptet és a hozzá hiányzó ászana-adatlapok, illusztrációk feladatait. Importáláskor csak privát tervezet keletkezik: a könyvtár és a nyilvános lejátszó változatlan.</p>
      <p><a className={styles.kitLink} href="/api/admin/yasuragi/authoring-kit">Aktuális Yasuragi Authoring Kit letöltése (JSON) ↓</a></p>
    </header>
    <div className={styles.layout}>
      <section className={styles.panel}>
        <h2><Upload size={20} aria-hidden="true"/> Új authoring projekt importálása</h2>
        <p><code>yasuragi.authoring.v1</code> egységes csomag, vagy korábbi <code>yasuragi.practice.v1</code> gyakorlás-JSON. A hiányzó pózok javaslatai együtt menthetők a gyakorlással; a könyvtárba külön, ellenőrzötten kerülnek be.</p>
        <label className={styles.upload} htmlFor="yasuragi-upload"><FileJson2 aria-hidden="true" size={23}/> <span>{fileName || "Válassz gyakorlás-JSON fájlt"}</span></label>
        <input id="yasuragi-upload" type="file" accept=".json,application/json" onChange={(event) => { void handleFile(event); }} className={styles.fileInput}/>
        <div className={styles.actions}>
          <button type="button" onClick={() => void execute("preview")} disabled={busy || source === null}>{busy ? "Ellenőrzés…" : "Ellenőrzés és előnézet"}</button>
          <button type="button" className={styles.save} onClick={() => void execute("save")} disabled={busy || !report?.ok || source === null || Boolean(savedId)}>Mentés új tervezetként</button>
        </div>
        {error && <p className={styles.error} role="alert"><AlertCircle size={17} aria-hidden="true"/> {error}</p>}
        {report && <div className={styles.report} aria-live="polite">
          <h3>{report.ok ? <CheckCircle2 aria-hidden="true" size={18}/> : <AlertCircle aria-hidden="true" size={18}/>} {report.ok ? "Szerkezeti ellenőrzés sikeres" : "Az import még nem menthető"}</h3>
          <p><strong>{report.title || report.practiceId || "Névtelen gyakorlás"}</strong> · verzió: {report.version || "—"} · {Math.round(report.durationSec / 60)} perc · {report.nodeCount} csomópont · {report.availableRouteCount} {report.mode === "authoring" ? "szerkezetileg bejárható" : "elérhető"} útvonal</p>
          <p><strong>{report.previewReady ? "Próbalejátszásra alkalmas" : "Könyvtári függőségek miatt még nem teljesen próbálható"}</strong> · {report.poseProposalCount} új pózjavaslat</p>
          {report.dependencies.length > 0 && <div className={styles.dependencies}>
            <h4><Layers3 size={17} aria-hidden="true"/> Ászana- és képi függőségek</h4>
            <ul>{report.dependencies.map((dep) => <li key={dep.poseId}>
              <span><strong>{dep.label}</strong><small>{dep.poseId}</small></span>
              <span className={styles.depStatus}>{dep.state === "ready" ? "Elérhető" : dep.state === "review_needed" ? "Képpel elérhető · felülvizsgálandó" : dep.state === "image_missing" ? "Kép hiányzik" : dep.state === "proposal_pending" ? "Pózjavaslat van · importálandó" : "Hiányzó pózjavaslat"}</span>
            </li>)}</ul>
          </div>}
          {report.errors.length > 0 && <div className={styles.issueGroup}><h4>Hibák ({report.errors.length})</h4><ul>{report.errors.map((issue, index) => <li key={`e-${index}`}><code>{issue.path}</code> — {issue.message}</li>)}</ul></div>}
          {report.warnings.length > 0 && <details className={styles.issueGroup}><summary>Figyelmeztetések ({report.warnings.length}) — nyisd meg</summary><ul>{report.warnings.map((issue, index) => <li key={`w-${index}`}><code>{issue.path}</code> — {issue.message}</li>)}</ul></details>}
          {report.ok && <p className={styles.reminder}>A sikeres szerkezeti ellenőrzés nem jelent jógaszakmai jóváhagyást, illusztrációs ellenőrzést vagy publikálási engedélyt.</p>}
        </div>}
        {savedId && <div className={styles.saved}><CheckCircle2 size={20} aria-hidden="true"/><div><strong>Új, privát tervezetverzió mentve.</strong><p>Az eredeti fájl és a korábbi változatok érintetlenek.</p>{report?.previewReady ? <Link href={`/admin/yasuragi?draft=${encodeURIComponent(savedId)}`}>Megnyitás a P01 próbalеjátszóban →</Link> : <p>A hiányzó könyvtári elemek rendezése után nyitható meg a próbalejátszó.</p>}</div></div>}
      </section>
      <section className={styles.panel}>
        <div className={styles.listHeading}><h2><BookOpen size={20} aria-hidden="true"/> Mentett tervezetek</h2><button type="button" onClick={() => void refresh()}>Frissítés</button></div>
        {listError && <p className={styles.error} role="alert">{listError}</p>}
        {loaded && !listError && !items.length && <p>Még nincs mentett gyakorlástervezet. Kezdd egy JSON importálásával.</p>}
        <div className={styles.savedList}>{items.map((item) => <article className={styles.draft} key={item.draftId}>
          <div><strong>{item.title}</strong><small>{item.practiceId} · {item.version} · {Math.round(item.durationSec / 60)} perc · {item.nodeCount} csomópont</small><small>{new Date(item.createdAt).toLocaleString("hu-HU")} · revízió: {item.draftId.slice(0, 13)}</small></div>
<button type="button" className={styles.secondaryButton} onClick={() => void openDraft(item.draftId)}>Projekt megnyitása →</button>
        </article>)}</div>
        <p className={styles.reminder}>A privát tervezetek időrendben, a régebbiektől az újabbak felé jelennek meg.</p>
        {nextCursor && <button type="button" className={styles.secondaryButton} disabled={loadingMore} onClick={() => void loadMoreDrafts()}>{loadingMore ? "Betöltés…" : "További, újabb tervezetek betöltése"}</button>}
        {openedDraft && <div className={styles.projectDetail}>
          <h3><BookOpen size={18} aria-hidden="true"/> {openedDraft.authoring?.projectId ?? openedDraft.script.practiceId}</h3>
          <p>Mentett verzió: <code>{openedDraft.draftId}</code> · csak olvasható, változatlan tervezet</p>
          <div className={styles.workflowSummary}>
            <strong>Egységes projektmunkafolyamat</strong>
            <p>1. Hiányzó póztervezet felvétele → 2. Illusztráció hozzárendelése → 3. Tartalom ellenőrzése az ászanatárban → 4. Függőségek újraellenőrzése → 5. Próbalеjátszás.</p>
            {projectReview && <p><strong>{projectReview.libraryReadyCount}</strong> használatra előkészített póz · <strong>{projectReview.missingCount}</strong> könyvtárból hiányzó · <strong>{projectReview.unapprovedCount}</strong> még nem teljesen jóváhagyott, hivatkozott póz. A P04 szerkesztői kapuja az alábbi külön felületen ellenőrizhető.</p>}
            <button type="button" className={styles.secondaryButton} onClick={() => void openDraft(openedDraft.draftId)} disabled={Boolean(writingPose)}>Élő könyvtári státusz frissítése</button>
          </div>
          <section className={styles.approvalPanel} aria-label="P07 munkafolyamat-összegzés">
            <h4>P07 · Automatikusan összeállított következő lépések</h4>
            <p role="status"><strong>{workflowPlan.label}</strong></p>
            <ol>{workflowPlan.actions.map((step, index) => <li key={`${step.code}-${index}`}>{step.label}</li>)}</ol>
            <p className={styles.reminder}>Ez pillanatnyi, csak olvasó státusz. A szakmai nyilatkozatokat és a publikálást továbbra is külön, kézzel kell végrehajtani.</p>
            <button type="button" className={styles.secondaryButton}
              disabled={!approval?.gate || !approval.librarySha256 || !publication}
              onClick={() => {
                if (!approval?.gate || !approval.librarySha256 || !publication) return;
                downloadJson(`${openedDraft.script.practiceId}-p07-munkafolyamat.json`, createWorkflowReport({
                  draftId: openedDraft.draftId, practiceId: openedDraft.script.practiceId,
                  version: openedDraft.script.version, scriptSha256: openedDraft.sha256,
                  librarySha256: approval.librarySha256, gate: approval.gate,
                  receiptCurrent: approval.receiptCurrent === true, publication,
                  createdAt: new Date().toISOString(),
                }));
              }}><Download size={15} aria-hidden="true"/> Műszaki státuszjelentés exportálása</button>
          </section>
          <section className={styles.approvalPanel} aria-label="P04 jóváhagyási kapu">
            <h4>Gyakorlás jóváhagyási kapuja · P04</h4>
            <p>A kapu minden aktív útvonal és az azokhoz szükséges ászanák élő állapotából számol. A tiltott, tervezett ágak nem publikálható választások.</p>
            {approvalError && <p role="alert" className={styles.error}>{approvalError}</p>}
            {!approval?.gate && !approvalError && <p>Jóváhagyási állapot betöltése…</p>}
            {approval?.gate && <>
              <strong>{approval.gate.eligible ? "Könyvtári és szerkezeti feltételek teljesülnek" : `${approval.gate.blockers.length} blokkoló függőség`}</strong>
              <p>{approval.gate.requiredPoseCount} érintett póz · {approval.receiptCurrent ? "Érvényes korábbi szerkesztői ellenőrzés" : approval.receipt ? "Korábbi ellenőrzés elavult / nem alkalmazható" : "Nincs rögzített szerkesztői ellenőrzés"}</p>
              {approval.gate.blockers.length > 0 && <details open className={styles.reviewDetails}><summary>Publikálás előtt rendezendő feltételek</summary><ul>{approval.gate.blockers.map((issue, i) => <li key={`${issue.code}-${issue.poseId ?? i}`}>{issue.label}</li>)}</ul></details>}
              {approval.gate.eligible && !approval.receiptCurrent && <div className={styles.approvalChecks}>
                <label><input type="checkbox" checked={attestations.scriptReviewed} onChange={(e) => setAttestations((v) => ({ ...v, scriptReviewed: e.target.checked }))}/> Szerkesztőként átnéztem a teljes T/M/E szövegkönyvet.</label>
                <label><input type="checkbox" checked={attestations.movementReviewed} onChange={(e) => setAttestations((v) => ({ ...v, movementReviewed: e.target.checked }))}/> A mozgás- és biztonsági útmutatásokat külön átvizsgáltuk.</label>
                <label><input type="checkbox" checked={attestations.previewChecked} onChange={(e) => setAttestations((v) => ({ ...v, previewChecked: e.target.checked }))}/> Minden engedélyezett útvonalat végigpróbáltunk.</label>
                <button type="button" className={styles.createButton} disabled={approving || !attestations.scriptReviewed || !attestations.movementReviewed || !attestations.previewChecked} onClick={() => void recordSignoff()}>{approving ? "Rögzítés…" : "Szerkesztői ellenőrzés rögzítése"}</button>
              </div>}
              {approval.receipt && <p className={styles.reminder}>Utolsó naplóbejegyzés: {new Date(approval.receipt.createdAt).toLocaleString("hu-HU")} · kötött gyakorlás- és könyvtári ellenőrzőösszeg.</p>}
            </>}
              <div className={styles.historyPanel}>
                <button type="button" className={styles.secondaryButton} disabled={receiptHistoryBusy} onClick={() => void loadApprovalHistory(openedDraft.draftId)}>
                  {receiptHistoryBusy ? "Napló betöltése…" : "Jóváhagyási napló megtekintése"}
                </button>
                {receiptHistoryError && <p className={styles.error} role="alert">{receiptHistoryError}</p>}
                {receiptHistoryLoaded && !receiptHistory.length && <p>Nincs korábbi jóváhagyási naplóbejegyzés.</p>}
                {receiptHistory.length > 0 && <ol className={styles.historyList}>
                  {receiptHistory.map((receipt) => <li key={receipt.receiptId}>
                    {new Date(receipt.createdAt).toLocaleString("hu-HU")} · verzióhoz kötött jóváhagyás · <code>{receipt.receiptId}</code>
                  </li>)}
                </ol>}
                {receiptHistoryCursor && <button type="button" className={styles.secondaryButton} disabled={receiptHistoryBusy} onClick={() => void loadApprovalHistory(openedDraft.draftId, receiptHistoryCursor)}>
                  További naplóbejegyzések
                </button>}
              </div>
            <section className={styles.approvalPanel} aria-label="Publikálási műveletek">
              <h4>P06 · Nyilvános kiadás</h4>
              <p>Csak érvényes, minden kötelező pózzal és ellenőrzéssel rendelkező tervezet aktiválható. A jóváhagyás önmagában nem publikál.</p>
              {publicationError && <p role="alert" className={styles.error}>{publicationError}</p>}
              <strong>Aktuális nyilvános állapot: {publication?.status === "published" ? publication.publiclyAccessible ? "Publikálva · elérhető" : "Publikálva, de jelenleg nem elérhető (elavult könyvtári állapot)" : publication?.status === "revoked" ? "Visszavonva" : publication?.status === "none" ? "Még nincs kiadás" : "Nem olvasható"}</strong>
              {publication?.status === "published" && publication.publiclyAccessible && <p><Link href={`/yasuragi/${encodeURIComponent(openedDraft.script.practiceId)}`} target="_blank" rel="noopener noreferrer">Publikus gyakorlásoldal megtekintése ↗</Link></p>}
              <div className={styles.proposalActions}>
                <button type="button" className={styles.createButton} disabled={publishing || !publication || !approval?.receiptCurrent || !approval.gate?.eligible} onClick={() => void changePublication("publish")}>
                  {publishing ? "Feldolgozás…" : publication?.status === "published" ? "Új jóváhagyott kiadás aktiválása" : "Gyakorlás publikálása"}
                </button>
                {publication?.status === "published" && <button type="button" className={styles.secondaryButton} disabled={publishing} onClick={() => void changePublication("revoke")}>Nyilvános kiadás visszavonása</button>}
                <button type="button" className={styles.secondaryButton} disabled={publishing} onClick={() => void refreshPublicationStatus(openedDraft.script.practiceId, openedDraft.draftId)}>Kiadási állapot frissítése</button>
              </div>
            </section>
          </section>
          {workError && <p role="alert" className={styles.error}>{workError}</p>}
          {workMessage && <p role="status" className={styles.workMessage}>{workMessage}</p>}
          <button type="button" className={styles.secondaryButton} onClick={() => downloadJson(`${openedDraft.script.practiceId}-gyakorlas.json`, openedDraft.script)}><Download size={16} aria-hidden="true"/> Gyakorlásscript exportálása</button>
          {openedDraft.authoring && <>
            <p><strong>{openedDraft.authoring.poseProposals.length} pózadatlap-javaslat</strong> tartozik a projekthez. Ezek még nem könyvtári rekordok, és nem tartalmaznak jóváhagyott képfájlt.</p>
            {openedDraft.authoring.poseProposals.map((proposal) => {
              const row = projectReview?.items.find((item) => item.poseId === proposal.poseId);
              const canCreate = row && !row.exists;
              const canAddImage = row?.exists && row.libraryStatus === "draft" && !row.imageAssetRef;
              return <div className={styles.proposal} key={proposal.poseId}>
                <strong>{proposal.record.name_hu}</strong>
                <small>{proposal.poseId} · {row?.libraryStatus === "missing" ? "Nincs még a könyvtárban" : row?.libraryStatus === "draft" ? "Könyvtári tervezet" : row?.libraryStatus === "active" ? "Aktív könyvtári póz" : row?.libraryStatus === "archived" ? "Archivált könyvtári póz" : "Státusz betöltése…"}</small>
                <p><ImageIcon size={14} aria-hidden="true"/> {proposal.illustration.brief}</p>
                <div className={styles.proposalActions}>
                  <button type="button" className={styles.secondaryButton} onClick={() => downloadJson(`${proposal.poseId}.json`, proposal.record)}><Download size={15} aria-hidden="true"/> Póztervezet JSON</button>
                  {canCreate && <button type="button" className={styles.createButton} disabled={Boolean(writingPose)} onClick={() => void createPoseDraft(proposal)}>{writingPose === proposal.poseId ? "Mentés…" : "Új draft póz felvétele"}</button>}
                </div>
                {row?.exists && <div className={styles.poseChecklist}>
                  <strong>Jelenlegi állapot</strong>
                  <span>Kép: {row.imageAssetRef ? row.imageStatus === "verified" ? "hozzárendelve · ellenőrzött slot" : "hozzárendelve · ellenőrzendő" : "hiányzik"}</span>
                  <span>Szöveg: {row.contentStatus === "published" || row.contentStatus === "verified" ? "tartalmilag ellenőrzött" : "jóváhagyásra vár"}</span>
                  <span>Jógaszakmai validálás: {row.validated ? "rögzítve" : "hiányzik"}</span>
                  <span>Lejátszó-könyvtári készültség: {row.libraryReady ? "teljes" : "függőben"}</span>
                </div>}
                {canAddImage && <div className={styles.imageUpload}>
                  <label htmlFor={`pose-image-${proposal.poseId}`}>Illusztráció hozzárendelése (PNG/WebP, max. 4 MB)</label>
                  <input id={`pose-image-${proposal.poseId}`} type="file" accept="image/png,image/webp,.png,.webp" disabled={Boolean(writingPose)} onChange={(event) => { setPoseFiles((old) => ({ ...old, [proposal.poseId]: event.target.files?.[0] ?? null })); setImageConfirmed((old) => ({ ...old, [proposal.poseId]: false })); }}/>
                  <label className={styles.confirmRow}><input type="checkbox" checked={Boolean(imageConfirmed[proposal.poseId])} onChange={(event) => setImageConfirmed((old) => ({ ...old, [proposal.poseId]: event.target.checked }))}/> Ellenőriztem, hogy a kép a megfelelő pózt és karaktert mutatja. A meglévő képfeltöltő ezt a képslotot „verified” állapotúra állítja.</label>
                  <button type="button" className={styles.createButton} disabled={Boolean(writingPose) || !poseFiles[proposal.poseId] || !imageConfirmed[proposal.poseId]} onClick={() => void uploadPoseImage(proposal)}>{writingPose === proposal.poseId ? "Feltöltés…" : "Kép hozzárendelése"}</button>
                </div>}
                {row?.exists && row.imageAssetRef && <p className={styles.reminder}>A póznak már van képe. Ezen a felületen nem írjuk felül; szükség esetén az illusztrációkezelőben cserélhető.</p>}
              </div>;
            })}
          </>}
          <p><Link href="/admin/yogis-choice">Pózadatlapok szakmai ellenőrzése az ászanatárban →</Link> · <Link href="/admin/yogis-choice/illustrations">Részletes illusztrációkezelő →</Link></p>
          {projectReview && <details className={styles.reviewDetails}>
            <summary>Összes könyvtári függőség ({projectReview.items.length})</summary>
            <ul>{projectReview.items.map((item) => <li key={item.poseId}>
              <strong>{item.label}</strong> <code>{item.poseId}</code> · {item.referenceCount ? `${item.referenceCount} hivatkozás` : "jelenleg nincs script-hivatkozás"} · {item.libraryReady ? "előkészítve" : !item.exists ? item.hasProposal ? "pózjavaslat vár" : "pózjavaslat hiányzik" : !item.imageAssetRef ? "kép hiányzik" : "szakmai/könyvtári felülvizsgálat szükséges"}
            </li>)}</ul>
          </details>}
          <p className={styles.reminder}>Minden póz- és képművelet után frissül a projekt állapota. A korábbi immutable gyakorlásverziót nem módosítjuk; publikálás kizárólag külön megerősített P06 művelettel történhet.</p>
          {openedReport?.dependencies.length ? <p>Jelenlegi könyvtári státusz: {openedReport.dependencies.filter((d) => d.state === "missing" || d.state === "proposal_pending" || d.state === "image_missing").length} hiányzó / kiegészítendő póz vagy kép.</p> : null}
          {openedReport?.previewReady ? <p><Link href={`/admin/yasuragi?draft=${encodeURIComponent(openedDraft.draftId)}`}>Ellenőrzés a P01 próbalеjátszóban →</Link></p> : <p>A próbalejátszó csak a szükséges könyvtári rekordok rendezése után használható. A tervezet mentése ettől függetlenül sikeres.</p>}
        </div>}
        <p className={styles.reminder}>A P03 csak új, jóváhagyatlan pózt hozhat létre és kifejezett megerősítéssel képet rendelhet hozzá. A szakmai tartalomjóváhagyás az ászanatárban marad; a külön P06 kiadási lépés nélkül semmi nem válik publikussá.</p>
      </section>
    </div>
  </main>;
}
