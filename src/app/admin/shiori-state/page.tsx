/** Admin-only display of one-reader progress and internal editorial notes. */
import Link from "next/link";
import { loadSpiritLibrary } from "@/lib/spiritLibrary";
import { privateShioriReady } from "@/lib/shioriPrivateBlob";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shiori · Belső állapot · Kincstartó" };

const LABEL: Record<string, string> = {
  olvasatlan: "Olvasatlan", folyamatban: "Folyamatban",
  befejezett: "Befejezett", referencia: "Referencia",
};

export default async function ShioriStatePage() {
  // The parent /admin layout verifies the signed administrator session.
  if (!privateShioriReady()) {
    return (
      <main className={styles.page}>
        <Link href="/admin">← Shiori admin</Link>
        <h1>Belső állapot</h1>
        <p>Az adatátvitel utáni privát olvasás még nincs aktiválva.</p>
      </main>
    );
  }
  // Read the verified public projection and the private Blob, and never fall back to local legacy data.
  const library = await loadSpiritLibrary({ includePrivate: true });
  const visible = library.books.filter((book) => book.status !== "olvasatlan" || Boolean(book.notes));
  const paths = library.paths ?? [];
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div><Link href="/admin">← Shiori admin</Link><p className={styles.kicker}>Kizárólag admin · privát tároló</p><h1>Belső állapot</h1></div>
        <p className={styles.summary}>{library.books.length} könyv · {paths.length} olvasási út</p>
      </header>
      <p className={styles.intro}>Az olvasottság, az útvonalak haladása és a belső szerkesztői jegyzetek nem részei a nyilvános könyvadatlapoknak. Ez a nézet csak olvasásra szolgál.</p>
      <section className={styles.section} aria-label="Olvasottsági és belső jegyzetek">
        <h2>Könyvek · {visible.length} bejegyzés</h2>
        <p>A többi könyv olvasatlan, belső jegyzet nélkül.</p>
        <div className={styles.cards}>
          {visible.map((book) => (
            <article key={book.id} className={styles.card}>
              <div className={styles.cardHeading}><strong>{book.title}</strong><span>{LABEL[book.status] ?? book.status}</span></div>
              <small>{book.author}</small>
              {book.notes && <div className={styles.notes}><strong>Belső szerkesztői jegyzet</strong><p>{book.notes}</p></div>}
            </article>
          ))}
        </div>
      </section>
      <section className={styles.section} aria-label="Olvasási utak előrehaladása">
        <h2>Olvasási utak · {paths.length}</h2>
        <div className={styles.cards}>
          {paths.map((path) => (
            <article key={path.id} className={styles.card}>
              <div className={styles.cardHeading}><strong>{path.title}</strong><span>{path.progress ?? 0}%</span></div>
              <small>{path.items?.length ?? path.book_ids?.length ?? 0} könyv</small>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
