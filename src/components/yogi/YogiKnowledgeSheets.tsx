"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Anatomy, KnowledgeCard, Pose } from "@/lib/yogiKnowledgeSchema";
import type { YogaVideoMeta, YogaVideoStyle } from "@/lib/yogaVideoMetaSchema";
import { ACTIVITY_CATEGORY_META } from "@/types/activity";
import styles from "./YogiKnowledgeSheets.module.css";
import videoStyles from "./YogiKnowledgeAdmin.module.css";

type SheetProps = {
  title?: string;
  children: React.ReactNode;
  className?: string;
};

function SheetSection({ title, children, className }: SheetProps) {
  return (
    <section className={`${styles.section} ${className ?? ""}`}>
      {title && <h3 className={styles.sectionTitle}>{title}</h3>}
      {children}
    </section>
  );
}

function mapCategory(value: string) {
  const map: Record<string, string> = {
    standing: "Álló",
    seated: "Ülő",
    supine: "Fekvő hanyatt",
    prone: "Fekvő hason",
    kneeling: "Térdelő",
    balance: "Egyensúly",
    twist: "Csavarás",
    backbend: "Hátrahajlás",
    forward_fold: "Előrehajlás",
    restorative: "Regeneráló",
  };
  return map[value] ?? value;
}

function mapLevel(value: string) {
  const map: Record<string, string> = {
    beginner: "Kezdő",
    intermediate: "Középhaladó",
    advanced: "Haladó",
    all_levels: "Minden szint",
  };
  return map[value] ?? value;
}

function mapPurpose(value: string) {
  const map: Record<string, string> = {
    mobilizing: "Mobilizáló",
    stretching: "Nyújtó",
    strengthening: "Erősítő",
    stabilizing: "Stabilizáló",
    restorative: "Regeneráló",
    grounding: "Földelő",
    energizing: "Energizáló",
  };
  return map[value] ?? value;
}

function mapTag(value: string) {
  const key = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const map: Record<string, string> = {
    abs: "Has",
    adductors: "Combközelítők",
    advanced: "Haladó",
    alignment: "Igazítás",
    ankles: "Bokák",
    "arm strength": "Karerő",
    "arm support": "Kartámasz",
    "arms extended": "Nyújtott karok",
    asymmetrical: "Aszimmetrikus",
    backbend: "Hátrahajlás",
    balance: "Egyensúly",
    beginner: "Kezdő",
    bind: "Kötés",
    "cactus arms": "Kaktusz karok",
    calves: "Vádli",
    "chest opening": "Mellkasnyitás",
    "chest opener": "Mellkasnyitás",
    core: "Core",
    "cross legged": "Keresztbe tett lábak",
    csuklaterhelas: "Csuklóterhelés",
    csukloterheles: "Csuklóterhelés",
    "deep stretch": "Mély nyújtás",
    drishti: "Drishti",
    "flat back": "Egyenes hát",
    floor: "Talajon",
    flow: "Flow",
    focus: "Fókusz",
    "forward bend": "Előrehajlás",
    "forward fold": "Előrehajlás",
    foundation: "Alap",
    gentle: "Gyengéd",
    "gentle backbend": "Enyhe hátrahajlás",
    glutes: "Farizmok",
    hatrahajlas: "Hátrahajlás",
    "hamstring stretch": "Combhajlító nyújtás",
    hamstrings: "Combhajlítók",
    "hamstrings stretch": "Combhajlító nyújtás",
    "hands and knees": "Négykézláb",
    "hip flexor stretch": "Csípőhajlító nyújtás",
    "hip hinge": "Csípőből hajlás",
    "hip opener": "Csípőnyitás",
    "hip opening": "Csípőnyitás",
    hips: "Csípő",
    "inner thighs": "Belső comb",
    inversion: "Fordított póz",
    "inversion like": "Fordított jelleg",
    kneeling: "Térdelő",
    lateral: "Oldalirányú",
    "lateral lunge": "Oldalsó kitörés",
    "lateral opening": "Oldalnyitás",
    "leg strength": "Láberő",
    legs: "Lábak",
    levezetas: "Levezetés",
    levezetes: "Levezetés",
    "lower back": "Derék",
    lunge: "Kitörés",
    meditation: "Meditáció",
    mobility: "Mobilitás",
    "neutral spine": "Semleges gerinc",
    obliques: "Ferde hasizmok",
    pihenas: "Pihenés",
    pihenes: "Pihenés",
    plank: "Plank",
    posture: "Testtartás",
    "prep headstand": "Fejenállás előkészítés",
    "prep pose": "Előkészítő póz",
    prone: "Hason fekvő",
    "quad stretch": "Combfeszítő nyújtás",
    quads: "Combfeszítők",
    relaxacia: "Relaxáció",
    relaxacio: "Relaxáció",
    restorative: "Regeneráló",
    seated: "Ülő",
    "shoulder opener": "Vállnyitás",
    "shoulder opening": "Vállnyitás",
    "side bend": "Oldalhajlás",
    "side body": "Oldalsó törzs",
    "spinal flexion": "Gerinchajlítás",
    "spinal mobility": "Gerincmobilitás",
    spine: "Gerinc",
    squat: "Guggolás",
    stability: "Stabilitás",
    standing: "Álló",
    "standing balance": "Álló egyensúly",
    strength: "Erő",
    strengthening: "Erősítés",
    stretch: "Nyújtás",
    supine: "Hanyatt fekvő",
    transition: "Átmenet",
    twist: "Csavarás",
    vallnyitas: "Vállnyitás",
    vinyasa: "Vinyasa",
    "vinyasa transition": "Vinyasa átmenet",
    warmup: "Bemelegítés",
    warrior: "Harcos",
    "wide stance": "Széles terpesz",
    "wrist extension": "Csuklófeszítés",
    yin: "Yin",
  };
  return map[key] ?? value;
}

function mapAnatomyType(value: string) {
  const map: Record<string, string> = {
    muscle: "Izom",
    joint: "Ízület",
    area: "Terület",
    system: "Rendszer",
  };
  return map[value] ?? value;
}

function normalizeKey(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeToken(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildTagSet(pose: Pose) {
  return new Set(
    (pose.tags ?? [])
      .map((tag) => normalizeToken(String(tag)))
      .filter((tag) => tag.length > 0),
  );
}

function intersectCount(a: Set<string>, b: Set<string>) {
  let count = 0;
  a.forEach((item) => {
    if (b.has(item)) count += 1;
  });
  return count;
}

function computeRelatedPoses(pose: Pose, pool: Pose[], limit: number) {
  const poseTags = buildTagSet(pose);
  const posePurposes = new Set(pose.purpose ?? []);
  const scored = pool
    .filter((candidate) => candidate.id !== pose.id)
    .map((candidate) => {
      const candidateTags = buildTagSet(candidate);
      const candidatePurposes = new Set(candidate.purpose ?? []);
      const sharedTags = intersectCount(poseTags, candidateTags);
      const sharedPurposes = intersectCount(posePurposes, candidatePurposes);
      let score = 0;
      score += sharedTags * 1;
      score += sharedPurposes * 2;
      if (pose.category === candidate.category) score += 3;
      if (pose.level === candidate.level) score += 2;
      return { candidate, score };
    })
    .filter((entry) => entry.score >= 2)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.candidate.name_hu.localeCompare(b.candidate.name_hu, "hu");
    })
    .slice(0, limit);

  if (scored.length > 0) return scored.map((entry) => entry.candidate);

  return pool
    .filter((candidate) => candidate.id !== pose.id)
    .sort((a, b) => {
      const catA = a.category === pose.category ? 1 : 0;
      const catB = b.category === pose.category ? 1 : 0;
      if (catB !== catA) return catB - catA;
      const lvlA = a.level === pose.level ? 1 : 0;
      const lvlB = b.level === pose.level ? 1 : 0;
      if (lvlB !== lvlA) return lvlB - lvlA;
      return a.name_hu.localeCompare(b.name_hu, "hu");
    })
    .slice(0, limit);
}

type YogaTemplate = {
  id: string;
  category: string;
  label: string;
  duration_minutes: number | null;
  intensity: number | null;
  link: string | null;
};

const VIDEO_STYLE_META: Record<YogaVideoStyle, { label: string; color: string }> = {
  flow: { label: "Flow", color: "#14b8a6" },
  vinyasa: { label: "Vinyasa", color: "#f97316" },
  yin: { label: "Yin", color: "#6366f1" },
  restorative: { label: "Restorative", color: "#22c55e" },
  power: { label: "Power", color: "#ef4444" },
  mobility: { label: "Mobility", color: "#0ea5e9" },
  stretch: { label: "Stretch", color: "#a855f7" },
  breath: { label: "Breath", color: "#84cc16" },
};

type PillTone = "category" | "level" | "duration" | "purpose" | "tag" | "neutral";

function Pill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  return <span className={`${styles.pill} ${styles[`pill_${tone}`]}`}>{children}</span>;
}

function HeaderPill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  return <span className={`${styles.headerPill} ${styles[`pill_${tone}`]}`}>{children}</span>;
}

function Pills({ items, tone }: { items: string[]; tone: PillTone }) {
  if (!items || items.length === 0) return <p className={styles.empty}>{"Nincs megadva."}</p>;
  return (
    <div className={styles.pillRow}>
      {items.map((item) => (
        <Pill key={item} tone={tone}>
          {item}
        </Pill>
      ))}
    </div>
  );
}

function List({ items }: { items: string[] }) {
  if (!items || items.length === 0) return <p className={styles.empty}>{"Nincs megadva."}</p>;
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function TextBlock({ value }: { value?: string | null }) {
  if (!value) return <p className={styles.empty}>{"Nincs megadva."}</p>;
  return <p className={styles.text}>{value}</p>;
}

type ImageSlotLike = {
  asset_ref?: string | null;
  status?: string | null;
};

function resolveImageUrl(url?: string | null) {
  if (!url) return "";
  return `/api/yogi-knowledge/image-proxy?url=${encodeURIComponent(url)}`;
}

function hexToRgba(hex: string, alpha: number) {
  const sanitized = hex.replace("#", "");
  const value =
    sanitized.length === 3
      ? sanitized
          .split("")
          .map((char) => char + char)
          .join("")
      : sanitized;
  const num = Number.parseInt(value, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function ImageSlotFrame({
  slot,
  label,
  tone = "neutral",
  className,
}: {
  slot?: ImageSlotLike;
  label: string;
  tone?: PillTone;
  className?: string;
}) {
  const hasImage = Boolean(slot?.status === "verified" && slot?.asset_ref);
  return (
    <div className={`${styles.imageFrame} ${className ?? ""}`}>
      {hasImage ? (
        <img
          src={resolveImageUrl(slot?.asset_ref)}
          alt={label}
          className={styles.imageFrameImg}
        />
      ) : (
        <div className={styles.imageFrameInner}>
          <span className={styles.poseFrameLabel}>{label}</span>
        </div>
      )}
    </div>
  );
}

export function YogiPoseSheet({ pose }: { pose: Pose }) {
  const title = pose.name_en;
  const subtitle = pose.sanskrit_name ?? pose.name_hu;
  const [relatedPoses, setRelatedPoses] = useState<Pose[]>([]);
  const [publishedPoses, setPublishedPoses] = useState<Pose[]>([]);
  const [relatedIndex, setRelatedIndex] = useState(0);
  const relatedPageSize = 5;
  const [poseVideos, setPoseVideos] = useState<YogaTemplate[]>([]);
  const [poseVideoMeta, setPoseVideoMeta] = useState<Map<string, YogaVideoMeta>>(new Map());
  const [poseVideosLoading, setPoseVideosLoading] = useState(false);
  const [poseVideosError, setPoseVideosError] = useState<string | null>(null);
  const [publicVideoId, setPublicVideoId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadRelated = async () => {
      try {
        const response = await fetch("/api/yogi-knowledge/poses");
        const data = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(data?.poses)) return;
        const published = (data.poses as Pose[]).filter(
          (item) => item.content_status === "published",
        );
        const relatedFromLinks = published.filter((item) =>
          pose.related_pose_ids.includes(item.id),
        );
        const related =
          relatedFromLinks.length > 0
            ? relatedFromLinks.sort((a, b) => a.name_en.localeCompare(b.name_en, "en"))
            : computeRelatedPoses(pose, published, 8);
        if (active) {
          setRelatedPoses(related);
          setPublishedPoses(published);
        }
      } catch {
        if (active) {
          setRelatedPoses([]);
          setPublishedPoses([]);
        }
      }
    };
    loadRelated();
    return () => {
      active = false;
    };
  }, [pose.related_pose_ids]);

  useEffect(() => {
    setRelatedIndex(0);
  }, [relatedPoses]);

  useEffect(() => {
    let active = true;
    const loadPoseVideos = async () => {
      setPoseVideosLoading(true);
      setPoseVideosError(null);
      try {
        const [templatesRes, metaRes] = await Promise.all([
          fetch("/api/yogis-choice/yoga-templates"),
          fetch("/api/yogis-choice/yoga-video-meta"),
        ]);
        const templatesData = await templatesRes.json().catch(() => null);
        const metaData = await metaRes.json().catch(() => null);
        if (!templatesRes.ok || !Array.isArray(templatesData?.templates)) {
          if (active) setPoseVideosError("Nem sikerült betölteni a YouTube jógákat.");
          return;
        }
        if (!metaRes.ok || !Array.isArray(metaData?.items)) {
          if (active) setPoseVideosError("Nem sikerült betölteni a YouTube jóga meta adatokat.");
          return;
        }

        const metaMap = new Map<string, YogaVideoMeta>();
        (metaData.items as YogaVideoMeta[]).forEach((item) => {
          metaMap.set(item.yoga_id, item);
        });

        const targetTokens = new Set([
          pose.id,
          pose.slug,
          normalizeToken(pose.id),
          normalizeToken(pose.slug),
          normalizeToken(pose.name_en),
          normalizeToken(pose.name_hu),
        ]);

        const linked = (templatesData.templates as YogaTemplate[]).filter((template) => {
          const meta = metaMap.get(template.id);
          const poseIds = (meta?.pose_ids ?? []).map((id) => normalizeToken(id));
          return poseIds.some((id) => targetTokens.has(id));
        });

        if (active) {
          setPoseVideoMeta(metaMap);
          setPoseVideos(linked);
        }
      } catch {
        if (active) setPoseVideosError("Nem sikerült betölteni a YouTube jógákat.");
      } finally {
        if (active) setPoseVideosLoading(false);
      }
    };

    loadPoseVideos();
    return () => {
      active = false;
    };
  }, [pose.id]);

  const publishedPoseMap = useMemo(() => {
    const map = new Map<string, Pose>();
    publishedPoses.forEach((item) => map.set(item.id, item));
    return map;
  }, [publishedPoses]);

  const publicTemplate = useMemo(
    () => (publicVideoId ? poseVideos.find((item) => item.id === publicVideoId) ?? null : null),
    [publicVideoId, poseVideos],
  );
  const publicMeta = useMemo(
    () => (publicTemplate ? poseVideoMeta.get(publicTemplate.id) ?? null : null),
    [publicTemplate, poseVideoMeta],
  );
  const publicCategoryMeta = useMemo(() => {
    if (!publicTemplate) return null;
    const categoryKey =
      publicTemplate.category === "relax" || publicTemplate.category === "strong"
        ? (publicTemplate.category as "relax" | "strong")
        : "relax";
    return ACTIVITY_CATEGORY_META.yoga[categoryKey];
  }, [publicTemplate]);
  const publicStyleMeta = useMemo(() => {
    const styleKey = publicMeta?.style ?? null;
    return styleKey ? VIDEO_STYLE_META[styleKey] : null;
  }, [publicMeta]);
  const publicStyleLabel = publicStyleMeta?.label ?? (publicMeta?.style ?? "nincs stílus");
  const publicDurationLabel = publicTemplate
    ? publicTemplate.duration_minutes !== null && publicTemplate.duration_minutes !== undefined
      ? `${publicTemplate.duration_minutes} perc`
      : "Ismeretlen hossz"
    : "";
  return (
    <div className={styles.sheet}>

      <div className={styles.poseTop}>
        <div className={styles.poseVisual}>
          <div className={styles.poseHeaderOverlay}>
            <div className={styles.poseHeaderBlock}>
              <div className={styles.poseTitleRow}>
                <p className={styles.nameEn}>{title}</p>
                <p className={styles.nameHu}>{subtitle}</p>
              </div>
              <div className={styles.poseHeaderPills}>
                <HeaderPill tone="category">{mapCategory(pose.category)}</HeaderPill>
                <HeaderPill tone="level">{mapLevel(pose.level)}</HeaderPill>
                <HeaderPill tone="duration">{`${pose.duration.min_seconds}–${pose.duration.max_seconds} mp`}</HeaderPill>
              </div>
            </div>
          </div>
          <div className={styles.mannequinGrid}>
            {pose.mannequin_angled?.status === "verified" && (
              <ImageSlotFrame
                slot={pose.mannequin_angled}
                label="Mannequin 3/4"
                tone="level"
                className={styles.mannequinFrame}
              />
            )}
            {pose.mannequin_front?.status === "verified" && (
              <ImageSlotFrame
                slot={pose.mannequin_front}
                label="Mannequin front"
                tone="level"
                className={styles.mannequinFrame}
              />
            )}
            {pose.mannequin_angled?.status !== "verified" &&
              pose.mannequin_front?.status !== "verified" && (
              <ImageSlotFrame
                slot={pose.mannequin_angled}
                label="Mannequin preview"
                tone="level"
                className={styles.mannequinFrame}
              />
            )}
          </div>
          <div className={styles.posePills}>
            <div className={styles.posePillGroup}>
              <Pills items={pose.purpose.map(mapPurpose)} tone="purpose" />
            </div>
            <div className={styles.posePillGroup}>
              <Pills items={pose.tags.map(mapTag)} tone="tag" />
            </div>
          </div>
        </div>

        <div className={styles.poseIntro}>
          <div className={styles.fieldStack}>
            <div>
              <p className={styles.metaLabel}>{"Kiindulás"}</p>
              <TextBlock value={pose.setup} />
            </div>
            <div>
              <p className={styles.metaLabel}>{"Belépés"}</p>
              <TextBlock value={pose.entry} />
            </div>
            <div>
              <p className={styles.metaLabel}>{"Kitartás"}</p>
              <TextBlock value={pose.hold} />
            </div>
            <div>
              <p className={styles.metaLabel}>{"Kilépés"}</p>
              <TextBlock value={pose.exit} />
            </div>
            <div>
              <p className={styles.metaLabel}>{"Légzés"}</p>
              <TextBlock value={pose.breath} />
            </div>
          </div>
        </div>
      </div>

      <SheetSection title="Megfigyelés">
        <div className={styles.tripleCol}>
          <div>
            <p className={styles.metaLabel}>{"Figyeld meg"}</p>
            <List items={pose.self_check_statements} />
          </div>
          <div>
            <p className={styles.metaLabel}>{"Gyakori hibák"}</p>
            <List items={pose.common_mistakes} />
          </div>
        </div>
      </SheetSection>

      <SheetSection title="Testhatások">
        <div className={styles.effectsGrid}>
          <div>
            <p className={styles.metaLabel}>{"Nyújtja"}</p>
            <List items={pose.stretches} />
          </div>
          <div>
            <p className={styles.metaLabel}>{"Erősíti"}</p>
            <List items={pose.strengthens} />
          </div>
          <div>
            <p className={styles.metaLabel}>{"Aktiválja"}</p>
            <List items={pose.activates} />
          </div>
          <div>
            <p className={styles.metaLabel}>{"Enyhíti"}</p>
            <List items={pose.relieves} />
          </div>
        </div>
      </SheetSection>

      <SheetSection title="Eszközök">
        <div className={styles.metaGrid}>
          <List items={pose.props} />
        </div>
      </SheetSection>

      <SheetSection title="Biztonság">
        <div>
          <p className={styles.metaLabel}>{"Legyél óvatos"}</p>
          <div className={styles.safetyCardGrid}>
            {pose.contraindications.length > 0 ? (
              pose.contraindications.map((item) => (
                <div key={item} className={styles.safetyCard}>
                  <p className={styles.safetyCardText}>{item}</p>
                </div>
              ))
            ) : (
              <p className={styles.empty}>{"Nincs megadva."}</p>
            )}
          </div>
        </div>
        <div className={styles.painNote}>
          <TextBlock value={pose.pain_notes} />
        </div>
        <div className={styles.safetyModifications}>
          <p className={styles.metaLabel}>{"Enyhítő módosítások"}</p>
          <List items={pose.modifications} />
        </div>
      </SheetSection>

      <SheetSection title="Kapcsolódó pózok" className={styles.sectionTransparent}>
        {relatedPoses.length > relatedPageSize && (
          <div className={styles.relatedHeaderRow}>
            <div className={styles.relatedNav}>
              <button
                type="button"
                className={styles.relatedChevron}
                onClick={() => setRelatedIndex(Math.max(0, relatedIndex - relatedPageSize))}
                disabled={relatedIndex === 0}
                aria-label="Előző"
              >
                <span aria-hidden="true">{"<"}</span>
              </button>
              <button
                type="button"
                className={styles.relatedChevron}
                onClick={() =>
                  setRelatedIndex(
                    Math.min(
                      Math.max(0, relatedPoses.length - relatedPageSize),
                      relatedIndex + relatedPageSize,
                    ),
                  )
                }
                disabled={relatedIndex + relatedPageSize >= relatedPoses.length}
                aria-label="Következő"
              >
                <span aria-hidden="true">{">"}</span>
              </button>
            </div>
          </div>
        )}

        {relatedPoses.length === 0 ? (
          <p className={styles.empty}>{"Nincs megadva."}</p>
        ) : (
          <div className={styles.relatedGrid}>
            {relatedPoses
              .slice(relatedIndex, relatedIndex + relatedPageSize)
              .map((related) => {
                const slot = related.mannequin_angled;
                const hasImage = slot?.status === "verified" && Boolean(slot?.asset_ref);
                const token = related.slug || related.id;
                const idParam = related.id ? `?id=${encodeURIComponent(related.id)}` : "";
                const href = `/yogis-choice/poses/${encodeURIComponent(token)}${idParam}`;
                return (
                  <Link
                    key={related.id}
                    href={href}
                    className={styles.relatedCardLink}
                    aria-label={`${related.name_en} – ${related.sanskrit_name ?? related.name_hu}`}
                  >
                    <div className={styles.relatedCard}>
                      <div className={styles.relatedImage}>
                        {hasImage ? (
                          <img src={resolveImageUrl(slot?.asset_ref)} alt={related.name_en} />
                        ) : (
                          <span>Mannequin</span>
                        )}
                      </div>
                      <div className={styles.relatedText}>
                        <p className={styles.relatedTitle}>{related.name_en}</p>
                        <p className={styles.relatedSubtitle}>
                          {related.sanskrit_name ?? related.name_hu}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
          </div>
        )}
      </SheetSection>
      <SheetSection title="Kapcsolódó YouTube jógák" className={styles.sectionTransparent}>
        {poseVideosError && <p className={styles.empty}>{poseVideosError}</p>}
        {!poseVideosError && poseVideosLoading && <p className={styles.empty}>{"Betöltés..."}</p>}
        {!poseVideosError && !poseVideosLoading && poseVideos.length === 0 && (
          <p className={styles.empty}>{"Nincs megadva."}</p>
        )}
        {!poseVideosError && !poseVideosLoading && poseVideos.length > 0 && (
          <div className={videoStyles.videoGrid}>
            {poseVideos.map((template) => {
              const meta = poseVideoMeta.get(template.id);
              const categoryKey =
                template.category === "relax" || template.category === "strong"
                  ? (template.category as "relax" | "strong")
                  : "relax";
              const categoryMeta = ACTIVITY_CATEGORY_META.yoga[categoryKey];
              const styleKey = meta?.style ?? null;
              const styleMeta = styleKey ? VIDEO_STYLE_META[styleKey] : null;
              const styleLabel = styleMeta?.label ?? (styleKey ?? "nincs stílus");
              const durationLabel =
                template.duration_minutes !== null && template.duration_minutes !== undefined
                  ? `${template.duration_minutes} perc`
                  : "Ismeretlen hossz";
              const poseThumbs = (meta?.pose_ids ?? [])
                .map((poseId) => publishedPoseMap.get(poseId))
                .filter(Boolean)
                .slice(0, 5) as Pose[];
              const cardBody = (
                <div className={videoStyles.videoCardBody}>
                  <div className={videoStyles.videoCardHeader}>
                    <div>
                      <p className={videoStyles.videoCardTitle}>
                        {meta?.title_override ?? template.label}
                      </p>
                      <div className={videoStyles.videoCardSubtitlePills}>
                        <span
                          className={videoStyles.videoCategoryPill}
                          style={{
                            borderColor: categoryMeta.color,
                            backgroundColor: hexToRgba(categoryMeta.color, 0.12),
                            color: categoryMeta.color,
                            ["--pill-icon" as any]: `url(${categoryMeta.icon})`,
                          }}
                        >
                          <span className={videoStyles.videoCategoryIcon} aria-hidden="true" />
                          {categoryMeta.label}
                        </span>
                        <span
                          className={`${videoStyles.videoMetaPill} ${
                            styleMeta ? "" : videoStyles.videoMetaPillMuted
                          }`}
                          style={
                            styleMeta
                              ? {
                                  borderColor: styleMeta.color,
                                  backgroundColor: hexToRgba(styleMeta.color, 0.12),
                                  color: styleMeta.color,
                                }
                              : undefined
                          }
                        >
                          {styleLabel}
                        </span>
                        <span
                          className={`${videoStyles.videoMetaPill} ${videoStyles.videoMetaPillNeutral}`}
                        >
                          {durationLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div
                    className={videoStyles.videoIntensityRow}
                    style={{
                      ["--level-dot-active" as any]: categoryMeta.color,
                      ["--level-dot-active-border" as any]: categoryMeta.color,
                    }}
                  >
                    {Array.from({ length: 3 }).map((_, index) => {
                      const isActive = template.intensity ? index < template.intensity : false;
                      return (
                        <span
                          key={`${template.id}-intensity-${index}`}
                          className={`${videoStyles.videoIntensityDot} ${
                            isActive ? videoStyles.videoIntensityDotActive : ""
                          }`}
                        />
                      );
                    })}
                  </div>
                  <p className={videoStyles.videoCardSummary}>
                    {meta?.description_short ?? "Nincs rövid leírás."}
                  </p>
                  <div className={videoStyles.videoPoseRow}>
                    {poseThumbs.length === 0 && (
                      <span className={videoStyles.videoPoseEmpty}>Nincs póz</span>
                    )}
                    {poseThumbs.map((poseItem) => {
                      const slot = poseItem.mannequin_angled;
                      const hasImage = slot?.status === "verified" && slot?.asset_ref;
                      return (
                        <div key={poseItem.id} className={videoStyles.videoPoseThumb}>
                          {hasImage ? (
                            <img src={resolveImageUrl(slot.asset_ref)} alt={poseItem.name_en} />
                          ) : (
                            <span>{poseItem.name_en}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );

              return (
                <button
                  key={template.id}
                  type="button"
                  className={`${videoStyles.videoCard} ${videoStyles.videoCardStatic}`}
                  onClick={() => setPublicVideoId(template.id)}
                  aria-label={`YouTube jóga: ${template.label}`}
                >
                  {cardBody}
                </button>
              );
            })}
          </div>
        )}
      </SheetSection>

      {publicTemplate && (
        <div className={videoStyles.modalOverlay} onClick={() => setPublicVideoId(null)}>
          <div
            className={`${videoStyles.modal} ${videoStyles.publicVideoModal}`}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="YouTube jóga részletek"
          >
            <div className={videoStyles.modalHeader}>
              <div className={videoStyles.publicVideoHeader}>
                <div className={videoStyles.publicVideoTitleRow}>
                  <p className={videoStyles.publicVideoTitle}>
                    {publicMeta?.title_override ?? publicTemplate.label}
                  </p>
                  <div
                    className={videoStyles.videoIntensityRow}
                    style={
                      publicCategoryMeta
                        ? {
                            ["--level-dot-active" as any]: publicCategoryMeta.color,
                            ["--level-dot-active-border" as any]: publicCategoryMeta.color,
                          }
                        : undefined
                    }
                  >
                    {Array.from({ length: 3 }).map((_, index) => {
                      const isActive = publicTemplate.intensity
                        ? index < publicTemplate.intensity
                        : false;
                      return (
                        <span
                          key={`${publicTemplate.id}-public-intensity-${index}`}
                          className={`${videoStyles.videoIntensityDot} ${
                            isActive ? videoStyles.videoIntensityDotActive : ""
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
                <p className={videoStyles.publicVideoChannel}>
                  {publicMeta?.channel ?? "Nincs megadva csatorna"}
                </p>
                <div className={videoStyles.publicVideoPills}>
                  {publicCategoryMeta && (
                    <span
                      className={videoStyles.videoCategoryPill}
                      style={{
                        borderColor: publicCategoryMeta.color,
                        backgroundColor: hexToRgba(publicCategoryMeta.color, 0.12),
                        color: publicCategoryMeta.color,
                        ["--pill-icon" as any]: `url(${publicCategoryMeta.icon})`,
                      }}
                    >
                      <span className={videoStyles.videoCategoryIcon} aria-hidden="true" />
                      {publicCategoryMeta.label}
                    </span>
                  )}
                  <span
                    className={`${videoStyles.videoMetaPill} ${
                      publicStyleMeta ? "" : videoStyles.videoMetaPillMuted
                    }`}
                    style={
                      publicStyleMeta
                        ? {
                            borderColor: publicStyleMeta.color,
                            backgroundColor: hexToRgba(publicStyleMeta.color, 0.12),
                            color: publicStyleMeta.color,
                          }
                        : undefined
                    }
                  >
                    {publicStyleLabel}
                  </span>
                  <span className={`${videoStyles.videoMetaPill} ${videoStyles.videoMetaPillNeutral}`}>
                    {publicDurationLabel}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setPublicVideoId(null)}
              >
                Bezárás
              </button>
            </div>

            <p className={videoStyles.publicVideoText}>
              {publicMeta?.description_long ?? "Nincs hosszabb leírás."}
            </p>

            <div className={videoStyles.publicVideoPoseRow}>
              {(publicMeta?.pose_ids ?? [])
                .map((poseId) => publishedPoseMap.get(poseId))
                .filter(Boolean)
                .slice(0, 12)
                .map((poseItem) => {
                  const slot = poseItem!.mannequin_angled;
                  const hasImage = slot?.status === "verified" && slot?.asset_ref;
                  return (
                    <div key={poseItem!.id} className={videoStyles.publicVideoPoseThumbLarge}>
                      {hasImage ? (
                        <img src={resolveImageUrl(slot!.asset_ref)} alt={poseItem!.name_en} />
                      ) : (
                        <span>{poseItem!.name_en}</span>
                      )}
                    </div>
                  );
                })}
            </div>

            {publicTemplate.link && (
              <a
                className={videoStyles.publicVideoLink}
                href={publicTemplate.link}
                target="_blank"
                rel="noreferrer"
              >
                Videó megnyitása
              </a>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

export function YogiAnatomySheet({ anatomy }: { anatomy: Anatomy }) {
  const tagSet = new Set((anatomy.tags ?? []).map((tag) => tag.trim()).filter(Boolean));
  const titleKeys = new Set([normalizeKey(anatomy.name_hu), normalizeKey(anatomy.name_en)]);
  const headerTags = Array.from(tagSet)
    .filter((tag) => tag !== anatomy.region)
    .filter((tag) => !titleKeys.has(normalizeKey(tag)));
  return (
    <div className={styles.sheet}>
      <div className={styles.anatomyHeader}>
        <p className={styles.nameEn}>{anatomy.name_hu}</p>
        <p className={styles.nameHu}>
          {anatomy.name_en}
          {anatomy.name_latin ? (
            <span className={styles.nameLatin}> · {anatomy.name_latin}</span>
          ) : null}
        </p>
        <TextBlock value={anatomy.description} />
        <div>
          <p className={styles.metaLabel}>{"Hogyan vesz részt a mozgásban"}</p>
          <TextBlock value={anatomy.role_in_movement} />
        </div>
        <div className={styles.anatomyHeaderPills}>
          <HeaderPill tone="category">{anatomy.region}</HeaderPill>
          <HeaderPill tone="level">{mapAnatomyType(anatomy.type)}</HeaderPill>
          {headerTags.length > 0 && <Pills items={headerTags.map(mapTag)} tone="tag" />}
        </div>
      </div>

      <SheetSection title="Áttekintés">
        <div className={styles.anatomyOverview}>
          <div className={styles.fieldStack}>
            <div>
              <p className={styles.metaLabel}>{"Miért fontos jógában"}</p>
              <TextBlock value={anatomy.why_relevant_in_yoga} />
            </div>
            <div>
              <p className={styles.metaLabel}>{"Gyakori minták"}</p>
              <List items={anatomy.common_patterns} />
            </div>
          </div>
          <div className={styles.anatomyVisual}>
            <ImageSlotFrame
              slot={anatomy.scientific_image}
              label="Scientific sketch"
              tone="category"
              className={styles.anatomyFrame}
            />
          </div>
        </div>
      </SheetSection>

      <SheetSection title="Minták és tudatosítás">
        <div className={styles.tripleCol}>
          <div>
            <p className={styles.metaLabel}>{"Feszülési minták"}</p>
            <List items={anatomy.tension_patterns} />
          </div>
          <div>
            <p className={styles.metaLabel}>{"Gyengeségi minták"}</p>
            <List items={anatomy.weakness_patterns} />
          </div>
          <div>
            <p className={styles.metaLabel}>{"Tudatosítási pontok"}</p>
            <List items={anatomy.awareness_cues} />
          </div>
        </div>
      </SheetSection>

      <SheetSection title="Biztonság">
        <div className={styles.fieldStack}>
          <div>
            <p className={styles.metaLabel}>{"Diszkomfort jelek"}</p>
            <TextBlock value={anatomy.discomfort_notes} />
          </div>
          <div>
            <p className={styles.metaLabel}>{"Biztonságos gyakorlás"}</p>
            <TextBlock value={anatomy.safe_practice_notes} />
          </div>
        </div>
      </SheetSection>
      <SheetSection title="Kapcsolódások">
        <div className={styles.metaGrid}>
          <div>
            <p className={styles.metaLabel}>{"Nyújtó pózok"}</p>
            <List items={anatomy.stretch_pose_ids} />
          </div>
          <div>
            <p className={styles.metaLabel}>{"Erősítő pózok"}</p>
            <List items={anatomy.strengthen_pose_ids} />
          </div>
          <div>
            <p className={styles.metaLabel}>{"Mobilizáló pózok"}</p>
            <List items={anatomy.mobility_pose_ids} />
          </div>
          <div>
            <p className={styles.metaLabel}>{"Óvatosan végzendő pózok"}</p>
            <List items={anatomy.caution_pose_ids} />
          </div>
        </div>
      </SheetSection>

      
    </div>
  );
}

export function YogiKnowledgeCardSheet({ card }: { card: KnowledgeCard }) {
  return (
    <div className={styles.sheet}>
      <header className={styles.header}>
        <div>
          <p className={styles.nameHu}>{card.title_hu}</p>
        </div>
        <div className={styles.metaPills}>
          <span className={styles.pillEmphasis}>{card.category}</span>
        </div>
      </header>

      <SheetSection title="Összefoglaló">
        <TextBlock value={card.summary} />
      </SheetSection>

      <SheetSection title="Kulcspontok">
        <List items={card.key_points} />
      </SheetSection>

      <SheetSection title="Kapcsolódások">
        <div className={styles.metaGrid}>
          <div>
            <p className={styles.metaLabel}>{"Kapcsolódó pózok"}</p>
            <List items={card.related_pose_ids} />
          </div>
          <div>
            <p className={styles.metaLabel}>{"Kapcsolódó anatómia"}</p>
            <List items={card.related_anatomy_ids} />
          </div>
        </div>
      </SheetSection>
    </div>
  );
}




