"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { BookOpen, Bookmark, Check, Circle, Search, SlidersHorizontal, X, ChevronLeft, ChevronRight, ChevronDown, ArrowLeft } from "lucide-react";
import type { SpiritBook, SpiritPath, SpiritPill, SpiritStatus } from "@/lib/spiritSchema";
import ShioriPrivatePathPanel from "./ShioriPrivatePathPanel";
import { orderShioriBooks } from "@/lib/shioriCatalog";
import shelfPlan from "./shioriShelves.json";
import styles from "./ShioriShelf.module.css";
import ShioriBookDetail from "./ShioriBookDetail";

type Shelf = (typeof shelfPlan.shelves)[number];
type Group = Shelf & { books: SpiritBook[] };
type Collection = { kind: "all" | "category" | "path"; id: string | null };
type FilterGroup = "categories" | "themes" | "tags" | "traditions" | "levels" | "formats" | "languages";
type Filters = Record<FilterGroup, string[]>;
type Props = {
  fullscreen?: boolean;
  books: SpiritBook[];
  paths: SpiritPath[];
  themePills: SpiritPill[];
  tagLabels: Record<string, string>;
  onOpenBook: (book: SpiritBook) => void;
  canManagePrivate?: boolean;
  localStatusPreview?: boolean;
  onBookSaved?: (id: string, status: SpiritStatus, notes: string) => void;
  onPathSaved?: (id: string, change: { progress?: number; comment?: { bookId: string; text: string } }) => void;
};

const EMPTY_FILTERS: Filters = { categories: [], themes: [], tags: [], traditions: [], levels: [], formats: [], languages: [] };
const FILTER_GROUPS: FilterGroup[] = ["categories", "themes", "tags", "traditions", "levels", "formats", "languages"];
const CATEGORIES = shelfPlan.shelves;
const ALL_IDS = new Set(CATEGORIES.flatMap((item) => item.bookIds));
const COLOR = ["#269B81", "#486DB9", "#D35D62", "#E1B647", "#2799A6", "#8C64B7", "#D77E54"];
const COPY = {
  heading: "A k\u00f6nyvt\u00e1r polcai",
  all: "Teljes k\u00f6nyvt\u00e1r",
  topics: "T\u00e9m\u00e1k",
  paths: "Olvas\u00e1si utak",
  search: "Keres\u00e9s \u00e9s sz\u0171r\u00e9s",
  query: "Keres\u00e9s c\u00edmben, szerz\u0151ben, t\u00e9m\u00e1ban\u2026",
  empty: "Ehhez a v\u00e1laszt\u00e1shoz most nincs tal\u00e1lat.",
  back: "Vissza a v\u00e1logat\u00e1shoz",
  clear: "Sz\u0171r\u0151k t\u00f6rl\u00e9se",
  close: "Panel bez\u00e1r\u00e1sa",
  detail: "K\u00f6nyvadatlap",
  returnCover: "Vissza a bor\u00edt\u00f3hoz",
  noSelection: "V\u00e1lassz egy k\u00f6nyvgerincet a polcr\u00f3l.",
  category: "Els\u0151dleges kateg\u00f3ri\u00e1k",
  themes: "R\u00e9szletes t\u00e9m\u00e1k",
  tags: "C\u00edmk\u00e9k",
  traditions: "Trad\u00edci\u00f3k",
  levels: "Olvas\u00e1si szint",
  formats: "Form\u00e1tum",
  languages: "Nyelv",
  short: "R\u00f6vid ismertet\u0151",
  long: "R\u00e9szletes ismertet\u0151",
  recommended: "Kinek aj\u00e1nlott?",
  cautions: "Mire \u00e9rdemes figyelni?",
  related: "Kapcsol\u00f3d\u00f3 k\u00f6nyvek",
  searchResults: "Keres\u00e9si tal\u00e1latok",
  unassigned: "Besorol\u00e1sra v\u00e1r\u00f3 k\u00f6nyvek",
  unknown: "A k\u00f6nyvt\u00e1r jelenleg \u00fcres.",
};

function normalized(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("hu").trim();
}
function pathIds(path: SpiritPath): string[] {
  return path.items?.map((item) => item.book_id) ?? path.book_ids ?? [];
}
function hashId(id: string): number {
  return Array.from(id).reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 17);
}
function coverVariant(book: SpiritBook): number {
  const variants = ["pigment", "split_fields", "abstract_mark", "color_rhythm"];
  const edited = variants.indexOf(book.cover_family ?? "");
  return edited >= 0 ? edited : hashId(book.id + ":cover") % 4;
}
function spineVariant(book: SpiritBook): number {
  const variants = ["cloth", "split_band", "paper_label", "soft_patch"];
  const edited = variants.indexOf(book.spine_family ?? "");
  return edited >= 0 ? edited : hashId(book.id + ":spine") % 4;
}
function bookStyle(book: SpiritBook, categoryId: string | null): CSSProperties {
  const index = CATEGORIES.findIndex((item) => item.id === (book.primary_category_id || categoryId));
  const tone = index < 0 ? "#8b8072" : COLOR[index];
  const hash = hashId(book.id);
  return { "--book-tone": tone, "--book-height": `${82 + hash % 15}%` } as CSSProperties;
}

const LOCAL_SAMPLE_STATUSES: SpiritStatus[] = ["olvasatlan", "folyamatban", "befejezett", "referencia"];

function coverStatusForBook(book: SpiritBook, canManagePrivate: boolean, localStatusPreview: boolean): SpiritStatus | null {
  if (canManagePrivate) return book.status;
  // Visual-only development sample. It is NOT the user's real reading state.
  if (localStatusPreview) return LOCAL_SAMPLE_STATUSES[hashId(book.id) % LOCAL_SAMPLE_STATUSES.length];
  return null;
}

const STATUS_LABELS: Record<SpiritStatus, string> = {
  olvasatlan: "Olvasatlan",
  folyamatban: "Folyamatban",
  befejezett: "Befejezett",
  referencia: "Referencia",
};

/** The status marker is mounted only on the authenticated admin book cover. */
function PrivateCoverStatus({ status }: { status: SpiritStatus }) {
  const Icon = status === "folyamatban" ? BookOpen
    : status === "befejezett" ? Check
    : status === "referencia" ? Bookmark : Circle;
  return (
    <span className={styles.coverStatus} aria-hidden="true">
      <Icon size={15} strokeWidth={2.1} />
    </span>
  );
}

export default function ShioriShelf({ fullscreen = false, books, paths, themePills, tagLabels, onOpenBook, canManagePrivate = false, localStatusPreview = false, onBookSaved, onPathSaved }: Props) {
  const [mobile, setMobile] = useState(false);
  const [collection, setCollection] = useState<Collection>({ kind: "all", id: null });
  const [navTab, setNavTab] = useState<"categories" | "paths">("categories");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [spinePage, setSpinePage] = useState(0);
  const [spinesPerPage, setSpinesPerPage] = useState(10);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filterPanel, setFilterPanel] = useState(false);
  const [detailStack, setDetailStack] = useState<string[]>([]);
  const deckRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const mobileCoverRef = useRef<HTMLButtonElement>(null);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const desktopFilterRef = useRef<HTMLButtonElement>(null);
  const browseSnapshot = useRef<{ selectedId: string | null; spinePage: number; listY: number } | null>(null);
  const wheelTurnAt = useRef(0);
  const swipeStartX = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 700px)");
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!filterPanel) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFilterPanel(false);
        (mobile ? filterTriggerRef : desktopFilterRef).current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [filterPanel, mobile]);

  const groups = useMemo(() => {
    const byId = new Map(books.map((book) => [book.id, book]));
    const result: Group[] = CATEGORIES.map((shelf) => ({
      ...shelf,
      books: orderShioriBooks(shelf.bookIds.flatMap((id) => {
        const book = byId.get(id);
        return book ? [book] : [];
      })),
    }));
    const unassigned = books.filter((book) => !ALL_IDS.has(book.id));
    if (unassigned.length) {
      result.push({
        id: "unassigned", title: COPY.unassigned, description: "", featured: "",
        color: "#788580", themeHints: [], bookIds: unassigned.map((book) => book.id),
        books: orderShioriBooks(unassigned),
      });
    }
    return result;
  }, [books]);

  const sortedAll = useMemo(() => orderShioriBooks(books), [books]);
  const byId = useMemo(() => new Map(books.map((book) => [book.id, book])), [books]);
  const groupByBook = useMemo(() => {
    const map = new Map<string, string>();
    groups.forEach((group) => group.books.forEach((book) => map.set(book.id, group.id)));
    return map;
  }, [groups]);
  const collectionBooks = useMemo(() => {
    if (collection.kind === "all") return sortedAll;
    if (collection.kind === "category") return groups.find((g) => g.id === collection.id)?.books ?? [];
    const path = paths.find((p) => p.id === collection.id);
    if (!path) return [];
    return orderShioriBooks(pathIds(path).flatMap((id) => {
      const book = byId.get(id);
      return book ? [book] : [];
    }));
  }, [collection, sortedAll, groups, paths, byId]);

  const searchActive = Boolean(query.trim()) || FILTER_GROUPS.some((key) => filters[key].length > 0);
  const shownBooks = useMemo(() => {
    if (!searchActive) return collectionBooks;
    const needle = normalized(query);
    return sortedAll.filter((book) => {
      const labelText = book.themes.map((slug) => themePills.find((pill) => pill.slug === slug)?.label ?? slug);
      const tags = (book.tags ?? []).map((tag) => tagLabels[tag] ?? tag);
      const content = normalized([book.title, book.author, book.summary_short, book.summary_long ?? "", ...labelText, ...tags].join(" "));
      if (needle && !content.includes(needle)) return false;
      const values: Record<FilterGroup, string[]> = {
        categories: [book.primary_category_id || groupByBook.get(book.id) || ""],
        themes: book.themes, tags: book.tags ?? [], traditions: [book.tradition],
        levels: [book.level], formats: [book.format], languages: [book.language],
      };
      return FILTER_GROUPS.every((key) => filters[key].length === 0 || filters[key].some((value) => values[key].includes(value)));
    });
  }, [searchActive, collectionBooks, sortedAll, query, filters, themePills, tagLabels, groupByBook]);

  // Only complete spines are mounted on a page. A clipped scroll container or
  // scroll-snap alone cannot guarantee a whole spine at the right-hand edge.
  useLayoutEffect(() => {
    if (mobile || !deckRef.current) return;
    const deck = deckRef.current;
    const measure = () => {
      const computed = getComputedStyle(deck);
      const padding = (parseFloat(computed.paddingLeft) || 0) + (parseFloat(computed.paddingRight) || 0);
      const gap = parseFloat(computed.columnGap) || 4;
      const firstSpine = deck.querySelector<HTMLButtonElement>(`button.${styles.spine}`);
      const spineWidth = firstSpine?.getBoundingClientRect().width || Math.min(50, Math.max(33, window.innerWidth * .0315));
      const available = Math.max(0, deck.clientWidth - padding);
      setSpinesPerPage(Math.max(1, Math.floor((available + gap) / (spineWidth + gap))));
    };
    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(deck);
    return () => resizeObserver.disconnect();
  }, [mobile, shownBooks.length]);

  const pageCount = Math.max(1, Math.ceil(shownBooks.length / spinesPerPage));
  const activePage = Math.min(spinePage, pageCount - 1);
  const pageStart = activePage * spinesPerPage;
  const visibleSpines = shownBooks.slice(pageStart, pageStart + spinesPerPage);

  const current = shownBooks.find((book) => book.id === selectedId) ?? (mobile ? shownBooks[0] : null) ?? null;
  const currentCoverStatus = current ? coverStatusForBook(current, canManagePrivate, localStatusPreview) : null;
  const detailBook = detailStack.length ? byId.get(detailStack[0]) ?? null : null;
  const currentPath = paths.find((path) => path.id === collection.id);
  const currentGroup = groups.find((group) => group.id === collection.id);
  const heading = searchActive ? COPY.searchResults : collection.kind === "all" ? COPY.all : collection.kind === "path" ? (currentPath?.title ?? COPY.paths) : (currentGroup?.title ?? COPY.all);
  const colorIndex = collection.kind === "category" ? CATEGORIES.findIndex((g) => g.id === collection.id) : -1;
  const palette = colorIndex < 0 ? "#74877c" : COLOR[colorIndex];
  const stageStyle = { "--category-accent": palette } as CSSProperties;

  const chooseCollection = (next: Collection) => {
    setCollection(next);
    setSelectedId(null);
    setSpinePage(0);
    setDetailStack([]);
    setQuery("");
    setFilters(EMPTY_FILTERS);
    browseSnapshot.current = null;
    setFilterPanel(false);
    listRef.current?.scrollTo({ top: 0 });
  };
  const rememberBrowse = () => {
    if (!searchActive && !browseSnapshot.current) {
      browseSnapshot.current = { selectedId, spinePage: activePage, listY: listRef.current?.scrollTop ?? 0 };
    }
  };
  const changeQuery = (next: string) => {
    if (!next.trim() && FILTER_GROUPS.every((key) => filters[key].length === 0) && browseSnapshot.current) {
      backToBrowse();
      return;
    }
    if (next.trim()) rememberBrowse();
    setSpinePage(0);
    setQuery(next);
  };
  const changeFilter = (key: FilterGroup, value: string) => {
    rememberBrowse();
    setSpinePage(0);
    setFilters((currentFilters) => ({
      ...currentFilters,
      [key]: currentFilters[key].includes(value)
        ? currentFilters[key].filter((item) => item !== value)
        : [...currentFilters[key], value],
    }));
  };
  const backToBrowse = () => {
    const snapshot = browseSnapshot.current;
    setQuery("");
    setFilters(EMPTY_FILTERS);
    setSelectedId(snapshot?.selectedId ?? null);
    setSpinePage(snapshot?.spinePage ?? 0);
    setDetailStack([]);
    setFilterPanel(false);
    browseSnapshot.current = null;
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = snapshot?.listY ?? 0;
    });
  };
  const openBook = (book: SpiritBook) => {
    if (mobile) setDetailStack([book.id]);
    else onOpenBook(book);
  };
  const selectBook = (book: SpiritBook) => {
    setSelectedId(book.id);
    setDetailStack([]);
  };
  const filterOptions: Record<FilterGroup, { value: string; label: string }[]> = {
    categories: groups.map((g) => ({ value: g.id, label: g.title })),
    themes: themePills.map((t) => ({ value: t.slug, label: t.label })),
    tags: Object.entries(tagLabels).map(([value, label]) => ({ value, label })),
    traditions: [...new Set(books.map((book) => book.tradition))].map((v) => ({ value: v, label: v })),
    levels: [...new Set(books.map((book) => book.level))].map((v) => ({ value: v, label: v })),
    formats: [...new Set(books.map((book) => book.format))].map((v) => ({ value: v, label: v })),
    languages: [...new Set(books.map((book) => book.language))].map((v) => ({ value: v, label: v })),
  };
  const activeFilterChips = FILTER_GROUPS.flatMap((key) =>
    filters[key].map((value) => ({
      key,
      value,
      label: filterOptions[key].find((option) => option.value === value)?.label ?? value,
    })),
  );
  const closeFilters = () => {
    setFilterPanel(false);
    (mobile ? filterTriggerRef : desktopFilterRef).current?.focus();
  };

  return (
    <section className={`${styles.shell} ${fullscreen ? styles.fullscreen : ""}`} style={stageStyle} aria-label={COPY.heading}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandSeal} aria-hidden="true" />
          <h1>Shiori <span>{COPY.heading}</span></h1>
        </div>
        <div className={styles.desktopSearch}>
          <label className={styles.searchInput}>
            <Search size={17} aria-hidden="true" />
            <span className={styles.visuallyHidden}>{COPY.query}</span>
            <input type="search" value={query} onChange={(e) => changeQuery(e.target.value)} placeholder={COPY.query} />
          </label>
          <button type="button" ref={desktopFilterRef} className={styles.searchFilterButton} onClick={() => setFilterPanel(true)} aria-label="Szűrők megnyitása" aria-expanded={filterPanel}>
            <SlidersHorizontal size={17} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className={styles.room}>
        <aside className={styles.wall} aria-label="Shiori navigation">
          <div className={styles.wallHeader}>
            <div className={styles.wallHeaderBrand}>
              <span className={styles.brandSeal} aria-hidden="true" />
              <div className={styles.wallHeaderText}>
                <span className={styles.wallHeaderEyebrow}>Könyvtár</span>
                <strong>Shiori</strong>
              </div>
            </div>
          </div>
          <div className={styles.wallTabs} role="tablist" aria-label="Shiori collection type">
            <button type="button" role="tab" aria-selected={navTab === "categories"} onClick={() => setNavTab("categories")}>{COPY.topics}</button>
            <button type="button" role="tab" aria-selected={navTab === "paths"} onClick={() => setNavTab("paths")}>{COPY.paths}</button>
          </div>
          <div className={styles.wallRows}>
            {navTab === "categories" ? (
              <>
                <button type="button" className={`${styles.wallRow} ${!searchActive && collection.kind === "all" ? styles.wallRowActive : ""}`} onClick={() => chooseCollection({ kind: "all", id: null })} aria-current={!searchActive && collection.kind === "all" ? "true" : undefined}>
                  <span>{COPY.all}</span><span className={styles.wallCount}>{books.length}</span><span className={styles.neutralDot} />
                </button>
                {groups.map((group) => (
                  <button key={group.id} type="button" className={`${styles.wallRow} ${!searchActive && collection.kind === "category" && collection.id === group.id ? styles.wallRowActive : ""}`} onClick={() => chooseCollection({ kind: "category", id: group.id })} aria-current={!searchActive && collection.kind === "category" && collection.id === group.id ? "true" : undefined}>
                    <span>{group.title}</span><span className={styles.wallCount}>{group.books.length}</span><span className={styles.categoryDot} style={{ background: COLOR[CATEGORIES.findIndex((c) => c.id === group.id)] ?? "#87918b" }} />
                  </button>
                ))}
              </>
            ) : (
              paths.map((path) => (
                <button key={path.id} type="button" className={`${styles.wallRow} ${!searchActive && collection.kind === "path" && collection.id === path.id ? styles.wallRowActive : ""}`} onClick={() => chooseCollection({ kind: "path", id: path.id })} aria-current={!searchActive && collection.kind === "path" && collection.id === path.id ? "true" : undefined}>
                  <span>{path.title}</span><span className={styles.wallCount}>{new Set(pathIds(path).filter((id) => byId.has(id))).size}</span><span className={styles.neutralDot} />
                </button>
              ))
            )}
          </div>
        </aside>

        <div className={styles.mainArea}>
          <div className={styles.sectionHeading}>
            <div className={styles.sectionName}><span className={styles.eyebrow}>Shiori / {shownBooks.length}</span><h2>{heading}</h2></div>
            <div className={styles.headingActions}>
              {searchActive && <button type="button" onClick={backToBrowse} className={styles.restoreButton}><ArrowLeft size={16} aria-hidden="true" />{COPY.back}</button>}
            </div>
          </div>
          {canManagePrivate && collection.kind === "path" && currentPath && onPathSaved && (
            <ShioriPrivatePathPanel key={currentPath.id} path={currentPath} books={books} onSaved={onPathSaved} />
          )}
          <div className={styles.desktopStage}>
            {shownBooks.length === 0 ? (
              <div className={styles.empty}><BookOpen size={27} /><p>{COPY.empty}</p></div>
            ) : (
              <>
                <div className={styles.spineFrame}>
                  <div className={styles.spines} ref={deckRef} role="group" tabIndex={0} aria-label="Könyvgerincek"
                    onWheel={(event) => {
                      // Horizontal trackpad gestures page by complete book groups.
                      if (Math.abs(event.deltaX) < 15 || Date.now() - wheelTurnAt.current < 420) return;
                      wheelTurnAt.current = Date.now();
                      setSpinePage((page) => Math.max(0, Math.min(pageCount - 1, page + (event.deltaX > 0 ? 1 : -1))));
                    }}
                    onTouchStart={(event) => { swipeStartX.current = event.touches[0]?.clientX ?? null; }}
                    onTouchEnd={(event) => {
                      const from = swipeStartX.current;
                      const to = event.changedTouches[0]?.clientX;
                      swipeStartX.current = null;
                      if (from === null || to === undefined || Math.abs(from - to) < 55) return;
                      setSpinePage((page) => Math.max(0, Math.min(pageCount - 1, page + (from > to ? 1 : -1))));
                    }}
                    onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === "ArrowRight" && activePage < pageCount - 1) { event.preventDefault(); setSpinePage(activePage + 1); }
                    if (event.key === "ArrowLeft" && activePage > 0) { event.preventDefault(); setSpinePage(activePage - 1); }
                  }}>
                  {visibleSpines.map((book) => {
                    const active = current?.id === book.id;
                    return (
                      <button key={book.id} type="button" className={`${styles.spine} ${active ? styles.spineSelected : ""} ${styles[`spineFamily${spineVariant(book)}`]}`} style={bookStyle(book, groupByBook.get(book.id) ?? null)} aria-pressed={active} aria-label={`${book.author} - ${book.title}`} title={`${book.author}: ${book.title}`} onClick={() => selectBook(book)} onDoubleClick={() => onOpenBook(book)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onOpenBook(book); } }}>
                        <span className={styles.spineAuthor}>{book.author}</span><span className={styles.spineTitle}>{book.title}</span>
                      </button>
                    );
                  })}
                  </div>
                  {pageCount > 1 && <nav className={styles.spinePager} aria-label="Könyvgerincek lapozása">
                    <button type="button" disabled={activePage === 0} aria-label="Előző könyvek" onClick={() => setSpinePage(activePage - 1)}><ChevronLeft size={16} aria-hidden="true" /></button>
                    <button type="button" disabled={activePage === pageCount - 1} aria-label="Következő könyvek" onClick={() => setSpinePage(activePage + 1)}><ChevronRight size={16} aria-hidden="true" /></button>
                    <span className={styles.visuallyHidden} aria-live="polite">{pageStart + 1}–{Math.min(pageStart + spinesPerPage, shownBooks.length)}. könyv a {shownBooks.length} közül</span>
                  </nav>}
                </div>
                <div className={styles.featured}>
                  {current ? (
                    <button type="button" className={`${styles.bookCover} ${styles[`coverFamily${coverVariant(current)}`]}`} style={bookStyle(current, groupByBook.get(current.id) ?? null)} onClick={() => onOpenBook(current)} aria-label={`${COPY.detail}: ${current.title}${canManagePrivate ? ` · Olvasottság: ${STATUS_LABELS[current.status]}` : localStatusPreview ? " · Helyi státuszikon-minta, nem valódi olvasottság" : ""}`} title={canManagePrivate ? `Olvasottság: ${STATUS_LABELS[current.status]}` : localStatusPreview ? "Helyi státuszikon-minta, nem valódi olvasottság" : undefined}>
                      {currentCoverStatus && <PrivateCoverStatus status={currentCoverStatus} />}
                      <span className={styles.coverArt} aria-hidden="true"><span className={styles.coverArtDetail}/></span>
                      <span className={styles.coverAuthor}>{current.author_display_short ?? current.author}</span>
                      <strong className={styles.coverTitle}>{current.title}</strong>
                      <span className={styles.coverTagline}>{(current.cover_tag_ids?.length ? current.cover_tag_ids : current.tags ?? []).slice(0, 2).map((tag) => tagLabels[tag] ?? tag).join(" · ")}</span>
                    </button>
                  ) : (
                    <div className={styles.stageRest} aria-label="Nincs kiválasztott könyv">
                      <BookOpen size={42} strokeWidth={1.2} aria-hidden="true" />
                      <p>Válassz egy könyvet</p>
                      <span>Kattints egy gerincre</span>
                    </div>
                  )}
                </div>
                <div className={styles.woodShelf} aria-hidden="true" />
              </>
            )}
          </div>

          <div className={`${styles.mobileTop} ${detailBook ? styles.mobileTopExpanded : ""}`}>
            {detailBook ? (
              <ShioriBookDetail
                key={detailBook.id}
                embedded
                initialBook={detailBook}
                books={books}
                themePills={themePills}
                tagLabels={tagLabels}
                canManagePrivate={canManagePrivate}
                onBookSaved={onBookSaved}
                onClose={() => {
                  setDetailStack([]);
                  requestAnimationFrame(() => mobileCoverRef.current?.focus());
                }}
              />
            ) : current ? (
              <button ref={mobileCoverRef} type="button" className={`${styles.mobileCover} ${styles[`coverFamily${coverVariant(current)}`]}`} style={bookStyle(current, groupByBook.get(current.id) ?? null)} onClick={() => openBook(current)} aria-label={`${COPY.detail}: ${current.title}${canManagePrivate ? ` · Olvasottság: ${STATUS_LABELS[current.status]}` : localStatusPreview ? " · Helyi státuszikon-minta, nem valódi olvasottság" : ""}`} title={canManagePrivate ? `Olvasottság: ${STATUS_LABELS[current.status]}` : localStatusPreview ? "Helyi státuszikon-minta, nem valódi olvasottság" : undefined}>
                {currentCoverStatus && <PrivateCoverStatus status={currentCoverStatus} />}
                <span className={styles.coverArt} aria-hidden="true"><span className={styles.coverArtDetail}/></span>
                <span className={styles.coverAuthor}>{current.author_display_short ?? current.author}</span>
                <strong className={styles.coverTitle}>{current.title}</strong>
                <span className={styles.coverTagline}>{(current.cover_tag_ids?.length ? current.cover_tag_ids : current.tags ?? []).slice(0, 2).map((tag) => tagLabels[tag] ?? tag).join(" · ")}</span>
              </button>
            ) : <div className={styles.empty}><p>{COPY.empty}</p></div>}
          </div>
          <div className={styles.mobileList} ref={listRef} role="list" aria-label="Az aktuális válogatás könyvei">
            {shownBooks.map((book) => (
              <button role="listitem" type="button" key={book.id} className={`${styles.mobileListItem} ${current?.id === book.id ? styles.mobileListSelected : ""}`} onClick={() => selectBook(book)} aria-current={current?.id === book.id ? "true" : undefined}>
                <span className={styles.listColor} style={{ background: COLOR[CATEGORIES.findIndex((c) => c.id === groupByBook.get(book.id))] ?? "#829482" }} />
                <span><strong>{book.title}</strong><small>{book.author}</small></span>
              </button>
            ))}
          </div>
          <footer className={styles.footer}>
            <button className={styles.mobileFilterButton} ref={filterTriggerRef} type="button" onClick={() => setFilterPanel(true)}><Search size={18} aria-hidden="true" />{COPY.search}</button>
          </footer>
        </div>
      </div>

      {filterPanel && <div className={styles.filterBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) closeFilters(); }}>
        <div className={styles.filterDialog} role="dialog" aria-modal="true" aria-labelledby="shiori-filter-title">
          <div className={styles.filterTop}>
            <div className={styles.filterTitleBlock}>
              <span className={styles.filterOverline}>Shiori · Könyvtár</span>
              <h2 id="shiori-filter-title">{COPY.search}</h2>
            </div>
            <button type="button" className={styles.filterClose} onClick={closeFilters} aria-label={COPY.close}><X size={20} aria-hidden="true" /></button>
          </div>
          <div className={styles.filterBody}>
            <label className={styles.filterSearch}>
              <Search size={18} aria-hidden="true" />
              <span className={styles.visuallyHidden}>{COPY.query}</span>
              <input type="search" autoFocus value={query} onChange={(event) => changeQuery(event.target.value)} placeholder={COPY.query} />
            </label>
            <div className={styles.filterSummary} role="status" aria-live="polite">
              <strong>{shownBooks.length} könyv</strong>
              <span>{searchActive ? "felel meg a feltételeknek" : "az aktuális válogatásban"}</span>
            </div>
            {activeFilterChips.length > 0 && (
              <div className={styles.filterActiveChips} aria-label="Aktív szűrők">
                {activeFilterChips.map(({ key, value, label }) => (
                  <button type="button" key={`${key}:${value}`} onClick={() => changeFilter(key, value)} aria-label={`${label} szűrő eltávolítása`} title={`${label} eltávolítása`}>
                    <span>{label}</span><X size={13} aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
            <div className={styles.mobileCollections}>
              <h3>{COPY.topics}</h3>
              <button type="button" onClick={() => chooseCollection({ kind: "all", id: null })}>{COPY.all} ({books.length})</button>
              {groups.map((group) => <button type="button" key={group.id} onClick={() => chooseCollection({ kind: "category", id: group.id })}>{group.title} ({group.books.length})</button>)}
              <h3>{COPY.paths}</h3>
              {paths.map((path) => <button type="button" key={path.id} onClick={() => chooseCollection({ kind: "path", id: path.id })}>{path.title}</button>)}
            </div>
            <div className={styles.filterGroups}>
              {FILTER_GROUPS.map((key) => (
                <details key={key} className={styles.filterGroup}>
                  <summary>
                    <span>{key === "categories" ? COPY.category : key === "themes" ? COPY.themes : key === "tags" ? COPY.tags : key === "traditions" ? COPY.traditions : key === "levels" ? COPY.levels : key === "formats" ? COPY.formats : COPY.languages}</span>
                    {filters[key].length > 0 && <span className={styles.filterGroupCount}>{filters[key].length}</span>}
                    <ChevronDown size={16} aria-hidden="true" />
                  </summary>
                  <div className={styles.filterChoices}>
                    {filterOptions[key].map((option) => <label key={option.value} className={styles.choice}>
                      <input type="checkbox" checked={filters[key].includes(option.value)} onChange={() => changeFilter(key, option.value)} />
                      <span>{option.label}</span>
                    </label>)}
                  </div>
                </details>
              ))}
            </div>
          </div>
          <div className={styles.filterActions}>
            <div className={styles.filterSecondaryActions}>
              <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} disabled={activeFilterChips.length === 0}>{COPY.clear}</button>
              {searchActive && <button type="button" onClick={backToBrowse}>{COPY.back}</button>}
            </div>
            <button type="button" className={styles.filterShowResults} onClick={closeFilters}>Könyvek megtekintése <span>{shownBooks.length}</span></button>
          </div>
        </div>
      </div>}
    </section>
  );
}
