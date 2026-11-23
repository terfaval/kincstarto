"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import styles from "./wreath.module.css";

const ADMIN_HOLD_MS = 8_000;
const MOVE_TOLERANCE_PX = 14;

/** Mobile-only, undisclosed entrance to the existing (authenticated) admin login. */
export default function HiddenAdminEntry() {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const originRef = useRef({ x: 0, y: 0 });
  const [holding, setHolding] = useState(false);

  const cancelHold = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pointerIdRef.current = null;
    setHolding(false);
  }, []);

  useEffect(() => {
    const onHidden = () => {
      if (document.hidden) cancelHold();
    };
    window.addEventListener("blur", cancelHold);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      window.removeEventListener("blur", cancelHold);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [cancelHold]);

  const startHold = (event: ReactPointerEvent<HTMLButtonElement>) => {
    // No mouse shortcut: the gesture belongs to the mobile touch experience.
    if (event.pointerType !== "touch") return;
    // A second finger interrupts rather than advancing the hidden gesture.
    if (!event.isPrimary) {
      cancelHold();
      return;
    }
    if (pointerIdRef.current !== null) return;
    event.preventDefault();
    pointerIdRef.current = event.pointerId;
    originRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    setHolding(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      pointerIdRef.current = null;
      setHolding(false);
      router.push("/login");
    }, ADMIN_HOLD_MS);
  };

  const moveHold = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    const distance = Math.hypot(
      event.clientX - originRef.current.x,
      event.clientY - originRef.current.y,
    );
    if (distance > MOVE_TOLERANCE_PX) cancelHold();
  };

  const finishHold = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (pointerIdRef.current === event.pointerId) cancelHold();
  };

  return (
    <button
      type="button"
      className={`${styles.mobileLogoButton} ${holding ? styles.mobileLogoHolding : ""}`}
      aria-label="Kincstartó"
      onPointerDown={startHold}
      onPointerMove={moveHold}
      onPointerUp={finishHold}
      onPointerCancel={finishHold}
      onLostPointerCapture={finishHold}
      onContextMenu={(event) => event.preventDefault()}
    >
      <svg className={styles.mobileHoldRing} viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="55" />
      </svg>
      <Image
        src="/logo.svg"
        alt=""
        width={112}
        height={112}
        className={styles.mobileEmblem}
        priority
        draggable={false}
      />
    </button>
  );
}
