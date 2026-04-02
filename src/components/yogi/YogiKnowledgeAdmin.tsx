"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./YogiKnowledgeAdmin.module.css";
import {
  YogiAnatomySheet,
  YogiKnowledgeCardSheet,
  YogiPoseSheet,
} from "./YogiKnowledgeSheets";
import type { Pose } from "@/lib/yogiKnowledgeSchema";
import {
  ContentStatusEnum,
  PoseCategoryEnum,
  PoseLevelEnum,
  PosePurposeEnum,
} from "@/lib/yogiKnowledgeSchema";
import { buildAnatomyImageSlot, buildPoseImageSlots } from "@/lib/yogiImagePrompts";
import { compilePoseSpec } from "@/lib/yogiPosePromptCompiler";
import { KNOWN_POSES } from "@/lib/yogiKnownPoses";
import { normalizeSlug } from "@/lib/slug";
import { collectPropCatalog } from "@/lib/yogiPropCatalog";
import {
  YogaVideoStyleEnum,
  type YogaVideoMeta,
  type YogaVideoStyle,
} from "@/lib/yogaVideoMetaSchema";
import { ACTIVITY_CATEGORY_META } from "@/types/activity";
import { Grid2X2, Plus, RotateCcw } from "lucide-react";

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
type PosePurposeFilter = "all" | (typeof PosePurposeEnum.options)[number];
type PoseLevelFilter = "all" | (typeof PoseLevelEnum.options)[number];
type PoseCategoryFilter = "all" | (typeof PoseCategoryEnum.options)[number];
type ContentStatusFilter = "all" | (typeof ContentStatusEnum.options)[number];

type YogaTemplate = {
  id: string;
  category: string;
  label: string;
  duration_minutes: number | null;
  intensity: number | null;
  link: string | null;
};

type YogaVideoForm = {
  yoga_id: string;
  title_override: string;
  channel: string;
  style: YogaVideoStyle | "";
  description_short: string;
  description_long: string;
  source_description: string;
  pose_ids: string[];
  language: string;
};

type YogiKnowledgeAdminProps = {
  mode?: "admin" | "public";
  showPropCatalog?: boolean;
};

const ENTITY_OPTIONS: Array<{ value: EntityType; label: string }> = [
  { value: "pose", label: "Pose" },
  { value: "anatomy", label: "Anatomy" },
  { value: "knowledge_card", label: "Knowledge Card" },
];

const POSE_MODE_OPTIONS: Array<{ value: PoseMode; label: string }> = [
  { value: "known", label: "Known" },
  { value: "functional", label: "Functional" },
];

const CONTENT_STATUS_LABELS: Record<ContentStatusFilter, string> = {
  all: "Összes",
  draft: "Piszkozat",
  verified: "Ellenőrzött",
  published: "Publikált",
  archived: "Archivált",
};

const POSE_LEVEL_LABELS: Record<PoseLevelFilter, string> = {
  all: "Összes",
  beginner: "Kezdő",
  intermediate: "Középhaladó",
  advanced: "Haladó",
  all_levels: "Minden szint",
};

const POSE_CATEGORY_LABELS: Record<PoseCategoryFilter, string> = {
  all: "Összes",
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

const POSE_PURPOSE_LABELS: Record<PosePurposeFilter, string> = {
  all: "Összes",
  mobilizing: "Mobilizáló",
  stretching: "Nyújtó",
  strengthening: "Erősítő",
  stabilizing: "Stabilizáló",
  restorative: "Regeneráló",
  grounding: "Földelő",
  energizing: "Energizáló",
};

const POSE_PURPOSE_COLORS: Record<(typeof PosePurposeEnum.options)[number], string> = {
  mobilizing: "#38bdf8",
  stretching: "#f97316",
  strengthening: "#22c55e",
  stabilizing: "#a855f7",
  restorative: "#14b8a6",
  grounding: "#f59e0b",
  energizing: "#ef4444",
};


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

function resolveImageUrl(url?: string | null) {
  if (!url) return "";
  return `/api/yogi-knowledge/image-proxy?url=${encodeURIComponent(url)}`;
}

export default function YogiKnowledgeAdmin({
  mode = "admin",
  showPropCatalog = true,
}: YogiKnowledgeAdminProps) {
  const isAdmin = mode === "admin";
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
  const [posePageSize, setPosePageSize] = useState(3);
  const [promptOverrides, setPromptOverrides] = useState<Record<string, string>>({});
  const [promptReviews, setPromptReviews] = useState<Record<string, string>>({});
  const [poseQuery, setPoseQuery] = useState("");
  const [poseContentStatusFilter, setPoseContentStatusFilter] =
    useState<ContentStatusFilter>("all");
  const [poseLevelFilter, setPoseLevelFilter] = useState<PoseLevelFilter>("all");
  const [poseCategoryFilter, setPoseCategoryFilter] = useState<PoseCategoryFilter>("all");
  const [posePurposeFilter, setPosePurposeFilter] = useState<PosePurposeFilter>("all");
  const [yogaTemplates, setYogaTemplates] = useState<YogaTemplate[]>([]);
  const [yogaTemplatesLoading, setYogaTemplatesLoading] = useState(false);
  const [yogaTemplatesError, setYogaTemplatesError] = useState<string | null>(null);
  const [videoMeta, setVideoMeta] = useState<YogaVideoMeta[]>([]);
  const [videoMetaLoading, setVideoMetaLoading] = useState(false);
  const [videoMetaError, setVideoMetaError] = useState<string | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [publicVideoId, setPublicVideoId] = useState<string | null>(null);
  const [videoForm, setVideoForm] = useState<YogaVideoForm | null>(null);
  const [videoFormError, setVideoFormError] = useState<string | null>(null);
  const [videoSaveMessage, setVideoSaveMessage] = useState<string | null>(null);
  const [videoDraftLoading, setVideoDraftLoading] = useState(false);
  const [posePickerQuery, setPosePickerQuery] = useState("");
  const [poseRelinkLoading, setPoseRelinkLoading] = useState(false);
  const [poseRelinkMessage, setPoseRelinkMessage] = useState<string | null>(null);
  const [poseRelinkError, setPoseRelinkError] = useState<string | null>(null);
  const [publicVideoCategoryFilter, setPublicVideoCategoryFilter] = useState("all");
  const [publicVideoStyleFilter, setPublicVideoStyleFilter] = useState<YogaVideoStyle | "all">(
    "all",
  );
  const [publicVideoDurationFilter, setPublicVideoDurationFilter] = useState("all");
  const [publicVideoIntensityFilter, setPublicVideoIntensityFilter] = useState("all");
  const [showPoseFilters, setShowPoseFilters] = useState(false);
  const [showVideoFilters, setShowVideoFilters] = useState(false);
  const [propImageErrors, setPropImageErrors] = useState<Record<string, boolean>>({});
  const [poseGridView, setPoseGridView] = useState(false);

  useEffect(() => {
    const body = document.body;
    body.classList.add("yoga-bg");
    body.classList.add("yogi-palette");
    return () => {
      body.classList.remove("yoga-bg");
      body.classList.remove("yogi-palette");
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadPoses = async () => {
      setPoseLoading(true);
      setPoseError(null);
      try {
        const response = await fetch(
          isAdmin ? "/api/admin/yogi-knowledge/poses" : "/api/yogi-knowledge/poses",
        );
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
  }, [isAdmin]);

  useEffect(() => {
    let active = true;
    const loadYogaTemplates = async () => {
      setYogaTemplatesLoading(true);
      setYogaTemplatesError(null);
      try {
        const response = await fetch(
          isAdmin ? "/api/yoga-templates" : "/api/yogis-choice/yoga-templates",
        );
        const data = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(data?.templates)) {
          if (active) setYogaTemplatesError(readJsonError(data));
          return;
        }
        if (active) setYogaTemplates(data.templates as YogaTemplate[]);
      } catch (err) {
        if (active) setYogaTemplatesError((err as Error)?.message ?? "Failed to load yoga templates");
      } finally {
        if (active) setYogaTemplatesLoading(false);
      }
    };
    loadYogaTemplates();
    return () => {
      active = false;
    };
  }, [isAdmin]);

  useEffect(() => {
    let active = true;
    const loadVideoMeta = async () => {
      setVideoMetaLoading(true);
      setVideoMetaError(null);
      try {
        const response = await fetch(
          isAdmin ? "/api/admin/yoga-video-meta" : "/api/yogis-choice/yoga-video-meta",
        );
        const data = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(data?.items)) {
          if (active) setVideoMetaError(readJsonError(data));
          return;
        }
        if (active) setVideoMeta(data.items as YogaVideoMeta[]);
      } catch (err) {
        if (active) setVideoMetaError((err as Error)?.message ?? "Failed to load yoga meta");
      } finally {
        if (active) setVideoMetaLoading(false);
      }
    };
    loadVideoMeta();
    return () => {
      active = false;
    };
  }, [isAdmin]);

  useEffect(() => {
    setPosePage(0);
  }, [
    poseQuery,
    poseContentStatusFilter,
    poseLevelFilter,
    poseCategoryFilter,
    posePurposeFilter,
    posePageSize,
  ]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 720px)");
    const sync = () => {
      setPosePageSize(media.matches ? 1 : 3);
      if (!media.matches) {
        setShowPoseFilters(false);
        setShowVideoFilters(false);
      }
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 960px)");
    const sync = () => {
      if (media.matches) setPoseGridView(false);
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
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
      setPromptOverrides({});
      setPromptReviews({});
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

      if (data?.id) {
        const normalizedSlug =
          typeof (parsed as any)?.slug === "string"
            ? normalizeSlug((parsed as any).slug)
            : (parsed as any)?.slug;
        const nextItem = {
          ...(parsed as Record<string, unknown>),
          id: data.id,
          slug: normalizedSlug,
        } as Record<string, unknown>;

        setDraftText(JSON.stringify(nextItem, null, 2));

        if (entityType === "pose") {
          setPoses((prev) => {
            const next = [...prev];
            const idx = next.findIndex((item) => item.id === data.id);
            if (idx === -1) next.push(nextItem as Pose);
            else next[idx] = nextItem as Pose;
            return next;
          });
        }
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

  const handleGenerateImage = async (
    slotKey: ImageSlotKey,
    promptOverride?: string,
    reviewInstruction?: string,
  ) => {
    setError(null);
    setInputError(null);

    try {
      const parsed = JSON.parse(draftText) as Record<string, unknown>;
      const slot = (parsed as any)[slotKey];
      const override = promptOverride?.trim();
      const review = reviewInstruction?.trim();
      const promptBase = typeof slot?.prompt === "string" ? slot.prompt.trim() : "";
      const prompt = override || promptBase;

      if (!prompt) {
        setError("Hiányzik az image prompt a generáláshoz.");
        return;
      }

      const slug = (parsed as any)?.slug ?? (parsed as any)?.id ?? "unknown";

      setImageLoading((prev) => ({ ...prev, [slotKey]: true }));

      if (override && !review) {
        updateDraft((draft) => {
          const current = (draft as any)[slotKey] ?? {};
          return {
            ...draft,
            [slotKey]: {
              ...current,
              prompt: override,
              prompt_revision: Date.now(),
            },
          } as Record<string, unknown>;
        });
      }

      const response = await fetch("/api/admin/yogi-knowledge/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type: entityType,
          slot: slotKey,
          prompt,
          slug,
          review_instruction: review,
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
            prompt: review ? data?.prompt_used ?? current.prompt ?? prompt : current.prompt ?? prompt,
            ...(review ? { prompt_revision: Date.now() } : {}),
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

  const yogaVideoMetaMap = useMemo(() => {
    const map = new Map<string, YogaVideoMeta>();
    videoMeta.forEach((item) => {
      map.set(item.yoga_id, item);
    });
    return map;
  }, [videoMeta]);

  const poseMap = useMemo(() => {
    const map = new Map<string, Pose>();
    poses.forEach((pose) => {
      map.set(pose.id, pose);
    });
    return map;
  }, [poses]);

  const buildVideoForm = (yogaId: string): YogaVideoForm => {
    const existing = yogaVideoMetaMap.get(yogaId);
    return {
      yoga_id: yogaId,
      title_override: existing?.title_override ?? "",
      channel: existing?.channel ?? "",
      style: existing?.style ?? "",
      description_short: existing?.description_short ?? "",
      description_long: existing?.description_long ?? "",
      source_description: "",
      pose_ids: existing?.pose_ids ?? [],
      language: existing?.language ?? "",
    };
  };

  const normalizeVideoForm = (form: YogaVideoForm): YogaVideoMeta => {
    const channel = form.channel.trim();
    const titleOverride = form.title_override.trim();
    const descriptionShort = form.description_short.trim();
    const descriptionLong = form.description_long.trim();
    const language = form.language.trim();
    return {
      yoga_id: form.yoga_id,
      title_override: titleOverride ? titleOverride : null,
      channel: channel ? channel : null,
      style: form.style ? form.style : null,
      description_short: descriptionShort ? descriptionShort : null,
      description_long: descriptionLong ? descriptionLong : null,
      pose_ids: form.pose_ids.filter(Boolean),
      language: language ? language : null,
    };
  };

  const openVideoModal = (yogaId: string) => {
    setActiveVideoId(yogaId);
    setVideoForm(buildVideoForm(yogaId));
    setVideoFormError(null);
    setVideoSaveMessage(null);
  };

  const closeVideoModal = () => {
    setActiveVideoId(null);
    setVideoForm(null);
    setVideoFormError(null);
    setVideoSaveMessage(null);
  };

  const handleSaveVideoMeta = async () => {
    if (!videoForm) return;
    setVideoFormError(null);
    setVideoSaveMessage(null);

    const payload = normalizeVideoForm(videoForm);
    try {
      const response = await fetch("/api/admin/yoga-video-meta/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: payload }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setVideoFormError(readJsonError(data));
        return;
      }
      setVideoSaveMessage("Mentve.");
      setVideoMeta((prev) => {
        const next = prev.filter((item) => item.yoga_id !== payload.yoga_id);
        next.push(payload);
        return next;
      });
    } catch (err) {
      setVideoFormError((err as Error)?.message ?? "Save failed");
    }
  };

  const handleDraftVideoMeta = async () => {
    if (!videoForm) return;
    const template = yogaTemplates.find((item) => item.id === videoForm.yoga_id);
    if (!template) {
      setVideoFormError("Hiányzik a videó adat.");
      return;
    }

    setVideoDraftLoading(true);
    setVideoFormError(null);
    setVideoSaveMessage(null);

    try {
      const response = await fetch("/api/admin/yoga-video-meta/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yoga_id: template.id,
          title: videoForm.title_override.trim() || template.label,
          category: template.category,
          duration_minutes: template.duration_minutes,
          intensity: template.intensity,
          link: template.link,
          channel: videoForm.channel.trim() ? videoForm.channel.trim() : null,
          source_description: videoForm.source_description.trim()
            ? videoForm.source_description.trim()
            : null,
          pose_ids: videoForm.pose_ids,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.draft) {
        setVideoFormError(readJsonError(data));
        return;
      }

      const draft = data.draft as {
        description_short?: string;
        description_long?: string;
        style?: YogaVideoStyle;
        channel?: string | null;
      };

      setVideoForm((prev) =>
        prev
          ? {
              ...prev,
              description_short: draft.description_short ?? prev.description_short,
              description_long: draft.description_long ?? prev.description_long,
              style: draft.style ?? prev.style,
              channel: draft.channel ?? prev.channel,
            }
          : prev,
      );
      setVideoSaveMessage("Draft javaslat betöltve.");
    } catch (err) {
      setVideoFormError((err as Error)?.message ?? "Draft failed");
    } finally {
      setVideoDraftLoading(false);
    }
  };

  const handleMoveVideoPose = (index: number, direction: -1 | 1) => {
    if (!videoForm) return;
    const next = [...videoForm.pose_ids];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setVideoForm((prev) => (prev ? { ...prev, pose_ids: next } : prev));
  };

  const handleRemoveVideoPose = (poseId: string) => {
    if (!videoForm) return;
    setVideoForm((prev) =>
      prev ? { ...prev, pose_ids: prev.pose_ids.filter((id) => id !== poseId) } : prev,
    );
  };

  const availablePoseOptions = useMemo(() => {
    const generatedKeys = new Set<string>();
    poses.forEach((pose) => {
      generatedKeys.add(normalizeKey(pose.slug));
      generatedKeys.add(normalizeKey(pose.id));
      generatedKeys.add(normalizeKey(pose.name_en));
      generatedKeys.add(normalizeKey(pose.name_hu));
    });

    return KNOWN_POSES
      .filter((entry) => {
        const entryKeys = [
          normalizeKey(entry.slug),
          normalizeKey(entry.name_hu),
          normalizeKey(entry.name_en),
        ];
        return !entryKeys.some((key) => key && generatedKeys.has(key));
      })
      .sort((a, b) => a.name_hu.localeCompare(b.name_hu));
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

  const filteredPoses = useMemo(() => {
    const query = poseQuery.trim().toLowerCase();
    const withQuery = query
      ? poses.filter((pose) => {
          const haystack = [
            pose.name_hu,
            pose.name_en,
            pose.sanskrit_name ?? "",
            pose.slug,
            pose.id,
            ...(pose.tags ?? []),
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(query);
        })
      : poses;

    const base = isAdmin
      ? withQuery
      : withQuery.filter((pose) => pose.content_status === "published");
    const withContentStatus =
      !isAdmin || poseContentStatusFilter === "all"
        ? base
        : base.filter((pose) => pose.content_status === poseContentStatusFilter);

    const withLevel =
      poseLevelFilter === "all"
        ? withContentStatus
        : withContentStatus.filter((pose) => pose.level === poseLevelFilter);

    const withCategory =
      poseCategoryFilter === "all"
        ? withLevel
        : withLevel.filter((pose) => pose.category === poseCategoryFilter);

    const withPurpose =
      posePurposeFilter === "all"
        ? withCategory
        : withCategory.filter((pose) => pose.purpose?.includes(posePurposeFilter));

    const levelOrder: Record<Pose["level"], number> = {
      beginner: 0,
      all_levels: 1,
      intermediate: 2,
      advanced: 3,
    };

    const sorted = [...withPurpose].sort((a, b) => {
      const levelDiff = levelOrder[a.level] - levelOrder[b.level];
      if (levelDiff !== 0) return levelDiff;
      return a.name_hu.localeCompare(b.name_hu, "hu");
    });

    return sorted;
  }, [
    poses,
    poseQuery,
    poseContentStatusFilter,
    poseLevelFilter,
    poseCategoryFilter,
    posePurposeFilter,
    isAdmin,
  ]);

  const filterBasePoses = useMemo(() => {
    const query = poseQuery.trim().toLowerCase();
    const base = isAdmin ? poses : poses.filter((pose) => pose.content_status === "published");
    if (!query) return base;
    return base.filter((pose) => {
      const haystack = [
        pose.name_hu,
        pose.name_en,
        pose.sanskrit_name ?? "",
        pose.slug,
        pose.id,
        ...(pose.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [poses, poseQuery, isAdmin]);

  const optionCounts = useMemo(() => {
    const countByLevel = new Map<Pose["level"], number>();
    const countByCategory = new Map<Pose["category"], number>();
    const countByPurpose = new Map<PosePurposeFilter, number>();

    const applyOtherFilters = (pose: Pose, ignore: "level" | "category" | "purpose") => {
      if (ignore !== "level" && poseLevelFilter !== "all" && pose.level !== poseLevelFilter) {
        return false;
      }
      if (
        ignore !== "category" &&
        poseCategoryFilter !== "all" &&
        pose.category !== poseCategoryFilter
      ) {
        return false;
      }
      if (
        ignore !== "purpose" &&
        posePurposeFilter !== "all" &&
        !pose.purpose?.includes(posePurposeFilter)
      ) {
        return false;
      }
      return true;
    };

    filterBasePoses.forEach((pose) => {
      if (applyOtherFilters(pose, "level")) {
        countByLevel.set(pose.level, (countByLevel.get(pose.level) ?? 0) + 1);
      }
      if (applyOtherFilters(pose, "category")) {
        countByCategory.set(pose.category, (countByCategory.get(pose.category) ?? 0) + 1);
      }
      if (applyOtherFilters(pose, "purpose")) {
        pose.purpose?.forEach((purpose) => {
          countByPurpose.set(
            purpose,
            (countByPurpose.get(purpose as PosePurposeFilter) ?? 0) + 1,
          );
        });
      }
    });

    return { countByLevel, countByCategory, countByPurpose };
  }, [
    filterBasePoses,
    poseLevelFilter,
    poseCategoryFilter,
    posePurposeFilter,
  ]);

  const poseTotalPages =
    filteredPoses.length === 0 ? 0 : Math.ceil(filteredPoses.length / posePageSize);
  const safePosePage = poseTotalPages === 0 ? 0 : Math.min(posePage, poseTotalPages - 1);
  const poseSliceStart = safePosePage * posePageSize;
  const poseSlice = filteredPoses.slice(poseSliceStart, poseSliceStart + posePageSize);
  const activeTemplate = useMemo(
    () =>
      activeVideoId ? yogaTemplates.find((item) => item.id === activeVideoId) ?? null : null,
    [activeVideoId, yogaTemplates],
  );
  const publicTemplate = useMemo(
    () =>
      publicVideoId ? yogaTemplates.find((item) => item.id === publicVideoId) ?? null : null,
    [publicVideoId, yogaTemplates],
  );
  const publicMeta = useMemo(
    () => (publicTemplate ? yogaVideoMetaMap.get(publicTemplate.id) ?? null : null),
    [publicTemplate, yogaVideoMetaMap],
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
  const sortedYogaTemplates = useMemo(() => {
    const scoreMeta = (meta?: YogaVideoMeta) => {
      if (!meta) return 0;
      let score = 0;
      if (meta.title_override?.trim()) score += 2;
      if (meta.channel?.trim()) score += 1;
      if (meta.style) score += 1;
      if (meta.description_short?.trim()) score += 2;
      if (meta.description_long?.trim()) score += 2;
      if (meta.pose_ids && meta.pose_ids.length > 0) score += 1;
      if (meta.language?.trim()) score += 1;
      return score;
    };
    return [...yogaTemplates].sort((a, b) => {
      const scoreA = scoreMeta(yogaVideoMetaMap.get(a.id));
      const scoreB = scoreMeta(yogaVideoMetaMap.get(b.id));
      if (scoreA !== scoreB) return scoreB - scoreA;
      return a.label.localeCompare(b.label, "hu");
    });
  }, [yogaTemplates, yogaVideoMetaMap]);

  const publicVideoCategories = useMemo(() => {
    const set = new Set<string>();
    yogaTemplates.forEach((template) => {
      if (template.category) set.add(template.category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "hu"));
  }, [yogaTemplates]);

  const publicVideoDurationOptions = useMemo(() => {
    const options = new Set<string>();
    yogaTemplates.forEach((template) => {
      const minutes = template.duration_minutes;
      if (minutes === null || minutes === undefined) {
        options.add("unknown");
        return;
      }
      if (minutes <= 10) options.add("0-10");
      else if (minutes <= 20) options.add("10-20");
      else if (minutes <= 35) options.add("20-35");
      else options.add("35+");
    });
    const order = ["0-10", "10-20", "20-35", "35+", "unknown"];
    return order.filter((value) => options.has(value));
  }, [yogaTemplates]);

  const publicFilteredYogaTemplates = useMemo(() => {
    if (isAdmin) return sortedYogaTemplates;
    return sortedYogaTemplates.filter((template) => {
      if (publicVideoCategoryFilter !== "all" && template.category !== publicVideoCategoryFilter) {
        return false;
      }
      if (publicVideoStyleFilter !== "all") {
        const meta = yogaVideoMetaMap.get(template.id);
        if (meta?.style !== publicVideoStyleFilter) return false;
      }
      if (publicVideoIntensityFilter !== "all") {
        const intensity = template.intensity ?? null;
        if (publicVideoIntensityFilter === "unknown" && intensity !== null) return false;
        if (publicVideoIntensityFilter !== "unknown" && intensity !== Number(publicVideoIntensityFilter)) {
          return false;
        }
      }
      if (publicVideoDurationFilter !== "all") {
        const minutes = template.duration_minutes ?? null;
        if (publicVideoDurationFilter === "unknown" && minutes !== null) return false;
        if (publicVideoDurationFilter !== "unknown") {
          if (minutes === null) return false;
          if (publicVideoDurationFilter === "0-10" && !(minutes <= 10)) return false;
          if (publicVideoDurationFilter === "10-20" && !(minutes > 10 && minutes <= 20)) return false;
          if (publicVideoDurationFilter === "20-35" && !(minutes > 20 && minutes <= 35)) return false;
          if (publicVideoDurationFilter === "35+" && !(minutes > 35)) return false;
        }
      }
      return true;
    });
  }, [
    isAdmin,
    sortedYogaTemplates,
    publicVideoCategoryFilter,
    publicVideoStyleFilter,
    publicVideoDurationFilter,
    publicVideoIntensityFilter,
    yogaVideoMetaMap,
  ]);
  const posePickerItems = useMemo(() => {
    const query = posePickerQuery.trim().toLowerCase();
    const base = query
      ? poses.filter((pose) => {
          const haystack = [
            pose.name_hu,
            pose.name_en,
            pose.sanskrit_name ?? "",
            pose.slug,
            pose.id,
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(query);
        })
      : poses;
    return [...base].sort((a, b) => a.name_en.localeCompare(b.name_en, "en"));
  }, [poses, posePickerQuery]);
  const propCatalog = useMemo(() => collectPropCatalog(poses), [poses]);

  const poseGridGroups = useMemo(() => {
    if (isAdmin) return [];
    const byCategory = new Map<Pose["category"], Pose[]>();
    filteredPoses.forEach((pose) => {
      const key = pose.category;
      const list = byCategory.get(key) ?? [];
      list.push(pose);
      byCategory.set(key, list);
    });
    return PoseCategoryEnum.options
      .map((category) => ({
        category,
        label: POSE_CATEGORY_LABELS[category],
        poses: byCategory.get(category) ?? [],
      }))
      .filter((group) => group.poses.length > 0);
  }, [filteredPoses, isAdmin]);
  const propListText = useMemo(
    () =>
      propCatalog
        .map((prop) => `${prop.label} | /yogi/props/${prop.slug}.png`)
        .join("\n"),
    [propCatalog],
  );
  const poseDetailHref = (pose: Pose) => {
    const token = (pose.slug && pose.slug.trim()) || (pose.id && pose.id.trim()) || "";
    const idParam = pose.id ? `?id=${encodeURIComponent(pose.id)}` : "";
    return `/yogis-choice/poses/${encodeURIComponent(token)}${idParam}`;
  };

  const handleRelinkPoses = async () => {
    if (!isAdmin) return;
    if (!window.confirm("Biztosan újraszámoljuk a kapcsolódó pózokat minden elemnél?")) {
      return;
    }

    setPoseRelinkLoading(true);
    setPoseRelinkMessage(null);
    setPoseRelinkError(null);

    try {
      const response = await fetch("/api/admin/yogi-knowledge/poses-relink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setPoseRelinkError(readJsonError(data));
        return;
      }
      if (Array.isArray(data?.poses)) {
        setPoses(data.poses as Pose[]);
      }
      const updated = typeof data?.updated === "number" ? data.updated : null;
      const total = typeof data?.total === "number" ? data.total : null;
      if (updated !== null && total !== null) {
        setPoseRelinkMessage(`Kapcsolódó pózok frissítve (${updated}/${total}).`);
      } else {
        setPoseRelinkMessage("Kapcsolódó pózok frissítve.");
      }
    } catch (err) {
      setPoseRelinkError((err as Error)?.message ?? "Relink failed");
    } finally {
      setPoseRelinkLoading(false);
    }
  };

  return (
    <section className={`admin-stack ${styles.page} ${styles.yogiPage}`}>
      <div className={`admin-card ${styles.poseFilterPanel} ${styles.poseFilterPanelCompact}`}>
        <button
          type="button"
          className={`${styles.filterToggle} ${showPoseFilters ? styles.filterToggleActive : ""}`}
          onClick={() => setShowPoseFilters((prev) => !prev)}
        >
          {showPoseFilters ? "Szűrők elrejtése" : "Szűrők megnyitása"}
        </button>
        <div
          className={`${styles.poseFilterGrid} ${
            showPoseFilters ? "" : styles.filterPanelCollapsed
          }`}
        >
          {isAdmin && (
            <label className="form-field">
              <span className="form-field__label">Tartalom státusz</span>
              <select
                className={`input ${styles.poseFilterSelect}`}
                value={poseContentStatusFilter}
                onChange={(event) =>
                  setPoseContentStatusFilter(event.target.value as ContentStatusFilter)
                }
              >
                <option value="all">{CONTENT_STATUS_LABELS.all}</option>
                {ContentStatusEnum.options.map((status) => (
                  <option key={status} value={status}>
                    {CONTENT_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="form-field">
            <span className="form-field__label">Szint</span>
            <select
              className={`input ${styles.poseFilterSelect}`}
              value={poseLevelFilter}
              onChange={(event) =>
                setPoseLevelFilter(event.target.value as PoseLevelFilter)
              }
            >
              <option value="all">{POSE_LEVEL_LABELS.all}</option>
              {PoseLevelEnum.options.map((level) => (
                <option
                  key={level}
                  value={level}
                  disabled={(optionCounts.countByLevel.get(level) ?? 0) === 0}
                >
                  {POSE_LEVEL_LABELS[level]}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span className="form-field__label">Kategória</span>
            <select
              className={`input ${styles.poseFilterSelect}`}
              value={poseCategoryFilter}
              onChange={(event) =>
                setPoseCategoryFilter(event.target.value as PoseCategoryFilter)
              }
            >
              <option value="all">{POSE_CATEGORY_LABELS.all}</option>
              {PoseCategoryEnum.options.filter(
                (category) => (optionCounts.countByCategory.get(category) ?? 0) > 0,
              ).map((category) => (
                <option key={category} value={category}>
                  {POSE_CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span className="form-field__label">Cél</span>
            <select
              className={`input ${styles.poseFilterSelect}`}
              value={posePurposeFilter}
              onChange={(event) =>
                setPosePurposeFilter(event.target.value as PosePurposeFilter)
              }
            >
              <option value="all">{POSE_PURPOSE_LABELS.all}</option>
              {PosePurposeEnum.options.filter(
                (purpose) => (optionCounts.countByPurpose.get(purpose) ?? 0) > 0,
              ).map((purpose) => (
                <option key={purpose} value={purpose}>
                  {POSE_PURPOSE_LABELS[purpose]}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.poseFilterInlineButtons}>
            <button
              type="button"
              className={`btn btn--ghost ${styles.filterResetButton}`}
              onClick={() => {
                setPoseQuery("");
                setPoseContentStatusFilter("all");
                setPoseLevelFilter("all");
                setPoseCategoryFilter("all");
                setPosePurposeFilter("all");
              }}
              aria-label="Szűrők törlése"
              title="Szűrők törlése"
            >
              <RotateCcw size={16} aria-hidden="true" />
            </button>

            {!isAdmin && (
              <button
                type="button"
                className={`btn btn--ghost ${styles.poseViewToggleButton}`}
                onClick={() => setPoseGridView((prev) => !prev)}
                aria-pressed={poseGridView}
                aria-label={poseGridView ? "Lapozós nézet" : "Grid nézet"}
                title={poseGridView ? "Lapozós nézet" : "Grid nézet"}
              >
                <Grid2X2 size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        <div className={styles.poseFilterActions}>
          {isAdmin && (
            <div className={styles.poseFilterActionRow}>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={handleRelinkPoses}
                disabled={poseRelinkLoading}
              >
                {poseRelinkLoading ? "Újralinkelés..." : "Kapcsolódó pózok újralinkelése"}
              </button>
              {poseRelinkError && (
                <span className={styles.poseFilterCount}>{poseRelinkError}</span>
              )}
              {poseRelinkMessage && (
                <span className={styles.poseFilterCount}>{poseRelinkMessage}</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={styles.poseGallery}>
        {poseGridView && !isAdmin ? (
          <div className={styles.poseGridView}>
            {poseError && (
              <div className={styles.poseGalleryEmpty}>
                Nem sikerült betölteni a pózokat.
              </div>
            )}

            {!poseError && poseLoading && (
              <div className={styles.poseGalleryEmpty}>Betöltés...</div>
            )}

            {!poseError && !poseLoading && filteredPoses.length === 0 && (
              <div className={styles.poseGalleryEmpty}>Még nincs generált póz.</div>
            )}

            {!poseError && !poseLoading && filteredPoses.length > 0 && (
              <>
                {poseGridGroups.map((group) => (
                  <div key={group.category} className={styles.poseCategoryGroup}>
                    <div className={styles.poseCategoryHeader}>
                      <p className={styles.poseCategoryTitle}>{group.label}</p>
                      <span className={styles.poseCategoryCount}>
                        {group.poses.length} póz
                      </span>
                    </div>
                    <div className={styles.poseCategoryGrid}>
                      {group.poses.map((pose) => {
                        const subtitle = pose.sanskrit_name ?? pose.name_hu;
                        const imageSlot = pose.mannequin_angled;
                        const hasImage =
                          imageSlot?.status === "verified" && imageSlot.asset_ref;
                        const primaryPurpose = pose.purpose?.[0] ?? null;
                        const purposeLabel = primaryPurpose
                          ? POSE_PURPOSE_LABELS[primaryPurpose as PosePurposeFilter]
                          : null;
                        const purposeColor = primaryPurpose
                          ? POSE_PURPOSE_COLORS[primaryPurpose]
                          : null;
                        return (
                          <Link
                            key={pose.id}
                            href={poseDetailHref(pose)}
                            className={`${styles.poseCard} ${styles.poseCardCompact}`}
                            aria-label={`${pose.name_en} – ${subtitle}`}
                          >
                            <div
                              className={`${styles.poseCardImage} ${styles.poseCardImageCompact}`}
                            >
                              {hasImage ? (
                                <img
                                  src={resolveImageUrl(imageSlot.asset_ref)}
                                  alt={pose.name_en}
                                />
                              ) : (
                                <span>Mannequin 3/4</span>
                              )}
                              {purposeLabel && purposeColor && (
                                <span
                                  className={styles.posePurposePill}
                                  style={{
                                    borderColor: purposeColor,
                                    backgroundColor: hexToRgba(purposeColor, 0.28),
                                    color: purposeColor,
                                  }}
                                >
                                  {purposeLabel}
                                </span>
                              )}
                            </div>
                            <div
                              className={`${styles.poseCardBody} ${styles.poseCardBodyCompact}`}
                            >
                              <div className={styles.poseCardHeader}>
                                <div>
                                  <p className={styles.poseCardTitle}>{pose.name_en}</p>
                                  <p className={styles.poseCardSubtitle}>{subtitle}</p>
                                </div>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        ) : (
          <div className={styles.poseGalleryShell}>
            <button
              type="button"
              className={styles.poseGalleryChevron}
              disabled={safePosePage === 0}
              onClick={() => setPosePage(Math.max(0, safePosePage - 1))}
              aria-label="Előző oldal"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path
                  d="M12.5 4.5L7.5 10l5 5.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <div className={styles.poseGalleryContent}>
              {poseError && (
                <div className={styles.poseGalleryEmpty}>
                  Nem sikerült betölteni a pózokat.
                </div>
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
                    const subtitle = pose.sanskrit_name ?? pose.name_hu;
                    const imageSlot = pose.mannequin_angled;
                    const hasImage = imageSlot?.status === "verified" && imageSlot.asset_ref;
                    const primaryPurpose = pose.purpose?.[0] ?? null;
                    const purposeLabel = primaryPurpose
                      ? POSE_PURPOSE_LABELS[primaryPurpose as PosePurposeFilter]
                      : null;
                    const purposeColor = primaryPurpose
                      ? POSE_PURPOSE_COLORS[primaryPurpose]
                      : null;
                    const cardBody = (
                      <>
                        <div className={styles.poseCardImage}>
                          {hasImage ? (
                            <img
                              src={resolveImageUrl(imageSlot.asset_ref)}
                              alt={pose.name_en}
                            />
                          ) : (
                            <span>Mannequin 3/4</span>
                          )}
                          {purposeLabel && purposeColor && (
                            <span
                              className={styles.posePurposePill}
                              style={{
                                borderColor: purposeColor,
                                backgroundColor: hexToRgba(purposeColor, 0.28),
                                color: purposeColor,
                              }}
                            >
                              {purposeLabel}
                            </span>
                          )}
                        </div>
                        <div className={styles.poseCardBody}>
                          <div className={styles.poseCardHeader}>
                            <div>
                              <p className={styles.poseCardTitle}>{pose.name_en}</p>
                              <p className={styles.poseCardSubtitle}>{subtitle}</p>
                            </div>
                          </div>
                          <p className={styles.poseCardSummary}>{pose.summary}</p>
                        </div>
                      </>
                    );

                    return isAdmin ? (
                      <button
                        key={pose.id}
                        type="button"
                        className={styles.poseCard}
                        onClick={() => loadPoseIntoEditor(pose)}
                      >
                        {cardBody}
                      </button>
                    ) : (
                      <Link
                        key={pose.id}
                        href={poseDetailHref(pose)}
                        className={styles.poseCard}
                        aria-label={`${pose.name_en} – ${subtitle}`}
                      >
                        {cardBody}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              type="button"
              className={styles.poseGalleryChevron}
              disabled={safePosePage >= poseTotalPages - 1}
              onClick={() => setPosePage(Math.min(poseTotalPages - 1, safePosePage + 1))}
              aria-label="Következő oldal"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path
                  d="M7.5 4.5L12.5 10l-5 5.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        )}

        {!poseGridView && (
          <div className={styles.poseGalleryPagination}>
            {Array.from({ length: Math.max(1, poseTotalPages) }).map((_, index) => {
              const isDisabled = poseTotalPages === 0;
              const isActive = index === safePosePage && !isDisabled;
              return (
                <button
                  key={`pose-dot-${index}`}
                  type="button"
                  className={`${styles.poseGalleryDot} ${
                    isActive ? styles.poseGalleryDotActive : ""
                  }`}
                  disabled={isDisabled}
                  onClick={() => {
                    if (!isDisabled) setPosePage(index);
                  }}
                  aria-label={`Oldal ${index + 1}`}
                  aria-current={isActive ? "page" : undefined}
                />
              );
            })}
          </div>
        )}
      </div>

      {showPropCatalog && (
        <div className={`admin-card ${styles.panel}`}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Eszközök (props)</h2>
            <p className="admin-text-muted">
              Egységesített eszközlista a pózokból. A képeket mentsd a public alá:
              `public/yogi/props/[slug].png`.
            </p>
          </div>

          {propCatalog.length === 0 && (
            <div className={styles.poseGalleryEmpty}>Még nincs eszköz lista.</div>
          )}

          {propCatalog.length > 0 && (
            <>
              <div className={styles.propGrid}>
                {propCatalog.map((prop) => {
                  const imagePath = `/yogi/props/${prop.slug}.png`;
                  const isMissing = propImageErrors[prop.slug];
                  return (
                    <div key={prop.key} className={styles.propCard}>
                      <div className={styles.propImage}>
                        {!isMissing && (
                          <img
                            src={imagePath}
                            alt={prop.label}
                            onError={() =>
                              setPropImageErrors((prev) => ({
                                ...prev,
                                [prop.slug]: true,
                              }))
                            }
                          />
                        )}
                        {isMissing && (
                          <span className={styles.propPlaceholder}>{prop.label}</span>
                        )}
                      </div>
                      <div className={styles.propMeta}>
                        <p className={styles.propLabel}>{prop.label}</p>
                        <p className={styles.propCount}>{prop.count} póz</p>
                        <p className={styles.propPath}>{imagePath}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <label className="form-field">
                <span className="form-field__label">Lista képgeneráláshoz</span>
                <textarea
                  className={`input ${styles.inputTextarea}`}
                  rows={Math.min(10, Math.max(4, propCatalog.length))}
                  readOnly
                  value={propListText}
                />
              </label>
            </>
          )}
        </div>
      )}

      <div className={`admin-card ${styles.panel}`}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Jóga videók</h2>
          {isAdmin && (
            <Link
              href="/admin/yoga"
              className={styles.panelAddButton}
              aria-label="Új YouTube jóga"
              title="Új YouTube jóga hozzáadása"
            >
              <Plus size={16} />
            </Link>
          )}
          <p className="admin-text-muted">
            Válogatott gyakorlások leírással, stílussal és a kapcsolódó pózokkal.
          </p>
        </div>

        {yogaTemplatesError && (
          <div className={`admin-card ${styles.inlineCard} ${styles.errorCard}`}>
            <p className={styles.feedbackBody}>
              Nem sikerült betölteni a videókat.
            </p>
          </div>
        )}

        {!yogaTemplatesError && yogaTemplatesLoading && (
          <div className={styles.poseGalleryEmpty}>Betöltés...</div>
        )}

        {!yogaTemplatesError && !yogaTemplatesLoading && yogaTemplates.length === 0 && (
          <div className={styles.poseGalleryEmpty}>Még nincs rögzített videó.</div>
        )}

        {!yogaTemplatesError && !yogaTemplatesLoading && yogaTemplates.length > 0 && (
          <>
            {!isAdmin && (
              <div className={styles.poseFilterPanel}>
                <button
                  type="button"
                  className={`${styles.filterToggle} ${
                    showVideoFilters ? styles.filterToggleActive : ""
                  }`}
                  onClick={() => setShowVideoFilters((prev) => !prev)}
                >
                  {showVideoFilters ? "Szűrők elrejtése" : "Szűrők megnyitása"}
                </button>
                <div
                  className={`${styles.videoFilterGrid} ${
                    showVideoFilters ? "" : styles.filterPanelCollapsed
                  }`}
                >
                  <label className="form-field">
                    <span className="form-field__label">Kategória</span>
                    <select
                      className={`input ${styles.poseFilterSelect}`}
                      value={publicVideoCategoryFilter}
                      onChange={(event) => setPublicVideoCategoryFilter(event.target.value)}
                    >
                      <option value="all">Összes</option>
                      {publicVideoCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    <span className="form-field__label">Stílus</span>
                    <select
                      className={`input ${styles.poseFilterSelect}`}
                      value={publicVideoStyleFilter}
                      onChange={(event) =>
                        setPublicVideoStyleFilter(event.target.value as YogaVideoStyle | "all")
                      }
                    >
                      <option value="all">Összes</option>
                      {YogaVideoStyleEnum.options.map((style) => (
                        <option key={style} value={style}>
                          {VIDEO_STYLE_META[style]?.label ?? style}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    <span className="form-field__label">Hossz</span>
                    <select
                      className={`input ${styles.poseFilterSelect}`}
                      value={publicVideoDurationFilter}
                      onChange={(event) => setPublicVideoDurationFilter(event.target.value)}
                    >
                      <option value="all">Összes</option>
                      {publicVideoDurationOptions.map((value) => (
                        <option key={value} value={value}>
                          {value === "0-10" && "0–10 perc"}
                          {value === "10-20" && "10–20 perc"}
                          {value === "20-35" && "20–35 perc"}
                          {value === "35+" && "35+ perc"}
                          {value === "unknown" && "Ismeretlen"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    <span className="form-field__label">Intenzitás</span>
                    <select
                      className={`input ${styles.poseFilterSelect}`}
                      value={publicVideoIntensityFilter}
                      onChange={(event) => setPublicVideoIntensityFilter(event.target.value)}
                    >
                      <option value="all">Összes</option>
                      <option value="1">1 pont</option>
                      <option value="2">2 pont</option>
                      <option value="3">3 pont</option>
                      <option value="unknown">Ismeretlen</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    className={`btn btn--ghost ${styles.filterResetButton}`}
                    onClick={() => {
                      setPublicVideoCategoryFilter("all");
                      setPublicVideoStyleFilter("all");
                      setPublicVideoDurationFilter("all");
                      setPublicVideoIntensityFilter("all");
                    }}
                    aria-label="Szűrők törlése"
                    title="Szűrők törlése"
                  >
                    <RotateCcw size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}

            <div className={styles.videoGrid}>
              {publicFilteredYogaTemplates.map((template) => {
              const meta = yogaVideoMetaMap.get(template.id);
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
                .map((poseId) => poseMap.get(poseId))
                .filter(Boolean)
                .slice(0, 5) as Pose[];
              const cardBody = (
                <div className={styles.videoCardBody}>
                  <div className={styles.videoCardHeader}>
                    <div>
                      <p className={styles.videoCardTitle}>
                        {meta?.title_override ?? template.label}
                      </p>
                      <div className={styles.videoCardSubtitlePills}>
                        <span
                          className={styles.videoCategoryPill}
                          style={{
                            borderColor: categoryMeta.color,
                            backgroundColor: hexToRgba(categoryMeta.color, 0.12),
                            color: categoryMeta.color,
                            ["--pill-icon" as any]: `url(${categoryMeta.icon})`,
                          }}
                        >
                          <span className={styles.videoCategoryIcon} aria-hidden="true" />
                          {categoryMeta.label}
                        </span>
                        <span
                          className={`${styles.videoMetaPill} ${
                            styleMeta ? "" : styles.videoMetaPillMuted
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
                        <span className={`${styles.videoMetaPill} ${styles.videoMetaPillNeutral}`}>
                          {durationLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div
                    className={styles.videoIntensityRow}
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
                          className={`${styles.videoIntensityDot} ${
                            isActive ? styles.videoIntensityDotActive : ""
                          }`}
                        />
                      );
                    })}
                  </div>
                  <p className={styles.videoCardSummary}>
                    {meta?.description_short ?? "Nincs rövid leírás."}
                  </p>
                  <div className={styles.videoPoseRow}>
                    {poseThumbs.length === 0 && (
                      <span className={styles.videoPoseEmpty}>Nincs póz</span>
                    )}
                    {poseThumbs.map((pose) => {
                      const slot = pose.mannequin_angled;
                      const hasImage = slot?.status === "verified" && slot?.asset_ref;
                      return (
                        <div key={pose.id} className={styles.videoPoseThumb}>
                          {hasImage ? (
                            <img src={resolveImageUrl(slot.asset_ref)} alt={pose.name_en} />
                          ) : (
                            <span>{pose.name_en}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );

              return isAdmin ? (
                <button
                  key={template.id}
                  type="button"
                  className={styles.videoCard}
                  onClick={() => openVideoModal(template.id)}
                >
                  {cardBody}
                </button>
              ) : (
                <button
                  key={template.id}
                  type="button"
                  className={`${styles.videoCard} ${styles.videoCardStatic}`}
                  onClick={() => setPublicVideoId(template.id)}
                  aria-label={`YouTube jóga: ${template.label}`}
                >
                  {cardBody}
                </button>
              );
            })}
            </div>
          </>
        )}

        {videoMetaError && (
          <div className={`admin-card ${styles.inlineCard} ${styles.errorCard}`}>
            <p className={styles.feedbackBody}>
              Nem sikerült betölteni a meta adatokat.
            </p>
          </div>
        )}
      </div>

      {isAdmin && (
        <>
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
                    <option key={pose.slug} value={pose.slug}>
                      {pose.name_hu || pose.name_en}
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
                            <img src={resolveImageUrl(slot.asset_ref)} alt={label} />
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

                      <label className={`form-field ${styles.imageSlotField}`}>
                        <span className="form-field__label">Prompt override</span>
                        <textarea
                          className={`input ${styles.inputTextarea}`}
                          rows={3}
                          value={promptOverrides[slotKey] ?? ""}
                          onChange={(event) =>
                            setPromptOverrides((prev) => ({
                              ...prev,
                              [slotKey]: event.target.value,
                            }))
                          }
                          placeholder="Illeszd be az override szöveget..."
                        />
                      </label>

                        <div className={styles.imageSlotActions}>
                          <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={() => {
                              const override = promptOverrides[slotKey]?.trim();
                              if (!override) {
                                setError("Nincs megadva override prompt.");
                                return;
                              }
                              updateDraft((draft) => {
                                const current = (draft as any)[slotKey] ?? {};
                                return {
                                  ...draft,
                                  [slotKey]: {
                                    ...current,
                                    prompt: override,
                                    prompt_revision: Date.now(),
                                  },
                                } as Record<string, unknown>;
                              });
                            }}
                          >
                            Override beírása
                          </button>

                          <button
                            type="button"
                            className="btn btn--primary"
                            onClick={() => handleGenerateImage(slotKey, promptOverrides[slotKey])}
                            disabled={isLoading}
                          >
                            Generálás override-dal
                          </button>

                          <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={() =>
                              setPromptOverrides((prev) => ({
                                ...prev,
                                [slotKey]: "",
                              }))
                            }
                          >
                            Override törlése
                          </button>
                        </div>

                        <label className={`form-field ${styles.imageSlotField}`}>
                          <span className="form-field__label">Review instruction (HU/EN)</span>
                          <textarea
                            className={`input ${styles.inputTextarea}`}
                            rows={3}
                            value={promptReviews[slotKey] ?? ""}
                            onChange={(event) =>
                              setPromptReviews((prev) => ({
                                ...prev,
                                [slotKey]: event.target.value,
                              }))
                            }
                            placeholder="Írd le röviden, mit kell módosítani a prompton..."
                          />
                        </label>

                        <div className={styles.imageSlotActions}>
                          <button
                            type="button"
                            className="btn btn--primary"
                            onClick={() => {
                              const review = promptReviews[slotKey]?.trim();
                              if (!review) {
                                setError("Nincs megadva review instruction.");
                                return;
                              }
                              handleGenerateImage(slotKey, undefined, review);
                            }}
                            disabled={isLoading}
                          >
                            Generálás review-val
                          </button>

                          <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={() =>
                              setPromptReviews((prev) => ({
                                ...prev,
                                [slotKey]: "",
                              }))
                            }
                          >
                            Review törlése
                          </button>
                        </div>

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
                          <img src={resolveImageUrl(slot.asset_ref)} alt={label} />
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

                      <label className={`form-field ${styles.imageSlotField}`}>
                        <span className="form-field__label">Prompt override</span>
                        <textarea
                          className={`input ${styles.inputTextarea}`}
                          rows={3}
                          value={promptOverrides[slotKey] ?? ""}
                          onChange={(event) =>
                            setPromptOverrides((prev) => ({
                              ...prev,
                              [slotKey]: event.target.value,
                            }))
                          }
                          placeholder="Illeszd be az override szĂ¶veget..."
                        />
                      </label>

                        <div className={styles.imageSlotActions}>
                          <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={() => {
                              const override = promptOverrides[slotKey]?.trim();
                              if (!override) {
                                setError("Nincs megadva override prompt.");
                                return;
                              }
                              updateDraft((draft) => {
                                const current = (draft as any)[slotKey] ?? {};
                                return {
                                  ...draft,
                                  [slotKey]: {
                                    ...current,
                                    prompt: override,
                                    prompt_revision: Date.now(),
                                  },
                                } as Record<string, unknown>;
                              });
                            }}
                          >
                            Override beĂ­rĂˇsa
                          </button>

                          <button
                            type="button"
                            className="btn btn--primary"
                            onClick={() => handleGenerateImage(slotKey, promptOverrides[slotKey])}
                            disabled={isLoading}
                          >
                            GenerĂˇlĂˇs override-dal
                          </button>

                          <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={() =>
                              setPromptOverrides((prev) => ({
                                ...prev,
                                [slotKey]: "",
                              }))
                            }
                          >
                            Override tĂ¶rlĂ©se
                          </button>
                        </div>

                        <label className={`form-field ${styles.imageSlotField}`}>
                          <span className="form-field__label">Review instruction (HU/EN)</span>
                          <textarea
                            className={`input ${styles.inputTextarea}`}
                            rows={3}
                            value={promptReviews[slotKey] ?? ""}
                            onChange={(event) =>
                              setPromptReviews((prev) => ({
                                ...prev,
                                [slotKey]: event.target.value,
                              }))
                            }
                            placeholder="Írd le röviden, mit kell módosítani a prompton..."
                          />
                        </label>

                        <div className={styles.imageSlotActions}>
                          <button
                            type="button"
                            className="btn btn--primary"
                            onClick={() => {
                              const review = promptReviews[slotKey]?.trim();
                              if (!review) {
                                setError("Nincs megadva review instruction.");
                                return;
                              }
                              handleGenerateImage(slotKey, undefined, review);
                            }}
                            disabled={isLoading}
                          >
                            Generálás review-val
                          </button>

                          <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={() =>
                              setPromptReviews((prev) => ({
                                ...prev,
                                [slotKey]: "",
                              }))
                            }
                          >
                            Review törlése
                          </button>
                        </div>

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

        </div>
      )}
        </>
      )}

      {isAdmin && activeVideoId && videoForm && activeTemplate && (
        <div className={styles.modalOverlay} onClick={closeVideoModal}>
          <div
            className={styles.modal}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="YouTube jóga meta szerkesztő"
          >
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.modalTitle}>YouTube jóga meta</p>
                <p className={styles.modalSubtitle}>{activeTemplate.label}</p>
              </div>
              <button type="button" className="btn btn--ghost" onClick={closeVideoModal}>
                Bezárás
              </button>
            </div>

            <div className={styles.modalLinkRow}>
              <p className={styles.modalLinkLabel}>Videó link</p>
              {activeTemplate.link ? (
                <a
                  className={styles.modalLink}
                  href={activeTemplate.link}
                  target="_blank"
                  rel="noreferrer"
                >
                  {activeTemplate.link}
                </a>
              ) : (
                <span className={styles.modalLinkMissing}>Nincs link</span>
              )}
            </div>

            {videoFormError && (
              <div className={`admin-card ${styles.inlineCard} ${styles.errorCard}`}>
                <p className={styles.feedbackBody}>{videoFormError}</p>
              </div>
            )}

            {videoSaveMessage && (
              <div className={`admin-card ${styles.inlineCard} ${styles.successCard}`}>
                <p className={styles.feedbackBody}>{videoSaveMessage}</p>
              </div>
            )}

            <div className={styles.modalGrid}>
              <label className="form-field">
                <span className="form-field__label">Cím (felülírható)</span>
                <input
                  className="input"
                  type="text"
                  value={videoForm.title_override}
                  onChange={(event) =>
                    setVideoForm((prev) =>
                      prev ? { ...prev, title_override: event.target.value } : prev,
                    )
                  }
                  placeholder={activeTemplate.label}
                />
              </label>

              <label className="form-field">
                <span className="form-field__label">Csatorna</span>
                <input
                  className="input"
                  type="text"
                  value={videoForm.channel}
                  onChange={(event) =>
                    setVideoForm((prev) =>
                      prev ? { ...prev, channel: event.target.value } : prev,
                    )
                  }
                  placeholder="YouTube csatorna neve"
                />
              </label>

              <label className="form-field">
                <span className="form-field__label">Stílus</span>
                <select
                  className="input"
                  value={videoForm.style}
                  onChange={(event) =>
                    setVideoForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            style: event.target.value as YogaVideoStyle | "",
                          }
                        : prev,
                    )
                  }
                >
                  <option value="">Válassz stílust</option>
                  {YogaVideoStyleEnum.options.map((style) => (
                    <option key={style} value={style}>
                      {style}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="form-field">
              <span className="form-field__label">Rövid leírás</span>
              <textarea
                className={`input ${styles.inputTextarea}`}
                rows={3}
                value={videoForm.description_short}
                onChange={(event) =>
                  setVideoForm((prev) =>
                    prev ? { ...prev, description_short: event.target.value } : prev,
                  )
                }
                placeholder="1 mondatos leírás"
              />
            </label>

            <label className="form-field">
              <span className="form-field__label">Hosszabb leírás (4-6 mondat)</span>
              <textarea
                className={`input ${styles.inputTextarea}`}
                rows={6}
                value={videoForm.description_long}
                onChange={(event) =>
                  setVideoForm((prev) =>
                    prev ? { ...prev, description_long: event.target.value } : prev,
                  )
                }
                placeholder="4-6 mondatos leírás"
              />
            </label>

            <label className="form-field">
              <span className="form-field__label">Forrás leírás (YouTube)</span>
              <textarea
                className={`input ${styles.inputTextarea}`}
                rows={4}
                value={videoForm.source_description}
                onChange={(event) =>
                  setVideoForm((prev) =>
                    prev ? { ...prev, source_description: event.target.value } : prev,
                  )
                }
                placeholder="Ide másold be a YouTube leírást, ebből készül a draft."
              />
            </label>

            <label className="form-field">
              <span className="form-field__label">Nyelv</span>
              <input
                className="input"
                type="text"
                value={videoForm.language}
                onChange={(event) =>
                  setVideoForm((prev) =>
                    prev ? { ...prev, language: event.target.value } : prev,
                  )
                }
                placeholder="hu, en..."
              />
            </label>

            <div className={styles.modalPoseBlock}>
              <div className={styles.modalPoseHeader}>
                <p className={styles.modalPoseTitle}>Póz kiválasztás</p>
              </div>
              <label className={`form-field ${styles.modalPoseSearch}`}>
                <span className="form-field__label">Keresés pózok között</span>
                <input
                  className="input"
                  type="text"
                  value={posePickerQuery}
                  onChange={(event) => setPosePickerQuery(event.target.value)}
                  placeholder="Név, szanszkrit vagy slug..."
                />
              </label>
              <div className={styles.modalPoseGrid}>
                {posePickerItems.map((pose) => {
                  const slot = pose.mannequin_angled;
                  const hasImage = slot?.status === "verified" && slot?.asset_ref;
                  const isSelected = videoForm.pose_ids.includes(pose.id);
                  return (
                    <button
                      key={pose.id}
                      type="button"
                      className={`${styles.modalPoseTile} ${
                        isSelected ? styles.modalPoseTileSelected : ""
                      }`}
                      onClick={() => {
                        if (isSelected) return;
                        setVideoForm((prev) =>
                          prev ? { ...prev, pose_ids: [...prev.pose_ids, pose.id] } : prev,
                        );
                      }}
                      aria-pressed={isSelected}
                      title={`${pose.name_hu} · ${pose.name_en}`}
                    >
                      {hasImage ? (
                        <img src={resolveImageUrl(slot.asset_ref)} alt={pose.name_en} />
                      ) : (
                        <span>{pose.name_en}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {videoForm.pose_ids.length === 0 && (
                <p className={styles.modalPoseEmpty}>Még nincs póz hozzárendelve.</p>
              )}

              {videoForm.pose_ids.length > 0 && (
                <div className={styles.modalPoseList}>
                  {videoForm.pose_ids.map((poseId, index) => {
                    const pose = poseMap.get(poseId);
                    return (
                      <div key={`${poseId}-${index}`} className={styles.modalPoseItem}>
                        <div className={styles.modalPoseMeta}>
                          <p className={styles.modalPoseName}>
                            {pose ? `${pose.name_hu} · ${pose.name_en}` : poseId}
                          </p>
                          <p className={styles.modalPoseId}>{poseId}</p>
                        </div>
                        <div className={styles.modalPoseButtons}>
                          <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={() => handleMoveVideoPose(index, -1)}
                            disabled={index === 0}
                          >
                            Feljebb
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={() => handleMoveVideoPose(index, 1)}
                            disabled={index === videoForm.pose_ids.length - 1}
                          >
                            Lejjebb
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={() => handleRemoveVideoPose(poseId)}
                          >
                            Törlés
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={handleDraftVideoMeta}
                disabled={videoDraftLoading}
              >
                {videoDraftLoading ? "AI draft..." : "AI draft javaslat"}
              </button>
              <button type="button" className="btn btn--primary" onClick={handleSaveVideoMeta}>
                Meta mentése
              </button>
            </div>
          </div>
        </div>
      )}

      {!isAdmin && publicTemplate && (
        <div className={styles.modalOverlay} onClick={() => setPublicVideoId(null)}>
          <div
            className={`${styles.modal} ${styles.publicVideoModal}`}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="YouTube jóga részletek"
          >
            <div className={styles.modalHeader}>
              <div className={styles.publicVideoHeader}>
                <div className={styles.publicVideoTitleRow}>
                  <p className={styles.publicVideoTitle}>
                    {publicMeta?.title_override ?? publicTemplate.label}
                  </p>
                  <div
                    className={styles.videoIntensityRow}
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
                          className={`${styles.videoIntensityDot} ${
                            isActive ? styles.videoIntensityDotActive : ""
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
                <p className={styles.publicVideoChannel}>
                  {publicMeta?.channel ?? "Nincs megadva csatorna"}
                </p>
                <div className={styles.publicVideoPills}>
                  {publicCategoryMeta && (
                    <span
                      className={styles.videoCategoryPill}
                      style={{
                        borderColor: publicCategoryMeta.color,
                        backgroundColor: hexToRgba(publicCategoryMeta.color, 0.12),
                        color: publicCategoryMeta.color,
                        ["--pill-icon" as any]: `url(${publicCategoryMeta.icon})`,
                      }}
                    >
                      <span className={styles.videoCategoryIcon} aria-hidden="true" />
                      {publicCategoryMeta.label}
                    </span>
                  )}
                  <span
                    className={`${styles.videoMetaPill} ${
                      publicStyleMeta ? "" : styles.videoMetaPillMuted
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
                  <span className={`${styles.videoMetaPill} ${styles.videoMetaPillNeutral}`}>
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

            <p className={styles.publicVideoText}>
              {yogaVideoMetaMap.get(publicTemplate.id)?.description_long ??
                "Nincs hosszabb leírás."}
            </p>

            <div className={styles.publicVideoPoseRow}>
              {(yogaVideoMetaMap.get(publicTemplate.id)?.pose_ids ?? [])
                .map((poseId) => poseMap.get(poseId))
                .filter(Boolean)
                .slice(0, 12)
                .map((pose) => {
                  const slot = pose!.mannequin_angled;
                  const hasImage = slot?.status === "verified" && slot?.asset_ref;
                  return (
                    <div key={pose!.id} className={styles.publicVideoPoseThumbLarge}>
                      {hasImage ? (
                        <img src={resolveImageUrl(slot!.asset_ref)} alt={pose!.name_en} />
                      ) : (
                        <span>{pose!.name_en}</span>
                      )}
                    </div>
                  );
                })}
            </div>

            {publicTemplate.link && (
              <a
                className={styles.publicVideoLink}
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
    </section>
  );
}











