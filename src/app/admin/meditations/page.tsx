import Link from "next/link";
import { loadMeditationAudioMap } from "@/features/audio/lib/audio-loaders";
import { MeditationSpace, loadMeditations } from "@/features/meditations";
import styles from "@/features/meditations/styles/meditations.module.css";
import { isAdminRequest } from "@/lib/adminAuth";

export const metadata = {
  title: "Meditációk (admin)",
  description: "Admin nézet: meditációs tér",
};

export const dynamic = "force-dynamic";

export default async function AdminMeditationsPage() {
  const meditations = await loadMeditations();
  const audioMap = await loadMeditationAudioMap();
  const isAdmin = await isAdminRequest();
  return (
    <>
      <Link href="/admin" className={styles.backLink} aria-label="Vissza az admin főoldalra">
        <span className={styles.backIcon} aria-hidden="true">
          ←
        </span>
        <span className={styles.backLabel}>vissza</span>
      </Link>
      <MeditationSpace meditations={meditations} audioMap={audioMap} isAdmin={isAdmin} />
    </>
  );
}
