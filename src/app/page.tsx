"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import styles from "./wreath.module.css";

type RoomKey = "shiori" | "tamayura" | "yasuragi" | "ayumi" | "kaori";
type Room = {
  key: RoomKey;
  title: string;
  definition: string;
  description: string;
  href: string | null;
  angle: string;
  accessible: string;
};

// The wreath presents public rooms, not their supporting knowledge bases.
// Planned rooms show a preview until their public experiences exist.
const rooms: Room[] = [
  {
    key: "shiori",
    title: "Shiori",
    definition: "Jelentése: könyvjelző, útmutató.",
    description: "Könyvek, személyes gyűjtemények és olvasási utak.",
    href: "/library",
    angle: "288deg",
    accessible: "Shiori – könyvtár megnyitása",
  },
  {
    key: "tamayura",
    title: "Tamayura",
    definition: "たまゆら: egy röpke, megőrzött pillanat.",
    description: "Vezetett meditációk, üveggyöngyök és saját gyakorlások.",
    href: "/meditations",
    angle: "0deg",
    accessible: "Tamayura – meditációk megnyitása",
  },
  {
    key: "yasuragi",
    title: "Yasuragi",
    definition: "Jelentése: megnyugvás, belső békesség.",
    description: "Szelíden vezetett, testtudatos mozgás a mindennapok mellé.",
    href: null,
    angle: "72deg",
    accessible: "Yasuragi – készülő mindennapi jóga, bemutatás megjelenítése",
  },
  {
    key: "ayumi",
    title: "Ayumi",
    definition: "Jelentése: lépések, haladás, a megtett út.",
    description: "Mozgásnapló a gyakorlásaidhoz és a fejlődésed követéséhez.",
    href: null,
    angle: "144deg",
    accessible: "Ayumi – készülő mozgásnapló, bemutatás megjelenítése",
  },
  {
    key: "kaori",
    title: "Kaori",
    definition: "Jelentése: illat, aroma.",
    description: "Teareceptek és lépésről lépésre vezetett elkészítésük.",
    href: null,
    angle: "216deg",
    accessible: "Kaori – készülő teás modul, bemutatás megjelenítése",
  },
];

export default function LandingPage() {
  const [focus, setFocus] = useState<RoomKey | null>(null);
  const selected = rooms.find((room) => room.key === focus);

  return (
    <main className={styles.page}>
      <div className={styles.atmosphere} aria-hidden="true" />
      <h1 className={styles.visuallyHidden}>Kincstartó</h1>

      <section className={styles.mainSection} aria-label="Kincstartó főmenü">
        <div className={styles.wreath}>
          <div className={styles.orbit} aria-hidden="true" />
          <div className={styles.orbitInner} aria-hidden="true" />

          <div className={styles.center} aria-live="polite" aria-atomic="true">
            {selected ? (
              <div className={styles.preview} key={selected.key}>
                <span className={styles.previewTitle}>{selected.title}</span>
                <p className={styles.previewDefinition}>{selected.definition}</p>
                <p className={styles.previewDescription}>{selected.description}</p>
                {!selected.href && <span className={styles.previewPending}>Készülő tér</span>}
              </div>
            ) : (
              <Image
                src="/favicon.svg"
                alt=""
                width={112}
                height={112}
                className={styles.emblem}
                priority
              />
            )}
          </div>

          <nav className={styles.beads} aria-label="Személyes terek">
            {rooms.map((room) => {
              const content = (
                <>
                  <span className={styles.beadOrb} aria-hidden="true" />
                  <span className={styles.symbolPair} aria-hidden="true">
                    <span className={styles.monSymbol}>
                      <span
                        className={styles.monInk}
                        style={{
                          WebkitMaskImage: `url('/symbols/mon-${room.key}-ink.svg')`,
                          maskImage: `url('/symbols/mon-${room.key}-ink.svg')`,
                        }}
                      />
                      <Image
                        className={styles.monAccent}
                        src={`/symbols/mon-${room.key}-accent.svg`}
                        alt=""
                        width={66}
                        height={66}
                        loading="eager"
                        unoptimized
                      />
                    </span>
                    <Image
                      className={styles.hankoSymbol}
                      src={`/symbols/hanko-${room.key}.svg`}
                      alt=""
                      width={52}
                      height={52}
                      loading="eager"
                      unoptimized
                    />
                  </span>
                  <span className={styles.beadName}>{room.title}</span>
                </>
              );
              const commonProps = {
                className: `${styles.bead} ${focus === room.key ? styles.beadFocused : ""} ${!room.href ? styles.beadPending : ""}`,
                style: { ["--bead-angle" as string]: room.angle },
                onMouseEnter: () => setFocus(room.key),
                onMouseLeave: () => setFocus(null),
                onFocus: () => setFocus(room.key),
                onBlur: () => setFocus(null),
                "aria-label": room.accessible,
              };
              return room.href ? (
                <Link key={room.key} href={room.href} {...commonProps}>
                  {content}
                </Link>
              ) : (
                <button
                  key={room.key}
                  type="button"
                  {...commonProps}
                  onClick={() => setFocus(room.key)}
                >
                  {content}
                </button>
              );
            })}
          </nav>
        </div>
      </section>
    </main>
  );
}
