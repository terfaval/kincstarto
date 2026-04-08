"use client";

import { useEffect, useMemo, useState } from "react";

function hasDebugFlag() {
  if (typeof window === "undefined") return false;
  try {
    return window.location.search.includes("debug=1");
  } catch {
    return false;
  }
}

export default function ClientBootMarker() {
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [bootText, setBootText] = useState("boot");
  const startedAt = useMemo(() => new Date().toISOString(), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDebugEnabled(hasDebugFlag());
    try {
      window.__clientBoot = true;
      window.__firstClientMount = { app: startedAt };
      setBootText("boot ok");
    } catch {
      setBootText("boot error");
    }
  }, [startedAt]);

  if (!debugEnabled) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "40px",
        left: "8px",
        padding: "6px 8px",
        background: "rgba(30, 90, 160, 0.92)",
        color: "#fff",
        fontSize: "12px",
        borderRadius: "6px",
        zIndex: 10000,
        pointerEvents: "none",
      }}
    >
      {bootText}
    </div>
  );
}
