"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SpiritBook, SpiritLibrary, SpiritStatus } from "@/lib/spiritSchema";
import ShioriShelf from "./ShioriShelf";
import ShioriBookDetail from "./ShioriBookDetail";
import SpiritJsonTransfer from "./SpiritJsonTransfer";
import styles from "./SpiritLibraryApp.module.css";
import meditationStyles from "@/features/meditations/styles/meditations.module.css";

type Props = {
  library: SpiritLibrary;
  admin?: boolean;
  privateEnabled?: boolean;
  localStatusPreview?: boolean;
};

/** Shared Shiori reading room; private controls exist only on the authenticated admin route. */
export default function SpiritLibraryApp({ library, admin = false, privateEnabled = false, localStatusPreview = false }: Props) {
  // Never reuse admin-private client state when the route switches to public.
  // A new server snapshot is used synchronously, before effects run.
  const [local, setLocal] = useState(() => ({ source: library, snapshot: library }));
  useEffect(() => setLocal({ source: library, snapshot: library }), [library]);
  const canManagePrivate = admin && privateEnabled;
  const viewLibrary = canManagePrivate && local.source === library ? local.snapshot : library;
  const onBookSaved = (id: string, status: SpiritStatus, notes: string) => {
    if (!canManagePrivate) return;
    setLocal((current) => current.source !== library ? current : ({
      ...current, snapshot: { ...current.snapshot, books: current.snapshot.books.map((book) =>
        book.id === id ? { ...book, status, notes: notes || undefined } : book),
      },
    }));
  };
  const onPathSaved = (id: string, change: { progress?: number; comment?: { bookId: string; text: string } }) => {
    const { comment } = change;
    if (!canManagePrivate) return;
    setLocal((current) => current.source !== library ? current : ({
      ...current, snapshot: { ...current.snapshot, paths: current.snapshot.paths?.map((path) =>
        path.id !== id ? path : {
          ...path,
          ...(change.progress !== undefined ? { progress: change.progress } : {}),
          ...(comment ? { items: path.items?.map((item) =>
            item.book_id === comment.bookId
              ? { ...item, comment: comment.text || undefined }
              : item) } : {}),
        }),
      },
    }));
  };
  const [openedBookId, setOpenedBookId] = useState<string | null>(null);
  const openedBook: SpiritBook | null =
    viewLibrary.books.find((book) => book.id === openedBookId) ?? null;

  return (
    <section className={`${styles.page} ${styles.pageShelf} ${styles.pagePublic} admin-stack`}>
      {/* Use Tamayura's original back control, including its hover label. */}
      <Link href="/" className={`${meditationStyles.backLink} ${styles.shioriBackLink}`} aria-label="Vissza a főoldalra">
        <span className={meditationStyles.backIcon} aria-hidden="true">‹</span>
        <span className={`${meditationStyles.backLabel} ${styles.shioriBackLabel}`}>vissza</span>
      </Link>

      {admin && (
        <div className={styles.fabToolbar} role="group" aria-label="Könyvtár admin eszközök">
          <SpiritJsonTransfer triggerClassName={styles.addFab} />
        </div>
      )}

      <ShioriShelf
        fullscreen
        books={viewLibrary.books}
        paths={viewLibrary.paths ?? []}
        themePills={viewLibrary.thematic_pills}
        tagLabels={viewLibrary.tag_labels ?? {}}
        canManagePrivate={canManagePrivate}
        localStatusPreview={admin && !privateEnabled && localStatusPreview}
        onBookSaved={onBookSaved}
        onPathSaved={onPathSaved}
        onOpenBook={(book) => setOpenedBookId(book.id)}
      />

      {openedBook && (
        <ShioriBookDetail
          key={openedBook.id}
          initialBook={openedBook}
          books={viewLibrary.books}
          themePills={viewLibrary.thematic_pills}
          tagLabels={viewLibrary.tag_labels ?? {}}
          canManagePrivate={canManagePrivate}
          onBookSaved={onBookSaved}
          onClose={() => setOpenedBookId(null)}
        />
      )}
    </section>
  );
}
