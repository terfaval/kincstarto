"use client";

import { useEffect, useState } from "react";

type DebugInfo = {
  error: string | null;
  userAgent: string;
  matchMediaEventSupport: string;
  hydratedAt: string;
};

type DebugRuntime = {
  bootOk: boolean;
  prebootOk: boolean;
  firstMount: string;
  viewport: string;
  blockerCount: number;
  lastTap: string;
  lastTop: string;
};

export default function DebugBanner() {
  const [enabled, setEnabled] = useState(false);
  const [info, setInfo] = useState<DebugInfo | null>(null);
  const [runtime, setRuntime] = useState<DebugRuntime | null>(null);

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
    setRuntime(getRuntimeInfo());

    window.addEventListener("error", errorHandler);
    window.addEventListener("unhandledrejection", rejectionHandler);
    const interval = window.setInterval(() => {
      setRuntime(getRuntimeInfo());
    }, 500);
    return () => {
      window.removeEventListener("error", errorHandler);
      window.removeEventListener("unhandledrejection", rejectionHandler);
      window.clearInterval(interval);
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
      <div>{runtime?.bootOk ? "boot: ok" : "boot: missing"}</div>
      <div>{runtime?.prebootOk ? "preboot: ok" : "preboot: missing"}</div>
      <div>{runtime ? `first mount: ${runtime.firstMount}` : "first mount: none"}</div>
      <div>{runtime ? `viewport: ${runtime.viewport}` : "viewport: unknown"}</div>
      <div>{runtime ? `blockers: ${runtime.blockerCount}` : "blockers: unknown"}</div>
      <div>{runtime ? `tap: ${runtime.lastTap}` : "tap: none"}</div>
      <div>{runtime ? `top: ${runtime.lastTop}` : "top: none"}</div>
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

function getRuntimeInfo(): DebugRuntime {
  if (typeof window === "undefined") {
    return {
      bootOk: false,
      prebootOk: false,
      firstMount: "none",
      viewport: "unknown",
      blockerCount: 0,
      lastTap: "none",
      lastTop: "none",
    };
  }
  const bootOk =
    (typeof document !== "undefined" && document.documentElement?.dataset?.clientBoot === "ok") ||
    Boolean(window.__clientBoot);
  const viewport = `${window.innerWidth}x${window.innerHeight}`;
  const blockerCount = Array.isArray(window.__blockerCandidates) ? window.__blockerCandidates.length : 0;
  const last = Array.isArray(window.__tapProbe) ? window.__tapProbe[window.__tapProbe.length - 1] : null;
  const prebootOk =
    Boolean(window.__prebootOk) ||
    (typeof document !== "undefined" && document.documentElement?.dataset?.preboot === "ok");
  const firstMount =
    (window.__firstClientMount && window.__firstClientMount.app) ||
    (window.__bootDiag && window.__bootDiag.firstMount) ||
    "none";
  return {
    bootOk,
    prebootOk,
    firstMount,
    viewport,
    blockerCount,
    lastTap: last ? `${last.type} ${last.target}` : "none",
    lastTop: last ? last.top : "none",
  };
}
