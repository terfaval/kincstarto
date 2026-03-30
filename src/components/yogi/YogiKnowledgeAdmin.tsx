"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./YogiKnowledgeAdmin.module.css";
import {
  YogiAnatomySheet,
  YogiKnowledgeCardSheet,
  YogiPoseSheet,
} from "./YogiKnowledgeSheets";
import poseSpecsRaw from "../../../data/yogi/pose-image-specs.v1.json";
import type { Pose } from "@/lib/yogiKnowledgeSchema";
import { buildAnatomyImageSlot, buildPoseImageSlots } from "@/lib/yogiImagePrompts";
import { compilePoseSpec } from "@/lib/yogiPosePromptCompiler";

type DraftResponse = {
  entity_type: "pose" | "anatomy" | "knowledge_card";
  draft: Record<string, unknown>;
  warnings?: string[];
  uncertain_fields?: string[];
  sources?: Array<{ title: string; url?: string }>;
};

type ApiError = {
  error?: string;
  phase?: string;
  error_code?: string;
  detail?: string;
};

type EntityType = "pose" | "anatomy" | "knowledge_card";
type PoseMode = "known" | "functional";
type ImageSlotKey =
  | "mannequin_front"
  | "mannequin_angled"
  | "scientific_image";

type PoseSpecEntry = {
  id: string;
  slug: string;
  aliases?: string[];
  display_name: string;
};

type PoseSpecLibrary = {
  poses: PoseSpecEntry[];
};

const poseSpecs = poseSpecsRaw as PoseSpecLibrary;

const ENTITY_OPTIONS: Array<{ value: EntityType; label: string }> = [
  { value: "pose", label: "Pose" },
  { value: "anatomy", label: "Anatomy" },
  { value: "knowledge_card", label: "Knowledge Card" },
];

const POSE_MODE_OPTIONS: Array<{ value: PoseMode; label: string }> = [
  { value: "known", label: "Known" },
  { value: "functional", label: "Functional" },
];

function readJsonError(payload: any): string {
  if (!payload || typeof payload !== "object") return "Unknown error";
  const parts = [
    payload.error,
    payload.phase,
    payload.error_code,
    payload.detail,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Unknown error";
}

function normalizeKey(value?: string) {
  return (value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function YogiKnowledgeAdmin() {
  const [entityType, setEntityType] = useState<EntityType>("pose");
  const [poseMode, setPoseMode] = useState<PoseMode>("known");
  const [inputText, setInputText] = useState("");
  const [poseSelection, setPoseSelection] = useState("");
  const [lastPayload, setLastPayload] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [draftResponse, setDraftResponse] = useState<DraftResponse | null>(null);
  const [draftText, setDraftText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveWarnings, setSaveWarnings] = useState<string[]>([]);
  const [saving, setSaving] = useState<"save" | "publish" | null>(null);
  const [imageLoading, setImageLoading] = useState<Record<string, boolean>>({});
  const [poses, setPoses] = useState<Pose[]>([]);
  const [poseLoading, setPoseLoading] = useState(false);
  const [poseError, setPoseError] = useState<string | null>(null);
  const [posePage, setPosePage] = useState(0);

  useEffect(() => {
    const body = document.body;
    body.classList.add("yoga-bg");
    return () => {
      body.classList.remove("yoga-bg");
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadPoses = async () => {
      setPoseLoading(true);
      setPoseError(null);
      try {
        const response = await fetch("/api/admin/yogi-knowledge/poses");
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.poses) {
          if (active) setPoseError(readJsonError(data));
          return;
        }
        if (active) setPoses(data.poses as Pose[]);
      } catch (err) {
        if (active) setPoseError((err as Error)?.message ?? "Failed to load poses");
      } finally {
        if (active) setPoseLoading(false);
      }
    };
    loadPoses();
    return () => {
      active = false;
    };
  }, []);

  const inputLabel = useMemo(() => {
    if (entityType === "pose") {
      return poseMode === "known"
        ? "Pose név vagy slug"
        : "Funkcionális cél / leírás";
    }
    return "Téma / rövid input";
  }, [entityType, poseMode]);

  const resetDraftState = () => {
    setDraftResponse(null);
    setDraftText("");
    setError(null);
    setInputError(null);
    setSaveMessage(null);
    setSaveWarnings([]);
    setLastPayload(null);
    setImageLoading({});
    setInputText("");
    setPoseSelection("");
  };

  const loadPoseIntoEditor = (pose: Pose) => {
    setEntityType("pose");
    setDraftResponse({
      entity_type: "pose",
      draft: pose as Record<string, unknown>,
      warnings: [],
      uncertain_fields: [],
      sources: [],
    });
    setDraftText(JSON.stringify(pose, null, 2));
    setError(null);
    setInputError(null);
    setSaveMessage(null);
    setSaveWarnings([]);
  };

  const requestDraft = async (payload: Record<string, unknown>) => {
    setError(null);
    setInputError(null);
    setSaveMessage(null);
    setSaveWarnings([]);
    setLoading(true);
    setDraftResponse(null);
    setDraftText("");

    try {
      const response = await fetch("/api/admin/yogi-knowledge/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => null)) as
        | DraftResponse
        | ApiError
        | null;

      if (!response.ok || !data || "error" in (data as any)) {
        setError(readJsonError(data));
        return;
      }

      const draft = (data as DraftResponse).draft;
      setDraftResponse(data as DraftResponse);
      setDraftText(JSON.stringify(draft, null, 2));
    } catch (err) {
      setError((err as Error)?.message ?? "Draft failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    const trimmed =
      entityType === "pose" && poseMode === "known"
        ? poseSelection.trim()
        : inputText.trim();
    if (!trimmed) {
      setInputError(
        entityType === "pose" && poseMode === "known"
          ? "Válassz egy pózt a legördülő listából."
          : "Adj meg egy rövid inputot a generáláshoz.",
      );
      return;
    }

    const payload: Record<string, unknown> = { entity_type: entityType };

    if (entityType === "pose") {
      payload.pose_mode = poseMode;
      if (poseMode === "known") payload.pose_name = trimmed;
      if (poseMode === "functional") payload.functional_goal = trimmed;
    } else {
      payload.topic = trimmed;
    }

    setLastPayload(payload);
    await requestDraft(payload);
  };

  const handleRegenerateContent = async () => {
    if (!lastPayload) {
      setError("Nincs elérhető előző generálási payload.");
      return;
    }
    await requestDraft(lastPayload);
  };

  const handleSave = async (intent: "save" | "publish") => {
    setError(null);
    setInputError(null);
    setSaveMessage(null);
    setSaveWarnings([]);
    setSaving(intent);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(draftText) as Record<string, unknown>;
    } catch {
      setError("A draft JSON nem ervenyes.");
      setSaving(null);
      return;
    }

    try {
      const response = await fetch("/api/admin/yogi-knowledge/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type: entityType,
          item: parsed,
          intent: intent === "publish" ? "publish" : "save",
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(readJsonError(data));
        setSaving(null);
        return;
      }

      if (Array.isArray(data?.warnings)) {
        setSaveWarnings(data.warnings);
      }

      setSaveMessage(intent === "publish" ? "Publikálva." : "Mentve.");
    } catch (err) {
      setError((err as Error)?.message ?? "Save failed");
    } finally {
      setSaving(null);
    }
  };

  const handleFormatJson = () => {
    setError(null);
    setInputError(null);

    try {
      const parsed = JSON.parse(draftText) as Record<string, unknown>;
      setDraftText(JSON.stringify(parsed, null, 2));
    } catch {
      setError("A JSON nem formázható, mert érvénytelen.");
    }
  };

  const updateDraft = (
    updater: (draft: Record<string, unknown>) => Record<string, unknown>,
  ) => {
    setError(null);
    setInputError(null);

    try {
      const parsed = JSON.parse(draftText) as Record<string, unknown>;
      const next = updater(parsed);
      setDraftText(JSON.stringify(next, null, 2));
    } catch {
      setError("A draft JSON nem ervenyes.");
    }
  };

  const handleContentVerify = () => {
    updateDraft((draft) => ({ ...draft, content_status: "verified" }));
  };

  const handleGenerateImage = async (slotKey: ImageSlotKey) => {
    setError(null);
    setInputError(null);

    try {
      const parsed = JSON.parse(draftText) as Record<string, unknown>;
      const slot = (parsed as any)[slotKey];
      const prompt = typeof slot?.prompt === "string" ? slot.prompt.trim() : "";

      if (!prompt) {
        setError("Hiányzik az image prompt a generáláshoz.");
        return;
      }

      const slug = (parsed as any)?.slug ?? (parsed as any)?.id ?? "unknown";

      setImageLoading((prev) => ({ ...prev, [slotKey]: true }));

      const response = await fetch("/api/admin/yogi-knowledge/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type: entityType,
          slot: slotKey,
          prompt,
          slug,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data || data.error) {
        setError(readJsonError(data));
        return;
      }

      updateDraft((draft) => {
        const current = (draft as any)[slotKey] ?? {};
        return {
          ...draft,
          [slotKey]: {
            ...current,
            prompt: current.prompt ?? prompt,
            asset_ref: data.asset_ref,
            status: "generated",
            warning: data.warning ?? null,
            warning_detail: data.warning_detail ?? null,
          },
        } as Record<string, unknown>;
      });
    } catch (err) {
      setError((err as Error)?.message ?? "Image generation failed");
    } finally {
      setImageLoading((prev) => ({ ...prev, [slotKey]: false }));
    }
  };

  const handleRefreshSpec = async (slotKey: ImageSlotKey) => {
    setError(null);
    setInputError(null);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(draftText) as Record<string, unknown>;
    } catch {
      setError("A draft JSON nem ervenyes.");
      return;
    }

    if (entityType === "pose") {
      const existingSlot = (parsed as any)?.[slotKey];
      const hasSpec = Boolean(existingSlot?.spec);
      const hasImage = Boolean(existingSlot?.asset_ref);
      if (hasSpec || hasImage) {
        const label = slotKey === "mannequin_front" ? "mannequin front" : "mannequin angled";
        const message =
          `Mar van ${hasSpec ? "spec" : "informacio"}${hasImage ? " es kep" : ""} a(z) ${label} slotban. ` +
          "Biztosan ujrageneralodjon a spec?";
        if (!window.confirm(message)) return;
      }
      try {
        const response = await fetch("/api/admin/yogi-knowledge/spec", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pose: parsed }),
        });

        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.ok) {
          setError(readJsonError(data));
          return;
        }

        updateDraft((draft) => {
          const pose = draft as any;
          const slots = data?.slots ?? {};
          const fresh = slotKey === "mannequin_front" ? slots.mannequin_front : slots.mannequin_angled;
          if (!fresh) return draft;
          const current = pose[slotKey] ?? {};
          return {
            ...pose,
            [slotKey]: {
              ...fresh,
              asset_ref: current.asset_ref ?? fresh.asset_ref,
              status: current.status ?? fresh.status,
              warning: data?.warning ?? null,
              warning_detail: data?.warning_detail ?? null,
              prompt_revision: Date.now(),
            },
          };
        });
      } catch (err) {
        setError((err as Error)?.message ?? "Spec refresh failed");
      }
      return;
    }

    updateDraft((draft) => {
      if (entityType === "anatomy" && slotKey === "scientific_image") {
        const anatomy = draft as any;
        const fresh = buildAnatomyImageSlot(anatomy);
        const current = anatomy.scientific_image ?? {};
        return {
          ...anatomy,
          scientific_image: {
            ...fresh,
            asset_ref: current.asset_ref ?? fresh.asset_ref,
            status: current.status ?? fresh.status,
            warning: null,
            warning_detail: null,
            prompt_revision: Date.now(),
          },
        };
      }

      setError("Ehhez a muvelethez elobb pose vagy anatomy draft szukseges.");
      return draft;
    });
  };

  const handleImageVerify = (slotKey: ImageSlotKey, label: string) => {
    updateDraft((draft) => {
      const slot = (draft as any)[slotKey];

      if (!slot?.asset_ref) {
        setError(`${label} verifikálásához előbb generálj képet vagy adj meg asset_ref mezőt.`);
        return draft;
      }

      if (slot?.status !== "generated") {
        setError(`${label} verifikálásához előbb generáld le a képet.`);
        return draft;
      }

      return {
        ...draft,
        [slotKey]: {
          ...slot,
          status: "verified",
        },
      } as Record<string, unknown>;
    });
  };

  const handleRegenerateImagePrompts = () => {
    updateDraft((draft) => {
      if (entityType === "pose") {
        const pose = draft as any;
        const slots = buildPoseImageSlots(pose);
        const revision = Date.now();
        const mergeSlot = (current: any, fresh: any) => ({
          ...fresh,
          asset_ref: current?.asset_ref ?? fresh.asset_ref,
          status: current?.status ?? fresh.status,
          warning: null,
          warning_detail: null,
          prompt_revision: revision,
        });

        return {
          ...pose,
          mannequin_angled: mergeSlot(pose.mannequin_angled, slots.mannequin_angled),
          mannequin_front: mergeSlot(pose.mannequin_front, slots.mannequin_front),
        };
      }

      if (entityType === "anatomy") {
        const anatomy = draft as any;
        const slot = buildAnatomyImageSlot(anatomy);
        const current = anatomy.scientific_image;
        return {
          ...anatomy,
          scientific_image: {
            ...slot,
            asset_ref: current?.asset_ref ?? slot.asset_ref,
            status: current?.status ?? slot.status,
            warning: null,
            warning_detail: null,
            prompt_revision: Date.now(),
          },
        };
      }

      setError("Ehhez a muvelethez elobb pose vagy anatomy draft szukseges.");
      return draft;
    });
  };

  const handleAssetRefChange = (slotKey: ImageSlotKey, value: string) => {
    updateDraft((draft) => {
      const slot = (draft as any)[slotKey] ?? {};
      const nextStatus =
        value && (slot?.status === "missing" || !slot?.status)
          ? "generated"
          : slot?.status;
      return {
        ...draft,
        [slotKey]: {
          ...slot,
          asset_ref: value,
          status: nextStatus,
        },
      } as Record<string, unknown>;
    });
  };

  const handleImageUnverify = (slotKey: ImageSlotKey, label: string) => {
    updateDraft((draft) => {
      const slot = (draft as any)[slotKey];

      if (!slot) {
        setError(`${label} unverify-hoz nincs slot adat.`);
        return draft;
      }

      if (slot?.status !== "verified") {
        setError(`${label} unverify-hoz eloszor verified status szukseges.`);
        return draft;
      }

      const nextStatus = slot?.asset_ref ? "generated" : "missing";
      return {
        ...draft,
        [slotKey]: {
          ...slot,
          status: nextStatus,
        },
      } as Record<string, unknown>;
    });
  };

  const parsedDraft = useMemo(() => {
    if (!draftText) return null;

    try {
      return JSON.parse(draftText) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [draftText]);

  const availablePoseOptions = useMemo(() => {
    const generatedKeys = new Set<string>();
    poses.forEach((pose) => {
      generatedKeys.add(normalizeKey(pose.slug));
      generatedKeys.add(normalizeKey(pose.id));
      generatedKeys.add(normalizeKey(pose.name_en));
      generatedKeys.add(normalizeKey(pose.name_hu));
    });

    return (poseSpecs.poses ?? [])
      .filter((entry) => {
        const entryKeys = [
          normalizeKey(entry.slug),
          normalizeKey(entry.id),
          normalizeKey(entry.display_name),
          ...(entry.aliases ?? []).map((alias) => normalizeKey(alias)),
        ];
        return !entryKeys.some((key) => key && generatedKeys.has(key));
      })
      .sort((a, b) => a.display_name.localeCompare(b.display_name));
  }, [poses]);

  const sheetPreview = useMemo(() => {
    if (!parsedDraft) {
      return {
        node: null,
        error: draftText ? "A JSON nem értelmezhető sheet megjelenítéshez." : null,
      };
    }

    if (entityType === "pose") {
      return {
        node: <YogiPoseSheet pose={parsedDraft as any} />,
        error: null,
      };
    }

    if (entityType === "anatomy") {
      return {
        node: <YogiAnatomySheet anatomy={parsedDraft as any} />,
        error: null,
      };
    }

    return {
      node: <YogiKnowledgeCardSheet card={parsedDraft as any} />,
      error: null,
    };
  }, [parsedDraft, draftText, entityType]);

  const posePageSize = 3;
  const poseTotalPages = poses.length === 0 ? 0 : Math.ceil(poses.length / posePageSize);
  const safePosePage = poseTotalPages === 0 ? 0 : Math.min(posePage, poseTotalPages - 1);
  const poseSliceStart = safePosePage * posePageSize;
  const poseSlice = poses.slice(poseSliceStart, poseSliceStart + posePageSize);

  return (
    <section className={`admin-stack ${styles.page}`}>
      <div className={`admin-card ${styles.poseGallery}`}>
        <div className={styles.poseGalleryHeader}>
          <div>
            <p className={styles.poseGalleryEyebrow}>Yogi Knowledge</p>
            <h2 className={styles.poseGalleryTitle}>Generált pózok</h2>
            <p className="admin-text-muted">
              A legutóbbi pózok áttekintése. Kattints egy kártyára a szerkesztéshez.
            </p>
          </div>
          <div className={styles.poseGalleryControls}>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={safePosePage === 0}
              onClick={() => setPosePage(Math.max(0, safePosePage - 1))}
            >
              Előző
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={safePosePage >= poseTotalPages - 1}
              onClick={() => setPosePage(Math.min(poseTotalPages - 1, safePosePage + 1))}
            >
              Következő
            </button>
          </div>
        </div>

        {poseError && (
          <div className={styles.poseGalleryEmpty}>Nem sikerült betölteni a pózokat.</div>
        )}

        {!poseError && poseLoading && (
          <div className={styles.poseGalleryEmpty}>Betöltés...</div>
        )}

        {!poseError && !poseLoading && poseSlice.length === 0 && (
          <div className={styles.poseGalleryEmpty}>Még nincs generált póz.</div>
        )}

        {!poseError && !poseLoading && poseSlice.length > 0 && (
          <div className={styles.poseGalleryGrid}>
            {poseSlice.map((pose) => {
              const status = pose.status ?? "draft";
              const subtitle = pose.sanskrit_name ?? pose.name_hu;
              const imageSlot = pose.mannequin_angled;
              const hasImage = imageSlot?.status === "verified" && imageSlot.asset_ref;
              return (
                <button
                  key={pose.id}
                  type="button"
                  className={styles.poseCard}
                  onClick={() => loadPoseIntoEditor(pose)}
                >
                  <div className={styles.poseCardImage}>
                    {hasImage ? (
                      <img src={imageSlot.asset_ref ?? ""} alt={pose.name_en} />
                    ) : (
                      <span>Mannequin 3/4</span>
                    )}
                  </div>
                  <div className={styles.poseCardBody}>
                    <div className={styles.poseCardHeader}>
                      <div>
                        <p className={styles.poseCardTitle}>{pose.name_en}</p>
                        <p className={styles.poseCardSubtitle}>{subtitle}</p>
                      </div>
                      <span className={styles.poseStatusPill}>{status}</span>
                    </div>
                    <p className={styles.poseCardSummary}>{pose.summary}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className={styles.poseGalleryFooter}>
          <span className={styles.poseGalleryPage}>
            {poseTotalPages === 0 ? "0/0" : `${safePosePage + 1} / ${poseTotalPages}`}
          </span>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={`admin-card ${styles.panel}`}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Generálás</h2>
            <p className="admin-text-muted">
              Válassz pózt vagy adj meg rövid inputot a draft létrehozásához.
            </p>
          </div>

          <div className="admin-stack">
            <div className={styles.inlineRow}>
              <label className="form-field">
                <span className="form-field__label">Entity type</span>
                <select
                  className="input"
                  value={entityType}
                  onChange={(event) => {
                    setEntityType(event.target.value as EntityType);
                    resetDraftState();
                  }}
                >
                  {ENTITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {entityType === "pose" && (
                <label className="form-field">
                  <span className="form-field__label">Pose mode</span>
                  <select
                    className="input"
                    value={poseMode}
                    onChange={(event) => {
                      setPoseMode(event.target.value as PoseMode);
                      resetDraftState();
                    }}
                  >
                    {POSE_MODE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {entityType === "pose" && poseMode === "known" ? (
              <label className="form-field">
                <span className="form-field__label">Póz kiválasztása</span>
                <select
                  className="input"
                  value={poseSelection}
                  onChange={(event) => setPoseSelection(event.target.value)}
                  disabled={availablePoseOptions.length === 0}
                >
                  <option value="">Válassz pózt...</option>
                  {availablePoseOptions.map((pose) => (
                    <option key={pose.id} value={pose.slug}>
                      {pose.display_name} ({pose.slug})
                    </option>
                  ))}
                </select>
                <p className="admin-text-muted">
                  {availablePoseOptions.length === 0
                    ? "Nincs olyan póz a libraryben, ami még nincs generálva."
                    : `${availablePoseOptions.length} póz elérhető a libraryből.`}
                </p>
              </label>
            ) : (
              <label className="form-field">
                <span className="form-field__label">{inputLabel}</span>
                <textarea
                  className={`input ${styles.inputTextarea}`}
                  rows={3}
                  value={inputText}
                  onChange={(event) => setInputText(event.target.value)}
                  placeholder="Írd be a rövid inputot..."
                />
              </label>
            )}

            <div className={styles.actionRow}>
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleGenerate}
                disabled={
                  loading ||
                  (entityType === "pose" && poseMode === "known" && !poseSelection)
                }
              >
                {loading ? "Generálás..." : "Draft generálás"}
              </button>

              <button
                type="button"
                className="btn btn--ghost"
                onClick={handleRegenerateContent}
                disabled={loading || !lastPayload}
              >
                Tartalom újragenerálása
              </button>
            </div>
          </div>
        </div>

        <div className={styles.feedbackCol}>
          {(error || inputError) && (
            <div className={`admin-card ${styles.feedbackCard} ${styles.errorCard}`}>
              <h3 className={styles.feedbackTitle}>Hiba</h3>
              <p className={styles.feedbackBody}>{error ?? inputError}</p>
            </div>
          )}

          {saveMessage && (
            <div className={`admin-card ${styles.feedbackCard} ${styles.successCard}`}>
              <h3 className={styles.feedbackTitle}>Mentés</h3>
              <p className={styles.feedbackBody}>{saveMessage}</p>
            </div>
          )}

          {saveWarnings.length > 0 && (
            <div className={`admin-card ${styles.feedbackCard}`}>
              <h3 className={styles.feedbackTitle}>Save warnings</h3>
              <p className={styles.feedbackBody}>{saveWarnings.join(", ")}</p>
            </div>
          )}

          {draftResponse?.warnings && draftResponse.warnings.length > 0 && (
            <div className={`admin-card ${styles.feedbackCard}`}>
              <h3 className={styles.feedbackTitle}>Warnings</h3>
              <p className={styles.feedbackBody}>{draftResponse.warnings.join(", ")}</p>
            </div>
          )}

          {draftResponse?.uncertain_fields && draftResponse.uncertain_fields.length > 0 && (
            <div className={`admin-card ${styles.feedbackCard}`}>
              <h3 className={styles.feedbackTitle}>Uncertain fields</h3>
              <p className={styles.feedbackBody}>
                {draftResponse.uncertain_fields.join(", ")}
              </p>
            </div>
          )}

          {draftResponse?.sources && draftResponse.sources.length > 0 && (
            <div className={`admin-card ${styles.feedbackCard}`}>
              <h3 className={styles.feedbackTitle}>Sources</h3>
              <p className={styles.feedbackBody}>
                {draftResponse.sources
                  .map((source) =>
                    source.url ? `${source.title} (${source.url})` : source.title,
                  )
                  .join(", ")}
              </p>
            </div>
          )}
        </div>
      </div>

      {draftResponse && (
        <div className={`admin-card ${styles.editorCard}`}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Draft editor</h2>
            <p className="admin-text-muted">Szerkesztés után ments vagy publikálj.</p>
          </div>

          <div className={styles.statusBlock}>
            <div className={styles.statusRow}>
              <div>
                <p className={styles.statusLabel}>Content status</p>
                <span className={styles.statusPill}>
                  {(parsedDraft as any)?.content_status ?? "draft"}
                </span>
              </div>

              <button
                type="button"
                className="btn btn--ghost"
                onClick={handleContentVerify}
              >
                Tartalom verifikálása
              </button>
            </div>
          </div>

          <label className="form-field">
            <span className="form-field__label">Draft JSON</span>
            <textarea
              className={`input ${styles.editorTextarea}`}
              rows={20}
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
            />
          </label>

          <div className={styles.editorActions}>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={handleFormatJson}
            >
              JSON formázása
            </button>

            <div className={styles.editorButtons}>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => handleSave("save")}
                disabled={saving !== null}
              >
                {saving === "save" ? "Mentés..." : "Mentés (draft)"}
              </button>

              <button
                type="button"
                className="btn btn--primary"
                onClick={() => handleSave("publish")}
                disabled={saving !== null}
              >
                {saving === "publish" ? "Publikálás..." : "Publikálás (active)"}
              </button>
            </div>
          </div>

          <div className={styles.imageSlots}>
            <div className={styles.imageSlotsHeader}>
              <h3 className={styles.imageSlotsTitle}>Image slots</h3>
              <p className="admin-text-muted">
                Képgenerálás, preview és verifikálás slotonként.
              </p>
            </div>

            {entityType === "pose" && (
              <div className={styles.imageSlotGrid}>
                {(["mannequin_angled", "mannequin_front"] as const).map((slotKey) => {
                    const slot = (parsedDraft as any)?.[slotKey];
                    const label =
                      slotKey === "mannequin_front" ? "Mannequin front (backup)" : "Mannequin angled";
                  const canVerify =
                    slot?.status === "generated" && Boolean(slot?.asset_ref);
                  const canUnverify = slot?.status === "verified";
                  const isLoading = Boolean(imageLoading[slotKey]);

                    return (
                      <div key={slotKey} className={styles.imageSlotCard}>
                        <div className={styles.imageSlotPreview}>
                          {slot?.asset_ref ? (
                            <img src={slot.asset_ref} alt={label} />
                          ) : (
                            <span className={styles.imageSlotPlaceholder}>{label}</span>
                          )}
                        </div>

                      <div className={styles.imageSlotMeta}>
                        <span className={styles.statusPill}>
                          {slot?.status ?? "missing"}
                        </span>
                        <span className={styles.imageSlotUrl}>
                          {slot?.asset_ref ?? "-"}
                        </span>
                      </div>

                      <div className={styles.imageSlotActions}>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={() => handleRefreshSpec(slotKey)}
                        >
                          Spec refresh
                        </button>

                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={() => handleGenerateImage(slotKey)}
                          disabled={isLoading}
                        >
                          {slot?.status === "missing" ? "Generate" : "Regenerate"}
                        </button>

                        <button
                          type="button"
                          className="btn btn--primary"
                          onClick={() => handleImageVerify(slotKey, label)}
                          disabled={!canVerify}
                        >
                          Verify
                        </button>

                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={() => handleImageUnverify(slotKey, label)}
                          disabled={!canUnverify}
                        >
                          Unverify
                        </button>
                      </div>

                      <label className={`form-field ${styles.imageSlotField}`}>
                        <span className="form-field__label">Asset ref / URL</span>
                        <input
                          className="input"
                          type="text"
                          value={slot?.asset_ref ?? ""}
                          onChange={(event) =>
                            handleAssetRefChange(slotKey, event.target.value)
                          }
                          placeholder="Adj meg asset_ref-et vagy URL-t..."
                        />
                      </label>

                      {slot?.warning && (
                        <div className={styles.imageSlotWarning}>
                          <p className={styles.imageSlotWarningTitle}>Reference warning</p>
                          <p className={styles.imageSlotWarningText}>{slot.warning}</p>
                          {slot?.warning_detail ? (
                            <p className={styles.imageSlotWarningDetail}>{slot.warning_detail}</p>
                          ) : null}
                        </div>
                      )}

                      {slot?.spec && (
                        <div className={styles.imageSlotSpec}>
                          <p className={styles.imageSlotLabel}>Image spec</p>
                          <p className={styles.imageSlotText}>{slot.spec}</p>
                        </div>
                      )}

                      {entityType === "pose" && slot?.spec && (
                        <div className={styles.imageSlotSpec}>
                          <p className={styles.imageSlotLabel}>Compiled spec</p>
                          <p className={styles.imageSlotText}>
                            {compilePoseSpec(slot.spec)}
                          </p>
                        </div>
                      )}

                      <div className={styles.imageSlotPrompt}>
                        <p className={styles.imageSlotLabel}>Prompt</p>
                        <p className={styles.imageSlotText}>{slot?.prompt ?? "-"}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {entityType === "anatomy" && (
              <div className={styles.imageSlotGrid}>
                {(["scientific_image"] as const).map((slotKey) => {
                  const slot = (parsedDraft as any)?.[slotKey];
                  const label = "Scientific image";
                  const canVerify =
                    slot?.status === "generated" && Boolean(slot?.asset_ref);
                  const canUnverify = slot?.status === "verified";
                  const isLoading = Boolean(imageLoading[slotKey]);

                  return (
                    <div key={slotKey} className={styles.imageSlotCard}>
                      <div className={styles.imageSlotPreview}>
                        {slot?.asset_ref ? (
                          <img src={slot.asset_ref} alt={label} />
                        ) : (
                          <span className={styles.imageSlotPlaceholder}>{label}</span>
                        )}
                      </div>

                      <div className={styles.imageSlotMeta}>
                        <span className={styles.statusPill}>
                          {slot?.status ?? "missing"}
                        </span>
                        <span className={styles.imageSlotUrl}>
                          {slot?.asset_ref ?? "-"}
                        </span>
                      </div>

                      <div className={styles.imageSlotActions}>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={() => handleRefreshSpec(slotKey)}
                        >
                          Spec refresh
                        </button>

                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={() => handleGenerateImage(slotKey)}
                          disabled={isLoading}
                        >
                          {slot?.status === "missing" ? "Generate" : "Regenerate"}
                        </button>

                        <button
                          type="button"
                          className="btn btn--primary"
                          onClick={() => handleImageVerify(slotKey, label)}
                          disabled={!canVerify}
                        >
                          Verify
                        </button>

                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={() => handleImageUnverify(slotKey, label)}
                          disabled={!canUnverify}
                        >
                          Unverify
                        </button>
                      </div>

                      <label className={`form-field ${styles.imageSlotField}`}>
                        <span className="form-field__label">Asset ref / URL</span>
                        <input
                          className="input"
                          type="text"
                          value={slot?.asset_ref ?? ""}
                          onChange={(event) =>
                            handleAssetRefChange(slotKey, event.target.value)
                          }
                          placeholder="Adj meg asset_ref-et vagy URL-t..."
                        />
                      </label>

                      {slot?.warning && (
                        <div className={styles.imageSlotWarning}>
                          <p className={styles.imageSlotWarningTitle}>Reference warning</p>
                          <p className={styles.imageSlotWarningText}>{slot.warning}</p>
                          {slot?.warning_detail ? (
                            <p className={styles.imageSlotWarningDetail}>{slot.warning_detail}</p>
                          ) : null}
                        </div>
                      )}

                      {slot?.spec && (
                        <div className={styles.imageSlotSpec}>
                          <p className={styles.imageSlotLabel}>Image spec</p>
                          <p className={styles.imageSlotText}>{slot.spec}</p>
                        </div>
                      )}

                      <div className={styles.imageSlotPrompt}>
                        <p className={styles.imageSlotLabel}>Prompt</p>
                        <p className={styles.imageSlotText}>{slot?.prompt ?? "-"}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {sheetPreview.error && (
            <div className={`admin-card ${styles.inlineCard} ${styles.errorCard}`}>
              <p className={styles.feedbackBody}>{sheetPreview.error}</p>
            </div>
          )}

          <div className={styles.sheetPreview}>{sheetPreview.node}</div>

          <div className={styles.sheetActions}>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={handleRegenerateImagePrompts}
            >
              Image promptok újragenerálása
            </button>
            <p className={styles.sheetActionHint}>
              Csak a prompt mezőket frissíti, az asset_ref és státusz nem változik.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}


