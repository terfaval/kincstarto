"use client";

import type { Meditation } from "../lib/meditation-types";
import { getCategoryLabel } from "../lib/meditation-utils";
import styles from "../styles/meditations.module.css";

export default function MeditationCenterFocus({ meditation }: { meditation: Meditation | null }) {
  if (!meditation) {
    return (
      <div className={styles.centerFocus}>
        <p className={styles.centerHint}>Engedd, hogy a figyelmed lassan megálljon.</p>
        <span className={styles.centerSubtle}>Érints meg egy gyöngyöt.</span>
      </div>
    );
  }

  return (
    <div className={styles.centerFocus}>
      <span className={styles.centerCategory}>{getCategoryLabel(meditation.category)}</span>
      <h2 className={styles.centerTitle}>{meditation.title}</h2>
    </div>
  );
}
