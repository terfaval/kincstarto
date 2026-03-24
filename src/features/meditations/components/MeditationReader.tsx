"use client";

import { useEffect, useMemo, useState } from "react";
import type { Meditation, MeditationEndBehavior } from "../lib/meditation-types";
import { useReaderEngine } from "../hooks/useReaderEngine";
import ReaderStage from "./ReaderStage";
import styles from "../styles/meditations.module.css";

type Props = {
  meditation: Meditation;
  onExit: () => void;
  onComplete: (behavior: MeditationEndBehavior) => void;
};

export default function MeditationReader({ meditation, onExit, onComplete }: Props) {
  const { status, currentText, start, restart, stop } = useReaderEngine(meditation);
  const [closing, setClosing] = useState(false);
  const [completed, setCompleted] = useState(false);

  const endBehavior = useMemo(() => meditation.reader.end_behavior, [meditation.reader.end_behavior]);

  useEffect(() => {
    start();
  }, [start, meditation.id]);

  useEffect(() => {
    if (status !== "ended" || completed) return;
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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        stop();
        onExit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit, stop]);

  const showEndPanel = status === "ended" && endBehavior !== "fade_out";
  const endCopy = endBehavior === "complete" ? "Meditacio befejezve." : "Lassan terj vissza.";

  const handleExit = () => {
    stop();
    onExit();
  };

  return (
    <div
      className={`${styles.readerOverlay} ${closing ? styles.readerOverlayClosing : ""}`}
      role="dialog"
      aria-modal="true"
    >
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
  );
}

