"use client";

import { useEffect } from "react";

const DAY_START = 6;
const NIGHT_START = 18;
const MINUTE_MS = 60 * 1000;

const DAY_BACKGROUNDS = ["/backgrounds/day/day_default.png"];
const NIGHT_BACKGROUNDS = ["/backgrounds/night/night_default.png"];

const getDayOfYear = (date: Date) => {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

const getThemeFromDate = () => {
  const hours = new Date().getHours();
  return hours >= DAY_START && hours < NIGHT_START ? "day" : "night";
};

const pickDailyBackground = (theme: string, date: Date) => {
  const list = theme === "night" ? NIGHT_BACKGROUNDS : DAY_BACKGROUNDS;
  const dayIndex = getDayOfYear(date) % list.length;
  return list[dayIndex];
};

const applyTheme = (theme: string) => {
  if (typeof document === "undefined" || !document.documentElement) return;
  document.documentElement.setAttribute("data-time-theme", theme);
};

export default function TimeThemeEffect() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const safeTheme = (theme: string) => {
      try {
        applyTheme(theme);
      } catch {
        // no-op: avoid boot crash
      }
    };
    const updateTheme = () => {
      try {
        const now = new Date();
        const canMatch = typeof window.matchMedia === "function";
        const prefersDark = canMatch ? window.matchMedia("(prefers-color-scheme: dark)").matches : false;
        const theme = prefersDark ? "night" : getThemeFromDate();
        safeTheme(theme);

        if (typeof document !== "undefined" && document.documentElement) {
          const bg = pickDailyBackground(theme, now);
          document.documentElement.style.setProperty("--bg-photo", `url("${bg}")`);
        }
      } catch {
        safeTheme("day");
      }
    };

    updateTheme();

    const intervalId = window.setInterval(updateTheme, MINUTE_MS);
    const handleFocus = () => updateTheme();
    window.addEventListener("focus", handleFocus);
    const canMatch = typeof window.matchMedia === "function";
    const media = canMatch ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    const handleSchemeChange = () => updateTheme();

    if (media) {
      try {
        if (typeof media.addEventListener === "function") {
          media.addEventListener("change", handleSchemeChange);
        } else {
          media.addListener(handleSchemeChange);
        }
      } catch {
        // ignore listener failures
      }
    }

    return () => {
      try {
        window.clearInterval(intervalId);
        window.removeEventListener("focus", handleFocus);
        if (media) {
          if (typeof media.removeEventListener === "function") {
            media.removeEventListener("change", handleSchemeChange);
          } else {
            media.removeListener(handleSchemeChange);
          }
        }
      } catch {
        // no-op
      }
    };
  }, []);

  return null;
}
