"use client";

import { useEffect, useRef, useState } from "react";
import {
  CUSTOM_CUES,
  MAX_PRESETS,
  MAX_REPEATS,
  MAX_STAGE_SECONDS,
  MAX_STAGES,
  MIN_STAGE_SECONDS,
  durationOfPreset,
  formatCustomDuration,
  getCustomCuePath,
  newCustomStage,
  type CustomCueId,
  type CustomMeditationCollection,
  type CustomMeditationDraft,
  type CustomMeditationStage,
} from "../lib/custom-meditation-types";
import styles from "../styles/custom-meditations.module.css";

type Props = {
  collection: CustomMeditationCollection;
  error: string | null;
  onSave: (draft: CustomMeditationDraft, existingId?: string) => boolean;
  onRemove: (id: string) => boolean;
  onSetDefault: (id: string) => boolean;
  onClose: () => void;
  onStartRequested: (id?: string) => void;
  createImmediately?: boolean;
};

type Editor = { id?: string; draft: CustomMeditationDraft };

type StageForm = {
  id: string;
  title: string;
  minutes: string;
  seconds: string;
  cueId: CustomCueId | "";
  repeats: string;
};

const freshDraft = (): CustomMeditationDraft => ({ title: "", stages: [newCustomStage(1)] });

function toStageForm(stage: CustomMeditationStage): StageForm {
  return {
    id: stage.id,
    title: stage.title,
    minutes: String(Math.floor(stage.durationSec / 60)),
    seconds: String(stage.durationSec % 60),
    cueId: stage.cueId ?? "",
    repeats: String(stage.repeats),
  };
}

function validatedStage(form: StageForm): CustomMeditationStage | null {
  const minutes = Number(form.minutes);
  const seconds = Number(form.seconds);
  const repeats = Number(form.repeats);
  const durationSec = minutes * 60 + seconds;
  if (!form.title.trim() || form.title.trim().length > 60 ||
      !Number.isInteger(minutes) || minutes < 0 ||
      !Number.isInteger(seconds) || seconds < 0 || seconds > 59 ||
      durationSec < MIN_STAGE_SECONDS || durationSec > MAX_STAGE_SECONDS ||
      !Number.isInteger(repeats) || repeats < 1 || repeats > MAX_REPEATS) return null;
  return {
    id: form.id,
    title: form.title.trim(),
    durationSec,
    cueId: form.cueId || null,
    repeats: form.cueId ? repeats : 1,
  };
}

export default function CustomMeditationsDialog({
  collection, error, onSave, onRemove, onSetDefault, onClose, onStartRequested, createImmediately = false,
}: Props) {
  const [editor, setEditor] = useState<Editor | null>(() => createImmediately ? { draft: freshDraft() } : null);
  const [stageForm, setStageForm] = useState<StageForm | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [previewingCue, setPreviewingCue] = useState<CustomCueId | null>(null);

  const stopCuePreview = () => {
    const audio = previewAudioRef.current;
    previewAudioRef.current = null;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.currentTime = 0;
    }
    setPreviewingCue(null);
  };

  const toggleCuePreview = (cueId: CustomCueId) => {
    if (previewingCue === cueId) {
      stopCuePreview();
      return;
    }
    stopCuePreview();
    const audio = new Audio(getCustomCuePath(cueId));
    previewAudioRef.current = audio;
    audio.onended = () => {
      if (previewAudioRef.current === audio) {
        previewAudioRef.current = null;
        setPreviewingCue(null);
      }
    };
    audio.onerror = () => {
      if (previewAudioRef.current === audio) {
        previewAudioRef.current = null;
        setPreviewingCue(null);
        setMessage("A hang nem tölthető be. Ellenőrizd a meditációs hangfájlokat.");
      }
    };
    setMessage(null);
    setPreviewingCue(cueId);
    void audio.play().catch(() => {
      if (previewAudioRef.current === audio) {
        previewAudioRef.current = null;
        setPreviewingCue(null);
        setMessage("A hang előnézete nem indult el. Koppints újra a lejátszásra.");
      }
    });
  };

  useEffect(() => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      previewAudioRef.current?.pause();
      previewAudioRef.current = null;
      document.body.style.overflow = oldOverflow;
      previousFocus.current?.focus();
    };
  }, []);

  const confirmDiscard = () => {
    if (!editor) return true;
    return window.confirm("Elveted a még nem mentett módosításokat?");
  };

  const close = () => {
    if (confirmDiscard()) {
      stopCuePreview();
      onClose();
    }
  };

  const goBack = () => {
    if (stageForm) {
      stopCuePreview();
      setStageForm(null);
      setMessage(null);
    } else if (confirmDiscard()) {
      setEditor(null);
      setMessage(null);
    }
  };

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (stageForm) {
          stopCuePreview();
          setStageForm(null);
          setMessage(null);
        } else if (editor) {
          if (window.confirm("Elveted a még nem mentett módosításokat?")) {
            setEditor(null);
            setMessage(null);
          }
        } else onClose();
      }
      if (event.key === "Tab" && dialogRef.current) {
        const elements = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]'
        ));
        if (!elements.length) return;
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [editor, stageForm, onClose]);

  const editPreset = (id: string) => {
    const preset = collection.presets.find((item) => item.id === id);
    if (!preset) return;
    setEditor({ id: preset.id, draft: { title: preset.title, stages: preset.stages.map((stage) => ({ ...stage })) } });
    setMessage(null);
  };

  const copyPreset = (id: string) => {
    const preset = collection.presets.find((item) => item.id === id);
    if (!preset) return;
    setEditor({ draft: {
      title: `${preset.title} – másolat`.slice(0, 70),
      stages: preset.stages.map((stage) => ({ ...stage, id: newCustomStage(1).id })),
    } });
    setMessage(null);
  };

  const removePreset = (id: string) => {
    const preset = collection.presets.find((item) => item.id === id);
    if (!preset || !window.confirm(`Törlöd ezt a gyakorlást: „${preset.title}”?`)) return;
    if (!onRemove(id)) setMessage("A törlés nem sikerült.");
  };

  const saveEditor = () => {
    if (!editor) return;
    if (!editor.draft.title.trim()) {
      setMessage("Adj nevet a gyakorlásnak.");
      return;
    }
    if (onSave(editor.draft, editor.id)) {
      setEditor(null);
      setMessage("A gyakorlás elmentve.");
    } else {
      setMessage("A mentés nem sikerült. Ellenőrizd a szakaszok adatait.");
    }
  };

  const openStage = (stage: CustomMeditationStage) => {
    stopCuePreview();
    setStageForm(toStageForm(stage));
    setMessage(null);
  };

  const saveStage = () => {
    if (!editor || !stageForm) return;
    const stage = validatedStage(stageForm);
    if (!stage) {
      setMessage("Adj nevet és 15 másodperc és 120 perc közötti időtartamot. Az ismétlés 1–8 lehet.");
      return;
    }
    setEditor({ ...editor, draft: {
      ...editor.draft,
      stages: editor.draft.stages.map((item) => item.id === stage.id ? stage : item),
    } });
    stopCuePreview();
    setStageForm(null);
    setMessage(null);
  };

  const addStage = () => {
    if (!editor || editor.draft.stages.length >= MAX_STAGES) return;
    const stage = newCustomStage(editor.draft.stages.length + 1);
    setEditor({ ...editor, draft: { ...editor.draft, stages: [...editor.draft.stages, stage] } });
    openStage(stage);
  };

  const moveStage = (index: number, offset: -1 | 1) => {
    if (!editor) return;
    const target = index + offset;
    if (target < 0 || target >= editor.draft.stages.length) return;
    const stages = [...editor.draft.stages];
    [stages[index], stages[target]] = [stages[target], stages[index]];
    setEditor({ ...editor, draft: { ...editor.draft, stages } });
  };

  const deleteStage = (id: string) => {
    if (!editor || editor.draft.stages.length <= 1) return;
    setEditor({ ...editor, draft: { ...editor.draft, stages: editor.draft.stages.filter((stage) => stage.id !== id) } });
  };

  const title = stageForm ? "Szakasz beállítása" : editor ? (editor.id ? "Gyakorlás szerkesztése" : "Új gyakorlás") : "Saját gyakorlásaim";

  return (
    <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="custom-meditations-title" ref={dialogRef} tabIndex={-1}>
        <div className={styles.header}>
          <div>
            <span className={styles.eyebrow}>ÜVEGGYÖNGYÖK</span>
            <h2 className={styles.title} id="custom-meditations-title">{title}</h2>
          </div>
          <button type="button" className={styles.iconButton} onClick={close} aria-label="Bezárás">×</button>
        </div>

        <div className={styles.content}>
          {stageForm ? (
            <div className={styles.editorSection}>
              <label className={styles.field}>
                <span>Szakasz neve</span>
                <input value={stageForm.title} maxLength={60} onChange={(event) => setStageForm({ ...stageForm, title: event.target.value })} placeholder="Például: Csendes ülés" />
              </label>
              <div className={styles.field}>
                <span>Időtartam</span>
                <div className={styles.durationFields}>
                  <label><input type="number" min={0} max={120} step={1} value={stageForm.minutes} onChange={(event) => setStageForm({ ...stageForm, minutes: event.target.value })} /> perc</label>
                  <label><input type="number" min={0} max={59} step={1} value={stageForm.seconds} onChange={(event) => setStageForm({ ...stageForm, seconds: event.target.value })} /> mp</label>
                </div>
                <small>Legalább 15 másodperc, legfeljebb 120 perc.</small>
              </div>
              <div className={styles.field}>
                <label htmlFor="custom-stage-cue">Hangjelzés a szakasz végén</label>
                <div className={styles.cueSelection}>
                  <select
                    id="custom-stage-cue"
                    value={stageForm.cueId}
                    onChange={(event) => {
                      stopCuePreview();
                      setStageForm({ ...stageForm, cueId: event.target.value as CustomCueId | "" });
                    }}
                  >
                    <option value="">Nincs hang – csendes váltás</option>
                    {CUSTOM_CUES.map((cue) => <option value={cue.id} key={cue.id}>{cue.label}</option>)}
                  </select>
                  {stageForm.cueId && (
                    <button
                      type="button"
                      className={styles.cuePreviewButton}
                      onClick={() => toggleCuePreview(stageForm.cueId as CustomCueId)}
                      aria-label={previewingCue === stageForm.cueId ? "Hangelőnézet leállítása" : "Hang meghallgatása"}
                    >
                      {previewingCue === stageForm.cueId ? "Leállítás" : "Meghallgatás"}
                    </button>
                  )}
                </div>
              </div>
              {stageForm.cueId && (
                <label className={styles.field}>
                  <span>Jelzés ismétlése</span>
                  <select value={stageForm.repeats} onChange={(event) => setStageForm({ ...stageForm, repeats: event.target.value })}>
                    {Array.from({ length: MAX_REPEATS }, (_, i) => i + 1).map((count) => (
                      <option key={count} value={count}>{count} alkalom</option>
                    ))}
                  </select>
                </label>
              )}
              <p className={styles.helper}>A meditációs hangtárból választhatsz. A jelzések legfeljebb 7 másodpercig szólnak. Az ismétlések egymás után következnek, ezért több ütés hosszabb lezárást eredményezhet.</p>
            </div>
          ) : editor ? (
            <div className={styles.editorSection}>
              <label className={styles.field}>
                <span>Gyakorlás neve</span>
                <input value={editor.draft.title} maxLength={70} onChange={(event) => setEditor({ ...editor, draft: { ...editor.draft, title: event.target.value } })} placeholder="Például: Reggeli elcsendesedés" />
              </label>
              <div className={styles.sectionHeading}>
                <strong>Szakaszok</strong>
                <span>{formatCustomDuration(durationOfPreset(editor.draft))} összesen</span>
              </div>
              <div className={styles.presetList}>
                {editor.draft.stages.map((stage, index) => (
                  <div key={stage.id} className={styles.stageItem}>
                    <button type="button" className={styles.stageMain} onClick={() => openStage(stage)} aria-label={`${stage.title} beállítása`}>
                      <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
                      <span className={styles.stageText}>
                        <strong>{stage.title}</strong>
                        <small>{formatCustomDuration(stage.durationSec)} · {stage.cueId ? `${CUSTOM_CUES.find((cue) => cue.id === stage.cueId)?.label} × ${stage.repeats}` : "Csendes váltás"}</small>
                      </span>
                      <span aria-hidden="true">›</span>
                    </button>
                    <div className={styles.stageActions}>
                      <button type="button" disabled={index === 0} onClick={() => moveStage(index, -1)} aria-label={`${stage.title} előrébb`}>↑</button>
                      <button type="button" disabled={index === editor.draft.stages.length - 1} onClick={() => moveStage(index, 1)} aria-label={`${stage.title} hátrébb`}>↓</button>
                      <button type="button" disabled={editor.draft.stages.length === 1} onClick={() => deleteStage(stage.id)} aria-label={`${stage.title} törlése`}>×</button>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className={styles.addButton} onClick={addStage} disabled={editor.draft.stages.length >= MAX_STAGES}>
                + Szakasz hozzáadása
              </button>
              <p className={styles.helper}>A szakaszok egymás után következnek. A dedikált nyitóhang minden induláskor automatikusan megszólal majd, nem része a szakaszoknak.</p>
            </div>
          ) : (
            <div className={styles.editorSection}>
              {collection.presets.length === 0 ? (
                <p className={styles.emptyState}>Még nincs mentett saját meditációd. Állíts össze egyet a saját ritmusodban.</p>
              ) : (
                <div className={styles.presetList}>
                  {collection.presets.map((preset) => (
                    <div key={preset.id} className={styles.presetItem}>
                      <div className={styles.presetInfo}>
                        <strong>{preset.title}</strong>
                        <span>{formatCustomDuration(durationOfPreset(preset))} · {preset.stages.length} szakasz</span>
                        {collection.defaultId === preset.id && <small className={styles.defaultLabel}>Alapértelmezett</small>}
                      </div>
                      <div className={styles.presetActions}>
                        <button type="button" onClick={() => onStartRequested(preset.id)}>Indítás</button>
                        {collection.defaultId !== preset.id && <button type="button" onClick={() => onSetDefault(preset.id)}>Legyen az alap</button>}
                        <button type="button" onClick={() => editPreset(preset.id)}>Szerkesztés</button>
                        <button type="button" onClick={() => copyPreset(preset.id)} disabled={collection.presets.length >= MAX_PRESETS}>Másolás</button>
                        <button type="button" onClick={() => removePreset(preset.id)} className={styles.deleteButton}>Törlés</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" className={styles.addButton} onClick={() => { setEditor({ draft: freshDraft() }); setMessage(null); }} disabled={collection.presets.length >= MAX_PRESETS}>
                + Új meditáció létrehozása
              </button>
              <p className={styles.helper}>A gyakorlásaid ezen az eszközön és ebben a böngészőben maradnak. A lejátszó nyitott képernyővel használható.</p>
            </div>
          )}
          {(message || error) && <p className={styles.feedback} role="status">{message || error}</p>}
        </div>

        <div className={styles.footer}>
          {stageForm ? (
            <>
              <button type="button" className={styles.secondaryButton} onClick={goBack}>Mégse</button>
              <button type="button" className={styles.primaryButton} onClick={saveStage}>Szakasz mentése</button>
            </>
          ) : editor ? (
            <>
              <button type="button" className={styles.secondaryButton} onClick={goBack}>Vissza</button>
              <button type="button" className={styles.primaryButton} onClick={saveEditor}>Gyakorlás mentése</button>
            </>
          ) : (
            <>
              <button type="button" className={styles.secondaryButton} onClick={onClose}>Bezárás</button>
              {collection.presets.length > 0 && <button type="button" className={styles.primaryButton} onClick={() => onStartRequested()}>Alapgyakorlás indítása</button>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
