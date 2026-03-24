"use client";

import { useMemo } from "react";
import type { Meditation } from "../lib/meditation-types";

export function useMeditations(initial: Meditation[]) {
  return useMemo(() => {
    const list = Array.isArray(initial) ? initial : [];
    return list
      .filter((meditation) => meditation.is_published)
      .slice()
      .sort((a, b) => {
        if (a.category === b.category) {
          return a.order_in_category - b.order_in_category;
        }
        return a.category.localeCompare(b.category);
      });
  }, [initial]);
}

