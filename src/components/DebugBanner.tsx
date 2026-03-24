"use client";

import { useEffect, useState } from "react";

type DebugInfo = {
  error: string | null;
  userAgent: string;
  matchMediaEventSupport: string;
  hydratedAt: string;
};

export default function DebugBanner() {
  const [enabled, setEnabled] = useState(false);
  const [info, setInfo] = useState<DebugInfo | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setEnabled(params.get("debug") === "1");
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const errorHandler = (event: ErrorEvent) => {
      setInfo((current) => ({
        ...(current ?? getBaseInfo()),
        error: event.message || "Unknown error",
      }));
    };
    const rejectionHandler = (event: PromiseRejectionEvent) => {
      const message =
        event.reason instanceof Error
          ? event.reason.message
          : typeof event.reason === "string"
            ? event.reason
            : "Unhandled rejection";
      setInfo((current) => ({
        ...(current ?? getBaseInfo()),
        error: message,
      }));
    };

    const base = getBaseInfo();
    setInfo(base);

    window.addEventListener("error", errorHandler);
    window.addEventListener("unhandledrejection", rejectionHandler);
    return () => {
      window.removeEventListener("error", errorHandler);
      window.removeEventListener("unhandledrejection", rejectionHandler);
    };
  }, [enabled]);

  if (!enabled || !info) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: "auto 10px 10px 10px",
        padding: "8px 10px",
        background: "rgba(20, 24, 32, 0.85)",
        color: "#fff",
        fontSize: "12px",
        borderRadius: "8px",
        zIndex: 9999,
        pointerEvents: "none",
        lineHeight: 1.4,
      }}
    >
      <div>debug=1</div>
      <div>{info.hydratedAt}</div>
      <div>{info.matchMediaEventSupport}</div>
      <div>{info.error ? `error: ${info.error}` : "error: none"}</div>
      <div style={{ opacity: 0.75 }}>{info.userAgent}</div>
    </div>
  );
}

function getBaseInfo(): DebugInfo {
  let media: MediaQueryList | null = null;
  try {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      media = window.matchMedia("(prefers-color-scheme: dark)");
    }
  } catch {
    media = null;
  }
  const hasAddEventListener = Boolean(media && typeof media.addEventListener === "function");
  return {
    error: null,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
    matchMediaEventSupport: `matchMedia.addEventListener: ${hasAddEventListener ? "yes" : "no"}`,
    hydratedAt: `hydrated: ${new Date().toISOString()}`,
  };
}
