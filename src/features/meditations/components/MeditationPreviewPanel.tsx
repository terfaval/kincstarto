"use client";

import type { Meditation } from "../lib/meditation-types";
import { formatDuration, getCategoryLabel } from "../lib/meditation-utils";
import styles from "../styles/meditations.module.css";

type Props = {
  meditation: Meditation;
  onEnter: () => void;
};

export default function MeditationPreviewPanel({ meditation, onEnter }: Props) {
  return (
    <aside className={styles.previewPanel} aria-live="polite">
      <div className={styles.previewHeader}>
        <span className={styles.previewCategory}>{getCategoryLabel(meditation.category)}</span>
        <h3 className={styles.previewTitle}>{meditation.title}</h3>
      </div>
      <p className={styles.previewSummary}>{meditation.summary_short}</p>
      <div className={styles.previewMeta}>
        <span>{formatDuration(meditation.duration_sec)}</span>
        <span className={styles.previewDot}>•</span>
        <span>{meditation.level.replace("-", " ")}</span>
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
        Belepes
      </button>
    </aside>
  );
}
