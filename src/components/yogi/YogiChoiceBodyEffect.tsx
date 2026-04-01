"use client";

import { useEffect } from "react";

export default function YogiChoiceBodyEffect() {
  useEffect(() => {
    const body = document.body;
    body.classList.add("yoga-bg");
    body.classList.add("yogi-palette");
    return () => {
      body.classList.remove("yoga-bg");
      body.classList.remove("yogi-palette");
    };
  }, []);

  return null;
}
