"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LayerEnd, LayerStart, MeditationAudioConfig } from "../lib/audio-types";
import { resolveAudioPath } from "../lib/resolve-audio-path";

type AudioLayerState = {
  audio: HTMLAudioElement;
  targetVolume: number;
  currentVolume: number;
  started: boolean;
  ended: boolean;
  start?: LayerStart;
  end?: LayerEnd;
  fadeIntervalId?: number;
};

export function useAudioEngine() {
  const layersRef = useRef<AudioLayerState[]>([]);
  const fadeIntervalsRef = useRef<number[]>([]);
  const currentBlockIndexRef = useRef(0);
  const [isMuted, setIsMutedState] = useState(false);
  const isMutedRef = useRef(false);

  const clearFadeIntervals = useCallback(() => {
    fadeIntervalsRef.current.forEach((interval) => window.clearInterval(interval));
    fadeIntervalsRef.current = [];
    layersRef.current.forEach((layer) => {
      if (layer.fadeIntervalId) {
        window.clearInterval(layer.fadeIntervalId);
        layer.fadeIntervalId = undefined;
      }
    });
  }, []);

  const applyVolume = useCallback((layer: AudioLayerState, volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume));
    layer.currentVolume = clamped;
    layer.audio.volume = isMutedRef.current ? 0 : clamped;
  }, []);

  const fadeLayerTo = useCallback(
    (layer: AudioLayerState, targetVolume: number, durationSec: number, onComplete?: () => void) => {
      if (layer.fadeIntervalId) {
        window.clearInterval(layer.fadeIntervalId);
        layer.fadeIntervalId = undefined;
      }
      const safeTarget = Math.max(0, Math.min(1, targetVolume));
      if (durationSec <= 0) {
        applyVolume(layer, safeTarget);
        onComplete?.();
        return;
      }
      const stepMs = 100;
      const totalSteps = Math.max(1, Math.floor((durationSec * 1000) / stepMs));
      const startVolume = layer.currentVolume;
      const step = (safeTarget - startVolume) / totalSteps;
      let stepIndex = 0;
      const interval = window.setInterval(() => {
        stepIndex += 1;
        applyVolume(layer, startVolume + step * stepIndex);
        if (stepIndex >= totalSteps) {
          window.clearInterval(interval);
          layer.fadeIntervalId = undefined;
          onComplete?.();
        }
      }, stepMs);
      layer.fadeIntervalId = interval;
      fadeIntervalsRef.current.push(interval);
    },
    [applyVolume]
  );

  const startLayer = useCallback(
    (layer: AudioLayerState, fadeInSec: number) => {
      if (layer.started || layer.ended) return;
      layer.started = true;
      if (fadeInSec > 0) {
        applyVolume(layer, 0);
      } else {
        applyVolume(layer, layer.targetVolume);
      }

      const playPromise = layer.audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch((error) => {
          console.warn("[audio] Playback failed:", error);
        });
      }

      if (fadeInSec > 0) {
        fadeLayerTo(layer, layer.targetVolume, fadeInSec);
      }
    },
    [applyVolume, fadeLayerTo]
  );

  const endLayer = useCallback(
    (layer: AudioLayerState, fadeOutSec: number) => {
      if (layer.ended) return;
      layer.ended = true;
      fadeLayerTo(layer, 0, fadeOutSec, () => {
        layer.audio.pause();
      });
    },
    [fadeLayerTo]
  );

  const stop = useCallback(() => {
    clearFadeIntervals();
    layersRef.current.forEach((layer) => {
      layer.audio.pause();
      layer.audio.src = "";
    });
    layersRef.current = [];
  }, [clearFadeIntervals]);

  const start = useCallback(
    (audioConfig?: MeditationAudioConfig | null) => {
      stop();
      if (!audioConfig || !Array.isArray(audioConfig.layers) || !audioConfig.layers.length) return;

      const baseGain = typeof audioConfig.mix?.base_gain === "number" ? audioConfig.mix.base_gain : 1;
      const mixFadeInSec = typeof audioConfig.mix?.fade_in_sec === "number" ? audioConfig.mix.fade_in_sec : 0;

      const layers: AudioLayerState[] = [];

      for (const layer of audioConfig.layers) {
        const path = resolveAudioPath(layer.asset_id);
        if (!path) continue;
        const audio = new Audio(path);
        audio.loop = true;

        const targetVolume = Math.max(0, Math.min(1, layer.gain * baseGain));
        const layerState: AudioLayerState = {
          audio,
          targetVolume,
          currentVolume: 0,
          started: false,
          ended: false,
          start: layer.start,
          end: layer.end,
        };

        layers.push(layerState);

        const shouldStartNow = !layer.start || currentBlockIndexRef.current >= layer.start.index;
        if (shouldStartNow) {
          const fadeInSec = layer.start?.fade_in_sec ?? (layer.start ? 0 : mixFadeInSec);
          startLayer(layerState, fadeInSec);
        }
      }

      layersRef.current = layers;
    },
    [startLayer, stop]
  );

  const fadeOut = useCallback(
    (durationSec = 5) => {
      if (!layersRef.current.length) return;
      clearFadeIntervals();
      layersRef.current.forEach((layer) => {
        const layerFade =
          layer.end?.mode === "meditation_end" && typeof layer.end.fade_out_sec === "number"
            ? layer.end.fade_out_sec
            : durationSec;
        endLayer(layer, layerFade);
      });
    },
    [clearFadeIntervals, endLayer]
  );

  const updateBlockIndex = useCallback(
    (blockIndex: number) => {
      if (!Number.isFinite(blockIndex) || blockIndex < 0) return;
      currentBlockIndexRef.current = blockIndex;
      if (!layersRef.current.length) return;

      layersRef.current.forEach((layer) => {
        if (!layer.started && !layer.ended) {
          const start = layer.start;
          if (!start || blockIndex >= start.index) {
            const fadeInSec = start?.fade_in_sec ?? 0;
            startLayer(layer, fadeInSec);
          }
        }

        if (!layer.ended && layer.end?.mode === "block_index" && blockIndex >= layer.end.index) {
          const fadeOutSec = typeof layer.end.fade_out_sec === "number" ? layer.end.fade_out_sec : 0;
          endLayer(layer, fadeOutSec);
        }
      });
    },
    [endLayer, startLayer]
  );

  const setMuted = useCallback(
    (muted: boolean) => {
      setIsMutedState(muted);
      isMutedRef.current = muted;
      layersRef.current.forEach((layer) => {
        layer.audio.volume = muted ? 0 : layer.currentVolume;
      });
    },
    [setIsMutedState]
  );

  useEffect(() => () => stop(), [stop]);

  return {
    start,
    stop,
    fadeOut,
    updateBlockIndex,
    setMuted,
    isMuted,
  };
}
