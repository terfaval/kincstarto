"use client";

import type { Anatomy, KnowledgeCard, Pose } from "@/lib/yogiKnowledgeSchema";
import styles from "./YogiKnowledgeSheets.module.css";

type SheetProps = {
  title?: string;
  children: React.ReactNode;
};

function SheetSection({ title, children }: SheetProps) {
  return (
    <section className={styles.section}>
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
  const map: Record<string, string> = {
    vall: "Váll",
    combhat: "Combhát",
    hat: "Hát",
    csipo: "Csípő",
    mobilitas: "Mobilitás",
    egyensuly: "Egyensúly",
    core: "Core",
  };
  return map[value] ?? value;
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
        <img src={slot?.asset_ref ?? ""} alt={label} className={styles.imageFrameImg} />
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

      <SheetSection title="Kapcsolódások">
        <div className={styles.metaGrid}>
          <div>
            <p className={styles.metaLabel}>{"Érintett anatómia"}</p>
            <List items={pose.anatomy_refs} />
          </div>
          <div>
            <p className={styles.metaLabel}>{"Kapcsolódó pózok"}</p>
            <List items={pose.related_pose_ids} />
          </div>
        </div>
      </SheetSection>

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


