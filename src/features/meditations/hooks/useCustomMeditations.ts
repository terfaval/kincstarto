"use client";

import { useCallback, useEffect, useState } from "react";
import {
  EMPTY_CUSTOM_MEDITATIONS,
  loadCustomMeditations,
  storeCustomMeditations,
  validateCustomMeditationDraft,
} from "../lib/custom-meditation-storage";
import { MAX_PRESETS, newCustomId, type CustomMeditationCollection, type CustomMeditationDraft } from "../lib/custom-meditation-types";

export function useCustomMeditations() {
  const [collection, setCollection] = useState<CustomMeditationCollection>(EMPTY_CUSTOM_MEDITATIONS);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unsafeStorage, setUnsafeStorage] = useState(false);

  useEffect(() => {
    try {
      setCollection(loadCustomMeditations());
    } catch (cause) {
      setUnsafeStorage(true);
      setError(cause instanceof Error ? cause.message : "Nem sikerült betölteni a gyakorlásokat.");
    } finally {
      setReady(true);
    }
  }, []);

  const commit = useCallback((next: CustomMeditationCollection): boolean => {
    if (!ready || unsafeStorage) return false;
    try {
      storeCustomMeditations(next);
      setCollection(next);
      setError(null);
      return true;
    } catch {
      setError("A mentés nem sikerült. Ellenőrizd a böngésző tárhelybeállításait.");
      return false;
    }
  }, [ready, unsafeStorage]);

  const save = useCallback((draft: CustomMeditationDraft, existingId?: string): boolean => {
    const validated = validateCustomMeditationDraft(draft);
    if (!validated) {
      setError("Adj nevet a gyakorlásnak és minden szakasznak, valamint érvényes időtartamot.");
      return false;
    }
    if (!existingId && collection.presets.length >= MAX_PRESETS) {
      setError("Legfeljebb 50 saját meditáció menthető.");
      return false;
    }
    if (existingId && !collection.presets.some((preset) => preset.id === existingId)) return false;
    const id = existingId ?? newCustomId();
    const item = { id, ...validated };
    const presets = existingId
      ? collection.presets.map((preset) => preset.id === id ? item : preset)
      : [...collection.presets, item];
    const ok = commit({ version: 1, presets, defaultId: collection.defaultId ?? id });
    return ok;
  }, [collection, commit]);

  const remove = useCallback((id: string): boolean => {
    const presets = collection.presets.filter((preset) => preset.id !== id);
    if (presets.length === collection.presets.length) return false;
    const defaultId = collection.defaultId === id ? presets[0]?.id ?? null : collection.defaultId;
    const ok = commit({ version: 1, presets, defaultId });
    return ok;
  }, [collection, commit]);

  const setDefault = useCallback((id: string): boolean => {
    if (!collection.presets.some((preset) => preset.id === id)) return false;
    const ok = commit({ ...collection, defaultId: id });
    return ok;
  }, [collection, commit]);

  const defaultPreset = collection.presets.find((preset) => preset.id === collection.defaultId) ?? null;

  return { collection, defaultPreset, ready, error, save, remove, setDefault };
}
