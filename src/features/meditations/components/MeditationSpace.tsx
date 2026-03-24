"use client";

import { useMemo, useState } from "react";
import type { Meditation, MeditationEndBehavior } from "../lib/meditation-types";
import { useMeditations } from "../hooks/useMeditations";
import MeditationCenterFocus from "./MeditationCenterFocus";
import MeditationRing from "./MeditationRing";
import MeditationPreviewPanel from "./MeditationPreviewPanel";
import MeditationReader from "./MeditationReader";
import styles from "../styles/meditations.module.css";

type Props = {
  meditations: Meditation[];
};

export default function MeditationSpace({ meditations: initialMeditations }: Props) {
  const meditations = useMeditations(initialMeditations);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [readerId, setReaderId] = useState<string | null>(null);
  const [readerOpen, setReaderOpen] = useState(false);
  const [readerCompleted, setReaderCompleted] = useState(false);

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

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setHoveredId(id);
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

  return (
    <section className={styles.space}>
      <div className={styles.spaceInner}>
        <MeditationCenterFocus meditation={focused} />
        <MeditationRing
          meditations={meditations}
          hoveredId={hoveredId}
          selectedId={selectedId}
          onHover={setHoveredId}
          onSelect={handleSelect}
        />
        {selected && !readerOpen && (
          <MeditationPreviewPanel
            meditation={selected}
            onEnter={() => {
              openReader();
            }}
          />
        )}
        {readerCompleted && !readerOpen && (
          <div className={styles.readerReturnHint}>A csend marad. Valassz ujra.</div>
        )}
      </div>
      {readerOpen && readerMeditation && (
        <MeditationReader
          meditation={readerMeditation}
          onExit={closeReader}
          onComplete={handleReaderComplete}
        />
      )}
    </section>
  );
}

