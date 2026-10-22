"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, X } from "lucide-react";
import type { CustomMeditationPreset } from "../lib/custom-meditation-types";
import type { CustomMeditationCues } from "../lib/custom-meditation-cues";
import { crossedBoundaries, stageBoundaries } from "../lib/custom-meditation-timeline";
import styles from "../styles/custom-meditation-player.module.css";

type Props = {
  preset: CustomMeditationPreset;
  cues: CustomMeditationCues;
  openingError?: boolean;
  onExit: () => void;
};

type PlayerPhase = "running" | "paused" | "finishing" | "paused-finishing";

export default function CustomMeditationPlayer({ preset, cues, openingError = false, onExit }: Props) {
  const boundaries = useMemo(() => stageBoundaries(preset.stages), [preset]);
  const totalMs = boundaries[boundaries.length - 1]?.elapsedMs ?? 0;
  const [phase, setPhase] = useState<PlayerPhase>("running");
  const phaseRef = useRef<PlayerPhase>("running");
  const elapsedMsRef = useRef(0);
  const startedAtRef = useRef(0);
  const runIdRef = useRef(0);
  const pendingFinishRef = useRef(false);
  const mountedRef = useRef(false);
  const mainButtonRef = useRef<HTMLButtonElement>(null);
  const [soundError, setSoundError] = useState(false);
  const [wakeLockUnavailable, setWakeLockUnavailable] = useState(false);
  const exitRef = useRef(onExit);
  useEffect(() => { exitRef.current = onExit; }, [onExit]);

  const changePhase = useCallback((value: PlayerPhase) => {
    phaseRef.current = value;
    setPhase(value);
  }, []);

  const tick = useCallback(() => {
    if (phaseRef.current !== "running") return;
    const now = performance.now();
    const current = Math.min(totalMs, elapsedMsRef.current + (now - startedAtRef.current));
    // A long jump should not generate a cascade of obsolete gong sounds.
    const crossed = crossedBoundaries(boundaries, elapsedMsRef.current, current);
    elapsedMsRef.current = current;
    startedAtRef.current = now;
    if (!crossed.length) return;
    const latest = crossed[crossed.length - 1];
    const isLast = latest.stageIndex === boundaries.length - 1;
    const runId = runIdRef.current;
    if (isLast) changePhase("finishing");
    void cues.playStageCue(
      latest.cueId, latest.repeats,
      () => {
        if (!isLast || runId !== runIdRef.current) return;
        if (phaseRef.current === "paused-finishing") pendingFinishRef.current = true;
        else exitRef.current();
      },
      () => setSoundError(true)
    );
  }, [boundaries, changePhase, cues, totalMs]);

  const pause = useCallback(() => {
    if (phaseRef.current === "running") {
      tick();
      if (phaseRef.current === "running") changePhase("paused");
      else if ((phaseRef.current as PlayerPhase) === "finishing") changePhase("paused-finishing");
    } else if (phaseRef.current === "finishing") changePhase("paused-finishing");
    else return;
    cues.pause();
  }, [changePhase, cues, tick]);

  const resume = useCallback(() => {
    if (phaseRef.current === "paused") {
      startedAtRef.current = performance.now();
      changePhase("running");
    } else if (phaseRef.current === "paused-finishing") changePhase("finishing");
    else return;
    cues.resume();
    if (pendingFinishRef.current) {
      pendingFinishRef.current = false;
      exitRef.current();
    }
  }, [changePhase, cues]);

  const exitMeditation = () => {
    runIdRef.current++;
    pendingFinishRef.current = false;
    cues.dispose();
    exitRef.current();
  };

  const restartMeditation = () => {
    runIdRef.current++;
    pendingFinishRef.current = false;
    cues.stopSources();
    setSoundError(false);
    // Gesture-bound opening playback; no confirmation or additional prompt.
    cues.playOpening(() => setSoundError(true));
    elapsedMsRef.current = 0;
    startedAtRef.current = performance.now();
    changePhase("running");
  };

  useEffect(() => {
    mountedRef.current = true;
    startedAtRef.current = performance.now();
    mainButtonRef.current?.focus();
    const interval = window.setInterval(tick, 125);
    const handleVisibility = () => { if (document.hidden) pause(); };
    document.addEventListener("visibilitychange", handleVisibility);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      document.body.style.overflow = overflow;
      runIdRef.current++;
      mountedRef.current = false;
      // React Strict Mode replays effect cleanup/setup in development. Keep
      // the user-gesture-unlocked AudioContext through that replay.
      queueMicrotask(() => { if (!mountedRef.current) cues.dispose(); });
    };
  }, [cues, pause, tick]);

  // Keep the screen awake only while meditation is active. Wake locks
  // are revocable by the OS, and unsupported/older Home Screen Web Apps may
  // still lock; do not claim guaranteed background execution.
  useEffect(() => {
    const active = phase === "running" || phase === "finishing";
    if (!active || document.visibilityState !== "visible") return;
    let cancelled = false;
    let lock: WakeLockSentinel | null = null;
    const acquire = async () => {
      if (!navigator.wakeLock?.request) {
        if (!cancelled) setWakeLockUnavailable(true);
        return;
      }
      try {
        const acquired = await navigator.wakeLock.request("screen");
        if (cancelled) { void acquired.release(); return; }
        lock = acquired;
        setWakeLockUnavailable(false);
      } catch {
        if (!cancelled) setWakeLockUnavailable(true);
      }
    };
    void acquire();
    return () => {
      cancelled = true;
      if (lock) void lock.release().catch(() => {});
    };
  }, [phase]);

  const isPaused = phase === "paused" || phase === "paused-finishing";
  return (
    <div className={styles.player} role="region" aria-label={`${preset.title} – saját meditáció lejátszó`}>
      <div className={styles.controls}>
        <button className={styles.smallButton} onClick={exitMeditation} type="button" aria-label="Kilépés a meditációból" title="Kilépés">
          <X size={26} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <button ref={mainButtonRef} className={styles.mainButton} onClick={isPaused ? resume : pause} type="button"
          aria-label={isPaused ? "Meditáció folytatása" : "Meditáció szüneteltetése"}
          title={isPaused ? "Folytatás" : "Szünet"}>
          {isPaused ? <Play size={32} strokeWidth={1.6} fill="currentColor" aria-hidden="true" /> : <Pause size={32} strokeWidth={1.6} aria-hidden="true" />}
        </button>
        <button className={styles.smallButton} onClick={restartMeditation} type="button" aria-label="Meditáció újrakezdése" title="Újrakezdés">
          <RotateCcw size={25} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
      <span className={styles.srOnly} role="status" aria-live="polite">
        {isPaused ? "A meditáció szünetel." : phase === "finishing" ? "A meditáció lezárása." : "A meditáció folyamatban van."}
      </span>
      {(soundError || openingError) && <p className={styles.soundError} role="alert">A hangjelzés nem indult el. Ellenőrizd a /audio/timer/ hangfájlok elérhetőségét.</p>}
      {wakeLockUnavailable && !isPaused && <p className={styles.wakeLockWarning} role="status">A kijelző ébren tartása ezen az eszközön nem garantált.</p>}
    </div>
  );
}
