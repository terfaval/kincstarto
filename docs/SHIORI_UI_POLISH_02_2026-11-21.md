# Shiori — második célzott vizuális finomítás (UI-only)

**Forrás / előfeltétel:** a 2026-11-21-i `Shiori_UI_Implementation_Patch_2026-11-21.zip` már telepítve van. Az itt mellékelt két CSS-fájl pontosan ennek változatlan példányából indul ki, kizárólag a végére fűzött szabályokkal. A kiindulási `kincstarto-main(8).zip` **önmagában nem elég**, a korábbi UI-patch is kell.

## Cél és változások

1. **Könyvláb a festett pulton:** a gerincek és a kiemelt borító egységesen lejjebb kerülnek. A kulcsparaméter a `.desktopStage`-ben `--painted-counter-clearance: clamp(105px,25dvh,265px)`. A korábbi képernyőképen kb. 40–50 px rés volt az objektumok és a festett pult között; az új beállítás ehhez igazított **kiinduló kalibráció**, nem bizonyított pixelpontos illesztés. Keskeny és alacsony desktop képernyőre külön értékek vannak. **Éles helyi képarányon végső ellenőrzés szükséges.**
2. **Kötések és borítók anyaghatása:** négy kis méretű, átlátszó, statikus WebP textúra (washi papírrost, száraz ecsethúzás, nyitott ecsetkör, három ecsetvonás). A négy már meglévő borítócsalád és a négy gerinccsalád megmarad, de a korábbi szabályos ovális és digitális fényhatás helyett organikus tus-/papírjelleg dominál. A könyv színe és családválasztása adatvezérelt, nem random újrarenderelésenként.
3. **Nyugodtabb fejléc:** a desktopos Shiori-cím a lampiontól jobbra, a könyvfelület fölé kerül; a kereső és a léptetőgombok világos, a falitáblával harmonizáló anyaghatást kapnak. Mobilon megmarad a kompakt fejléc.
4. **Nyitott könyv:** a desktopos teljes szélességű `KÖNYVADATLAP` modalsáv vizuálisan eltűnik, a hozzáférhető bezárás és az esetleges előző könyv gomb a lap jobb felső sarkánál marad. Tisztábban látható papírszélek, visszafogottabb háttérhomály, organikus kapcsolódó miniborító-motívumok. **Két külön desktop scroll és egy mobil scroll változatlanul megmarad.**

## Kifejezetten nem módosult

- TSX, React állapotlogika, keresés, `author_sort_key`, adatmodell, API, jogosultság, privát adatok, Vercel Blob, adminimport-protokoll.
- Négy jóváhagyott nappali/éjszakai, desktop/mobil `*-master.webp` háttérfájl.
- Más modulok működése. A képen látható `Belső állapot` hivatkozás nem ennek a patchnek a része; a másik fejlesztő munkájával nem kívánunk ütközni.

## Bevezetés és óvatosság

- **A telepítés előtt mindkét érintett CSS jelenlegi SHA-256 hashét ellenőrizni kell.** A korábbi patch szerinti eredeti hashértékek:
  - `src/components/spirit/ShioriShelf.module.css`: `a232fa35d5faa585158bf447317d104f244a8fcb318777d62167154556369f19`
  - `src/components/spirit/ShioriBookDetail.module.css`: `4558790dfc6a7d3f1d1bafa13ee9d41ed5121479bd9ce5ca1704b5e8b639f973`
- Eltérés esetén **ne írj felül semmit**. Kérj friss összeolvasztást az aktuális repó alapján.
- A négy új textúra a `public/shiori/textures/` alá kerül; a fejlesztői ZIP ezeket tartalmazza.
- Teszt: `node --test scripts/shiori-visual-polish02.test.mjs`; `node --test scripts/shiori-visual-ui.test.mjs`; `tsc --noEmit`; `git diff --check`; localhost vizuális ellenőrzés.
- A `--painted-counter-clearance` módosítható CSS-érték, **nem a könyvek transzformációja**; mindkét könyvtípusra együtt hat.

## Vizuális QA és elfogadási feltételek

1. Desktop éjjel és nappal 1650×816, 1440×900, 1024×768 és keskeny/730px magas ablakban: a gerincek és a kivett borító **ugyanazon a festett fapult-síkon állnak**, nincs látható lebegés vagy második polcsín. Ha a háttér `cover` cropja miatt még eltérés marad, a CSS-ben közös kalibrációt finomítani kell.
2. A kivett könyv nem fedi el használhatatlanul a jobb oldali szobadíszeket; szükség esetén a fedett területet a **meglévő** stage oszloparányain belül kell módosítani.
3. Mind a négy borítócsalád megkülönböztethető: pigment, színmező, tuskör, ecsetritmus; a gerincek is eltérő kötésjelleget hordoznak, de a szerző és cím olvasható marad.
4. Fejléc nem takarja a lampiont; a keresés és a bal falitábla stabil. Mobilon nem jelenik meg desktopos fejléc-eltolás.
5. Kétoldalas adatlapnál a bal és jobb oldal külön görgethető; a bezárás gombja látható és fókuszálható; kapcsolódó mű és visszalépés működik.
6. Mobilon borító, egylapos adatlap, alsó könyvlista és keresőpanel működése változatlan, kis magasságban sem tűnik el az alsó lista.
7. `prefers-reduced-motion` esetén nincs felesleges animáció.

## Tesztkörnyezet-korlát

A fájlok CSS-parszolása és az új statikus teszt elvégezhető. A repóhoz nem tartozik telepített `node_modules`, ezért **teljes Next.js build és az éles localhostos vizuális teszt itt nem igazolt**. Böngészős képernyőkép szükséges a végleges pultkalibrációhoz.
