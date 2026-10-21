"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { Meditation, MeditationCategory, MeditationEndBehavior } from "../lib/meditation-types";
import { CATEGORY_ORDER, getCategoryAngle } from "../lib/meditation-layout";
import { getCategoryLabel } from "../lib/meditation-utils";
import { useMeditations } from "../hooks/useMeditations";
import { useCustomMeditations } from "../hooks/useCustomMeditations";
import { durationOfPreset, formatCustomDuration, type CustomMeditationPreset } from "../lib/custom-meditation-types";
import { CustomMeditationCues } from "../lib/custom-meditation-cues";
import CustomMeditationsDialog from "./CustomMeditationsDialog";
import CustomMeditationPlayer from "./CustomMeditationPlayer";
import MeditationCenterFocus from "./MeditationCenterFocus";
import MeditationRing from "./MeditationRing";
import MeditationPreviewPanel from "./MeditationPreviewPanel";
import MeditationReader from "./MeditationReader";
import styles from "../styles/meditations.module.css";
import type { MeditationAudioMap } from "@/features/audio/lib/audio-types";

type Props = {
  meditations: Meditation[];
  audioMap: MeditationAudioMap;
  isAdmin?: boolean;
};

export default function MeditationSpace({ meditations: initialMeditations, audioMap, isAdmin }: Props) {
  const meditations = useMeditations(initialMeditations);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<MeditationCategory | null>(null);
  const { collection, defaultPreset, ready: customReady, error: customError, save, remove, setDefault } = useCustomMeditations();
  const [customDialog, setCustomDialog] = useState<"new" | "list" | null>(null);
  const [customPlayback, setCustomPlayback] = useState<{
    preset: CustomMeditationPreset;
    cues: CustomMeditationCues;
    openingError: boolean;
  } | null>(null);

  const startCustomMeditation = (id?: string) => {
    const selectedPreset = id ? collection.presets.find((item) => item.id === id) : defaultPreset;
    if (!selectedPreset) return;
    // AudioContext must be unlocked directly inside the user's click on iOS.
    const cues = new CustomMeditationCues();
    void cues.playOpening(() => setCustomPlayback((current) =>
      current?.cues === cues ? { ...current, openingError: true } : current
    ));
    cues.prepare(selectedPreset.stages.map((stage) => stage.cueId));
    const preset = { ...selectedPreset, stages: selectedPreset.stages.map((stage) => ({ ...stage })) };
    setCustomDialog(null);
    setCustomPlayback({ preset, cues, openingError: !cues.supported });
  };

  const openCustomConfig = (view: "new" | "list") => {
    setCustomDialog(view);
  };
  const [readerId, setReaderId] = useState<string | null>(null);
  const [readerOpen, setReaderOpen] = useState(false);
  const [readerCompleted, setReaderCompleted] = useState(false);

  useEffect(() => {
    const body = document.body;
    const previous = {
      backgroundImage: body.style.backgroundImage,
      backgroundColor: body.style.backgroundColor,
      backgroundRepeat: body.style.backgroundRepeat,
      backgroundSize: body.style.backgroundSize,
      backgroundPosition: body.style.backgroundPosition,
      backgroundBlendMode: body.style.backgroundBlendMode,
    };

    body.style.backgroundImage = 'url("/backgrounds/meditations_background.png")';
    body.style.backgroundColor = "#05080e";
    body.style.backgroundRepeat = "no-repeat";
    body.style.backgroundSize = "cover";
    body.style.backgroundPosition = "center";
    body.style.backgroundBlendMode = "normal";

    return () => {
      body.style.backgroundImage = previous.backgroundImage;
      body.style.backgroundColor = previous.backgroundColor;
      body.style.backgroundRepeat = previous.backgroundRepeat;
      body.style.backgroundSize = previous.backgroundSize;
      body.style.backgroundPosition = previous.backgroundPosition;
      body.style.backgroundBlendMode = previous.backgroundBlendMode;
    };
  }, []);

  const availableCategories = useMemo(() => {
    const available = new Set(meditations.map((meditation) => meditation.category));
    return CATEGORY_ORDER.filter((category) => available.has(category));
  }, [meditations]);

  const ringFocusStyle = useMemo(() => {
    if (!activeCategory) return undefined;
    const angle = (getCategoryAngle(activeCategory) * Math.PI) / 180;
    return {
      "--ring-pan-x": `${(-37 * Math.cos(angle)).toFixed(2)}%`,
      "--ring-pan-y": `${(-37 * Math.sin(angle)).toFixed(2)}%`,
    } as CSSProperties;
  }, [activeCategory]);

  const hovered = useMemo(
    () => meditations.find((meditation) => meditation.id === hoveredId) ?? null,
    [meditations, hoveredId]
  );

  const selected = useMemo(
    () => meditations.find((meditation) => meditation.id === selectedId) ?? null,
    [meditations, selectedId]
  );

  const focused = hovered ?? selected;

  const readerMeditation = useMemo(
    () => meditations.find((meditation) => meditation.id === readerId) ?? null,
    [meditations, readerId]
  );
  const readerAudioConfig = useMemo(() => {
    if (!readerMeditation) return null;
    return audioMap.items[readerMeditation.id]?.audio ?? null;
  }, [audioMap, readerMeditation]);

  const handleSelect = (id: string) => {
    const meditation = meditations.find((item) => item.id === id);
    if (meditation && activeCategory && activeCategory !== meditation.category) {
      setActiveCategory(meditation.category);
    }
    setSelectedId(id);
  };

  const chooseCategory = (category: MeditationCategory | null) => {
    setActiveCategory(category);
    setSelectedId(null);
    setHoveredId(null);
  };

  const closePreview = () => {
    setSelectedId(null);
    setHoveredId(null);
  };

  const openReader = () => {
    if (!selected) return;
    setReaderId(selected.id);
    setReaderCompleted(false);
    setReaderOpen(true);
  };

  const closeReader = () => {
    setReaderOpen(false);
    setReaderId(null);
  };

  const handleReaderComplete = (behavior: MeditationEndBehavior) => {
    if (behavior !== "fade_out") {
      setReaderCompleted(true);
    }
  };

  useEffect(() => {
    if (!selected || readerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePreview();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readerOpen, selected]);

  return (
    <section className={`${styles.space} ${readerOpen ? styles.spaceReaderOpen : ""}`}>
      <div className={styles.spaceInner}>
        <div className={styles.ringArea}>
          <nav className={styles.categoryFilters} aria-label="Meditációk tematikus szűrése">
            <button
              type="button"
              className={`${styles.categoryChip} ${activeCategory === null ? styles.categoryChipActive : ""}`}
              aria-pressed={activeCategory === null}
              onClick={() => chooseCategory(null)}
            >
              Mind
            </button>
            {availableCategories.map((category) => (
              <button
                type="button"
                key={category}
                className={`${styles.categoryChip} ${activeCategory === category ? styles.categoryChipActive : ""}`}
                aria-pressed={activeCategory === category}
                onClick={() => chooseCategory(category)}
              >
                {getCategoryLabel(category)}
              </button>
            ))}
          </nav>
          <div className={styles.ringViewport}>
            <div
              className={`${styles.ringStage} ${activeCategory ? styles.ringStageFocused : ""}`}
              style={ringFocusStyle}
            >
              <MeditationRing
                meditations={meditations}
                hoveredId={hoveredId}
                selectedId={selectedId}
                activeCategory={activeCategory}
                onHover={setHoveredId}
                onSelect={handleSelect}
              />
            </div>
          </div>
        </div>
        {!readerOpen && (
          <>
            <div className={styles.desktopCenterFocus}>
              <MeditationCenterFocus meditation={focused} />
              {!focused && (
                <div className={styles.desktopCustomEntry}>
                  {defaultPreset && <span className={styles.customPresetSummary}>{defaultPreset.title} · {formatCustomDuration(durationOfPreset(defaultPreset))}</span>}
                  <button type="button" className={styles.customStartButton} disabled={!customReady} onClick={() => defaultPreset ? startCustomMeditation() : openCustomConfig("new")}>
                    {defaultPreset ? "Saját meditáció indítása" : "Első saját meditáció beállítása"}
                  </button>
                  <button type="button" className={styles.customSettingsLink} disabled={!customReady} onClick={() => openCustomConfig("list")}>Gyakorlásaim beállítása</button>
                </div>
              )}
            </div>
            <div className={styles.mobileLower}>
              {selected ? (
                <MeditationPreviewPanel meditation={selected} onEnter={openReader} onClose={closePreview} />
              ) : (
                <div className={styles.mobileHome}>
                  <MeditationCenterFocus meditation={null} />
                  <div className={styles.customMeditationEntry}>
                    {defaultPreset && <span className={styles.customPresetSummary}>{defaultPreset.title} · {formatCustomDuration(durationOfPreset(defaultPreset))}</span>}
                    <button type="button" className={styles.customStartButton} disabled={!customReady} onClick={() => defaultPreset ? startCustomMeditation() : openCustomConfig("new")}>
                      {defaultPreset ? "Saját meditáció indítása" : "Első saját meditáció beállítása"}
                    </button>
                    <button type="button" className={styles.customSettingsLink} disabled={!customReady} onClick={() => openCustomConfig("list")}>
                      Gyakorlásaim beállítása
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
        {selected && !readerOpen && (
          <div className={styles.previewBackdrop} onClick={closePreview}>
            <MeditationPreviewPanel meditation={selected} onEnter={openReader} onClose={closePreview} />
          </div>
        )}
        {readerCompleted && !readerOpen && (
          <div className={styles.readerReturnHint}>A csend marad. Válassz újra.</div>
        )}
        {!customDialog && customError && !readerOpen && (
          <p className={styles.customStorageError} role="alert">{customError}</p>
        )}
      </div>
      {customDialog && (
        <CustomMeditationsDialog
          collection={collection}
          error={customError}
          onSave={save}
          onRemove={remove}
          onSetDefault={setDefault}
          onClose={() => setCustomDialog(null)}
          onStartRequested={startCustomMeditation}
          createImmediately={customDialog === "new"}
        />
      )}
      {customPlayback && (
        <CustomMeditationPlayer
          preset={customPlayback.preset}
          cues={customPlayback.cues}
          openingError={customPlayback.openingError}
          onExit={() => setCustomPlayback(null)}
        />
      )}
      {readerOpen && readerMeditation && (
        <MeditationReader
          meditation={readerMeditation}
          audioConfig={readerAudioConfig}
          onExit={closeReader}
          onComplete={handleReaderComplete}
          isAdmin={isAdmin}
        />
      )}
    </section>
  );
}
