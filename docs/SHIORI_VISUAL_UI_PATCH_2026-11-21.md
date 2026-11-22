# Shiori vizuális integráció — UI-only kódpatch

**Forrás:** `kincstarto-main(8).zip` (2026-11-21). A legfrissebb megkapott ZIP az irányadó. Az archívumra vonatkozó ellenőrzések **nem bizonyítják**, hogy a helyi Git-checkout időközben nem változott.

## Megvalósított

- A négy `public/shiori/backgrounds/*-master.webp` asset bekötése: desktop/mobil × nappali/éjszakai témák. Az assetfájlok **nem szerepelnek a patchben és nem módosultak**.
- A teljes szélességű, sötét és átmenetileg áttetsző Shiori-shell megszüntetése; helyi, papírszerű kontrasztot kapnak a kezelőelemek. A bal oldali világos Témák/Olvasási utak tábla megmarad.
- A festménybe már berajzolt könyvpulttal egybeillesztett gerinces elrendezés, második `shelf-wood.svg` sín nélkül. **A pult és a gerincek magasságának vizuális kalibrálása szükséges helyi böngészőben**, különböző képarányokon.
- C hibrid kategóriaszínekre épülő, stabil borító-/gerinccsaládok; a kiemelt borítón nagy, ismétlődő embléma helyett a családra jellemző organikus szerkezet és 0–2 meglévő szerkesztői címke.
- A nyitott könyvadatlapnak enyhébb hátterezés, finomabb papír- és kötéshatás; a címkepillék és olvasási tudnivalók elkülönítése; kisebb kapcsolódó miniborítók.
- Az admin JSON import/export kliensoldali felületének szétválasztása, fájlközpontú import, ellenőrzési lépések, rekord- és mezőlista, explicit mentési jóváhagyás. **Az admin API/protokoll, szerver, tartós adattárolás és jogosultságok érintetlenek.** A meglévő preview csak mezőneveket + kapcsolati előtte/utána értékeket ad, nem teljes mezőszintű értékdiffet; ezt a UI nem színleli.

## Nem érintett

- `src/app/api/**`, `src/lib/**`, `data/**`, jogosultságok, privát adatok, Vercel Blob, migráció.
- Tamayura, Yasuragi és más modulok.
- Már telepített képek és média; a patch **nem tartalmaz háttérképet**.

## Összehangolás a másik fejlesztő munkájával

- Az adat- és jogosultsági szétválasztás párhuzamosan történik. Ha közben megváltozott bármelyik célfájl, **ne alkalmazd vakon** a ZIP-et: kérj friss összeolvasztást.
- Az admin import/export mögötti szerződések változását külön integrációs teszttel kell igazolni. A patch a `kincstarto-main(8).zip` aktuális `/api/admin/spirit/json` protokolljára épít.

## Ellenőrzés helyi környezetben

1. `node --test scripts/shiori-visual-ui.test.mjs`
2. `& .\node_modules\.bin\tsc.cmd --noEmit` (ha a checkoutban telepítve van)
3. `git diff --check`
4. Browser: `/library` nappal/éjjel 1440px, 1024px, 820px; 420px és 360px mobil. Kontroll: könyvgerincek alja a **festett** fa pult síkjában, nincs lebegő duplapolc, cím/keresés/bal tábla olvasható, kivett könyv nem takarja a bonsait.
5. Funkció: teljes könyvtár kezdőállapot, gerincre egy kattintás, dupla kattintás, modal két külön scroll, kapcsolódó művek, globális keresés és visszatérés, mobil borító/lista/szűrő, nulla találat.
6. Admin `/admin`: csak tesztfájllal előnézet; export külön fülön; a mentés csak checkboxos megerősítés után aktiválódik. **Éles importot ne végezz kizárólag UI-teszt céljából.**

## Korlátok

A ZIP-ből hiányzik a `node_modules`, ezért az asszisztens itt nem végzett projekt-szintű Next.js buildet, TypeScript-szemantikai ellenőrzést vagy valós böngészős QA-t. Szintaktikai TypeScript- és PostCSS-parszolás, képasszetek ellenőrzése és a mellékelt statikus tesztek futtatása megtörtént. További vizuális finomhangolás a tényleges localhost-képernyőképek alapján történjen.
