"use client";

import { Fragment, useMemo, useState, useEffect } from "react";
import {
  Bookmark,
  Check,
  Clock,
  Circle,
  Dumbbell,
  LayoutList,
  LogOut,
  Route,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SpiritBook, SpiritLibrary, SpiritPill, SpiritTradition, SpiritLevel, SpiritPath } from "@/lib/spiritSchema";
import { buildLearningPath, getNextBookRecommendations, type LearningPathFilters } from "@/lib/learningPathEngine";
import { resolveTagLabel } from "@/lib/spiritTags";
import styles from "./SpiritLibraryApp.module.css";
import SpiritAddBookModal from "./SpiritAddBookModal";

type Props = {
  library: SpiritLibrary;
  admin?: boolean;
};

const TRADITION_OPTIONS = [
  { value: "taoizmus", label: "Taoizmus" },
  { value: "buddhizmus", label: "Buddhizmus" },
  { value: "vegyes", label: "Vegyes" },
];

const LEVEL_OPTIONS = [
  { value: "kezdo", label: "Kezdő" },
  { value: "kozep-halado", label: "Közép-haladó" },
  { value: "halado", label: "Haladó" },
];

const FORMAT_OPTIONS = [
  { value: "konyv", label: "Könyv" },
  { value: "kommentar", label: "Kommentár" },
  { value: "valogatas", label: "Válogatás" },
  { value: "szutra", label: "Szútra" },
  { value: "essze", label: "Esszé" },
];


const STATUS_LABELS: Record<string, string> = {
  olvasatlan: "Olvasatlan",
  folyamatban: "Folyamatban",
  befejezett: "Befejezett",
  referencia: "Referencia",
};

const STATUS_OPTIONS = [
  { value: "olvasatlan", label: "Olvasatlan" },
  { value: "folyamatban", label: "Folyamatban" },
  { value: "befejezett", label: "Befejezett" },
  { value: "referencia", label: "Referencia" },
];


const STATUS_FLOW = ["olvasatlan", "folyamatban", "befejezett", "referencia"] as const;

type ReadingStatus = (typeof STATUS_FLOW)[number];

function getNextStatus(current: ReadingStatus) {
  const index = STATUS_FLOW.indexOf(current);
  return STATUS_FLOW[(index + 1) % STATUS_FLOW.length];
}

function getStatusIcon(status: ReadingStatus) {
  if (status === "olvasatlan") return Circle;
  if (status === "folyamatban") return Clock;
  if (status === "befejezett") return Check;
  return Bookmark;
}

function getLevelDots(level: string) {
  if (level === "halado") return 3;
  if (level === "kozep-halado") return 2;
  return 1;
}

function getLevelRank(level: string) {
  if (level === "kezdo") return 0;
  if (level === "kozep-halado") return 1;
  return 2;
}
const LANGUAGE_OPTIONS = [
  { value: "hu", label: "HU" },
  { value: "en", label: "EN" },
  { value: "egyeb", label: "Egyéb" },
];

function normalizeText(value: string) {
  return value.toLowerCase().trim();
}

function matchesSearch(book: SpiritBook, query: string) {
  if (!query) {
    return true;
  }
  const haystack = [
    book.title,
    book.author,
    book.summary_short,
    book.summary_long ?? "",
    ...(book.tags ?? []),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function getThemeLabel(themes: SpiritPill[], slug: string) {
  return themes.find((theme) => theme.slug === slug)?.label ?? slug;
}

function getThemeShortLabel(themes: SpiritPill[], slug: string) {
  return themes.find((theme) => theme.slug === slug)?.short_label ?? slug;
}

function getThemeColor(themes: SpiritPill[], slug: string) {
  return themes.find((theme) => theme.slug === slug)?.color ?? "#222222";
}

function getOptionLabel(options: { value: string; label: string }[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function prettifyMetaLabel(themes: SpiritPill[], value: string) {
  const themed = themes.find((theme) => theme.slug === value)?.label;
  if (themed) return themed;
  const cleaned = value
    .replace(/[\-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!cleaned) return value;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}



function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) {
    return `rgba(0,0,0,${alpha})`;
  }
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function deriveRelatedBooks(book: SpiritBook, books: SpiritBook[]) {
  if (book.related && book.related.length > 0) {
    return book.related
      .map((id) => books.find((candidate) => candidate.id === id))
      .filter((candidate): candidate is SpiritBook => Boolean(candidate));
  }

  const overlaps = books
    .filter((candidate) => candidate.id !== book.id)
    .filter((candidate) => candidate.tradition === book.tradition)
    .map((candidate) => {
      const shared = candidate.themes.filter((theme) => book.themes.includes(theme)).length;
      return { candidate, shared };
    })
    .filter((entry) => entry.shared > 0)
    .sort((a, b) => b.shared - a.shared)
    .slice(0, 5)
    .map((entry) => entry.candidate);

  return overlaps;
}

export default function SpiritLibraryApp({ library, admin }: Props) {
  const isAdmin = Boolean(admin);
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tradition, setTradition] = useState<string>("");
  const [level, setLevel] = useState<string>("");
  const [language, setLanguage] = useState<string>("");
  const [format, setFormat] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [themes, setThemes] = useState<string[]>([]);
  const [themesOpen, setThemesOpen] = useState(false);
  const [pathTradition, setPathTradition] = useState<string>("");
  const [pathStartLevel, setPathStartLevel] = useState<string>("kezdo");
  const [pathThemes, setPathThemes] = useState<string[]>([]);
  const [pathRequest, setPathRequest] = useState<LearningPathFilters | null>(null);
  const [pathOpen, setPathOpen] = useState(false);
  const [paths, setPaths] = useState<SpiritPath[]>(() => library.paths ?? []);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [bookStack, setBookStack] = useState<SpiritBook[]>([]);
  const selectedBook = bookStack.length ? bookStack[bookStack.length - 1] : null;
  const [statusOverrides, setStatusOverrides] = useState<Record<string, ReadingStatus>>({});
  const [statusNotes, setStatusNotes] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [viewModeLocked, setViewModeLocked] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (!selectedBook) {
      if (typeof document !== "undefined" && document.body) {
        document.body.style.overflow = "";
      }
      return;
    }
    if (typeof document !== "undefined" && document.body) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      if (typeof document !== "undefined" && document.body) {
        document.body.style.overflow = "";
      }
    };
  }, [selectedBook]);

  useEffect(() => {
    if (!selectedBook) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setBookStack([]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedBook]);

  useEffect(() => {
    if (!selectedBook) return;
    setStatusNotes((current) => {
      if (current[selectedBook.id] !== undefined) return current;
      return { ...current, [selectedBook.id]: selectedBook.notes ?? "" };
    });
  }, [selectedBook]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let media: MediaQueryList | null = null;
    try {
      if (typeof window.matchMedia === "function") {
        media = window.matchMedia("(max-width: 720px)");
      }
    } catch {
      media = null;
    }
    const syncViewMode = () => {
      const isMatch = Boolean(media && media.matches);
      setIsMobile(isMatch);
      if (isMatch) {
        setViewMode("grid");
        return;
      }
      if (viewModeLocked) return;
    };
    try {
      syncViewMode();
      if (media) {
        if (typeof media.addEventListener === "function") {
          media.addEventListener("change", syncViewMode);
          return () => {
            try {
              media?.removeEventListener("change", syncViewMode);
            } catch {
              // no-op
            }
          };
        }
        media.addListener(syncViewMode);
        return () => {
          try {
            media?.removeListener(syncViewMode);
          } catch {
            // no-op
          }
        };
      }
    } catch {
      setIsMobile(false);
    }
    return () => {};
  }, [viewModeLocked]);

  const themePills = library.thematic_pills;
  const tagLabels = library.tag_labels ?? {};
  const bookById = useMemo(() => new Map(library.books.map((book) => [book.id, book])), [library.books]);
  const curatedPaths = paths;

  const filteredBooks = useMemo(() => {
    const query = normalizeText(searchQuery);
    return library.books.filter((book) => {
      if (tradition && book.tradition !== tradition) return false;
      if (level && book.level !== level) return false;
      if (language && book.language !== language) return false;
      if (format && book.format !== format) return false;
      if (status && book.status !== status) return false;
      if (themes.length > 0 && !themes.some((theme) => book.themes.includes(theme))) return false;
      return matchesSearch(book, query);
    });
  }, [library.books, tradition, level, language, format, status, themes, searchQuery]);

  const sortedBooks = useMemo(() => {
    return [...filteredBooks].sort((a, b) => {
      const statusA = (statusOverrides[a.id] ?? a.status) as ReadingStatus;
      const statusB = (statusOverrides[b.id] ?? b.status) as ReadingStatus;
      const aInProgress = statusA === "folyamatban";
      const bInProgress = statusB === "folyamatban";
      if (aInProgress !== bInProgress) return aInProgress ? -1 : 1;
      return 0;
    });
  }, [filteredBooks, statusOverrides]);

  const relatedBooks = useMemo(() => {
    if (!selectedBook) return [];
    return deriveRelatedBooks(selectedBook, library.books);
  }, [selectedBook, library.books]);

  const nextSteps = useMemo(() => {
    if (!selectedBook) return { items: [] };
    return getNextBookRecommendations(library.books, selectedBook.id, {
      excludeCompleted: true,
      minScore: 5,
      limit: 6,
    });
  }, [selectedBook, library.books]);

  const generatedPath = useMemo(() => {
    if (!pathRequest) return null;
    return buildLearningPath(library.books, pathRequest);
  }, [library.books, pathRequest]);

  const selectedPath = useMemo(
    () => paths.find((path) => path.id === selectedPathId) ?? null,
    [paths, selectedPathId]
  );

  const clearFilters = () => {
    setTradition("");
    setLevel("");
    setLanguage("");
    setFormat("");
    setStatus("");
    setThemes([]);
    setSearchQuery("");
  };

  const toggleFilters = () => {
    setFiltersOpen((current) => {
      const next = !current;
      if (next) setPathOpen(false);
      return next;
    });
  };

  const togglePathPanel = () => {
    setPathOpen((current) => {
      const next = !current;
      if (next) setFiltersOpen(false);
      return next;
    });
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
    } finally {
      router.replace("/login");
    }
  };

  const toggleViewMode = () => {
    setViewModeLocked(true);
    setViewMode((current) => (current === "grid" ? "list" : "grid"));
  };

  const handleStatusToggle = async (bookId: string, currentStatus: ReadingStatus) => {
    if (!isAdmin) return;
    const nextStatus = getNextStatus(currentStatus);
    setStatusOverrides((current) => ({ ...current, [bookId]: nextStatus }));

    try {
      const response = await fetch("/api/admin/spirit/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, status: nextStatus }),
      });

      if (!response.ok) {
        throw new Error("Failed to update status");
      }
    } catch {
      setStatusOverrides((current) => ({ ...current, [bookId]: currentStatus }));
    }
  };

  const handleNoteSave = async (bookId: string, note: string) => {
    if (!isAdmin) return;
    const trimmed = note.trim();
    try {
      const response = await fetch("/api/admin/spirit/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, notes: trimmed }),
      });

      if (!response.ok) {
        throw new Error("Failed to update notes");
      }
    } catch {
      // Keep local value; no UI disruption on save failure.
    }
  };

  const toggleTheme = (slug: string) => {
    setThemes((current) =>
      current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug]
    );
  };

  const togglePathTheme = (slug: string) => {
    setPathThemes((current) =>
      current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug]
    );
  };

  const handleGeneratePath = () => {
    const traditionValue = pathTradition ? (pathTradition as SpiritTradition) : undefined;
    const startLevelValue = pathStartLevel ? (pathStartLevel as SpiritLevel) : undefined;
    setPathRequest({
      tradition: traditionValue,
      themes: pathThemes,
      startLevel: startLevelValue,
    });
  };

  const pathItemsForRender = (path: SpiritPath) => {
    const items = path.items ?? path.book_ids?.map((id) => ({ book_id: id })) ?? [];
    return items
      .map((item) => ({
        item,
        book: bookById.get(item.book_id),
      }))
      .filter((entry): entry is { item: { book_id: string; comment?: string }; book: SpiritBook } =>
        Boolean(entry.book)
      );
  };

  const getBookStatus = (book: SpiritBook) => (statusOverrides[book.id] ?? book.status) as ReadingStatus;

  const getPathProgress = (path: SpiritPath) => {
    const entries = pathItemsForRender(path);
    if (entries.length === 0) return 0;
    const completed = entries.filter(({ book }) => getBookStatus(book) === "befejezett").length;
    return Math.round((completed / entries.length) * 100);
  };

  const updatePathState = (pathId: string, updater: (path: SpiritPath) => SpiritPath) => {
    setPaths((current) => current.map((path) => (path.id === pathId ? updater(path) : path)));
  };

  const savePathUpdate = async (payload: Record<string, unknown>) => {
    if (!isAdmin) return;
    try {
      await fetch("/api/admin/spirit/path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // Keep UI state even if save fails.
    }
  };

  const handlePathCommentChange = (pathId: string, bookId: string, comment: string) => {
    updatePathState(pathId, (path) => {
      const items = path.items ?? path.book_ids?.map((id) => ({ book_id: id })) ?? [];
      const updatedItems = items.map((item) =>
        item.book_id === bookId ? { ...item, comment } : item
      );
      return { ...path, items: updatedItems };
    });
  };

  const handlePathCommentSave = (pathId: string, bookId: string, comment: string) => {
    savePathUpdate({ pathId, itemComment: { bookId, comment } });
  };

  const handlePathTitleChange = (pathId: string, title: string) => {
    updatePathState(pathId, (path) => ({ ...path, title }));
  };

  const handlePathTitleSave = (pathId: string, title: string) => {
    savePathUpdate({ pathId, title });
  };

  const handlePathDescriptionChange = (pathId: string, description: string) => {
    updatePathState(pathId, (path) => ({ ...path, description }));
  };

  const handlePathDescriptionSave = (pathId: string, description: string) => {
    savePathUpdate({ pathId, description });
  };

  const handleDeletePath = async (pathId: string) => {
    if (!isAdmin) return;
    setPaths((current) => current.filter((path) => path.id !== pathId));
    setSelectedPathId(null);
    await savePathUpdate({ pathId, delete: true });
  };

  const handleSaveGeneratedPath = async () => {
    if (!isAdmin) return;
    if (!generatedPath || generatedPath.ordered_ids.length === 0) return;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const titleParts = [
      pathTradition ? getOptionLabel(TRADITION_OPTIONS, pathTradition) : null,
      pathThemes.length > 0 ? `${pathThemes.length} téma` : null,
    ].filter(Boolean);
    const title = titleParts.length > 0 ? `Ajánlott út — ${titleParts.join(" / ")}` : "Ajánlott út";
    const descriptionParts = [
      pathTradition ? `Tradíció: ${getOptionLabel(TRADITION_OPTIONS, pathTradition)}` : null,
      pathThemes.length > 0 ? `Témák: ${pathThemes.map((slug) => getThemeLabel(themePills, slug)).join(", ")}` : null,
    ].filter(Boolean);
    const description =
      descriptionParts.length > 0
        ? `Rögzített ajánlott út. ${descriptionParts.join(" · ")}`
        : "Rögzített ajánlott útvonal.";
    const newPath: SpiritPath = {
      id: `ajanlott_ut_${timestamp}`,
      title,
      description,
      items: generatedPath.ordered_ids.map((id) => ({ book_id: id })),
      progress: 0,
    };

    setPaths((current) => [newPath, ...current]);
    await savePathUpdate({ path: newPath });
  };

  return (
    <section className={`${styles.page} admin-stack`}>
      {pathOpen && (
        <div className={styles.toolbarPanelBackdrop} onClick={() => setPathOpen(false)}>
          <div className={styles.toolbarPanelCard} onClick={(event) => event.stopPropagation()}>
            {isAdmin && (
              <div className={`admin-card ${styles.pathSection}`}>
                <div className={styles.pathHeaderRow}>
                  <div>
                    <h2 className="admin-heading__title">{"Adj egy utat"}</h2>
                    <p className={styles.pathSubtitle}>
                      {"Determinista, szabályalapú útvonal a kért szűrések szerint. AI csak finomhangolhat."}
                    </p>
                  </div>
                  <div className={styles.pathHeaderActions}>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => setPathOpen(false)}
                      aria-label="Bezárás"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
                <div className={styles.pathForm}>
                  <label className="form-field">
                    <span className="form-field__label">{"Tradíció"}</span>
                    <select className="input" value={pathTradition} onChange={(event) => setPathTradition(event.target.value)}>
                      <option value="">Mind</option>
                      {TRADITION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    <span className="form-field__label">{"Kezdőszint"}</span>
                    <select className="input" value={pathStartLevel} onChange={(event) => setPathStartLevel(event.target.value)}>
                      <option value="">Mind</option>
                      {LEVEL_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className={styles.pathThemes}>
                    <span className="form-field__label">{"Témák"}</span>
                    <div className={styles.pathThemeGrid}>
                      {themePills.map((pill) => {
                        const color = pill.color;
                        const isActive = pathThemes.includes(pill.slug);
                        return (
                          <button
                            key={pill.slug}
                            type="button"
                            className={`${styles.pathThemePill} ${isActive ? styles.pathThemePillActive : ""}`}
                            onClick={() => togglePathTheme(pill.slug)}
                            style={{
                              borderColor: color,
                              color: isActive ? "#fff" : color,
                              background: isActive ? color : hexToRgba(color, 0.12),
                            }}
                            title={pill.label}
                          >
                            {pill.short_label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className={styles.pathActions}>
                    <button type="button" className="btn" onClick={handleGeneratePath}>
                      {"Utat kérek"}
                    </button>
                  </div>
                </div>

                {generatedPath && (
                  <div className={styles.pathResult}>
                    {generatedPath.steps.length === 0 ? (
                      <p className="admin-text-muted">{"Nincs elérhető útvonal ezekkel a szűrésekkel."}</p>
                    ) : (
                      <>
                        <div className={styles.pathResultMeta}>
                          <span>{`${generatedPath.steps.length} könyv`}</span>
                          <span>{`Flow quality: ${Math.round(generatedPath.flow * 100)}%`}</span>
                        </div>
                        <div className={styles.pathActionsRow}>
                          <button type="button" className="btn" onClick={handleSaveGeneratedPath}>
                            {"Ajánlott út rögzítése"}
                          </button>
                        </div>
                        <div className={styles.pathResultList}>
                          {generatedPath.steps.map((step, index) => (
                            <button
                              key={step.book.id}
                              type="button"
                              className={styles.pathResultCard}
                              onClick={() => setBookStack([step.book])}
                            >
                              <span className={styles.pathResultIndex}>{index + 1}</span>
                              <div className={styles.pathResultBody}>
                                <strong>{step.book.title}</strong>
                                <span className={styles.pathBookAuthor}>{step.book.author}</span>
                                {step.reasons.length > 0 && (
                                  <span className={styles.pathReason}>{step.reasons.join(" · ")}</span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {curatedPaths.length > 0 && (
              <div className={styles.pathGridSection}>
                <div className={styles.pathGridHeader}>
                  <h2 className="admin-heading__title">{"Mentett utak"}</h2>
                </div>
                <div className={styles.pathGrid}>
                  {curatedPaths.map((path) => {
                    const entries = pathItemsForRender(path);
                    const progress = getPathProgress(path);
                    return (
                      <div
                        key={path.id}
                        role="button"
                        tabIndex={0}
                        className={styles.pathCard}
                        onClick={() => setSelectedPathId(path.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedPathId(path.id);
                          }
                        }}
                      >
                        <div className={styles.pathCardHeader}>
                          <div className={styles.pathCardHeaderContent}>
                            <h3 className={styles.pathTitle}>{path.title}</h3>
                            {path.description && <p className={styles.pathDesc}>{path.description}</p>}
                          </div>
                        </div>
                        {entries.length > 0 && (
                          <div className={styles.pathBookList}>
                            {[...entries]
                              .sort((a, b) => {
                                const levelDelta = getLevelRank(a.book.level) - getLevelRank(b.book.level);
                                if (levelDelta !== 0) return levelDelta;
                                return a.book.title.localeCompare(b.book.title, "hu");
                              })
                              .map(({ book }) => (
                                <div key={book.id} className={styles.pathBookRowStatic}>
                                  <strong>{book.title}</strong>
                                  <span className={styles.pathBookAuthor}>{book.author}</span>
                                </div>
                              ))}
                          </div>
                        )}
                        <div className={styles.pathProgressSection}>
                          <p className={styles.pathMeta}>
                            {`${entries.length} könyv · ${progress}%`}
                          </p>
                          <div className={`${styles.pathProgressBar} ${styles.pathProgressBarCard}`}>
                            <span
                              className={styles.pathProgressFill}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className={styles.fabToolbar}>
        {isAdmin && (
          <button
            type="button"
            className={styles.addFab}
            onClick={handleLogout}
            aria-label="KijelentkezĂ©s"
            title="KijelentkezĂ©s"
          >
            <LogOut size={18} />
          </button>
        )}
        {isAdmin && (
          <Link
            href="/admin/yoga"
            className={styles.addFab}
            aria-label="Yoga napló"
            title="Yoga napló"
          >
            <Dumbbell size={18} />
          </Link>
        )}
        {(isAdmin || curatedPaths.length > 0) && (
          <button
            type="button"
            className={`${styles.addFab} ${pathOpen ? styles.filterFabActive : ""}`}
            aria-label={pathOpen ? "Utak elrejtése" : "Utak megnyitása"}
            aria-expanded={pathOpen}
            onClick={togglePathPanel}
          >
            <Route size={18} className={styles.fabIcon} />
          </button>
        )}
        {isAdmin && (
          <Link
            href="/meditations"
            className={styles.addFab}
            aria-label="Meditációs tér"
            title="Meditációs tér"
          >
            <Sparkles size={18} className={styles.fabIcon} />
          </Link>
        )}
        {!isMobile && (
            <button
              type="button"
              className={`${styles.addFab} ${styles.viewToggleButton} ${viewMode === "list" ? styles.filterFabActive : ""}`}
              aria-label={viewMode === "list" ? "Rácsnézet" : "Lista nézet"}
              onClick={toggleViewMode}
            >
              <LayoutList size={18} />
            </button>
          )}
        <button
          type="button"
          className={`${styles.addFab} ${filtersOpen ? styles.filterFabActive : ""}`}
          aria-label={filtersOpen ? "Szűrők elrejtése" : "Szűrők megnyitása"}
          aria-expanded={filtersOpen}
          onClick={toggleFilters}
        >
          <SlidersHorizontal size={18} />
        </button>
        {isAdmin && <SpiritAddBookModal library={library} onOpenBook={(book) => setBookStack([book])} />}
      </div>

      {filtersOpen && (
        <div className={styles.toolbarPanelBackdrop} onClick={() => setFiltersOpen(false)}>
          <div className={styles.toolbarPanelCard} onClick={(event) => event.stopPropagation()}>
            <div className={`admin-card ${styles.filtersCard}`}>
              <div className={styles.filtersHeader}>
                <h2 className="admin-heading__title">{"Szűrők és keresés"}</h2>
                <div className={styles.filtersActions}>
                  <button type="button" className="btn btn--ghost" onClick={clearFilters}>
                    {"Szűrők törlése"}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setFiltersOpen(false)}
                    aria-label="Bezárás"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className={styles.searchRow}>
                <input
                  className="input"
                  type="search"
                  placeholder="Keresés cím, szerző vagy kulcsszavak alapján"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>

              <div className={styles.filterGrid}>
                <label className="form-field">
                  <span className="form-field__label">{"Tradíció"}</span>
                  <select className="input" value={tradition} onChange={(event) => setTradition(event.target.value)}>
                    <option value="">Mind</option>
                    {TRADITION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span className="form-field__label">Szint</span>
                  <select className="input" value={level} onChange={(event) => setLevel(event.target.value)}>
                    <option value="">Mind</option>
                    {LEVEL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span className="form-field__label">Nyelv</span>
                  <select className="input" value={language} onChange={(event) => setLanguage(event.target.value)}>
                    <option value="">Mind</option>
                    {LANGUAGE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span className="form-field__label">{"Formátum"}</span>
                  <select className="input" value={format} onChange={(event) => setFormat(event.target.value)}>
                    <option value="">Mind</option>
                    {FORMAT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span className="form-field__label">{"Státusz"}</span>
                  <select className="input" value={status} onChange={(event) => setStatus(event.target.value)}>
                    <option value="">Mind</option>
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className={styles.themePanel}>
                <button
                  type="button"
                  className={styles.themeToggle}
                  aria-expanded={themesOpen}
                  onClick={() => setThemesOpen((current) => !current)}
                >
                  {"Tematikus szűrés"}
                  <span className={styles.themeToggleMeta}>
                    {themes.length > 0 ? `${themes.length} kiválasztva` : "Nincs szűrés"}
                  </span>
                </button>
                {themesOpen && (
                  <div className={styles.themeGrid}>
                    {themePills.map((pill) => {
                      const color = pill.color;
                      const isActive = themes.includes(pill.slug);
                      return (
                        <button
                          key={pill.slug}
                          type="button"
                          className={`${styles.themePill} ${isActive ? styles.themePillActive : ""}`}
                          onClick={() => toggleTheme(pill.slug)}
                          style={{
                            borderColor: color,
                            color: isActive ? "#fff" : color,
                            background: isActive ? color : hexToRgba(color, 0.12),
                          }}
                          title={pill.label}
                        >
                          {pill.short_label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={styles.resultsRow}>
        <p className="admin-text-muted">
          {filteredBooks.length} {"találat"}
        </p>
      </div>

      <div className={`${styles.grid} ${viewMode === "list" ? styles.gridList : ""}`}>
        {sortedBooks.map((book) => {
          const status = (statusOverrides[book.id] ?? book.status) as ReadingStatus;
          const Icon = getStatusIcon(status);
          const firstTheme = book.themes[0];
          const firstThemeColor = firstTheme ? getThemeColor(themePills, firstTheme) : "#222222";
          return (
            <div
              key={book.id}
              role="button"
              tabIndex={0}
              className={`${styles.card} ${viewMode === "list" ? styles.listCard : ""} admin-card`}
              onClick={() => setBookStack([book])}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setBookStack([book]);
                }
              }}
            >
              {viewMode === "list" ? (
                <>
                  <div className={styles.listColLeft}>
                    <div className={styles.levelRow} aria-label={book.level}>
                      {Array.from({ length: 3 }).map((_, idx) => (
                        <span
                          key={`${book.id}-dot-${idx}`}
                          className={`${styles.levelDot} ${idx < getLevelDots(book.level) ? styles.levelDotActive : ""}`}
                        />
                      ))}
                    </div>
                    {firstTheme && (
                      <span
                        className={styles.listThemeTag}
                        style={{
                          borderColor: firstThemeColor,
                          color: firstThemeColor,
                          background: hexToRgba(firstThemeColor, 0.12),
                        }}
                        title={getThemeLabel(themePills, firstTheme)}
                      >
                        {getThemeShortLabel(themePills, firstTheme)}
                      </span>
                    )}
                  </div>
                  <div className={styles.listColMain}>
                    <h3 className={styles.cardTitle}>{book.title}</h3>
                    <p className={styles.cardAuthor}>{book.author}</p>
                  </div>
                  <div className={styles.listColStatus}>
                    {isAdmin ? (
                      <button
                        type="button"
                        className={styles.statusButton}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleStatusToggle(book.id, status);
                        }}
                        aria-label={`Olvasási státusz: ${status}`}
                        title={`Olvasási státusz: ${status}`}
                      >
                        <Icon size={16} />
                      </button>
                    ) : (
                      <span className={styles.statusButton} aria-hidden="true">
                        <Icon size={16} />
                      </span>
                    )}
                    <span className={styles.statusLabel}>{STATUS_LABELS[status] ?? status}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.cardHeader}>
                    <div>
                      <h3 className={styles.cardTitle}>{book.title}</h3>
                      <p className={styles.cardAuthor}>{book.author}</p>
                    </div>
                  </div>
                  <p className={styles.cardSummary}>{book.summary_short}</p>
                  <div className={styles.levelRow} aria-label={book.level}>
                    {Array.from({ length: 3 }).map((_, idx) => (
                      <span
                        key={`${book.id}-dot-${idx}`}
                        className={`${styles.levelDot} ${idx < getLevelDots(book.level) ? styles.levelDotActive : ""}`}
                      />
                    ))}
                    <span className={styles.levelValue}>{book.level}</span>
                  </div>
                  <div className={styles.cardThemes}>
                    {book.themes.slice(0, 5).map((theme) => {
                      const color = getThemeColor(themePills, theme);
                      return (
                        <span
                          key={theme}
                          className={styles.themeTag}
                          style={{
                            borderColor: color,
                            color,
                            background: hexToRgba(color, 0.12),
                          }}
                          title={getThemeLabel(themePills, theme)}
                        >
                          {getThemeShortLabel(themePills, theme)}
                        </span>
                      );
                    })}
                  </div>
                  <div className={styles.cardFooter}>
                    {isAdmin ? (
                      <button
                        type="button"
                        className={styles.statusButton}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleStatusToggle(book.id, status);
                        }}
                        aria-label={`Olvasási státusz: ${status}`}
                        title={`Olvasási státusz: ${status}`}
                      >
                        <Icon size={16} />
                      </button>
                    ) : (
                      <span className={styles.statusButton} aria-hidden="true">
                        <Icon size={16} />
                      </span>
                    )}
                    <span className={styles.statusLabel}>{STATUS_LABELS[status] ?? status}</span>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {selectedPath && (
        <div className="admin-overlay-backdrop">
          <div className={`admin-overlay-panel ${styles.overlay}`}>
            <div className={styles.overlayHeader}>
              <div>
                <p className={styles.overlayMeta}>{"Mentett út"}</p>
                {isAdmin ? (
                  <>
                    <input
                      className={styles.pathTitleInput}
                      value={selectedPath.title}
                      onChange={(event) => handlePathTitleChange(selectedPath.id, event.target.value)}
                      onBlur={(event) => handlePathTitleSave(selectedPath.id, event.target.value)}
                    />
                    <textarea
                      className={styles.pathDescInput}
                      value={selectedPath.description ?? ""}
                      onChange={(event) => handlePathDescriptionChange(selectedPath.id, event.target.value)}
                      onBlur={(event) => handlePathDescriptionSave(selectedPath.id, event.target.value)}
                      placeholder="Leírás az útról"
                      rows={2}
                    />
                  </>
                ) : (
                  <>
                    <h2 className={styles.pathTitle}>{selectedPath.title}</h2>
                    {selectedPath.description && (
                      <p className={styles.pathOverlayDesc}>{selectedPath.description}</p>
                    )}
                  </>
                )}
              </div>
              <div className={styles.pathOverlayActions}>
                {isAdmin && (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => handleDeletePath(selectedPath.id)}
                  >
                    {"Törlés"}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setSelectedPathId(null)}
                  aria-label="Bezárás"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className={styles.overlayStack}>
              <div className={styles.pathProgressRow}>
                <span className={styles.pathProgressLabel}>{"Haladás"}</span>
                <div className={styles.pathProgressBar}>
                  <span
                    className={styles.pathProgressFill}
                    style={{ width: `${getPathProgress(selectedPath)}%` }}
                  />
                </div>
                <span className={styles.pathProgressValue}>{`${getPathProgress(selectedPath)}%`}</span>
              </div>

            <div className={styles.pathOverlayList}>
              {pathItemsForRender(selectedPath).map(({ book, item }) => {
                const card = (
                  <button
                    type="button"
                    className={`${styles.nextStepCard} ${styles.pathOverlayBookCard}`}
                    onClick={() => {
                      setSelectedPathId(null);
                      setBookStack([book]);
                    }}
                  >
                    <div className={styles.pathOverlayHeaderRow}>
                      <strong>{book.title}</strong>
                      <div className={styles.levelRow} aria-label={book.level}>
                        {Array.from({ length: 3 }).map((_, idx) => (
                          <span
                            key={`${book.id}-path-dot-${idx}`}
                            className={`${styles.levelDot} ${idx < getLevelDots(book.level) ? styles.levelDotActive : ""}`}
                          />
                        ))}
                      </div>
                    </div>
                    <span className={styles.pathBookAuthor}>{book.author}</span>
                    {book.themes.length > 0 && (
                      <div className={styles.pathOverlayThemes}>
                        {book.themes.slice(0, 5).map((theme) => {
                          const color = getThemeColor(themePills, theme);
                          return (
                            <span
                              key={theme}
                              className={styles.themeTag}
                              style={{
                                borderColor: color,
                                color,
                                background: hexToRgba(color, 0.12),
                              }}
                            >
                              {getThemeShortLabel(themePills, theme)}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {book.summary_short && (
                      <span className={styles.nextStepSummary}>{book.summary_short}</span>
                    )}
                  </button>
                );

                if (!isAdmin) {
                  return (
                    <Fragment key={book.id}>
                      {card}
                    </Fragment>
                  );
                }

                return (
                  <div key={book.id} className={styles.pathOverlayItem}>
                    {card}
                    {isAdmin ? (
                      <textarea
                        className={styles.pathComment}
                        value={item.comment ?? ""}
                        onChange={(event) =>
                          handlePathCommentChange(selectedPath.id, book.id, event.target.value)
                        }
                        onBlur={(event) =>
                          handlePathCommentSave(selectedPath.id, book.id, event.target.value)
                        }
                        placeholder="Megjegyzés ehhez az olvasmányhoz"
                        rows={2}
                      />
                    ) : (
                      item.comment && <p className={styles.pathComment}>{item.comment}</p>
                    )}
                  </div>
                );
              })}
            </div>
            </div>
          </div>
        </div>
      )}

      {selectedBook && (
        <div className="admin-overlay-backdrop">
          <div className={`admin-overlay-panel ${styles.overlay}`}>
            <div className={styles.overlayHeader}>
              <div>
                <p className={styles.overlayMeta}>{selectedBook.author}</p>
                <h2 className={styles.overlayTitle}>{selectedBook.title}</h2>
              </div>
              <button type="button" className="btn btn--ghost" onClick={() => setBookStack([])} aria-label="Bezárás">
                <X size={18} />
              </button>
            </div>

            <div className={styles.overlayStack}>
              <div className={styles.metaRecommendationGrid}>
                <div className={styles.recommendationBlock}>
                  <div className={styles.recommendationHeader}>
                    <h3>{"Ajánlás"}</h3>
                    <div className={styles.levelRow} aria-label={selectedBook.level}>
                      {Array.from({ length: 3 }).map((_, idx) => (
                        <span
                          key={`${selectedBook.id}-meta-dot-${idx}`}
                          className={`${styles.levelDot} ${idx < getLevelDots(selectedBook.level) ? styles.levelDotActive : ""}`}
                        />
                      ))}
                      <span className={styles.levelValue}>
                        {getOptionLabel(LEVEL_OPTIONS, selectedBook.level)}
                      </span>
                    </div>
                  </div>
                  <p>{selectedBook.recommendation}</p>
                </div>

                <div className={styles.metaSection}>
                  <div className={styles.metaPane}>
                    <div className={styles.metaRow}>
                      <span className={styles.metaLabel}>{"Tradíció"}</span>
                      <div className={styles.metaPillsInline}>
                        <span className={`${styles.metaPill} ${styles.metaPillCore}`}>
                          {getOptionLabel(TRADITION_OPTIONS, selectedBook.tradition)}
                        </span>
                      </div>
                    </div>
                    <div className={styles.metaRow}>
                      <span className={styles.metaLabel}>{"Formátum"}</span>
                      <div className={styles.metaPillsInline}>
                        <span className={`${styles.metaPill} ${styles.metaPillCore}`}>
                          {getOptionLabel(FORMAT_OPTIONS, selectedBook.format)}
                        </span>
                        {selectedBook.year && (
                          <span className={`${styles.metaPill} ${styles.metaPillCore}`}>{selectedBook.year}</span>
                        )}
                      </div>
                    </div>
                    {selectedBook.prerequisites && selectedBook.prerequisites.length > 0 && (
                      <div className={styles.metaRow}>
                        <span className={styles.metaLabel}>{"Előfeltételek"}</span>
                        <div className={styles.metaPillsInline}>
                          {selectedBook.prerequisites.map((item) => (
                            <span key={item} className={`${styles.metaPill} ${styles.metaPillPrereq}`}>
                              {prettifyMetaLabel(themePills, item)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedBook.tags && selectedBook.tags.length > 0 && (
                      <div className={styles.metaRow}>
                        <span className={styles.metaLabel}>{"Címkék"}</span>
                        <div className={styles.metaPillsInline}>
                          {selectedBook.tags.map((tag) => (
                            <span key={tag} className={`${styles.metaPill} ${styles.metaPillTag}`}>
                              {resolveTagLabel(tag, tagLabels)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

{(selectedBook.summary_long || selectedBook.cautions || selectedBook.themes.length > 0) && (
                <div className={styles.descriptionSection}>
                  <h3>{"Részletesebb leírás"}</h3>
                  {selectedBook.themes.length > 0 && (
                    <div className={styles.themePillsRow}>
                      {selectedBook.themes.map((theme) => {
                        const color = getThemeColor(themePills, theme);
                        return (
                          <span
                            key={theme}
                            className={styles.themeTag}
                            style={{
                              borderColor: color,
                              color,
                              background: hexToRgba(color, 0.12),
                            }}
                          >
                            {getThemeLabel(themePills, theme)}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {selectedBook.summary_long && <p>{selectedBook.summary_long}</p>}
                  {selectedBook.cautions && (
                    <div className={styles.inlineAlert}>
                      <strong>{"Figyelmeztetés"}</strong>
                      <p>{selectedBook.cautions}</p>
                    </div>
                  )}
                </div>
              )}

              <div className={styles.statusSection}>
                <div className={styles.statusHeader}>
                  <h3>{"Olvasási státusz"}</h3>
                  {(() => {
                    const status = (statusOverrides[selectedBook.id] ?? selectedBook.status) as ReadingStatus;
                    const Icon = getStatusIcon(status);
                    return (
                      <div className={styles.statusControls}>
                        {isAdmin ? (
                          <button
                            type="button"
                            className={styles.statusButton}
                            onClick={() => handleStatusToggle(selectedBook.id, status)}
                            aria-label={`Olvasási státusz: ${status}`}
                            title={`Olvasási státusz: ${status}`}
                          >
                            <Icon size={16} />
                          </button>
                        ) : (
                          <span className={styles.statusButton} aria-hidden="true">
                            <Icon size={16} />
                          </span>
                        )}
                        <span className={styles.statusLabel}>{STATUS_LABELS[status] ?? status}</span>
                      </div>
                    );
                  })()}
                </div>
                {isAdmin && (
                  <textarea
                    id={`status-note-${selectedBook.id}`}
                    className={styles.commentTextarea}
                    value={statusNotes[selectedBook.id] ?? ""}
                    onChange={(event) =>
                      setStatusNotes((current) => ({
                        ...current,
                        [selectedBook.id]: event.target.value,
                      }))
                    }
                    onBlur={(event) => handleNoteSave(selectedBook.id, event.target.value)}
                    placeholder="Megjegyzés az olvasási státuszhoz"
                    rows={4}
                  />
                )}
              </div>

              {nextSteps.items.length > 0 && (
                <div className={styles.overlaySection}>
                  <h3>{"Következő lépések"}</h3>
                  <div className={styles.nextStepsGrid}>
                    {nextSteps.items.map((item) => (
                      <button
                        key={item.book.id}
                        type="button"
                        className={styles.nextStepCard}
                        onClick={() => setBookStack([item.book])}
                      >
                        <div>
                          <strong>{item.book.title}</strong>
                        </div>
                        <span className={styles.pathBookAuthor}>{item.book.author}</span>
                        {item.reasons.length > 0 && (
                          <span className={styles.nextStepReason}>
                            {`Kapcsolódó könyv · ${item.reasons.length} közös téma`}
                          </span>
                        )}
                        {item.book.summary_short && (
                          <span className={styles.nextStepSummary}>{item.book.summary_short}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}    </section>
  );
}
