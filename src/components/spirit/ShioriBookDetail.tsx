"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { ArrowLeft, X } from "lucide-react";
import type { SpiritBook, SpiritPill, SpiritStatus } from "@/lib/spiritSchema";
import ShioriPrivateBookPanel from "./ShioriPrivateBookPanel";
import { explicitShioriRelated } from "@/lib/shioriDetail";
import shelves from "./shioriShelves.json";
import styles from "./ShioriBookDetail.module.css";

type Entry = { id: string; left: number; right: number; single: number };
type Props = {
  initialBook: SpiritBook;
  books: SpiritBook[];
  themePills: SpiritPill[];
  tagLabels: Record<string, string>;
  onClose: () => void;
  embedded?: boolean;
  canManagePrivate?: boolean;
  onBookSaved?: (id: string, status: SpiritStatus, notes: string) => void;
};

const TONES = ["#269B81", "#486DB9", "#D35D62", "#E1B647", "#2799A6", "#8C64B7", "#D77E54"];
const FORMAT: Record<string, string> = { konyv: "Könyv", kommentar: "Kommentár", valogatas: "Válogatás", szutra: "Szútra", essze: "Esszé" };
const LEVEL: Record<string, string> = { kezdo: "Kezdő", "kozep-halado": "Közép-haladó", halado: "Haladó" };
const TRADITION: Record<string, string> = { taoizmus: "Taoizmus", buddhizmus: "Buddhizmus", vegyes: "Vegyes" };
const LANGUAGE: Record<string, string> = { hu: "Magyar", en: "Angol", egyeb: "Egyéb" };

function toneFor(book: SpiritBook): string {
  const index = shelves.shelves.findIndex((shelf) => shelf.id === book.primary_category_id || shelf.bookIds.includes(book.id));
  return TONES[index] ?? "#688477";
}
function variantFor(id: string): number {
  return Array.from(id).reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 17) % 4;
}
function emptyEntry(id: string): Entry { return { id, left: 0, right: 0, single: 0 }; }

export default function ShioriBookDetail({ initialBook, books, themePills, tagLabels, onClose, embedded = false, canManagePrivate = false, onBookSaved }: Props) {
  const [history, setHistory] = useState<Entry[]>(() => [emptyEntry(initialBook.id)]);
  const active = history[history.length - 1];
  const byId = useMemo(() => new Map(books.map((book) => [book.id, book])), [books]);
  const book = byId.get(active.id) ?? initialBook;
  const related = useMemo(() => explicitShioriRelated(book, books), [book, books]);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);

  // Restore the content position on returning from a related work.
  useLayoutEffect(() => {
    if (leftRef.current) leftRef.current.scrollTop = active.left;
    if (rightRef.current) rightRef.current.scrollTop = active.right;
    if (mobileRef.current) mobileRef.current.scrollTop = active.single;
    if (history.length > 1) backRef.current?.focus();
  }, [active, history.length]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    if (!embedded) return () => { if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [embedded]);

  const remember = (): Entry => ({
    ...active,
    left: leftRef.current?.scrollTop ?? 0,
    right: rightRef.current?.scrollTop ?? 0,
    single: mobileRef.current?.scrollTop ?? 0,
  });

  const navigate = (next: SpiritBook) => {
    if (next.id === active.id) return;
    const saved = remember();
    setHistory((prev) => [...prev.slice(0, -1), saved, emptyEntry(next.id)]);
  };
  const back = () => {
    if (history.length > 1) setHistory((prev) => prev.slice(0, -1));
  };

  const keyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab" || embedded || !rootRef.current) return;
    const items = Array.from(rootRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((item) => item.getClientRects().length > 0);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  const themeLabel = (id: string) => themePills.find((pill) => pill.slug === id)?.label ?? id;
  const tagLabel = (id: string) => tagLabels[id] ?? id;
  const note = (value: string, key: string) => value && <span className={styles.metaValue} key={key}>{value}</span>;
  const relatedSection = related.length > 0 && (
    <section className={styles.section} aria-label="Kapcsolódó művek">
      <h3>Kapcsolódó művek</h3>
      <div className={styles.relatedGrid}>
        {related.map((item) => (
          <button type="button" key={item.id} className={styles.relatedButton} onClick={() => navigate(item)} aria-label={`Kapcsolódó könyv megnyitása: ${item.title}`}>
            <span className={`${styles.miniCover} ${styles[`miniVariant${variantFor(item.id)}`]}`} style={{ "--related-tone": toneFor(item) } as CSSProperties}>
              <span aria-hidden="true" className={styles.miniMark}>栞</span>
              <strong>{item.title}</strong>
            </span>
            <span className={styles.relatedAuthor}>{item.author}</span>
          </button>
        ))}
      </div>
    </section>
  );
  const leftContent = (titleId: string) => (
    <>
      <p className={styles.kicker}>Shiori · Könyvtár</p>
      <h2 id={titleId} className={styles.bookTitle}>{book.title}</h2>
      <p className={styles.author}>{book.author}</p>
      <section className={styles.section}><h3>Rövid ismertető</h3><p>{book.summary_short}</p></section>
      <section className={styles.section}><h3>Kinek ajánlott?</h3><p>{book.recommendation}</p></section>
      {book.themes.length > 0 && <section className={styles.section}><h3>Kulcstémák</h3><div className={styles.pills}>{book.themes.map((id) => <span className={styles.pill} key={id}>{themeLabel(id)}</span>)}</div></section>}
    </>
  );
  const facts = [
    LEVEL[book.level] ?? book.level,
    ...(book.prerequisites ?? []).map((item) => `Előismeret: ${themeLabel(item)}`),
    LANGUAGE[book.language] ?? book.language,
    FORMAT[book.format] ?? book.format,
    book.year,
    TRADITION[book.tradition] ?? book.tradition,
  ].filter((item): item is string => Boolean(item));
  const rightContent = (
    <>
      {book.summary_long && <section className={styles.section}><h3>Részletes ismertető</h3><p>{book.summary_long}</p></section>}
      {!!book.tags?.length && <section className={styles.section}><h3>Címkék</h3><div className={styles.pills}>{book.tags.map((tag) => <span className={`${styles.pill} ${styles.pillSmall}`} key={tag}>{tagLabel(tag)}</span>)}</div></section>}
      {facts.length > 0 && <section className={styles.section}><h3>Olvasási tudnivalók</h3><div className={styles.pills}>{facts.map((item, index) => note(item, String(index)))}</div></section>}
      {book.cautions && <section className={styles.section}><h3>Mire érdemes figyelni?</h3><p>{book.cautions}</p></section>}
      {relatedSection}
      {canManagePrivate && onBookSaved && (
        <ShioriPrivateBookPanel key={book.id} book={book} onSaved={onBookSaved} />
      )}
    </>
  );

  return (
    <div ref={rootRef} className={embedded ? styles.embedded : styles.backdrop} role={embedded ? "region" : "dialog"} aria-label={`Könyvadatlap: ${book.title}`} aria-modal={!embedded ? true : undefined} onKeyDown={keyDown}>
      <div className={styles.bookFrame}>
        <div className={styles.toolbar}>
          <span className={styles.toolbarLabel}>Könyvadatlap</span>
          <div className={styles.actions}>
            {history.length > 1 && <button type="button" ref={backRef} onClick={back} className={styles.toolbarButton}><ArrowLeft size={16} aria-hidden="true" /> <span>Előző könyv</span></button>}
            <button type="button" ref={closeRef} onClick={onClose} className={styles.toolbarButton} aria-label={embedded ? "Vissza a könyvlistához" : "Könyvadatlap bezárása"}>{embedded ? <ArrowLeft size={17} aria-hidden="true" /> : <X size={17} aria-hidden="true" />} <span>{embedded ? "Vissza a listához" : "Bezárás"}</span></button>
          </div>
        </div>
        <div className={styles.spread}>
          <div ref={leftRef} className={`${styles.paperPage} ${styles.leftPage}`} tabIndex={0} aria-label="Bal könyvoldal">{leftContent("shiori-detail-title")}</div>
          <div ref={rightRef} className={`${styles.paperPage} ${styles.rightPage}`} tabIndex={0} aria-label="Jobb könyvoldal">{rightContent}</div>
          <div ref={mobileRef} className={styles.singlePage} tabIndex={0} aria-label="Könyvadatlap tartalma">{leftContent("shiori-detail-title-mobile")}{rightContent}</div>
        </div>
      </div>
    </div>
  );
}
