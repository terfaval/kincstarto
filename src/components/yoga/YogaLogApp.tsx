"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import styles from "./YogaLogApp.module.css";
import {
  ACTIVITY_CATEGORY_META,
  ACTIVITY_COLORS,
  ACL_ROUTINES,
  STRENGTH_WORKOUTS,
  ACTIVITY_TYPE_META,
  YOGA_LIBRARY,
  type ActivityLogRow,
  type ActivityType,
} from "@/types/activity";

type YogaTemplate = {
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

function startOfWeek(date: Date) {
  const copy = new Date(date);
  const shift = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - shift);
  return copy;
}

function addDays(date: Date, amount: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function buildWeek(date: Date) {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, idx) => addDays(start, idx));
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

  const weekDates = useMemo(() => buildWeek(parseDateKey(selectedDate)), [selectedDate]);

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
    if (editingId) return;
    if (activeType === "yoga") {
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
      const first = STRENGTH_WORKOUTS[0];
      setDraft((current) => ({
        ...current,
        exerciseId: first?.id ?? "",
        notes: "",
      }));
    }
    if (activeType === "acl") {
      const first = ACL_ROUTINES[0];
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

  const logsByDate = useMemo(() => {
    const map = new Map<string, ActivityLogRow[]>();
    logs.forEach((log) => {
      const list = map.get(log.date) ?? [];
      list.push(log);
      map.set(log.date, list);
    });
    return map;
  }, [logs]);

  const logsForDay = useMemo(() => logs.filter((log) => log.date === selectedDate), [logs, selectedDate]);
  const logsForType = useMemo(
    () => logsForDay.filter((log) => log.activity_type === activeType),
    [logsForDay, activeType]
  );

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
    if (activeType === "yoga") {
      setDraft({
        label: "",
        category: "relax",
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

    if (!response.ok) return;
    const data = await response.json();
    const updatedLog = data.log as ActivityLogRow | undefined;
    if (!updatedLog) return;

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
          <div className={styles.heroAction}>
            <button type="button" className="btn btn--ghost" onClick={handleLogout}>
              {"KijelentkezĂ©s"}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.layout}>
        <div className={styles.mainColumn}>
          <div className={`admin-card ${styles.weekCard}`}>
            <div className={styles.weekHeader}>
              <div>
                <p className={styles.sectionTag}>{"Heti nézet"}</p>
                <h2>{"Kiválasztott nap"}</h2>
              </div>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setSelectedDate(toDateKey(new Date()))}
              >
                {"Ma"}
              </button>
            </div>
            <div className={styles.weekRow}>
              {weekDates.map((date) => {
                const key = toDateKey(date);
                const isActive = key === selectedDate;
                const hasLog = (logsByDate.get(key) ?? []).length > 0;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`${styles.weekDay} ${isActive ? styles.weekDayActive : ""}`}
                    data-has-log={hasLog ? "true" : "false"}
                    onClick={() => setSelectedDate(key)}
                  >
                    <span>{WEEKDAYS[(date.getDay() + 6) % 7]}</span>
                    <strong>{date.getDate()}</strong>
                  </button>
                );
              })}
            </div>
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
                  <img src={tab.icon} alt="" aria-hidden="true" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={`admin-card ${styles.logCard}`}>
            <div className={styles.logHeader}>
              <div>
                <p className={styles.sectionTag}>{"Napi logok"}</p>
                <h2>{`${selectedDate}`}</h2>
              </div>
              <div className={styles.logHeaderMeta}>
                <span>{activeType.toUpperCase()}</span>
                {loading && <em>{"betöltés..."}</em>}
              </div>
            </div>

            {logsForType.length === 0 && !loading && (
              <p className={styles.emptyText}>{"Nincs log ehhez a naphoz."}</p>
            )}

            {logsForType.length > 0 && (
              <div className={styles.logList}>
                {logsForType.map((log) => (
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
                            <img src={meta.icon} alt="" aria-hidden="true" />
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

            <div className={styles.formSection}>
              <div className={styles.formHeader}>
                <h3>{editingId ? "Log szerkesztése" : "Új log"}</h3>
                {editingId && (
                  <button type="button" className="btn btn--ghost" onClick={resetDraft}>
                    {"Szerkesztés lezárása"}
                  </button>
                )}
              </div>

              {activeType === "yoga" && (
                <div className={styles.templateRow}>
                  <div className={styles.templateGroup}>
                    <p>{"Mentett sablonok"}</p>
                    <div className={styles.templateList}>
                      {templates.length === 0 && <span className={styles.templateEmpty}>{"Nincs mentett sablon."}</span>}
                      {templates.map((template, idx) => (
                        <button
                          key={`${template.label}-${idx}`}
                          type="button"
                          className={styles.templateButton}
                          onClick={() =>
                            setDraft((current) => ({
                              ...current,
                              label: template.label,
                              category: template.category,
                              durationMinutes: template.duration_minutes ? String(template.duration_minutes) : "",
                              intensity: template.intensity ? String(template.intensity) : "2",
                              link: template.link ?? "",
                            }))
                          }
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
                                <img src={meta.icon} alt="" aria-hidden="true" />
                                {meta.label}
                              </span>
                            );
                          })()}
                          <span>
                            {template.duration_minutes ? `${template.duration_minutes} perc` : "idő nélkül"} ·{" "}
                            {`intenzitás ${template.intensity ?? "-"}`}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className={styles.templateGroup}>
                    <p>{"Könyvtári flow-k"}</p>
                    <div className={styles.templateList}>
                      {YOGA_LIBRARY.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          className={styles.templateButton}
                          onClick={() =>
                            setDraft((current) => ({
                              ...current,
                              label: entry.label,
                              category: entry.category,
                              durationMinutes: String(entry.durationMinutes),
                              intensity: String(entry.intensity),
                            }))
                          }
                        >
                          <strong>{entry.label}</strong>
                          {(() => {
                            const meta = getCategoryMeta("yoga", entry.category);
                            return (
                              <span
                                className={styles.templateBadge}
                                style={{
                                  borderColor: meta.color,
                                  color: meta.color,
                                  backgroundColor: hexToRgba(meta.color, 0.12),
                                }}
                              >
                                <img src={meta.icon} alt="" aria-hidden="true" />
                                {meta.label}
                              </span>
                            );
                          })()}
                          <span>{`${entry.durationMinutes} perc · intenzitás ${entry.intensity}`}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className={styles.formGrid}>
                {activeType === "yoga" && (
                  <>
                    <label className="form-field">
                      <span className="form-field__label">{"Cím"}</span>
                      <input
                        className="input"
                        value={draft.label}
                        onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))}
                      />
                    </label>
                    <label className="form-field">
                      <span className="form-field__label">{"Kategória"}</span>
                      <select
                        className="input"
                        value={draft.category}
                        onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
                      >
                        <option value="relax">Relax</option>
                        <option value="strong">Strong</option>
                      </select>
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
                  </>
                )}

                {activeType === "strength" && (
                  <>
                    <label className="form-field">
                      <span className="form-field__label">{"Workout"}</span>
                      <select
                        className="input"
                        value={draft.exerciseId}
                        onChange={(event) => setDraft((current) => ({ ...current, exerciseId: event.target.value }))}
                      >
                        {STRENGTH_WORKOUTS.map((workout) => (
                          <option key={workout.id} value={workout.id}>
                            {workout.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {selectedWorkout && (
                      <div className={styles.formHint}>
                        <strong>{selectedWorkout.label}</strong>
                        <span>{`${selectedWorkout.rounds} · ${selectedWorkout.category}`}</span>
                      </div>
                    )}
                  </>
                )}

                {activeType === "acl" && (
                  <>
                    <label className="form-field">
                      <span className="form-field__label">{"Rutin vagy blokk"}</span>
                      <select
                        className="input"
                        value={draft.exerciseId}
                        onChange={(event) => setDraft((current) => ({ ...current, exerciseId: event.target.value }))}
                      >
                        {ACL_ROUTINES.map((routine) => (
                          <option key={routine.id} value={routine.id}>
                            {routine.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {selectedRoutine && (
                      <div className={styles.formHint}>
                        <strong>{selectedRoutine.label}</strong>
                        <span>{selectedRoutine.focus}</span>
                      </div>
                    )}
                  </>
                )}

                {activeType === "running" && (
                  <>
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
                  </>
                )}
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
          </div>
        </div>

        <div className={styles.sideColumn}>
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
                    {dayLogs.length > 0 && (
                      <div className={styles.monthIndicators}>
                        {ACTIVITY_TABS.map((tab) => {
                          const indicatorMeta = dayLogs
                            .filter((log) => log.activity_type === tab.type)
                            .map((log) => getCategoryMeta(log.activity_type, log.category));
                          if (indicatorMeta.length === 0) return null;
                          const unique = Array.from(
                            new Map(indicatorMeta.map((meta) => [`${tab.type}:${meta.label}`, meta])).values()
                          );
                          return (
                            <div key={`${key}-${tab.type}`} className={styles.monthIndicatorGroup}>
                              {unique.map((meta) => (
                                <span
                                  key={`${key}-${tab.type}-${meta.label}`}
                                  style={{ backgroundColor: meta.color }}
                                />
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={`admin-card ${styles.metaCard}`}>
            <p className={styles.sectionTag}>{"Dokumentáció"}</p>
            <h2>{"Yoga rendszer forrásai"}</h2>
            <ul className={styles.metaList}>
              <li>{"TICKETS/body/INDEX.md"}</li>
              <li>{"TICKETS/body/yoga_surface_contract.md"}</li>
              <li>{"TICKETS/body/yoga_guru.md"}</li>
              <li>{"TICKETS/body/acl_edzes_rendszer.md"}</li>
              <li>{"TICKETS/body/acl_stabilitas_erosito_program.md"}</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
