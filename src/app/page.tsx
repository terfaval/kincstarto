"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import styles from "./wreath.module.css";

type RoomKey = "shiori" | "tamayura" | "yasuragi" | "kagami" | "kaori";
type Room = {
  key: RoomKey;
  title: string;
  kanji: string;
  tagline: string;
  description: string;
  href: string | null;
  angle: string;
  accessible: string;
};

// Approved HOME-01 copy. Keep public rooms separate from admin knowledge bases.
// Kagami, Kaori and Yasuragi do not open a route before their public modules exist.
const rooms: Room[] = [
  {
    key: "shiori",
    title: "Shiori",
    kanji: "栞",
    tagline: "Amihez időről időre visszatérek.",
    description: "A számomra fontos könyvek személyes gyűjteménye. Könyvadatlapokkal, tematikus kapcsolatokkal és olvasási utakkal, amelyek segítenek eligazodni közöttük.",
    href: "/library",
    angle: "288deg",
    accessible: "Shiori – könyvtár megnyitása",
  },
  {
    key: "tamayura",
    title: "Tamayura",
    kanji: "玉響",
    tagline: "Egy röpke, megőrzött pillanat.",
    description: "Az üveggyöngyök mindegyike egy finoman vezetett, olvasva követhető meditációt rejt. Emellett saját, időzített meditációs gyakorlatot is összeállíthatsz.",
    href: "/meditations",
    angle: "0deg",
    accessible: "Tamayura – meditációk megnyitása",
  },
  {
    key: "yasuragi",
    title: "Yasuragi",
    kanji: "安らぎ",
    tagline: "Mozgás, amit nem kell erőltetni.",
    description: "Jóga és testtudatosság a hétköznapi tevékenységeid közben. Szelíden vezetett mozdulatok, amelyek a munkához, a sétához vagy az otthoni teendőkhöz igazodnak.",
    href: null,
    angle: "72deg",
    accessible: "Yasuragi – készülő mindennapi jóga, bemutatás megjelenítése",
  },
  {
    key: "kagami",
    title: "Kagami",
    kanji: "鏡",
    tagline: "Egy másik nézőpont arra, ami foglalkoztat.",
    description: "Tarotkártyákra épülő önreflexiós gyakorlatok. Válassz egy vetést, húzz lapokat, és írd le, milyen gondolatokat indítanak el benned. Reflektív kérdések segítenek a folytatásban, a korábbi vetéseidet pedig visszanézheted.",
    href: null,
    angle: "144deg",
    accessible: "Kagami – készülő önreflexiós tér, bemutatás megjelenítése",
  },
  {
    key: "kaori",
    title: "Kaori",
    kanji: "香り",
    tagline: "A tea már az illatával elkezdődik.",
    description: "Teák elkészítése lépésről lépésre, pontos mennyiségekkel, vízhőmérséklettel és áztatási idővel. Egy helyen minden, ami egy jó csésze tea elkészítéséhez kell.",
    href: null,
    angle: "216deg",
    accessible: "Kaori – készülő teás tér, bemutatás megjelenítése",
  },
];

function isMobileWreath() {
  return window.matchMedia("(max-width: 600px)").matches;
}

function RoomPreview({ room }: { room: Room }) {
  return (
    <div className={styles.preview}>
      <span className={styles.previewTitle}>{room.title}</span>
      <p className={styles.previewJapanese}>
        <span className={styles.previewKanji} lang="ja">{room.kanji}</span>
      </p>
      <p className={styles.previewTagline}>{room.tagline}</p>
      <p className={styles.previewDescription}>{room.description}</p>
      {!room.href && <span className={styles.previewPending}>Készülő tér</span>}
    </div>
  );
}

export default function LandingPage() {
  const [focus, setFocus] = useState<RoomKey | null>(null);
  const selected = rooms.find((room) => room.key === focus);

  const clearDesktopFocus = () => {
    if (!isMobileWreath()) setFocus(null);
  };

  return (
    <main className={styles.page}>
      <div className={styles.atmosphere} aria-hidden="true" />
      <h1 className={styles.visuallyHidden}>Kincstartó</h1>

      <section className={styles.mainSection} aria-label="Kincstartó főmenü">
        <div className={styles.wreath}>
          <div className={styles.enso} aria-hidden="true" />
          <div className={styles.orbit} aria-hidden="true" />
          <div className={styles.orbitInner} aria-hidden="true" />

          <div className={styles.center}>
            <Image
              src="/logo.svg"
              alt=""
              width={112}
              height={112}
              className={`${styles.emblem} ${selected ? styles.emblemInactive : ""}`}
              priority
            />
            {selected && (
              <div className={styles.desktopPreview} key={selected.key}>
                <RoomPreview room={selected} />
              </div>
            )}
          </div>

          <nav
            className={styles.beads}
            aria-label="Személyes terek"
            onClick={(event) => {
              // On mobile, a tap on empty space restores the Kincstartó logo.
              if (isMobileWreath() && event.target === event.currentTarget) setFocus(null);
            }}
          >
            {rooms.map((room) => {
              const content = (
                <>
                  <span className={styles.symbolPair} aria-hidden="true">
                    <Image
                      className={styles.hankoSymbol}
                      src={`/symbols/hanko-${room.key}.svg`}
                      alt=""
                      width={52}
                      height={52}
                      loading="eager"
                      unoptimized
                    />
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
                  </span>
                  <span className={styles.beadName}>{room.title}</span>
                </>
              );
              const commonProps = {
                className: `${styles.bead} ${focus === room.key ? styles.beadFocused : ""} ${!room.href ? styles.beadPending : ""}`,
                style: { ["--bead-angle" as string]: room.angle },
                onMouseEnter: () => {
                  if (!isMobileWreath()) setFocus(room.key);
                },
                onMouseLeave: clearDesktopFocus,
                onFocus: () => {
                  if (!isMobileWreath()) setFocus(room.key);
                },
                onBlur: clearDesktopFocus,
                "aria-label": `${room.accessible}. ${room.tagline}`,
              };
              return room.href ? (
                <Link
                  key={room.key}
                  href={room.href}
                  {...commonProps}
                  onClick={(event) => {
                    // First mobile tap previews; second tap opens the linked room.
                    if (isMobileWreath() && focus !== room.key) {
                      event.preventDefault();
                      setFocus(room.key);
                    }
                  }}
                >
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

      <section className={styles.mobileLower} aria-label="Kincstartó bemutatkozás" aria-live="polite">
        {selected ? (
          <RoomPreview room={selected} />
        ) : (
          <Image
            src="/logo.svg"
            alt="Kincstartó"
            width={112}
            height={112}
            className={styles.mobileEmblem}
            priority
          />
        )}
      </section>
    </main>
  );
}
