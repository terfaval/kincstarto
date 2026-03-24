"use client";

import type { ReaderTextBlock } from "../lib/meditation-types";
import ReaderTextBlockView from "./ReaderTextBlock";
import styles from "../styles/meditations.module.css";

type Props = {
  block: ReaderTextBlock | null;
  isClosing: boolean;
};

export default function ReaderStage({ block, isClosing }: Props) {
  return (
    <div className={`${styles.readerStage} ${isClosing ? styles.readerStageClosing : ""}`}>
      <ReaderTextBlockView block={block} />
    </div>
  );
}

