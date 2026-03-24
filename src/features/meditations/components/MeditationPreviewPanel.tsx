"use client";

import type { Meditation } from "../lib/meditation-types";
import { formatDuration, getCategoryLabel } from "../lib/meditation-utils";
import styles from "../styles/meditations.module.css";

type Props = {
  meditation: Meditation;
  onEnter: () => void;
  onClose: () => void;
};

export default function MeditationPreviewPanel({ meditation, onEnter, onClose }: Props) {
  const levelDots = Math.max(1, Math.min(3, Number(meditation.level)));

  return (
    <aside className={styles.previewPanel} aria-live="polite" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className={styles.previewClose}
        onClick={onClose}
        aria-label="Bezárás"
      >
        X
      </button>
      <div className={styles.previewHeader}>
        <span className={styles.previewCategory}>{getCategoryLabel(meditation.category)}</span>
        <h3 className={styles.previewTitle}>{meditation.title}</h3>
      </div>
      <p className={styles.previewSummary}>{meditation.summary_short}</p>
      <div className={styles.previewMeta}>
        <span>{formatDuration(meditation.duration_sec)}</span>
        <span className={styles.previewDot}>•</span>
        <div className={styles.previewLevelDots} aria-label={`Szint ${meditation.level}`}>
          {Array.from({ length: 3 }).map((_, idx) => (
            <span
              key={`${meditation.id}-level-${idx}`}
              className={`${styles.levelDot} ${idx < levelDots ? styles.levelDotActive : ""}`}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
      <div className={styles.previewModeRow}>
        <span className={`${styles.modePill} ${styles[`mode${meditation.meditation_mode}` as const]}`}>
          {meditation.meditation_mode}
        </span>
      </div>
      {meditation.techniques.length > 0 && (
        <div className={styles.previewTags}>
          {meditation.techniques.slice(0, 3).map((technique) => (
            <span key={technique} className={styles.previewTag}>
              {technique}
            </span>
          ))}
        </div>
      )}
      <button type="button" className={`${styles.previewButton} btn btn--primary`} onClick={onEnter}>
        Indítás
      </button>
    </aside>
  );
}
