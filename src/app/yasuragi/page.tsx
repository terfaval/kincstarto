import type { Metadata } from "next";
import Link from "next/link";
import { listCurrentPublicPractices } from "@/features/yasuragi/lib/practice-public-read";
import styles from "@/features/yasuragi/styles/YasuragiPublic.module.css";

export const metadata: Metadata = { title: "Yasuragi – Gyakorlások | Kincstartó" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function YasuragiCatalogue() {
  let practices: Awaited<ReturnType<typeof listCurrentPublicPractices>> = [];
  let unavailable = false;
  try { practices = await listCurrentPublicPractices(); }
  catch { unavailable = true; }
  return <main className={styles.page}>
    <div className={styles.shell}>
      <nav className={styles.back}><Link href="/">← Kincstartó</Link></nav>
      <header className={styles.header}>
        <p className={styles.kicker}>安らぎ · YASURAGI</p>
        <h1>Gyakorlások</h1>
        <p>Válassz egy gyakorlást, amelyet most szívesen követnél. A lejátszó csak az Indítás után nyílik meg.</p>
      </header>
      {unavailable ? <div className={styles.empty} role="alert">A gyakorlások listája átmenetileg nem érhető el. Próbáld meg később.</div> :
       practices.length === 0 ? <div className={styles.empty}>Még nincs közzétett gyakorlás. A tervezetek és a belső próbák itt nem jelennek meg.</div> :
       <ul className={styles.catalogue}>
         {practices.map((practice) => <li key={practice.practiceId}>
           <Link href={`/yasuragi/${encodeURIComponent(practice.practiceId)}`} className={styles.practiceCard}>
             <span className={styles.cardAccent} aria-hidden="true" />
             <span className={styles.cardBody}><strong>{practice.title}</strong><small>{Math.round(practice.durationSec / 60)} perc · {practice.version}</small></span>
             <span className={styles.cardAction} aria-hidden="true">Megnézem →</span>
           </Link>
         </li>)}
       </ul>}
    </div>
  </main>;
}
