"use client";

import type { Meditation } from "../lib/meditation-types";
import { buildRingLayout } from "../lib/meditation-layout";
import { getCategoryColor } from "../lib/meditation-utils";
import styles from "../styles/meditations.module.css";

type Props = {
  meditations: Meditation[];
  hoveredId: string | null;
  selectedId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
};

export default function MeditationRing({ meditations, hoveredId, selectedId, onHover, onSelect }: Props) {
  const layout = buildRingLayout(meditations);

  return (
    <div className={styles.ring} aria-label="Meditacios gyuru">
      {layout.map(({ meditation, angle }) => {
        const isHovered = hoveredId === meditation.id;
        const isSelected = selectedId === meditation.id;
        const color = getCategoryColor(meditation.category);

        return (
          <button
            key={meditation.id}
            type="button"
            className={`${styles.bead} ${isHovered ? styles.beadHovered : ""} ${
              isSelected ? styles.beadSelected : ""
            }`}
            style={{
              ["--bead-angle" as any]: `${angle}deg`,
              ["--bead-glow" as any]: color,
            }}
            onMouseEnter={() => onHover(meditation.id)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(meditation.id)}
            onBlur={() => onHover(null)}
            onClick={() => onSelect(meditation.id)}
            aria-label={`${meditation.title} (${meditation.category})`}
          />
        );
      })}
    </div>
  );
}
