import Link from "next/link";
import { MeditationSpace, loadMeditations } from "@/features/meditations";
import styles from "@/features/meditations/styles/meditations.module.css";

export const metadata = {
  title: "Üveggyöngy meditációk",
  description: "Lassú, atmoszférikus meditációs tér",
};

export const dynamic = "force-dynamic";

export default async function MeditationPage() {
  const meditations = await loadMeditations();
  return (
    <>
      <Link href="/" className={styles.backLink} aria-label="Vissza a főoldalra">
        <span className={styles.backIcon} aria-hidden="true">
          ‹
        </span>
        <span className={styles.backLabel}>vissza</span>
      </Link>
      <MeditationSpace meditations={meditations} />
    </>
  );
}
