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
  document.documentElement.setAttribute("data-time-theme", theme);
};

export default function TimeThemeEffect() {
  useEffect(() => {
    const updateTheme = () => {
      const now = new Date();
      const theme = getThemeFromDate();
      applyTheme(theme);

      const bg = pickDailyBackground(theme, now);
      document.documentElement.style.setProperty("--bg-photo", `url("${bg}")`);
    };

    updateTheme();

    const intervalId = window.setInterval(updateTheme, MINUTE_MS);
    const handleFocus = () => updateTheme();

    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  return null;
}
