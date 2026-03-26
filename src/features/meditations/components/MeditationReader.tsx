"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import type {
  Meditation,
  MeditationEndBehavior,
  ReaderBlock,
  ReaderTextBlock,
  ReaderTone,
} from "../lib/meditation-types";
import { useReaderEngine } from "../hooks/useReaderEngine";
import { useAudioEngine } from "@/features/audio/hooks/useAudioEngine";
import type { MeditationAudioConfig } from "@/features/audio/lib/audio-types";
import ReaderStage from "./ReaderStage";
import styles from "../styles/meditations.module.css";

type Props = {
  meditation: Meditation;
  audioConfig: MeditationAudioConfig | null;
  onExit: () => void;
  onComplete: (behavior: MeditationEndBehavior) => void;
  isAdmin?: boolean;
};

const TONE_OPTIONS: ReaderTone[] = ["soft", "neutral", "deep"];

function formatDurationMs(durationMs: number) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return "0 mp";
  const seconds = durationMs / 1000;
  if (Number.isInteger(seconds)) return `${seconds} mp`;
  return `${seconds.toFixed(1)} mp`;
}

function getTextBlockIndices(blocks: ReaderBlock[]) {
  const indices: number[] = [];
  blocks.forEach((block, index) => {
    if (block.type === "text") indices.push(index);
  });
  return indices;
}

function getFollowingPauseDuration(blocks: ReaderBlock[], textIndex: number) {
  const next = blocks[textIndex + 1];
  if (next?.type === "pause" && Number.isFinite(next.duration_ms)) {
    return Math.max(0, next.duration_ms);
  }
  return 0;
}

export default function MeditationReader({
  meditation,
  audioConfig,
  onExit,
  onComplete,
  isAdmin,
}: Props) {
  const { status, currentText, currentBlockIndex, start, restart, stop } = useReaderEngine(meditation);
  const audioEngine = useAudioEngine();
  const [closing, setClosing] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [editorMode, setEditorMode] = useState(false);
  const [editorBlocks, setEditorBlocks] = useState<ReaderBlock[]>(meditation.reader.blocks);
  const [editorTextPosition, setEditorTextPosition] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const lastSavedRef = useRef<string>(JSON.stringify(meditation.reader.blocks));

  const endBehavior = useMemo(() => meditation.reader.end_behavior, [meditation.reader.end_behavior]);
  const textBlockIndices = useMemo(() => getTextBlockIndices(editorBlocks), [editorBlocks]);
  const hasTextBlocks = textBlockIndices.length > 0;
  const currentEditorTextIndex = textBlockIndices[editorTextPosition] ?? null;
  const editorCurrentBlock = useMemo(() => {
    if (currentEditorTextIndex === null) return null;
    const block = editorBlocks[currentEditorTextIndex];
    return block?.type === "text" ? block : null;
  }, [currentEditorTextIndex, editorBlocks]);
  const editorDurationMs = useMemo(() => {
    if (currentEditorTextIndex === null) return 0;
    return getFollowingPauseDuration(editorBlocks, currentEditorTextIndex);
  }, [currentEditorTextIndex, editorBlocks]);

  useEffect(() => {
    setEditorBlocks(meditation.reader.blocks);
    setEditorTextPosition(0);
    lastSavedRef.current = JSON.stringify(meditation.reader.blocks);
    setSaveState("idle");
  }, [meditation.id, meditation.reader.blocks]);

  useEffect(() => {
    if (editorMode) return;
    start();
  }, [editorMode, start, meditation.id]);

  useEffect(() => {
    if (!editorMode) return;
    audioEngine.stop();
    stop();
  }, [audioEngine, editorMode, stop]);

  useEffect(() => {
    if (editorTextPosition < textBlockIndices.length) return;
    setEditorTextPosition(Math.max(0, textBlockIndices.length - 1));
  }, [editorTextPosition, textBlockIndices.length]);

  useEffect(() => {
    if (!editorMode || !isAdmin) return;
    const current = JSON.stringify(editorBlocks);
    if (current === lastSavedRef.current) return;
    setSaveState("saving");
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/admin/meditations/reader-save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: meditation.id, blocks: editorBlocks }),
        });
        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          throw new Error(`Save failed (${response.status}): ${detail}`);
        }
        lastSavedRef.current = current;
        setSaveState("saved");
        window.setTimeout(() => setSaveState("idle"), 1500);
      } catch (error) {
        console.error("[meditations] Auto-save failed", error);
        setSaveState("error");
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [editorBlocks, editorMode, isAdmin, meditation.id]);

  useEffect(() => {
    if (editorMode) return;
    if (status !== "running") return;
    audioEngine.start(audioConfig);
  }, [audioConfig, audioEngine, editorMode, status]);

  useEffect(() => {
    if (editorMode) return;
    if (status !== "running" || currentBlockIndex === null) return;
    audioEngine.updateBlockIndex(currentBlockIndex);
  }, [audioEngine, currentBlockIndex, editorMode, status]);

  useEffect(() => {
    if (editorMode) return;
    if (status !== "ended" || completed) return;
    if (endBehavior === "soft_end") {
      audioEngine.fadeOut(5);
    }
    if (endBehavior === "fade_out") {
      audioEngine.fadeOut(10);
    }
    if (endBehavior === "complete") {
      audioEngine.stop();
    }
    setCompleted(true);
    onComplete(endBehavior);

    if (endBehavior === "fade_out") {
      setClosing(true);
      const timer = window.setTimeout(() => {
        onExit();
      }, 2000);
      return () => window.clearTimeout(timer);
    }
  }, [completed, editorMode, endBehavior, onComplete, onExit, status]);

  const handleExit = useCallback(() => {
    audioEngine.stop();
    stop();
    onExit();
  }, [audioEngine, onExit, stop]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleExit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleExit]);

  const showEndPanel = !editorMode && status === "ended" && endBehavior !== "fade_out";
  const endCopy = endBehavior === "complete" ? "Meditacio befejezve." : "Lassan terj vissza.";
  const displayBlock = editorMode ? editorCurrentBlock : currentText;
  const durationInputValue = editorDurationMs > 0 ? Number((editorDurationMs / 1000).toFixed(1)) : 0;
  const displayPosition = hasTextBlocks ? editorTextPosition + 1 : 0;

  const updateEditorBlock = useCallback(
    (updater: (block: ReaderTextBlock) => ReaderTextBlock) => {
      if (currentEditorTextIndex === null) return;
      setEditorBlocks((prev) => {
        const next = [...prev];
        const block = next[currentEditorTextIndex];
        if (!block || block.type !== "text") return prev;
        next[currentEditorTextIndex] = updater(block);
        return next;
      });
    },
    [currentEditorTextIndex]
  );

  const updateEditorDuration = useCallback(
    (durationSeconds: number) => {
      if (currentEditorTextIndex === null) return;
      const durationMs = Math.max(0, Math.round(durationSeconds * 1000));
      setEditorBlocks((prev) => {
        const next = [...prev];
        const pauseIndex = currentEditorTextIndex + 1;
        const existing = next[pauseIndex];
        if (durationMs === 0) {
          if (existing?.type === "pause") {
            next.splice(pauseIndex, 1);
          }
          return next;
        }
        if (existing?.type === "pause") {
          next[pauseIndex] = { ...existing, duration_ms: durationMs };
          return next;
        }
        next.splice(pauseIndex, 0, { type: "pause", duration_ms: durationMs });
        return next;
      });
    },
    [currentEditorTextIndex]
  );

  return (
    <div
      className={`${styles.readerOverlay} ${closing ? styles.readerOverlayClosing : ""}`}
      role="dialog"
      aria-modal="true"
      onClick={handleExit}
    >
      <div
        className={`${styles.readerPanel} ${editorMode ? styles.readerPanelEditor : ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className={styles.readerExit} onClick={handleExit}>
          Kilepes
        </button>
        {isAdmin && (
          <button
            type="button"
            className={styles.readerAdminToggle}
            onClick={() => setEditorMode((mode) => !mode)}
          >
            {editorMode ? "Olvaso mod" : "Szerkeszto mod"}
          </button>
        )}
        <ReaderStage block={displayBlock} isClosing={closing && !editorMode} />
        {editorMode && (
          <div className={styles.readerEditorPanel}>
            <div className={styles.readerEditorHeader}>
              <div>
                <p className={styles.readerEditorTitle}>Szerkeszto mod</p>
                <p className={styles.readerEditorMeta}>
                  Szoveg {displayPosition} / {textBlockIndices.length}
                </p>
                <p className={styles.readerEditorSaveState}>
                  {saveState === "saving" && "Mentes..."}
                  {saveState === "saved" && "Mentve"}
                  {saveState === "error" && "Mentes hiba"}
                </p>
              </div>
              <div className={styles.readerEditorDuration}>
                Idotartam: {formatDurationMs(editorDurationMs)}
              </div>
            </div>
            <div className={styles.readerEditorControls}>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() =>
                  hasTextBlocks && setEditorTextPosition((pos) => Math.max(0, pos - 1))
                }
                disabled={!hasTextBlocks || editorTextPosition <= 0}
              >
                Elozo
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() =>
                  hasTextBlocks &&
                  setEditorTextPosition((pos) => Math.min(textBlockIndices.length - 1, pos + 1))
                }
                disabled={!hasTextBlocks || editorTextPosition >= textBlockIndices.length - 1}
              >
                Kovetkezo
              </button>
              <select
                className={styles.readerEditorSelect}
                value={editorTextPosition}
                onChange={(event) => setEditorTextPosition(Number(event.target.value))}
                disabled={!hasTextBlocks}
              >
                {textBlockIndices.map((blockIndex, listIndex) => {
                  const block = editorBlocks[blockIndex] as ReaderTextBlock;
                  const durationLabel = formatDurationMs(
                    getFollowingPauseDuration(editorBlocks, blockIndex)
                  );
                  const trimmed =
                    block.content.length > 40 ? `${block.content.slice(0, 40)}…` : block.content;
                  return (
                    <option key={`${meditation.id}-editor-${blockIndex}`} value={listIndex}>
                      {`${listIndex + 1}. ${durationLabel} - ${trimmed}`}
                    </option>
                  );
                })}
              </select>
            </div>
            <label className={styles.readerEditorLabel} htmlFor="editor-text-content">
              Szoveg
            </label>
            <textarea
              id="editor-text-content"
              className={styles.readerEditorTextarea}
              value={editorCurrentBlock?.content ?? ""}
              rows={6}
              onChange={(event) =>
                updateEditorBlock((block) => ({ ...block, content: event.target.value }))
              }
            />
            <label className={styles.readerEditorLabel} htmlFor="editor-text-tone">
              Hangulat
            </label>
            <select
              id="editor-text-tone"
              className={styles.readerEditorSelect}
              value={editorCurrentBlock?.tone ?? "soft"}
              onChange={(event) =>
                updateEditorBlock((block) => ({ ...block, tone: event.target.value as ReaderTone }))
              }
            >
              {TONE_OPTIONS.map((tone) => (
                <option key={`tone-${tone}`} value={tone}>
                  {tone}
                </option>
              ))}
            </select>
            <label className={styles.readerEditorLabel} htmlFor="editor-text-duration">
              Idotartam (mp)
            </label>
            <input
              id="editor-text-duration"
              className={styles.readerEditorInput}
              type="number"
              min={0}
              step={0.5}
              value={durationInputValue}
              onChange={(event) => updateEditorDuration(Number(event.target.value))}
            />
            <p className={styles.readerEditorNote}>Az idotartam a kovetkezo szunet hossza.</p>
          </div>
        )}
        {showEndPanel && (
          <div className={styles.readerEndPanel}>
            <p>{endCopy}</p>
            <div className={styles.readerEndActions}>
              <button type="button" className="btn btn--ghost" onClick={restart}>
                Ujrainditas
              </button>
              <button type="button" className="btn btn--primary" onClick={handleExit}>
                Vissza a terbe
              </button>
            </div>
          </div>
        )}
      </div>
      <button
        type="button"
        className={styles.readerMuteFab}
        aria-label={audioEngine.isMuted ? "Hang visszakapcsolasa" : "Hang elnemitasa"}
        onClick={(event) => {
          event.stopPropagation();
          audioEngine.setMuted(!audioEngine.isMuted);
        }}
      >
        {audioEngine.isMuted ? <VolumeX /> : <Volume2 />}
      </button>
    </div>
  );
}

