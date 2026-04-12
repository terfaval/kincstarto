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

const MeditationsIcon = () => (
  <svg viewBox="0 0 500 500" className={styles.fabIcon} aria-hidden="true">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      fill="currentColor"
      d="M248.223,477c-103.188-1.621-191.701-65.986-220.189-161.107
		c-38.784-129.49,43.271-263.05,176.584-286.279c84.19-14.669,158.073,8.291,215.239,71.333
		c61.68,68.019,75.64,148.583,41.743,234.153c-30.582,77.197-90.794,120.889-171.318,137.213
		C276.512,475.105,262.254,475.5,248.223,477z M247.646,453.063c111.327,1.709,205.58-87.463,207.541-198.049
		c2.146-120.935-94.141-205.76-200.165-208.78C137.441,42.883,42.225,133.386,41.324,248.4
		C40.446,360.527,133.881,452.781,247.646,453.063z"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      fill="currentColor"
      d="M361.325,250.541c-0.951,61.91-51.69,111.797-112.906,111.012
		c-62.95-0.809-113.892-52.426-112.542-114.039c1.342-61.262,53.252-110.064,115.841-108.908
		C312.18,139.722,362.239,190.846,361.325,250.541z M249.001,163.088c-48.046-0.016-87.898,38.848-88.048,85.859
		c-0.154,49.1,38.712,88.115,87.932,88.273c48.029,0.152,87.539-39.094,87.659-87.074
		C336.664,202.264,297.287,163.104,249.001,163.088z"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      fill="currentColor"
      d="M300.798,249.617c-0.116,29.215-22.74,51.801-51.845,51.758
		c-29.726-0.041-52.313-22.641-52.166-52.195c0.137-28.168,23.306-50.686,52.231-50.766
		C277.503,198.336,300.91,221.484,300.798,249.617z"
    />
  </svg>
);

const YogaIcon = () => (
  <svg viewBox="0 0 500 500" className={styles.fabIcon} aria-hidden="true">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      fill="currentColor"
      d="M-430.472,423.718c31.748,0,62.487,0,94.646,0c0-4.083,0-7.989,0-11.895
		c-0.005-115.497-0.021-230.995,0.001-346.491c0.002-10.283,1.864-12.324,10.667-12.486c9.418-0.175,11.729,1.931,11.732,11.351
		c0.045,121.816,0.069,243.631,0.045,365.447c-0.001,12.529-1.488,14.115-13.944,14.118c-83.905,0.034-167.811-0.058-251.717-0.075
		c-32.097-0.007-64.193,0.092-96.29,0.11c-13.444,0.007-14.838-1.446-14.834-14.687c0.033-121.059,0.057-242.117,0.074-363.175
		c0.002-11.129,1.945-13.502,11.162-13.424c8.795,0.072,10.758,2.448,10.755,13.21c-0.017,113.981-0.043,227.963-0.067,341.944
		c-0.001,5.018,0,10.032,0,15.814c25.818,0,50.91,0,76.92,0c0.159-2.531,0.472-5.189,0.473-7.847
		c0.033-110.188,0.036-220.376,0.05-330.564c0.001-7.582-0.036-15.164,0.114-22.745c0.146-7.396,2.985-9.775,11.197-9.736
		c8.276,0.04,10.793,2.207,10.809,9.988c0.057,27.547-0.02,55.095-0.013,82.642c0,1.964,0.259,3.927,0.432,6.369
		c38.375,0,76.383,0,115.138,0c0.178-3.164,0.481-6.096,0.484-9.03c0.022-26.031-0.046-52.063-0.006-78.094
		c0.016-10.388,8.992-16.004,17.973-10.658c2.423,1.442,4,6.23,4.02,9.497c0.26,41.947,0.161,83.898,0.163,125.849
		c0.002,75.061,0.01,150.123,0.016,225.184C-430.472,417.082-430.472,419.827-430.472,423.718z M-568.375,322.656
		c38.76,0,76.752,0,115.333,0c0-50.428,0-100.306,0-150.475c-38.597,0-76.795,0-115.333,0
		C-568.375,222.54-568.375,272.222-568.375,322.656z M-568.237,342.635c0,27.241,0,53.878,0,80.675
		c1.376,0.278,2.33,0.64,3.286,0.641c35.596,0.062,71.194,0.003,106.79,0.209c5.885,0.034,5.607-3.431,5.603-7.388
		c-0.025-22.722,0.021-45.443-0.019-68.165c-0.003-1.909-0.448-3.818-0.717-5.972C-491.86,342.635-529.884,342.635-568.237,342.635z"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      fill="currentColor"
      d="M-510.188,279.775c-18.385-0.09-32.815-14.012-32.743-31.592
		c0.078-19.39,14.203-33.035,33.933-32.781c18.256,0.232,32.008,14.219,31.83,32.372
		C-477.35,266.251-491.398,279.865-510.188,279.775z"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      fill="currentColor"
      d="M452.969,385.953c8.365,11.172,13.784,22.398,14.169,35.52
		c0.97,33.001-23.094,59.998-58.276,65.691c-23.825,3.858-46.884,0.661-69.303-7.455c-23.018-8.331-46.085-16.634-68.593-26.218
		c-11.125-4.735-21.286-4.968-32.188-0.985c-24.423,8.92-48.856,17.812-73.329,26.589c-26.988,9.679-54.332,13.319-82.453,4.845
		c-37.929-11.431-57.013-51.934-39.938-85.377c2.152-4.215,5.163-7.988,8.14-12.521c-2.778-0.455-5.363-0.816-7.921-1.311
		c-6.613-1.271-11.277-4.713-11.708-11.882c-0.436-7.228,3.873-10.843,10.334-12.994c29.7-9.888,51.398-28.739,62.814-58.183
		c4.817-12.428,8.535-25.33,12-38.221c2.744-10.219,4.803-20.677,6.347-31.15c3.117-21.139,15.478-35.513,34.441-42.634
		c15.383-5.776,31.983-9.55,48.348-11.229c37.287-3.826,74.696-2.998,111.891,2.407c3.742,0.542,7.476,1.253,11.144,2.179
		c29.985,7.567,49.252,24.641,53.556,56.995c3.063,23.005,8.531,45.589,18.544,66.903c12.239,26.054,32.571,42.676,59.03,52.313
		c7.043,2.567,12.728,5.332,12.1,13.908c-0.632,8.636-6.997,10.903-14.133,12.104C456.75,385.456,455.503,385.6,452.969,385.953z
		 M349.351,380.938c22.559-5.207,44.591-10.292,65.844-15.198c-21.295-14.259-34.09-36.187-41.66-60.99
		c-6.316-20.705-10.731-42.029-15.252-63.235c-2.603-12.199-8.421-21.847-19.275-27.536c-7.493-3.928-15.683-7.387-23.948-8.821
		c-40.118-6.958-80.549-6.446-120.72-1.157c-27.288,3.593-46.766,14.374-51.093,48.319c-3.353,26.298-10.448,51.963-22.947,75.726
		c-8.063,15.329-18.981,28.356-31.292,37.839c21.579,4.881,43.649,9.87,65.898,14.9c2.782-32.225,1.914-64.813,10.845-96.734
		c3.391,5.742,6.687,11.605,7.304,17.737c2.811,27.851,5.131,55.761,6.972,83.693c0.376,5.7,1.938,8.371,7.18,10.391
		c16.481,6.349,32.923,12.864,49.054,20.044c10.991,4.894,21.167,4.504,32.048-0.255c16.178-7.071,32.634-13.52,49.131-19.822
		c5.219-1.994,7.322-4.57,7.175-10.417c-0.683-27.074,0.461-54.083,6.247-80.647c1.563-7.172,4.538-14.037,6.866-21.044
		c0.918,0.153,1.838,0.309,2.758,0.463C349.008,316.034,346.237,349.057,349.351,380.938z M286.941,432.689
		c-0.079,1.088-0.158,2.176-0.239,3.265c27.231,9.542,54.116,20.283,81.813,28.198c18.129,5.18,37.17,3.217,54.737-5.163
		c14.835-7.077,22.918-22.883,20.243-38.77c-2.938-17.458-13.413-27.878-31.437-29.232c-7.861-0.591-16.437,0.155-23.815,2.763
		c-31.831,11.245-63.35,23.382-94.947,35.28C291.039,429.881,289.054,431.453,286.941,432.689z M217.074,435.064
		c0.106-0.737,0.21-1.474,0.315-2.211c-2.978-1.666-5.817-3.684-8.96-4.944c-20.148-8.091-40.176-16.531-60.616-23.818
		c-14.693-5.238-29.757-9.88-45.024-12.948c-19.629-3.943-35.415,6.226-40.621,24.146c-5.421,18.653,2.804,36.463,20.567,44.568
		c15.768,7.198,32.651,8.94,48.96,4.902c19.73-4.881,38.8-12.491,58.066-19.177C198.974,442.384,207.977,438.588,217.074,435.064z"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      fill="currentColor"
      d="M252.35,164.358c-45.278-0.331-79.993-35.13-79.55-79.742
		c0.426-42.671,36.587-77.005,80.588-76.519c42.818,0.474,77.766,36.168,77.405,79.057
		C330.436,129.408,294.614,164.666,252.35,164.358z M308.143,87.04c0.026-31.913-24.501-56.311-56.813-56.509
		c-30.682-0.189-55.961,25.041-55.934,55.826c0.026,30.914,25.274,55.872,56.759,56.113
		C281.835,142.696,308.119,116.673,308.143,87.04z"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      fill="currentColor"
      d="M285.797,289.359c-0.203,18.03-15.003,32.591-32.967,32.433
		c-18.073-0.158-33.12-15.055-32.916-32.585c0.208-17.836,15.224-32.548,33.097-32.422
		C271.299,256.911,285.997,271.517,285.797,289.359z"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      fill="currentColor"
      d="M1027.802,481.025c-103.188-1.621-191.701-65.987-220.189-161.107
		c-38.784-129.49,43.271-263.051,176.584-286.28c84.19-14.669,158.073,8.291,215.239,71.333
		c61.68,68.019,75.64,148.583,41.743,234.153c-30.582,77.198-90.794,120.89-171.318,137.214
		C1056.091,479.131,1041.833,479.524,1027.802,481.025z M1027.226,457.087c111.327,1.709,205.58-87.463,207.541-198.048
		c2.146-120.935-94.141-205.76-200.165-208.781c-117.581-3.35-212.798,87.152-213.698,202.167
		C820.025,364.553,913.46,456.807,1027.226,457.087z"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      fill="currentColor"
      d="M1140.904,254.566c-0.951,61.91-51.69,111.797-112.906,111.012
		c-62.95-0.81-113.892-52.427-112.542-114.039c1.342-61.263,53.252-110.064,115.841-108.909
		C1091.759,143.747,1141.818,194.871,1140.904,254.566z M1028.58,167.113c-48.046-0.016-87.898,38.848-88.048,85.859
		c-0.154,49.1,38.712,88.114,87.932,88.272c48.029,0.153,87.539-39.093,87.659-87.073
		C1116.243,206.288,1076.866,167.129,1028.58,167.113z"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      fill="currentColor"
      d="M1080.377,253.643c-0.116,29.215-22.74,51.8-51.845,51.758
		c-29.726-0.041-52.313-22.641-52.166-52.195c0.137-28.168,23.306-50.686,52.231-50.766
		C1057.082,202.36,1080.489,225.509,1080.377,253.643z"
    />
  </svg>
);

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
  const meditationsHref = isAdmin ? "/admin/meditations" : "/meditations";
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
        <Link
          href={meditationsHref}
          className={styles.addFab}
          aria-label="Meditációs tér"
          title="Meditációs tér"
        >
          <MeditationsIcon />
        </Link>
        <Link
          href="/yogis-choice"
          className={styles.addFab}
          aria-label="Yogi's choice"
          title="Yogi's choice"
        >
          <YogaIcon />
        </Link>
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
