import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PUBLICATION_ID } from "@/features/yasuragi/lib/practice-release-core";
import { readCurrentPublicPractice } from "@/features/yasuragi/lib/practice-public-read";
import styles from "@/features/yasuragi/styles/YasuragiPublic.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;
type Props = { params: Promise<{ practiceId: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { practiceId } = await params;
  if (!PUBLICATION_ID.test(practiceId)) return { title: "Gyakorlás nem található | Yasuragi" };
  const release = await readCurrentPublicPractice(practiceId).catch(() => null);
  return { title: release ? `${release.title} | Yasuragi` : "Gyakorlás nem található | Yasuragi" };
}
export default async function YasuragiPracticeDetail({ params }: Props) {
  const { practiceId } = await params;
  if (!PUBLICATION_ID.test(practiceId)) notFound();
  const release = await readCurrentPublicPractice(practiceId);
  if (!release) notFound();
  return <main className={styles.page}><div className={styles.shell}>
    <nav className={styles.back}><Link href="/yasuragi">← Vissza a gyakorlásokhoz</Link></nav>
    <section className={styles.detail}>
      <p className={styles.kicker}>YASURAGI · GYAKORLÁS</p>
      <h1>{release.title}</h1>
      <p className={styles.duration}>{Math.round(release.durationSec / 60)} perc · {release.version}</p>
      <p>A gyakorlás lejátszása a következő oldalon indulhat el. A kezdésről és a szüneteltetésről te döntesz.</p>
      <Link className={styles.start} href={`/yasuragi/${encodeURIComponent(practiceId)}/play`}>Indítás →</Link>
    </section>
  </div></main>;
}
