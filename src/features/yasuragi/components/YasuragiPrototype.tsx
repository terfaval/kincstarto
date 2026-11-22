"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, BookOpen, Check, ChevronLeft, ChevronRight, CircleHelp, Clock3, Expand, Layers, Minimize2, Pause, Play, RotateCcw, Square, VolumeX, X } from "lucide-react";
import type { DecisionNode, EquipmentTip, PosePreview, PracticeScript, SegmentNode } from "../lib/practice-types";
import { allowedOptions, currentCue, resolvePosition, selectMiniText, validatePrototypeScript } from "../lib/practice-engine";
import styles from "../styles/YasuragiPrototype.module.css";

type Detail = ({ type: "pose"; poseId: string } | { type: "equipment"; equipment: EquipmentTip }) & { inMini: boolean };
type MiniView = "inline" | "pip" | null;
type PiPWindow = Window & { document: Document };
const INTRO_SECONDS = 8;

function formatClock(ms: number) {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function equipmentIcon(key: string) {
  return key.includes("takaró") ? <Layers aria-hidden="true" /> : <Square aria-hidden="true" />;
}

function PoseArtwork({ pose, className = "" }: { pose: PosePreview | undefined; className?: string }) {
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const broken = Boolean(pose?.imageUrl && brokenUrl === pose.imageUrl);
  return (
    <div className={`${styles.artwork} ${className}`}>
      {pose?.imageUrl && !broken ? (
        <Image src={pose.imageUrl} width={480} height={480} alt={pose.name} unoptimized className={styles.poseImage} onError={() => setBrokenUrl(pose.imageUrl)} />
      ) : (
        <div className={styles.artworkMissing} role="img" aria-label={`Nincs elérhető illusztráció: ${pose?.name ?? "ismeretlen póz"}`}>
          <BookOpen aria-hidden="true" />
          <span>{pose?.name ?? "Hiányzó könyvtári póz"}</span>
          <small>Illusztráció nem elérhető</small>
        </div>
      )}
    </div>
  );
}

export default function YasuragiPrototype({ script, poses, title = "Földön dolgozás", fixture = true, publicMode = false }: { script: PracticeScript; poses: Record<string, PosePreview>; title?: string; fixture?: boolean; publicMode?: boolean }) {
  const durationMs = script.durationSec * 1000;
  const previewStartMs = fixture && !publicMode ? Math.min(durationMs, (29 * 60 + 30) * 1000) : 0;
  const validationErrors = useMemo(() => validatePrototypeScript(script, poses), [script, poses]);
  const [elapsedMs, setElapsedMs] = useState(previewStartMs);
  const [playing, setPlaying] = useState(false);
  const anchorRef = useRef({ elapsed: previewStartMs, started: 0 });
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [poseSelections, setPoseSelections] = useState<Record<string, string>>({});
  const [poseIntro, setPoseIntro] = useState<{ nodeId: string; untilLocalSec: number } | null>(null);
  const [suppressed, setSuppressed] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<Detail | null>(null);
  const [mini, setMini] = useState<MiniView>(null);
  const [pip, setPip] = useState<PiPWindow | null>(null);
  const [miniNotice, setMiniNotice] = useState("");

  const tick = useCallback(() => {
    const next = Math.min(durationMs, anchorRef.current.elapsed + (performance.now() - anchorRef.current.started));
    setElapsedMs(next);
    if (next >= durationMs) setPlaying(false);
  }, []);

  useEffect(() => {
    if (!playing || validationErrors.length) return;
    const interval = window.setInterval(tick, 250);
    window.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("visibilitychange", tick);
    };
    // The clock anchor is set by user actions, never by render ticks.
  }, [playing, tick, validationErrors.length]);

  const jump = useCallback((ms: number) => {
    const next = Math.max(0, Math.min(durationMs, ms));
    anchorRef.current = { elapsed: next, started: performance.now() };
    setElapsedMs(next);
    setPoseIntro(null);
    setSuppressed(new Set());
  }, []);

  const togglePlayback = useCallback(() => {
    const now = performance.now();
    if (playing) {
      const pausedAt = Math.min(durationMs, anchorRef.current.elapsed + (now - anchorRef.current.started));
      anchorRef.current = { elapsed: pausedAt, started: now };
      setElapsedMs(pausedAt);
      setPlaying(false);
      return;
    }
    if (elapsedMs >= durationMs) { setChoices({}); setPoseSelections({}); setPoseIntro(null); setSuppressed(new Set()); }
    const from = elapsedMs >= durationMs ? 0 : elapsedMs;
    anchorRef.current = { elapsed: from, started: now };
    setElapsedMs(from);
    setPlaying(true);
  }, [playing, elapsedMs]);

  const position = useMemo(() => validationErrors.length ? null : resolvePosition(script, elapsedMs / 1000, choices, poses), [validationErrors.length, script, elapsedMs, choices, poses]);
  const node = position?.node ?? null;
  const segment = node?.type === "segment" ? node : null;
  const decision = node?.type === "decision" ? node : null;
  const localSec = position?.localSec ?? 0;
  const selectedPoseId = segment && segment.posePool.includes(poseSelections[segment.id]) ? poseSelections[segment.id] : segment?.defaultPoseId;
  const currentPose = selectedPoseId ? poses[selectedPoseId] : undefined;

  const introUntil = segment
    ? poseIntro?.nodeId === segment.id ? poseIntro.untilLocalSec : INTRO_SECONDS
    : 0;
  const fullCue = segment && selectedPoseId ? currentCue(segment, localSec, selectedPoseId) : null;
  const miniText = segment && selectedPoseId
    ? selectMiniText(segment, localSec, selectedPoseId, introUntil, suppressed)
    : null;

  const previousForDecision = useMemo(() => {
    if (!decision) return null;
    const prev = resolvePosition(script, decision.startGlobalSec - 0.001, choices, poses).node;
    if (!prev || prev.type !== "segment") return null;
    const id = prev.posePool.includes(poseSelections[prev.id]) ? poseSelections[prev.id] : prev.defaultPoseId;
    return poses[id];
  }, [decision, script, choices, poses, poseSelections]);

  const switchPose = useCallback((segmentNode: SegmentNode, indexDelta: number) => {
    const current = segmentNode.posePool.includes(poseSelections[segmentNode.id]) ? poseSelections[segmentNode.id] : segmentNode.defaultPoseId;
    const pool = segmentNode.posePool.filter((id) => Boolean(poses[id]));
    if (pool.length < 2) return;
    const next = pool[(pool.indexOf(current) + indexDelta + pool.length) % pool.length];
    if (!next || next === current) return;
    const interrupted = currentCue(segmentNode, Math.max(0, elapsedMs / 1000 - segmentNode.startGlobalSec), current);
    if (interrupted) setSuppressed((existing) => new Set([...existing, interrupted.id]));
    setPoseSelections((existing) => ({ ...existing, [segmentNode.id]: next }));
    setPoseIntro({ nodeId: segmentNode.id, untilLocalSec: elapsedMs / 1000 - segmentNode.startGlobalSec + INTRO_SECONDS });
  }, [poseSelections, poses, elapsedMs]);

  const closeMini = useCallback(() => {
    if (pip && !pip.closed) pip.close();
    setPip(null);
    setMini(null);
  }, [pip]);

  useEffect(() => () => {
    // Keep the main session alive; close orphaned PiP when the page unmounts.
    if (pip && !pip.closed) pip.close();
  }, [pip]);

  const openMini = useCallback(async () => {
    setMiniNotice("");
    if (mini) { closeMini(); return; }
    type DocumentPiP = { requestWindow(options: { width: number; height: number }): Promise<PiPWindow> };
    const api = (window as Window & { documentPictureInPicture?: DocumentPiP }).documentPictureInPicture;
    if (api) {
      try {
        const popup = await api.requestWindow({ width: 300, height: 300 });
        popup.document.title = "Yasuragi · Kísérő jóga";
        popup.document.body.style.margin = "0";
        popup.document.body.style.height = "100vh";
        popup.document.body.style.width = "100vw";
        popup.document.body.style.overflow = "hidden";
        popup.document.documentElement.setAttribute("data-time-theme", document.documentElement.getAttribute("data-time-theme") ?? "day");
        const stylesheetNodes = document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style');
        stylesheetNodes.forEach((source) => {
          const copy = source.cloneNode(true) as HTMLLinkElement | HTMLStyleElement;
          if (source instanceof HTMLLinkElement) (copy as HTMLLinkElement).href = source.href;
          popup.document.head.appendChild(copy);
        });
        const observer = new MutationObserver(() => popup.document.documentElement.setAttribute("data-time-theme", document.documentElement.getAttribute("data-time-theme") ?? "day"));
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-time-theme"] });
        popup.addEventListener("pagehide", () => { observer.disconnect(); setPip(null); setMini(null); }, { once: true });
        setPip(popup);
        setMini("pip");
        return;
      } catch {
        setMiniNotice("A lebegő ablak nem nyitható meg ebben a böngészőben. Beépített mini nézetet mutatunk.");
      }
    } else {
      setMiniNotice("Ez a böngésző nem támogatja a lebegő Document PiP ablakot. A mini csak ezen a lapon látszik.");
    }
    setMini("inline");
  }, [mini, closeMini]);

  function renderDecisionCards(decisionNode: DecisionNode, isMini: boolean) {
    const options = allowedOptions(decisionNode, poses);
    if (options.length < 2) {
      return <p className={styles.quietTransition}>Csendes átvezetés. Hamarosan kényelmes ülésben folytatjuk.</p>;
    }
    return <div className={`${styles.decisionGrid} ${isMini ? styles.decisionGridMini : ""}`}>
      {options.map((option) => <button
        type="button"
        key={option.id}
        className={`${styles.optionCard} ${choices[decisionNode.id] === option.id ? styles.optionSelected : ""}`}
        onClick={() => setChoices((existing) => ({ ...existing, [decisionNode.id]: option.id }))}
        aria-pressed={choices[decisionNode.id] === option.id}
      >
        <PoseArtwork pose={poses[option.imagePoseId]} className={styles.optionArtwork} />
        <span>{isMini ? option.miniLabel : option.label}</span>
        {choices[decisionNode.id] === option.id && <Check size={15} aria-hidden="true" />}
      </button>)}
    </div>;
  }

  function renderSurface(isMini: boolean) {
    const activePose = decision ? previousForDecision : currentPose;
    const showEquipment = !isMini || !decision;
    const variant = segment && selectedPoseId ? segment.poseVariants[selectedPoseId] : null;
    const equipment = variant?.equipment ?? [];
    const pool = segment?.posePool.filter((id) => Boolean(poses[id])) ?? [];
    return <section className={`${styles.player} ${isMini ? styles.miniPlayer : styles.fullPlayer}`} aria-label={isMini ? "Yasuragi minilejátszó" : "Yasuragi lejátszó"}>
      <div className={styles.playerHeading}>
        <div>
          <strong>{title}</strong>
          <small>{node?.name ?? "Gyakorlás vége"} · {formatClock(elapsedMs)}</small>
        </div>
        <div className={styles.headingControls}>
          {isMini ? <button type="button" onClick={closeMini} aria-label="Minilejátszó bezárása"><X size={16} /></button> : <button type="button" onClick={openMini} aria-label="Minilejátszó megnyitása"><Minimize2 size={17} /></button>}
        </div>
      </div>
      {decision && isMini ? <div className={styles.miniDecision}>
        {allowedOptions(decision, poses).length > 1 && <h2>{decision.questionMini}</h2>}
        {renderDecisionCards(decision, true)}
        <small>{choices[decision.id] ? "A választás a döntési ablak végén lép életbe." : "Választás nélkül az alapútvonal folytatódik."}</small>
      </div> : <>
        <div className={styles.poseStage}>
          {showEquipment && <div className={styles.equipmentRail} aria-label="Javasolt támaszok">
            {equipment.map((item) => <button key={item.catalogKey} type="button" title={item.catalogKey} className={styles.equipmentItem} onClick={() => setDetail({ type: "equipment", equipment: item, inMini: isMini })}>
              {equipmentIcon(item.catalogKey)}<span>{item.catalogKey}</span>
            </button>)}
          </div>}
          <div className={styles.poseCenter}>
            <div className={styles.poseCarousel}>
              {segment && pool.length > 1 && <button className={styles.carouselArrow} type="button" aria-label="Előző póz" onClick={() => switchPose(segment, -1)}><ChevronLeft /></button>}
              <PoseArtwork pose={activePose ?? undefined} className={styles.mainArtwork} />
              {segment && pool.length > 1 && <button className={styles.carouselArrow} type="button" aria-label="Következő póz" onClick={() => switchPose(segment, 1)}><ChevronRight /></button>}
            </div>
            <div className={styles.poseTitle}>
              <span>{activePose?.name ?? "—"}</span>
              {activePose && <button type="button" aria-label={`${activePose.name}: részletek`} onClick={() => setDetail({ type: "pose", poseId: activePose.id, inMini: isMini })}><CircleHelp size={isMini ? 15 : 18} /></button>}
            </div>
            {segment && pool.length > 1 && <div className={styles.dots} aria-label={`Póz ${pool.indexOf(selectedPoseId ?? "") + 1}/${pool.length}`}>
              {pool.map((id) => <span className={id === selectedPoseId ? styles.dotActive : ""} key={id} />)}
            </div>}
          </div>
          {!isMini && <div className={styles.rightBalance} aria-hidden="true" />}
        </div>
        {!isMini && segment && <p className={styles.tText}>{variant?.t.full}</p>}
        {!isMini && decision && <div className={styles.fullDecision}>
          {allowedOptions(decision, poses).length > 1 && <p>{decision.fullIntro}</p>}
          {renderDecisionCards(decision, false)}
        </div>}
        {segment && <div className={`${styles.mText} ${isMini ? styles.miniText : ""}`} aria-label="Aktuális tanári vezetés">
          {isMini ? <p key={`${segment.id}-${miniText?.kind}-${miniText?.cueId ?? selectedPoseId}`} className={styles.cueFade}>{miniText?.text ?? ""}</p> : <p key={fullCue?.id ?? "quiet"} className={styles.cueFade}>{fullCue?.full ?? ""}</p>}
        </div>}
        {position?.completed && <p className={styles.completed}>{publicMode ? "A gyakorlás véget ért. Visszatérhetsz a gyakorlásokhoz." : "A gyakorlás véget ért. A munkádat nyugodtan folytathatod."}</p>}
      </>}
      <div className={styles.playerFooter}>
        <span>{formatClock(elapsedMs)} / {formatClock(durationMs)}</span>
        <div className={styles.footerControls}>
          <button type="button" onClick={togglePlayback} disabled={validationErrors.length > 0} aria-label={playing ? "Szünet" : elapsedMs === 0 ? "Indítás" : "Folytatás"}>{playing ? <Pause /> : <Play />}</button>
          {!isMini && <button type="button" aria-label={publicMode ? "Gyakorlás újrakezdése" : "Vissza az induló tesztidőpontra"} onClick={() => { setPlaying(false); if (publicMode) { setChoices({}); setPoseSelections({}); } jump(previewStartMs); }}><RotateCcw size={17} /></button>}
        </div>
      </div>
      {detail?.inMini === true && isMini && detailModal}
    </section>;
  }

  const selectedDetailPose = detail?.type === "pose" ? poses[detail.poseId] : undefined;
  const detailModal = detail ? (
<div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setDetail(null); }}>
      <section className={styles.modal} role="dialog" aria-modal="true" aria-label={detail.type === "pose" ? "Ászana-információ" : "Eszközinformáció"} onKeyDown={(event) => { if (event.key === "Escape") setDetail(null); }}>
        <button type="button" className={styles.closeDetail} autoFocus onClick={() => setDetail(null)} aria-label="Bezárás"><X size={19} /></button>
        {selectedDetailPose ? <>
          <h2>{selectedDetailPose.name}</h2>
          {selectedDetailPose.sanskrit && <p className={styles.subtitle}>{selectedDetailPose.sanskrit}</p>}
          <h3>Elhelyezkedés</h3><p>{selectedDetailPose.setup}</p>
          <h3>Könnyítések</h3><ul>{selectedDetailPose.modifications.map((x) => <li key={x}>{x}</li>)}</ul>
          <h3>Figyelmet igényel</h3><p>{selectedDetailPose.cautionAreas.join(", ") || "Nincs külön adat."}</p>
          {!selectedDetailPose.validated && <p className={styles.notice}>A könyvtári rekord nincs szakmailag validáltnak jelölve.</p>}
        </> : detail.type === "equipment" ? <>
          <h2>{detail.equipment.catalogKey}</h2><p>{detail.equipment.tip}</p>
          <p className={styles.subtitle}>A tipp az aktuális gyakorlásscriptből származik, nem általános eszközadatlap.</p>
        </> : <p>Ehhez a pózhoz nem található adat.</p>}
      </section>
    </div>
  ) : null;
  return <main className={`${styles.page} ${publicMode ? styles.publicPage : ""}`}>
    {publicMode
      ? <div className={styles.backrow}><Link href={`/yasuragi/${encodeURIComponent(script.practiceId)}`}><ArrowLeft size={16} /> Vissza a gyakorláshoz</Link><Link href="/yasuragi">Összes gyakorlás</Link></div>
      : <div className={styles.backrow}><Link href="/admin/yasuragi/practices"><ArrowLeft size={16} /> Gyakorlásprojektek</Link><Link href="/admin/yogis-choice">Ászanatár</Link><span>BELSŐ PROTOTÍPUS · nem publikált gyakorlás</span></div>}
    <header className={styles.intro}>
      <p className={styles.eyebrow}>YASURAGI · KÍSÉRŐ JÓGA</p>
      <h1>{title}</h1>
      <p>{publicMode ? "Indítsd el a gyakorlást, amikor készen állsz. A mozgást bármikor szüneteltetheted." : "A gyakorlásscript élő motorpróbája. Pózválasztás, szövegütemezés és elágazások – egy közös gyakorlási órával."}</p>
    </header>
    {validationErrors.length > 0 && <div className={styles.error} role="alert"><strong>A próba nem indítható:</strong> {validationErrors.join(" · ")}</div>}
    <div className={`${styles.layout} ${publicMode ? styles.publicLayout : ""}`}>
      <div className={styles.playerColumn}>{renderSurface(false)}</div>
      {!publicMode && <aside className={styles.testPanel} aria-label="Prototípus tesztvezérlői">
        <h2><Clock3 size={18} /> Motorteszt</h2>
        <p>Az időugrás csak tesztelésre szolgál; a valódi gyakorlás folyamatosan halad.</p>
        <div className={styles.quickJumps}>
          <button type="button" onClick={() => jump(0)}>00:00 · Kezdés</button>
          {fixture && <>
            <button type="button" onClick={() => jump(previewStartMs)}>29:30 · P3</button>
            <button type="button" onClick={() => jump(35.5 * 60 * 1000)}>35:30 · D2</button>
            <button type="button" onClick={() => jump(42 * 60 * 1000)}>42:00 · D2B</button>
          </>}
        </div>
        <label htmlFor="yasuragi-progress">Időpont: {formatClock(elapsedMs)}</label>
        <input id="yasuragi-progress" type="range" min="0" max={script.durationSec} step="1" value={Math.floor(elapsedMs / 1000)} onChange={(event) => jump(Number(event.target.value) * 1000)} />
        <button type="button" className={styles.resetButton} onClick={() => { setPlaying(false); setChoices({}); setPoseSelections({}); setPoseIntro(null); setSuppressed(new Set()); jump(previewStartMs); }}>Döntések és tesztállapot nullázása</button>
        <p className={styles.statusLine}>{playing ? "Fut" : "Szünet"} · {node?.id ?? "END"} {decision ? `· ${Math.ceil(decision.durationSec - localSec)} mp a döntésből` : ""}</p>
        <button type="button" className={styles.miniOpen} onClick={openMini}><Expand size={16} /> {mini ? "Mini bezárása" : "Lebegő mini megnyitása"}</button>
        {miniNotice && <p className={styles.notice}>{miniNotice}</p>}
        <p className={styles.previewWarning}><VolumeX size={15} /> Ez néma, admin-only próbaverzió. Nem feltételezi, hogy a pózválasztás tényleges mozdulatot jelent.</p>
      </aside>}
    </div>
    {publicMode && miniNotice && <p className={styles.notice} role="status">{miniNotice}</p>}
    {mini === "inline" && <div className={styles.floatingMini}>{renderSurface(true)}</div>}
    {mini === "pip" && pip && !pip.closed && createPortal(renderSurface(true), pip.document.body)}
    {detail && !detail.inMini && detailModal}
  </main>;
}
