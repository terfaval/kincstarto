"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Meditation, MeditationEndBehavior } from "../lib/meditation-types";
import { useReaderEngine } from "../hooks/useReaderEngine";
import { useAudioEngine } from "@/features/audio/hooks/useAudioEngine";
import type { MeditationAudioConfig } from "@/features/audio/lib/audio-types";
import ReaderStage from "./ReaderStage";
import styles from "../styles/meditations.module.css";

type Props = {
  meditation: Meditation;
  audioConfig: MeditationAudioConfig | null;
  onExit: () => void;
  onComplete: (behavior: MeditationEndBehavior) => void;
};

export default function MeditationReader({ meditation, audioConfig, onExit, onComplete }: Props) {
  const { status, currentText, start, restart, stop } = useReaderEngine(meditation);
  const audioEngine = useAudioEngine();
  const [closing, setClosing] = useState(false);
  const [completed, setCompleted] = useState(false);

  const endBehavior = useMemo(() => meditation.reader.end_behavior, [meditation.reader.end_behavior]);

  useEffect(() => {
    start();
  }, [start, meditation.id]);

  useEffect(() => {
    if (status !== "running") return;
    audioEngine.start(audioConfig);
  }, [audioConfig, audioEngine, status]);

  useEffect(() => {
    if (status !== "ended" || completed) return;
    if (endBehavior === "soft_end") {
      audioEngine.fadeOut(5);
    }
    if (endBehavior === "fade_out") {
      audioEngine.fadeOut(10);
    }
    if (endBehavior === "complete") {
      audioEngine.stop();
    }
    setCompleted(true);
    onComplete(endBehavior);

    if (endBehavior === "fade_out") {
      setClosing(true);
      const timer = window.setTimeout(() => {
        onExit();
      }, 2000);
      return () => window.clearTimeout(timer);
    }
  }, [completed, endBehavior, onComplete, onExit, status]);

  const handleExit = useCallback(() => {
    audioEngine.stop();
    stop();
    onExit();
  }, [audioEngine, onExit, stop]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleExit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleExit]);

  const showEndPanel = status === "ended" && endBehavior !== "fade_out";
  const endCopy = endBehavior === "complete" ? "Meditacio befejezve." : "Lassan terj vissza.";

  return (
    <div
      className={`${styles.readerOverlay} ${closing ? styles.readerOverlayClosing : ""}`}
      role="dialog"
      aria-modal="true"
      onClick={handleExit}
    >
      <div className={styles.readerPanel} onClick={(event) => event.stopPropagation()}>
        <button type="button" className={styles.readerExit} onClick={handleExit}>
          Kilepes
        </button>
        <ReaderStage block={currentText} isClosing={closing} />
        {showEndPanel && (
          <div className={styles.readerEndPanel}>
            <p>{endCopy}</p>
            <div className={styles.readerEndActions}>
              <button type="button" className="btn btn--ghost" onClick={restart}>
                Ujrainditas
              </button>
              <button type="button" className="btn btn--primary" onClick={handleExit}>
                Vissza a terbe
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

