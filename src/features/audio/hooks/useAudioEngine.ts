"use client";

import { useCallback, useEffect, useRef } from "react";
import type { MeditationAudioConfig } from "../lib/audio-types";
import { resolveAudioPath } from "../lib/resolve-audio-path";

type AudioLayerState = {
  audio: HTMLAudioElement;
  targetVolume: number;
};

export function useAudioEngine() {
  const layersRef = useRef<AudioLayerState[]>([]);
  const fadeIntervalsRef = useRef<number[]>([]);

  const clearFadeIntervals = useCallback(() => {
    fadeIntervalsRef.current.forEach((interval) => window.clearInterval(interval));
    fadeIntervalsRef.current = [];
  }, []);

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
      const fadeInSec = typeof audioConfig.mix?.fade_in_sec === "number" ? audioConfig.mix.fade_in_sec : 0;

      const layers: AudioLayerState[] = [];

      for (const layer of audioConfig.layers) {
        const path = resolveAudioPath(layer.asset_id);
        if (!path) continue;
        const audio = new Audio(path);
        audio.loop = true;

        const targetVolume = Math.max(0, Math.min(1, (layer.gain ?? 0.2) * baseGain));
        if (fadeInSec > 0) {
          audio.volume = 0;
        } else {
          audio.volume = targetVolume;
        }

        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch((error) => {
            console.warn("[audio] Playback failed:", error);
          });
        }

        layers.push({ audio, targetVolume });

        if (fadeInSec > 0) {
          const stepMs = 100;
          const totalSteps = Math.max(1, Math.floor((fadeInSec * 1000) / stepMs));
          const step = targetVolume / totalSteps;
          const interval = window.setInterval(() => {
            audio.volume = Math.min(targetVolume, audio.volume + step);
            if (audio.volume >= targetVolume) {
              window.clearInterval(interval);
            }
          }, stepMs);
          fadeIntervalsRef.current.push(interval);
        }
      }

      layersRef.current = layers;
    },
    [stop]
  );

  const fadeOut = useCallback(
    (durationSec = 5) => {
      if (!layersRef.current.length) return;
      clearFadeIntervals();
      const stepMs = 100;
      const totalSteps = Math.max(1, Math.floor((durationSec * 1000) / stepMs));

      layersRef.current.forEach((layer) => {
        const step = layer.audio.volume / totalSteps;
        const interval = window.setInterval(() => {
          layer.audio.volume = Math.max(0, layer.audio.volume - step);
          if (layer.audio.volume <= 0) {
            layer.audio.pause();
            window.clearInterval(interval);
          }
        }, stepMs);
        fadeIntervalsRef.current.push(interval);
      });
    },
    [clearFadeIntervals]
  );

  useEffect(() => () => stop(), [stop]);

  return {
    start,
    stop,
    fadeOut,
  };
}
