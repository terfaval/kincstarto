"use client";

import type { ReaderTextBlock } from "../lib/meditation-types";
import styles from "../styles/meditations.module.css";

type Props = {
  block: ReaderTextBlock | null;
};

export default function ReaderTextBlock({ block }: Props) {
  if (!block) {
    return <p className={styles.readerPlaceholder}>...</p>;
  }

  return (
    <p
      key={block.content}
      className={`${styles.readerText} ${styles[`readerTone-${block.tone}`] ?? ""}`}
    >
      {block.content}
    </p>
  );
}

