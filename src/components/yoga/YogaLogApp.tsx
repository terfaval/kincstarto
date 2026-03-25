"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Info, LogOut, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./YogaLogApp.module.css";
import {
  ACTIVITY_CATEGORY_META,
  ACTIVITY_COLORS,
  ACL_ROUTINES,
  STRENGTH_WORKOUTS,
  ACTIVITY_TYPE_META,
  type ACLCategory,
  type StrengthWorkout,
  type StrengthCategory,
  type YogaCategory,
  type ActivityLogRow,
  type ActivityType,
} from "@/types/activity";

type YogaTemplate = {
  id: string;
  category: string;
  label: string;
  duration_minutes: number | null;
  intensity: number | null;
  link: string | null;
};

type DraftState = {
  label: string;
  category: string;
  durationMinutes: string;
  intensity: string;
  notes: string;
  link: string;
  distanceKm: string;
  exerciseId: string;
};

const ACTIVITY_TABS: Array<{ type: ActivityType; label: string; icon: string }> = [
  { type: "yoga", label: "Yoga", icon: ACTIVITY_TYPE_META.yoga.icon },
  { type: "strength", label: "Strength", icon: ACTIVITY_TYPE_META.strength.icon },
  { type: "acl", label: "ACL", icon: ACTIVITY_TYPE_META.acl.icon },
  { type: "running", label: "Running", icon: ACTIVITY_TYPE_META.running.icon },
];

const WEEKDAYS = ["H", "K", "Sz", "Cs", "P", "Sz", "V"];
const MONTHS = [
  "Január",
  "Február",
  "Március",
  "Április",
  "Május",
  "Június",
  "Július",
  "Augusztus",
  "Szeptember",
  "Október",
  "November",
  "December",
];

const DEFAULT_STRENGTH_PROGRESSION = {
  repEvery: 2,
  roundEvery: 5,
  timeIncrementSeconds: 5,
};

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}


function buildMonthGrid(year: number, monthIndex: number) {
  const first = new Date(year, monthIndex, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const total = Math.ceil((offset + daysInMonth) / 7) * 7;
  return Array.from({ length: total }, (_, idx) => {
    const dayIndex = idx - offset + 1;
    const date = new Date(year, monthIndex, dayIndex);
    const inMonth = dayIndex >= 1 && dayIndex <= daysInMonth;
    return { date, inMonth };
  });
}

function summarizeLog(log: ActivityLogRow) {
  if (log.activity_type === "running") {
    const parts = [];
    if (log.distance_km) parts.push(`${log.distance_km} km`);
    if (log.duration_minutes) parts.push(`${log.duration_minutes} perc`);
    return parts.join(" · ");
  }
  if (log.activity_type === "yoga") {
    const parts = [];
    if (log.duration_minutes) parts.push(`${log.duration_minutes} perc`);
    if (log.intensity) parts.push(`intenzitás ${log.intensity}`);
    return parts.join(" · ");
  }
  if (log.activity_type === "strength" || log.activity_type === "acl") {
    return log.exercise_id ? `Program: ${log.exercise_id}` : "";
  }
  return "";
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return `rgba(0, 0, 0, ${alpha})`;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getCategoryMeta(type: ActivityType, category: string) {
  const meta = ACTIVITY_CATEGORY_META[type]?.[category];
  if (meta) return meta;
  const fallback = ACTIVITY_TYPE_META[type];
  return {
    label: category || fallback.label,
    color: fallback.color,
    icon: fallback.icon,
  };
}

type ExerciseInfo = {
  start?: string;
  movement?: string;
  focus?: string;
  notes?: string;
};

function parseExerciseDetail(detail?: string | null): ExerciseInfo | null {
  if (!detail) return null;
  const lines = detail
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  const sections: ExerciseInfo = {};
  let current: keyof ExerciseInfo | null = null;

  const pushLine = (target: keyof ExerciseInfo, text: string) => {
    const trimmed = text.replace(/^\s*[-•]\s*/i, "").trim();
    if (!trimmed) return;
    sections[target] = sections[target] ? `${sections[target]} ${trimmed}` : trimmed;
  };

  for (const line of lines) {
    const normalized = line.toLowerCase();
    if (normalized.startsWith("kiinduló") || normalized.startsWith("kiindulo")) {
      current = "start";
      const rest = line.split(":").slice(1).join(":").trim();
      if (rest) pushLine("start", rest);
      continue;
    }
    if (normalized.startsWith("mozdulat")) {
      current = "movement";
      const rest = line.split(":").slice(1).join(":").trim();
      if (rest) pushLine("movement", rest);
      continue;
    }
    if (normalized.startsWith("fókusz") || normalized.startsWith("fokusz")) {
      current = "focus";
      const rest = line.split(":").slice(1).join(":").trim();
      if (rest) pushLine("focus", rest);
      continue;
    }
    if (normalized.startsWith("tempó") || normalized.startsWith("tempo")) {
      pushLine("notes", line);
      continue;
    }
    if (current) {
      pushLine(current, line);
    } else {
      pushLine("notes", line);
    }
  }

  if (!sections.start && !sections.movement && !sections.focus && !sections.notes) return null;
  if (!sections.start && !sections.movement && !sections.focus && sections.notes) {
    return { movement: sections.notes };
  }
  return sections;
}

function getIntensityDots(intensity?: number | null) {
  if (!intensity) return 0;
  return Math.max(0, Math.min(3, intensity));
}

function getStrengthProgression(workout: StrengthWorkout) {
  return workout.progression ?? DEFAULT_STRENGTH_PROGRESSION;
}

function parseBaseRounds(workout: StrengthWorkout) {
  if (typeof workout.baseRounds === "number" && Number.isFinite(workout.baseRounds)) return workout.baseRounds;
  const match = workout.rounds.match(/(\d+)/);
  if (!match) return null;
  const base = Number(match[1]);
  return Number.isFinite(base) ? base : null;
}

function applyRounds(rounds: string, baseRounds: number | null, roundSteps: number) {
  if (!baseRounds || roundSteps <= 0) return rounds;
  const next = baseRounds + roundSteps;
  return rounds.replace(/^\s*\d+/, String(next));
}

function applyRepProgression(reps: string, repSteps: number, timeIncrementSeconds: number) {
  if (repSteps <= 0) return reps;
  const match = reps.match(/^(\s*\d+\s*×\s*)(\d+)(\s*-\s*(\d+))?(\s*[^0-9]*)$/i);
  if (!match) return reps;

  const prefix = match[1] ?? "";
  const firstRaw = match[2];
  const rangeRaw = match[4];
  const suffix = match[5] ?? "";
  const isTimeBased = /mp\b|sec\b|s\b/i.test(suffix);
  const increment = isTimeBased ? repSteps * timeIncrementSeconds : repSteps;

  const first = Number(firstRaw);
  if (!Number.isFinite(first)) return reps;

  const nextFirst = first + increment;
  if (rangeRaw) {
    const second = Number(rangeRaw);
    if (!Number.isFinite(second)) return reps;
    const nextSecond = second + increment;
    return `${prefix}${nextFirst}-${nextSecond}${suffix}`;
  }

  return `${prefix}${nextFirst}${suffix}`;
}

function buildStrengthWithProgress(
  workouts: StrengthWorkout[],
  progressMap: Record<string, number>
): StrengthWorkout[] {
  return workouts.map((workout) => {
    const completed = progressMap[workout.id] ?? 0;
    const effectiveCompleted = Math.max(0, completed - 1);
    const progression = getStrengthProgression(workout);
    const repSteps = progression.repEvery > 0 ? Math.floor(effectiveCompleted / progression.repEvery) : 0;
    const roundSteps = progression.roundEvery > 0 ? Math.floor(effectiveCompleted / progression.roundEvery) : 0;
    const baseRounds = parseBaseRounds(workout);
    const rounds = applyRounds(workout.rounds, baseRounds, roundSteps);
    const exercises = workout.exercises.map((exercise) => ({
      ...exercise,
      reps: applyRepProgression(exercise.reps, repSteps, progression.timeIncrementSeconds),
    }));
    return { ...workout, rounds, exercises };
  });
}

export default function YogaLogApp() {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState(toDateKey(today));
  const [monthKey, setMonthKey] = useState(toMonthKey(today));
  const [activeType, setActiveType] = useState<ActivityType>("yoga");
  const [logs, setLogs] = useState<ActivityLogRow[]>([]);
  const [templates, setTemplates] = useState<YogaTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedYogaCategory, setSelectedYogaCategory] = useState<YogaCategory>("relax");
  const [selectedStrengthCategory, setSelectedStrengthCategory] = useState<StrengthCategory>("easy");
  const [selectedAclCategory, setSelectedAclCategory] = useState<ACLCategory>("routine");
  const [showYogaForm, setShowYogaForm] = useState(false);
  const [openExerciseInfo, setOpenExerciseInfo] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [strengthProgress, setStrengthProgress] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState<DraftState>({
    label: "",
    category: "relax",
    durationMinutes: "",
    intensity: "2",
    notes: "",
    link: "",
    distanceKm: "",
    exerciseId: "",
  });

  const renderLogBadge = (meta: { label: string; color: string; icon: string }) => (
    <span
      className={styles.logBadge}
      style={{
        borderColor: meta.color,
        color: meta.color,
        backgroundColor: hexToRgba(meta.color, 0.12),
      }}
    >
      <span
        className={styles.pillIcon}
        style={{ ["--pill-icon" as any]: `url(${meta.icon})` }}
        aria-hidden="true"
      />
      {meta.label}
    </span>
  );

  useEffect(() => {
    const date = parseDateKey(selectedDate);
    const nextMonth = toMonthKey(date);
    if (nextMonth !== monthKey) setMonthKey(nextMonth);
  }, [selectedDate, monthKey]);

  useEffect(() => {
    let isActive = true;
    setLoading(true);
    fetch(`/api/activity-logs?month=${monthKey}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isActive) return;
        setLogs(Array.isArray(data.logs) ? data.logs : []);
      })
      .catch(() => {
        if (!isActive) return;
        setLogs([]);
      })
      .finally(() => {
        if (!isActive) return;
        setLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, [monthKey]);

  const refreshTemplates = () => {
    fetch("/api/yoga-templates")
      .then((res) => res.json())
      .then((data) => {
        setTemplates(Array.isArray(data.templates) ? data.templates : []);
      })
      .catch(() => setTemplates([]));
  };

  useEffect(() => {
    refreshTemplates();
  }, []);

  useEffect(() => {
    fetch("/api/strength-progress")
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data === "object" && data.counts && typeof data.counts === "object") {
          setStrengthProgress(data.counts as Record<string, number>);
        }
      })
      .catch(() => setStrengthProgress({}));
  }, []);

  const templatesForCategory = useMemo(
    () => templates.filter((template) => template.category === selectedYogaCategory),
    [templates, selectedYogaCategory]
  );

  const strengthOptions = useMemo(() => {
    const progressed = buildStrengthWithProgress(STRENGTH_WORKOUTS, strengthProgress);
    return progressed.filter((workout) => workout.category === selectedStrengthCategory);
  }, [selectedStrengthCategory, strengthProgress]);

  const aclOptions = useMemo(
    () => ACL_ROUTINES.filter((routine) => routine.category === selectedAclCategory),
    [selectedAclCategory]
  );

  useEffect(() => {
    if (editingId) return;
    setOpenExerciseInfo(null);
    setDuplicateWarning(null);
    if (activeType === "yoga") {
      setShowYogaForm(false);
      setSelectedYogaCategory("relax");
      setDraft((current) => ({
        ...current,
        label: "",
        category: "relax",
        durationMinutes: "",
        intensity: "2",
        notes: "",
        link: "",
      }));
    }
    if (activeType === "strength") {
      setSelectedStrengthCategory("easy");
      const first = STRENGTH_WORKOUTS.find((workout) => workout.category === "easy");
      setDraft((current) => ({
        ...current,
        exerciseId: first?.id ?? "",
        notes: "",
      }));
    }
    if (activeType === "acl") {
      setSelectedAclCategory("routine");
      const first = ACL_ROUTINES.find((routine) => routine.category === "routine");
      setDraft((current) => ({
        ...current,
        exerciseId: first?.id ?? "",
        notes: "",
      }));
    }
    if (activeType === "running") {
      setDraft((current) => ({
        ...current,
        label: "Futás",
        distanceKm: "",
        durationMinutes: "",
        notes: "",
      }));
    }
  }, [activeType, editingId]);

  useEffect(() => {
    setDraft((current) => ({ ...current, category: selectedYogaCategory }));
  }, [selectedYogaCategory]);



  useEffect(() => {
    if (editingId) return;
    setDraft((current) => ({ ...current, category: selectedYogaCategory }));
  }, [selectedYogaCategory, editingId]);

  useEffect(() => {
    if (editingId) return;
    if (activeType !== "strength") return;
    if (strengthOptions.length === 0) return;
    if (strengthOptions.some((workout) => workout.id === draft.exerciseId)) return;
    setDraft((current) => ({ ...current, exerciseId: strengthOptions[0].id }));
  }, [strengthOptions, editingId, activeType, draft.exerciseId]);

  useEffect(() => {
    if (editingId) return;
    if (activeType !== "acl") return;
    if (aclOptions.length === 0) return;
    if (aclOptions.some((routine) => routine.id === draft.exerciseId)) return;
    setDraft((current) => ({ ...current, exerciseId: aclOptions[0].id }));
  }, [aclOptions, editingId, activeType, draft.exerciseId]);

  const logsByDate = useMemo(() => {
    const map = new Map<string, ActivityLogRow[]>();
    logs.forEach((log) => {
      const list = map.get(log.date) ?? [];
      list.push(log);
      map.set(log.date, list);
    });
    return map;
  }, [logs]);

  const buildIndicators = (dayLogs: ActivityLogRow[]) => {
    const unique = new Map<string, { label: string; color: string; icon: string }>();
    dayLogs.forEach((log) => {
      const meta = getCategoryMeta(log.activity_type, log.category);
      unique.set(`${log.activity_type}:${meta.label}`, meta);
    });
    return Array.from(unique.values());
  };

  const logsForDay = useMemo(() => logs.filter((log) => log.date === selectedDate), [logs, selectedDate]);

  const selectedWorkout = useMemo(
    () => STRENGTH_WORKOUTS.find((workout) => workout.id === draft.exerciseId),
    [draft.exerciseId]
  );

  const selectedRoutine = useMemo(
    () => ACL_ROUTINES.find((routine) => routine.id === draft.exerciseId),
    [draft.exerciseId]
  );

  const handleEdit = (log: ActivityLogRow) => {
    setEditingId(log.id);
    setActiveType(log.activity_type);
    setSelectedDate(log.date);
    setOpenExerciseInfo(null);
    if (log.activity_type === "yoga") {
      const category = (log.category as YogaCategory) || "relax";
      setSelectedYogaCategory(category);
      setShowYogaForm(true);
    }
    if (log.activity_type === "strength") {
      setSelectedStrengthCategory((log.category as StrengthCategory) || "easy");
    }
    if (log.activity_type === "acl") {
      setSelectedAclCategory((log.category as ACLCategory) || "routine");
    }
    setDraft({
      label: log.label ?? "",
      category: log.category ?? "",
      durationMinutes: log.duration_minutes ? String(log.duration_minutes) : "",
      intensity: log.intensity ? String(log.intensity) : "",
      notes: log.notes ?? "",
      link:
        log.metadata && typeof log.metadata === "object" && typeof log.metadata.link === "string"
          ? log.metadata.link
          : "",
      distanceKm: log.distance_km ? String(log.distance_km) : "",
      exerciseId: log.exercise_id ?? "",
    });
  };

  const resetDraft = () => {
    setEditingId(null);
    setOpenExerciseInfo(null);
    setDuplicateWarning(null);
    if (activeType === "yoga") {
      setShowYogaForm(false);
      setDraft({
        label: "",
        category: selectedYogaCategory,
        durationMinutes: "",
        intensity: "2",
        notes: "",
        link: "",
        distanceKm: "",
        exerciseId: draft.exerciseId,
      });
    } else if (activeType === "running") {
      setDraft({
        label: "Futás",
        category: "",
        durationMinutes: "",
        intensity: "",
        notes: "",
        link: "",
        distanceKm: "",
        exerciseId: "",
      });
    } else {
      setDraft((current) => ({
        ...current,
        notes: "",
      }));
    }
  };

  const handleDelete = async (logId: string) => {
    await fetch("/api/activity-logs", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: logId }),
    });
    setLogs((current) => current.filter((log) => log.id !== logId));
    if (editingId === logId) resetDraft();
  };

  const handleSubmit = async () => {
    const payload: Partial<ActivityLogRow> = {
      date: selectedDate,
      activity_type: activeType,
      category: draft.category,
      exercise_id: draft.exerciseId || null,
      label: draft.label,
      duration_minutes: draft.durationMinutes ? Number(draft.durationMinutes) : null,
      distance_km: draft.distanceKm ? Number(draft.distanceKm) : null,
      intensity: draft.intensity ? Number(draft.intensity) : null,
      notes: draft.notes,
      metadata: draft.link ? { link: draft.link } : null,
    };

    if (activeType === "yoga" && draft.link) {
      const duplicate = logs.find((log) => {
        if (editingId && log.id === editingId) return false;
        if (!log.metadata || typeof log.metadata !== "object") return false;
        const link = (log.metadata as Record<string, unknown>).link;
        return typeof link === "string" && link === draft.link;
      });
      if (duplicate) {
        setDuplicateWarning("Ez a link már rögzítve van. Megnyitottam a meglévő logot.");
        handleEdit(duplicate);
        return;
      }
    }

    if (activeType === "strength" && selectedWorkout) {
      payload.category = selectedWorkout.category;
      payload.exercise_id = selectedWorkout.id;
      payload.label = selectedWorkout.label;
    }

    if (activeType === "acl" && selectedRoutine) {
      payload.category = selectedRoutine.category;
      payload.exercise_id = selectedRoutine.id;
      payload.label = selectedRoutine.label;
    }

    if (activeType === "running") {
      payload.category = "run";
      if (!payload.distance_km && !payload.duration_minutes) return;
      if (!payload.label) payload.label = "Futás";
    }

    if (activeType === "yoga") {
      if (
        !payload.label ||
        payload.duration_minutes === null ||
        payload.intensity === null ||
        !payload.category
      )
        return;
    }

    const response = await fetch("/api/activity-logs", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingId ? { ...payload, id: editingId } : payload),
    });

    if (!response.ok) {
      if (response.status === 409) {
        const data = await response.json().catch(() => null);
        if (data?.error === "duplicate_link" && data.log) {
          setDuplicateWarning("Ez a link már rögzítve van. Megnyitottam a meglévő logot.");
          handleEdit(data.log as ActivityLogRow);
          return;
        }
      }
      return;
    }
    const data = await response.json();
    const updatedLog = data.log as ActivityLogRow | undefined;
    if (!updatedLog) return;

    setDuplicateWarning(null);
    setLogs((current) => {
      if (editingId) {
        return current.map((log) => (log.id === updatedLog.id ? updatedLog : log));
      }
      return [...current, updatedLog];
    });
    if (activeType === "yoga") refreshTemplates();
    resetDraft();
  };

  const handleMonthShift = (direction: number) => {
    const [year, month] = monthKey.split("-").map(Number);
    const nextDate = new Date(year, month - 1 + direction, 1);
    const nextKey = toMonthKey(nextDate);
    setMonthKey(nextKey);
    setSelectedDate(`${nextKey}-01`);
  };

  const monthDate = useMemo(() => parseDateKey(`${monthKey}-01`), [monthKey]);
  const monthGrid = useMemo(
    () => buildMonthGrid(monthDate.getFullYear(), monthDate.getMonth()),
    [monthDate]
  );

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
    } finally {
      router.replace("/login");
    }
  };

  return (
    <section className={`${styles.page} admin-stack`}>
      <div className={`admin-card ${styles.hero}`}>
        <div>
          <p className={styles.heroTag}>{"Mozgásnapló"}</p>
          <h1 className={styles.heroTitle}>{"Yoga és testedzés napló"}</h1>
          <p className={styles.heroLead}>
            {"Heti fókusz, havi átlátás és gyors logolás. A logokból új jóga sablonok épülnek."}
          </p>
        </div>
        <div className={styles.heroMeta}>
          <div>
            <span>{"Kijelölt nap"}</span>
            <strong>{selectedDate}</strong>
          </div>
          <div>
            <span>{"Havi logok"}</span>
            <strong>{logs.length}</strong>
          </div>
        </div>
      </div>

      <div className={styles.layout}>
        <div className={styles.topRow}>
          <div className={`admin-card ${styles.monthCard}`}>
            <div className={styles.monthHeader}>
              <button type="button" className="btn btn--ghost" onClick={() => handleMonthShift(-1)}>
                <ChevronLeft size={16} />
              </button>
              <div>
                <p className={styles.sectionTag}>{"Havi nézet"}</p>
                <h2>{`${MONTHS[monthDate.getMonth()]} ${monthDate.getFullYear()}`}</h2>
              </div>
              <button type="button" className="btn btn--ghost" onClick={() => handleMonthShift(1)}>
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setSelectedDate(toDateKey(new Date()))}
              >
                {"Ma"}
              </button>
            </div>
            <div className={styles.monthGrid}>
              {WEEKDAYS.map((label, idx) => (
                <span key={`${label}-${idx}`} className={styles.monthLabel}>
                  {label}
                </span>
              ))}
              {monthGrid.map(({ date, inMonth }) => {
                const key = toDateKey(date);
                const dayLogs = logsByDate.get(key) ?? [];
                const indicators = buildIndicators(dayLogs);
                return (
                  <button
                    key={key}
                    type="button"
                    className={`${styles.monthCell} ${inMonth ? "" : styles.monthCellMuted} ${
                      key === selectedDate ? styles.monthCellActive : ""
                    }`}
                    onClick={() => setSelectedDate(key)}
                  >
                    <span>{date.getDate()}</span>
                    {indicators.length > 0 && (
                      <div className={styles.monthIndicators}>
                        {indicators.map((meta) => (
                          <span key={`${key}-${meta.label}`} style={{ backgroundColor: meta.color }} />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={`admin-card ${styles.logCard}`}>
            <div className={styles.logHeader}>
              <div>
                <p className={styles.sectionTag}>{"Napi logok"}</p>
                <h2>{`${selectedDate}`}</h2>
              </div>
              <div className={styles.logHeaderMeta}>
                <span>{`${logsForDay.length} log`}</span>
                {loading && <em>{"betöltés..."}</em>}
              </div>
            </div>

            {logsForDay.length === 0 && !loading && (
              <p className={styles.emptyText}>{"Nincs log ehhez a naphoz."}</p>
            )}

            {logsForDay.length > 0 && (
              <div className={styles.logList}>
                {logsForDay.map((log) => (
                  <div key={log.id} className={styles.logItem}>
                    <div className={styles.logMeta}>
                      <div>
                        <strong>{log.label}</strong>
                        <span>{summarizeLog(log)}</span>
                      </div>
                      {(() => {
                        const meta = getCategoryMeta(log.activity_type, log.category);
                        return (
                          <div
                            className={styles.logBadge}
                            style={{
                              borderColor: meta.color,
                              color: meta.color,
                              backgroundColor: hexToRgba(meta.color, 0.12),
                            }}
                          >
                            <span
                              className={styles.pillIcon}
                              style={{ ["--pill-icon" as any]: `url(${meta.icon})` }}
                              aria-hidden="true"
                            />
                            <span>{meta.label}</span>
                          </div>
                        );
                      })()}
                    </div>
                    {log.notes && <p className={styles.logNotes}>{log.notes}</p>}
                    {log.metadata && typeof log.metadata === "object" && typeof log.metadata.link === "string" && (
                      <a className={styles.logLink} href={log.metadata.link} target="_blank" rel="noreferrer">
                        {log.metadata.link}
                      </a>
                    )}
                    <div className={styles.logActions}>
                      <button type="button" className="btn btn--ghost" onClick={() => handleEdit(log)}>
                        <Pencil size={16} />
                        {"Szerkesztés"}
                      </button>
                      <button type="button" className="btn btn--ghost" onClick={() => handleDelete(log.id)}>
                        <Trash2 size={16} />
                        {"Törlés"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

          <div className={`admin-card ${styles.entryCard} ${styles.entryFull}`}>
            <div className={styles.entryHeader}>
              <div>
                <p className={styles.sectionTag}>{"Rögzítés"}</p>
                <h2>{editingId ? "Log szerkesztése" : "Új log"}</h2>
              </div>
              {editingId && (
                <button type="button" className="btn btn--ghost" onClick={resetDraft}>
                  {"Szerkesztés lezárása"}
                </button>
              )}
            </div>

            {duplicateWarning && <div className={styles.warningBanner}>{duplicateWarning}</div>}

            <div className={styles.tabRow}>
              {ACTIVITY_TABS.map((tab) => (
                <button
                  key={tab.type}
                  type="button"
                  className={`${styles.tabButton} ${activeType === tab.type ? styles.tabButtonActive : ""}`}
                  onClick={() => setActiveType(tab.type)}
                  style={
                    activeType === tab.type
                      ? {
                          borderColor: ACTIVITY_COLORS[tab.type],
                          backgroundColor: hexToRgba(ACTIVITY_COLORS[tab.type], 0.12),
                          color: ACTIVITY_COLORS[tab.type],
                        }
                      : undefined
                  }
                >
                  <span
                    className={styles.tabIcon}
                    style={{ ["--pill-icon" as any]: `url(${tab.icon})` }}
                    aria-hidden="true"
                  />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {activeType === "yoga" && (
              <div className={styles.stepSection}>
                <p className={styles.stepLabel}>{"Kategória"}</p>
                <div className={styles.optionRow}>
                  <button
                    type="button"
                    className={`${styles.optionButton} ${
                      selectedYogaCategory === "relax" ? styles.optionButtonActive : styles.optionButtonInactive
                    }`}
                    onClick={() => setSelectedYogaCategory("relax")}
                    style={
                      selectedYogaCategory === "relax"
                        ? {
                            borderColor: ACTIVITY_CATEGORY_META.yoga.relax.color,
                            backgroundColor: hexToRgba(ACTIVITY_CATEGORY_META.yoga.relax.color, 0.12),
                            color: ACTIVITY_CATEGORY_META.yoga.relax.color,
                          }
                        : undefined
                    }
                  >
                    <span
                      className={styles.pillIcon}
                      style={{ ["--pill-icon" as any]: `url(${ACTIVITY_CATEGORY_META.yoga.relax.icon})` }}
                      aria-hidden="true"
                    />
                    {"Relax"}
                  </button>
                  <button
                    type="button"
                    className={`${styles.optionButton} ${
                      selectedYogaCategory === "strong" ? styles.optionButtonActive : styles.optionButtonInactive
                    }`}
                    onClick={() => setSelectedYogaCategory("strong")}
                    style={
                      selectedYogaCategory === "strong"
                        ? {
                            borderColor: ACTIVITY_CATEGORY_META.yoga.strong.color,
                            backgroundColor: hexToRgba(ACTIVITY_CATEGORY_META.yoga.strong.color, 0.12),
                            color: ACTIVITY_CATEGORY_META.yoga.strong.color,
                          }
                        : undefined
                    }
                  >
                    <span
                      className={styles.pillIcon}
                      style={{ ["--pill-icon" as any]: `url(${ACTIVITY_CATEGORY_META.yoga.strong.icon})` }}
                      aria-hidden="true"
                    />
                    {"Strong"}
                  </button>
                </div>

                <div className={styles.templateGroup}>
                  <p>{"Mentett sablonok"}</p>
                  <div className={styles.templateList}>
                    {templatesForCategory.length === 0 && (
                      <span className={styles.templateEmpty}>{"Nincs mentett sablon."}</span>
                    )}
                    {templatesForCategory.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        className={styles.templateButton}
                        onClick={() => {
                          setSelectedYogaCategory(template.category as YogaCategory);
                          setShowYogaForm(true);
                          setDraft((current) => ({
                            ...current,
                            label: template.label,
                            category: template.category,
                            durationMinutes: template.duration_minutes ? String(template.duration_minutes) : "",
                            intensity: template.intensity ? String(template.intensity) : "2",
                            link: template.link ?? "",
                          }));
                        }}
                      >
                        <strong>{template.label}</strong>
                        {(() => {
                          const meta = getCategoryMeta("yoga", template.category);
                          return (
                            <span
                              className={styles.templateBadge}
                              style={{
                                borderColor: meta.color,
                                color: meta.color,
                                backgroundColor: hexToRgba(meta.color, 0.12),
                              }}
                            >
                              <span
                                className={styles.pillIcon}
                                style={{ ["--pill-icon" as any]: `url(${meta.icon})` }}
                                aria-hidden="true"
                              />
                              {meta.label}
                            </span>
                          );
                        })()}
                        <span>
                          {template.duration_minutes ? `${template.duration_minutes} perc` : "idő nélkül"}
                        </span>
                        <div
                          className={styles.intensityRow}
                          aria-label={`intenzitás ${template.intensity ?? "-"}`}
                        >
                          {Array.from({ length: 3 }).map((_, idx) => (
                            <span
                              key={`${template.id}-dot-${idx}`}
                              className={`${styles.intensityDot} ${
                                idx < getIntensityDots(template.intensity) ? styles.intensityDotActive : ""
                              }`}
                            />
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  className={`btn btn--ghost ${styles.addYogaButton}`}
                  onClick={() => setShowYogaForm((current) => !current)}
                >
                  {showYogaForm ? "Adatlap bezárása" : "Új jóga hozzáadása"}
                </button>

                {showYogaForm && (
                  <div className={styles.formSection}>
                    <div className={styles.formGrid}>
                      <label className="form-field">
                        <span className="form-field__label">{"Cím"}</span>
                        <input
                          className="input"
                          value={draft.label}
                          onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))}
                        />
                      </label>
                      <label className="form-field">
                        <span className="form-field__label">{"Időtartam (perc)"}</span>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          value={draft.durationMinutes}
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, durationMinutes: event.target.value }))
                          }
                        />
                      </label>
                      <label className="form-field">
                        <span className="form-field__label">{"Intenzitás"}</span>
                        <select
                          className="input"
                          value={draft.intensity}
                          onChange={(event) => setDraft((current) => ({ ...current, intensity: event.target.value }))}
                        >
                          <option value="1">1 · lágy</option>
                          <option value="2">2 · közepes</option>
                          <option value="3">3 · erős</option>
                        </select>
                      </label>
                      <label className="form-field">
                        <span className="form-field__label">{"Link"}</span>
                        <input
                          className="input"
                          value={draft.link}
                          onChange={(event) => setDraft((current) => ({ ...current, link: event.target.value }))}
                        />
                      </label>
                    </div>

                    <label className="form-field">
                      <span className="form-field__label">{"Megjegyzés"}</span>
                      <textarea
                        className="input"
                        rows={3}
                        value={draft.notes}
                        onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                      />
                    </label>

                    <div className={styles.formActions}>
                      <button type="button" className="btn btn--primary" onClick={handleSubmit}>
                        <Plus size={16} />
                        {editingId ? "Mentés" : "Rögzítés"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeType === "strength" && (
              <div className={styles.stepSection}>
                <p className={styles.stepLabel}>{"Intenzitás"}</p>
                <div className={styles.optionRow}>
                  <button
                    type="button"
                    className={`${styles.optionButton} ${
                      selectedStrengthCategory === "easy" ? styles.optionButtonActive : styles.optionButtonInactive
                    }`}
                    onClick={() => setSelectedStrengthCategory("easy")}
                    style={
                      selectedStrengthCategory === "easy"
                        ? {
                            borderColor: ACTIVITY_CATEGORY_META.strength.easy.color,
                            backgroundColor: hexToRgba(ACTIVITY_CATEGORY_META.strength.easy.color, 0.12),
                            color: ACTIVITY_CATEGORY_META.strength.easy.color,
                          }
                        : undefined
                    }
                  >
                    <span
                      className={styles.pillIcon}
                      style={{ ["--pill-icon" as any]: `url(${ACTIVITY_CATEGORY_META.strength.easy.icon})` }}
                      aria-hidden="true"
                    />
                    {"Easy"}
                  </button>
                  <button
                    type="button"
                    className={`${styles.optionButton} ${
                      selectedStrengthCategory === "intense" ? styles.optionButtonActive : styles.optionButtonInactive
                    }`}
                    onClick={() => setSelectedStrengthCategory("intense")}
                    style={
                      selectedStrengthCategory === "intense"
                        ? {
                            borderColor: ACTIVITY_CATEGORY_META.strength.intense.color,
                            backgroundColor: hexToRgba(ACTIVITY_CATEGORY_META.strength.intense.color, 0.12),
                            color: ACTIVITY_CATEGORY_META.strength.intense.color,
                          }
                        : undefined
                    }
                  >
                    <span
                      className={styles.pillIcon}
                      style={{ ["--pill-icon" as any]: `url(${ACTIVITY_CATEGORY_META.strength.intense.icon})` }}
                      aria-hidden="true"
                    />
                    {"Intense"}
                  </button>
                </div>

                <div className={styles.workoutList}>
                  {strengthOptions.map((workout) => (
                    <div
                      key={workout.id}
                      className={`${styles.workoutCard} ${draft.exerciseId === workout.id ? styles.workoutCardActive : ""}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => setDraft((current) => ({ ...current, exerciseId: workout.id }))}
                    >
                      <div className={styles.workoutHeader}>
                        <strong>{workout.label}</strong>
                        <span className={styles.workoutMeta}>{workout.rounds}</span>
                      </div>
                      <div className={styles.exerciseList}>
                        {workout.exercises.map((exercise, idx) => {
                          const infoId = `${workout.id}-${idx}`;
                          const detail = parseExerciseDetail(exercise.detail);
                          return (
                            <div key={infoId} className={styles.exerciseBlock}>
                              <div className={styles.exerciseRow}>
                                <button
                                  type="button"
                                  className={styles.infoButton}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setOpenExerciseInfo((current) => (current === infoId ? null : infoId));
                                  }}
                                  aria-label={`Info: ${exercise.name}`}
                                >
                                  <Info size={14} />
                                </button>
                                <span className={styles.exerciseName}>{exercise.name}</span>
                                <span className={styles.exerciseRep}>{exercise.reps}</span>
                              </div>
                              {openExerciseInfo === infoId && detail && (
                                <div className={styles.infoPanel}>
                                  {detail.start && (
                                    <div className={styles.infoSection}>
                                      <span>{"Kiinduló"}</span>
                                      <p>{detail.start}</p>
                                    </div>
                                  )}
                                  {detail.movement && (
                                    <div className={styles.infoSection}>
                                      <span>{"Mozdulat"}</span>
                                      <p>{detail.movement}</p>
                                    </div>
                                  )}
                                  {detail.focus && (
                                    <div className={styles.infoSection}>
                                      <span>{"Fókusz"}</span>
                                      <p>{detail.focus}</p>
                                    </div>
                                  )}
                                  {!detail.start && !detail.movement && !detail.focus && detail.notes && (
                                    <div className={styles.infoSection}>
                                      <span>{"Leírás"}</span>
                                      <p>{detail.notes}</p>
                                    </div>
                                  )}
                                  {detail.notes && detail.movement && (
                                    <div className={styles.infoSection}>
                                      <span>{"Megjegyzés"}</span>
                                      <p>{detail.notes}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <label className="form-field">
                  <span className="form-field__label">{"Megjegyzés"}</span>
                  <textarea
                    className="input"
                    rows={3}
                    value={draft.notes}
                    onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                  />
                </label>

                <div className={styles.formActions}>
                  <button type="button" className="btn btn--primary" onClick={handleSubmit}>
                    <Plus size={16} />
                    {editingId ? "Mentés" : "Rögzítés"}
                  </button>
                </div>
              </div>
            )}

            {activeType === "acl" && (
              <div className={styles.stepSection}>
                <p className={styles.stepLabel}>{"Típus"}</p>
                <div className={styles.optionRow}>
                  <button
                    type="button"
                    className={`${styles.optionButton} ${
                      selectedAclCategory === "routine" ? styles.optionButtonActive : styles.optionButtonInactive
                    }`}
                    onClick={() => setSelectedAclCategory("routine")}
                    style={
                      selectedAclCategory === "routine"
                        ? {
                            borderColor: ACTIVITY_CATEGORY_META.acl.routine.color,
                            backgroundColor: hexToRgba(ACTIVITY_CATEGORY_META.acl.routine.color, 0.12),
                            color: ACTIVITY_CATEGORY_META.acl.routine.color,
                          }
                        : undefined
                    }
                  >
                    <span
                      className={styles.pillIcon}
                      style={{ ["--pill-icon" as any]: `url(${ACTIVITY_CATEGORY_META.acl.routine.icon})` }}
                      aria-hidden="true"
                    />
                    {"Routine"}
                  </button>
                  <button
                    type="button"
                    className={`${styles.optionButton} ${
                      selectedAclCategory === "block" ? styles.optionButtonActive : styles.optionButtonInactive
                    }`}
                    onClick={() => setSelectedAclCategory("block")}
                    style={
                      selectedAclCategory === "block"
                        ? {
                            borderColor: ACTIVITY_CATEGORY_META.acl.block.color,
                            backgroundColor: hexToRgba(ACTIVITY_CATEGORY_META.acl.block.color, 0.12),
                            color: ACTIVITY_CATEGORY_META.acl.block.color,
                          }
                        : undefined
                    }
                  >
                    <span
                      className={styles.pillIcon}
                      style={{ ["--pill-icon" as any]: `url(${ACTIVITY_CATEGORY_META.acl.block.icon})` }}
                      aria-hidden="true"
                    />
                    {"Block"}
                  </button>
                </div>

                <div className={styles.workoutList}>
                  {aclOptions.map((routine) => (
                    <div
                      key={routine.id}
                      className={`${styles.workoutCard} ${draft.exerciseId === routine.id ? styles.workoutCardActive : ""}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => setDraft((current) => ({ ...current, exerciseId: routine.id }))}
                    >
                      <div className={styles.workoutHeader}>
                        <strong>{routine.label}</strong>
                        <span className={styles.workoutMeta}>{routine.focus}</span>
                      </div>
                      <div className={styles.exerciseList}>
                        {routine.exercises.map((exercise, idx) => {
                          const infoId = `${routine.id}-${idx}`;
                          const detail = parseExerciseDetail(exercise.detail);
                          return (
                            <div key={infoId} className={styles.exerciseBlock}>
                              <div className={styles.exerciseRow}>
                                <button
                                  type="button"
                                  className={styles.infoButton}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setOpenExerciseInfo((current) => (current === infoId ? null : infoId));
                                  }}
                                  aria-label={`Info: ${exercise.name}`}
                                >
                                  <Info size={14} />
                                </button>
                                <span className={styles.exerciseName}>{exercise.name}</span>
                                <span className={styles.exerciseRep}>{exercise.reps}</span>
                              </div>
                              {openExerciseInfo === infoId && detail && (
                                <div className={styles.infoPanel}>
                                  {detail.start && (
                                    <div className={styles.infoSection}>
                                      <span>{"Kiinduló"}</span>
                                      <p>{detail.start}</p>
                                    </div>
                                  )}
                                  {detail.movement && (
                                    <div className={styles.infoSection}>
                                      <span>{"Mozdulat"}</span>
                                      <p>{detail.movement}</p>
                                    </div>
                                  )}
                                  {detail.focus && (
                                    <div className={styles.infoSection}>
                                      <span>{"Fókusz"}</span>
                                      <p>{detail.focus}</p>
                                    </div>
                                  )}
                                  {!detail.start && !detail.movement && !detail.focus && detail.notes && (
                                    <div className={styles.infoSection}>
                                      <span>{"Leírás"}</span>
                                      <p>{detail.notes}</p>
                                    </div>
                                  )}
                                  {detail.notes && detail.movement && (
                                    <div className={styles.infoSection}>
                                      <span>{"Megjegyzés"}</span>
                                      <p>{detail.notes}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <label className="form-field">
                  <span className="form-field__label">{"Megjegyzés"}</span>
                  <textarea
                    className="input"
                    rows={3}
                    value={draft.notes}
                    onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                  />
                </label>

                <div className={styles.formActions}>
                  <button type="button" className="btn btn--primary" onClick={handleSubmit}>
                    <Plus size={16} />
                    {editingId ? "Mentés" : "Rögzítés"}
                  </button>
                </div>
              </div>
            )}

            {activeType === "running" && (
              <div className={styles.stepSection}>
                <div className={styles.formGrid}>
                  {(() => {
                    const meta = getCategoryMeta("running", "run");
                    return <div className={styles.optionRow}>{renderLogBadge(meta)}</div>;
                  })()}
                  <label className="form-field">
                    <span className="form-field__label">{"Megnevezés"}</span>
                    <input
                      className="input"
                      value={draft.label}
                      onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))}
                    />
                  </label>
                  <label className="form-field">
                    <span className="form-field__label">{"Táv (km)"}</span>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.1"
                      value={draft.distanceKm}
                      onChange={(event) => setDraft((current) => ({ ...current, distanceKm: event.target.value }))}
                    />
                  </label>
                  <label className="form-field">
                    <span className="form-field__label">{"Idő (perc)"}</span>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      value={draft.durationMinutes}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, durationMinutes: event.target.value }))
                      }
                    />
                  </label>
                </div>

                <label className="form-field">
                  <span className="form-field__label">{"Megjegyzés"}</span>
                  <textarea
                    className="input"
                    rows={3}
                    value={draft.notes}
                    onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                  />
                </label>

                <div className={styles.formActions}>
                  <button type="button" className="btn btn--primary" onClick={handleSubmit}>
                    <Plus size={16} />
                    {editingId ? "Mentés" : "Rögzítés"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      <div className={styles.fabToolbar}>
        <Link
          href="/admin"
          className={styles.addFab}
          aria-label="Vissza a konyvekhez"
          title="Vissza a konyvekhez"
        >
          <BookOpen size={18} />
        </Link>
        <button
          type="button"
          className={styles.addFab}
          onClick={handleLogout}
          aria-label="Kijelentkezes"
          title="Kijelentkezes"
        >
          <LogOut size={18} />
        </button>
      </div>

    </section>
  );
}
