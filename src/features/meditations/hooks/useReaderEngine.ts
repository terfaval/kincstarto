"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Meditation, ReaderTextBlock } from "../lib/meditation-types";

export type ReaderStatus = "idle" | "running" | "ended";

export function useReaderEngine(meditation: Meditation | null) {
  const [status, setStatus] = useState<ReaderStatus>("idle");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentText, setCurrentText] = useState<ReaderTextBlock | null>(null);
  const [currentBlockIndex, setCurrentBlockIndex] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    setCurrentIndex(0);
    setCurrentText(null);
    setCurrentBlockIndex(null);
    setStatus("idle");
  }, [clearTimer]);

  const start = useCallback(() => {
    if (!meditation) return;
    clearTimer();
    setCurrentIndex(0);
    setCurrentText(null);
    setStatus("running");
  }, [clearTimer, meditation]);

  const stop = useCallback(() => {
    clearTimer();
    setStatus("idle");
  }, [clearTimer]);

  const restart = useCallback(() => {
    reset();
    if (meditation) {
      setStatus("running");
    }
  }, [meditation, reset]);

  useEffect(() => {
    if (!meditation) {
      reset();
    }
  }, [meditation, reset]);

  useEffect(() => {
    if (!meditation || status !== "running") return;

    const blocks = meditation.reader.blocks;
    if (currentIndex >= blocks.length) {
      setStatus("ended");
      return;
    }

    const block = blocks[currentIndex];
    setCurrentBlockIndex(currentIndex);
    if (block.type === "text") {
      setCurrentText(block);
      setCurrentIndex((index) => index + 1);
      return;
    }

    timerRef.current = window.setTimeout(() => {
      setCurrentIndex((index) => index + 1);
    }, Math.max(0, block.duration_ms));

    return () => {
      clearTimer();
    };
  }, [clearTimer, currentIndex, meditation, status]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return {
    status,
    currentText,
    currentBlockIndex,
    start,
    stop,
    restart,
  };
}

