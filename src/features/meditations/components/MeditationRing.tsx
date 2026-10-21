"use client";

import type { Meditation, MeditationCategory } from "../lib/meditation-types";
import { buildRingLayout } from "../lib/meditation-layout";
import { getCategoryColor, getCategoryLabel } from "../lib/meditation-utils";
import styles from "../styles/meditations.module.css";

type Props = {
  meditations: Meditation[];
  hoveredId: string | null;
  selectedId: string | null;
  activeCategory: MeditationCategory | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
};

export default function MeditationRing({
  meditations,
  hoveredId,
  selectedId,
  activeCategory,
  onHover,
  onSelect,
}: Props) {
  const layout = buildRingLayout(meditations);

  return (
    <div className={styles.ring} role="group" aria-label="Meditációs gyöngygyűrű">
      {layout.map(({ meditation, angle, radiusMult, mobileAngle, mobileRadiusMult }) => {
        const isHovered = hoveredId === meditation.id;
        const isSelected = selectedId === meditation.id;
        const isMuted = activeCategory !== null && activeCategory !== meditation.category;
        const color = getCategoryColor(meditation.category);

        return (
          <button
            key={meditation.id}
            type="button"
            className={`${styles.bead} ${isHovered ? styles.beadHovered : ""} ${
              isSelected ? styles.beadSelected : ""
            } ${isMuted ? styles.beadMuted : ""}`}
            style={{
              ["--bead-angle" as string]: `${angle}deg`,
              ["--bead-glow" as string]: color,
              ["--bead-color" as string]: color,
              ["--bead-radius-mult" as string]: `${radiusMult}`,
              ["--bead-mobile-angle" as string]: `${mobileAngle}deg`,
              ["--bead-mobile-radius-mult" as string]: `${mobileRadiusMult}`,
            }}
            onMouseEnter={() => onHover(meditation.id)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(meditation.id)}
            onBlur={() => onHover(null)}
            onClick={() => onSelect(meditation.id)}
            aria-pressed={isSelected}
            aria-label={`${meditation.title} (${getCategoryLabel(meditation.category)})`}
          />
        );
      })}
    </div>
  );
}
