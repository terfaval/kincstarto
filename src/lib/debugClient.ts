"use client";

type TapProbeEntry = {
  ts: string;
  type: string;
  target: string;
  top: string;
  x: number | null;
  y: number | null;
};

type BlockerCandidate = {
  selector: string;
  position: string;
  zIndex: number;
  pointerEvents: string;
  opacity: number;
  backgroundAlpha: number;
  rect: { x: number; y: number; width: number; height: number };
};

declare global {
  interface Window {
    __clientBoot?: boolean;
    __tapProbe?: TapProbeEntry[];
    __tapProbeInit?: boolean;
    __blockerCandidates?: BlockerCandidate[];
    __blockerScanPath?: string;
  }
}

export function markClientBoot(appName: string) {
  if (typeof window === "undefined") return;
  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.dataset.clientBoot = "ok";
  }
  window.__clientBoot = true;
  console.log(`[boot-ok] ${appName}`);
}

export function isDebugEnabled() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("debug") === "1";
}

export function initInteractionProbe() {
  if (!isDebugEnabled()) return;
  if (typeof document === "undefined") return;
  if (window.__tapProbeInit) return;
  window.__tapProbeInit = true;

  const handler = (event: Event) => {
    const target = event.target instanceof Element ? event.target : null;
    const { x, y } = getEventPoint(event);
    const top = x !== null && y !== null ? document.elementFromPoint(x, y) : null;
    const entry: TapProbeEntry = {
      ts: new Date().toISOString(),
      type: event.type,
      target: target ? describeElement(target) : "(none)",
      top: top ? describeElement(top) : "(none)",
      x,
      y,
    };

    const list = Array.isArray(window.__tapProbe) ? window.__tapProbe : [];
    list.push(entry);
    window.__tapProbe = list.slice(-5);

    const coords = x !== null && y !== null ? ` @${x},${y}` : "";
    console.log(`[tap-probe] ${entry.type} target=${entry.target} top=${entry.top}${coords}`);
  };

  const options = { capture: true, passive: true } as const;
  document.addEventListener("pointerdown", handler, options);
  document.addEventListener("click", handler, options);
  document.addEventListener("touchstart", handler, options);
}

export function scanForFullScreenBlockers() {
  if (!isDebugEnabled()) return;
  if (typeof document === "undefined" || typeof window === "undefined") return;

  const path = window.location.pathname + window.location.search;
  if (window.__blockerScanPath === path && Array.isArray(window.__blockerCandidates)) return;
  window.__blockerScanPath = path;

  window.setTimeout(() => {
    const candidates: BlockerCandidate[] = [];
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    if (!viewportWidth || !viewportHeight) return;

    const nodes = document.body ? Array.from(document.body.getElementsByTagName("*")) : [];
    nodes.forEach((node) => {
      const style = window.getComputedStyle(node);
      if (!style) return;
      const position = style.position;
      if (position !== "fixed" && position !== "absolute") return;
      if (style.pointerEvents === "none") return;
      if (style.display === "none" || style.visibility === "hidden") return;

      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const coversWidth = rect.width >= viewportWidth * 0.85;
      const coversHeight = rect.height >= viewportHeight * 0.85;
      if (!coversWidth || !coversHeight) return;

      const zIndex = parseInt(style.zIndex, 10);
      const numericZ = Number.isFinite(zIndex) ? zIndex : 0;
      if (numericZ < 100) return;

      const opacity = parseFloat(style.opacity);
      const backgroundAlpha = parseBackgroundAlpha(style.backgroundColor);
      const effectiveOpacity = Number.isFinite(opacity) ? opacity : 1;
      const isTransparent = effectiveOpacity <= 0.1 || backgroundAlpha <= 0.1;
      if (!isTransparent) return;

      candidates.push({
        selector: describeElement(node),
        position,
        zIndex: numericZ,
        pointerEvents: style.pointerEvents,
        opacity: effectiveOpacity,
        backgroundAlpha,
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
      });
    });

    window.__blockerCandidates = candidates;

    if (candidates.length === 0) {
      console.log("[blocker-scan] no candidates");
      return;
    }

    console.log(`[blocker-scan] candidates=${candidates.length}`);
    candidates.forEach((candidate) => {
      console.log(
        `[blocker] ${candidate.selector} pos=${candidate.position} z=${candidate.zIndex} rect=${candidate.rect.width}x${candidate.rect.height}+${candidate.rect.x},${candidate.rect.y} opacity=${candidate.opacity} bgAlpha=${candidate.backgroundAlpha} pointerEvents=${candidate.pointerEvents}`
      );
    });
  }, 120);
}

function getEventPoint(event: Event) {
  const anyEvent = event as any;
  if (anyEvent.touches && anyEvent.touches[0]) {
    return { x: Math.round(anyEvent.touches[0].clientX), y: Math.round(anyEvent.touches[0].clientY) };
  }
  if (typeof anyEvent.clientX === "number" && typeof anyEvent.clientY === "number") {
    return { x: Math.round(anyEvent.clientX), y: Math.round(anyEvent.clientY) };
  }
  return { x: null, y: null };
}

function describeElement(element: Element) {
  const tag = element.tagName.toLowerCase();
  if (element.id) return `${tag}#${element.id}`;
  const classList = Array.from(element.classList).filter(Boolean).slice(0, 3);
  if (classList.length) return `${tag}.${classList.join(".")}`;
  return tag;
}

function parseBackgroundAlpha(color: string) {
  if (!color || color === "transparent") return 0;
  const rgba = color.match(/rgba?\(([^)]+)\)/i);
  if (!rgba) return 1;
  const parts = rgba[1].split(",").map((part) => part.trim());
  if (parts.length < 4) return 1;
  const alpha = parseFloat(parts[3]);
  return Number.isFinite(alpha) ? alpha : 1;
}
