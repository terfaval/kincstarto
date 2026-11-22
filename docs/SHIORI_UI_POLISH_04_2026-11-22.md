# Shiori UI polish 04 — 2026-11-22

## Elkészült módosítások

1. **Asztali Shiori navigációs tábla**
   - a bal oldali táblára került egy külön **sötét fejléc**
   - a fejlécben a **Shiori** felirat és a **hanko-shiori** ikon jelenik meg
   - desktopon a felső, lebegő Shiori brand el van rejtve, így kevésbé zsúfolt a felső sáv

2. **Éjszakai tábla finomhangolása**
   - az éjszakai bal oldali tábla már nem áttetsző hangulatú
   - a fő panel **szürkített tintakék** felületet kapott
   - a fejléc ennél sötétebb, hogy elkülönüljön
   - a tabok és listaelemek színei ehhez lettek igazítva

3. **Szűrő gomb**
   - a desktop felső szűrő gomb már **ikon-only**
   - az akadálymentes `aria-label` megmaradt

4. **Nappali háttér / polc igazítás**
   - a nappali Shiori shelf háttér külön `background-position` finomhangolást kapott
   - az éjszakai háttér pozíció külön marad

5. **Kódból rajzolt pult / counter fallback**
   - a desktop stage kapott egy finom, réteges, **kódból rajzolt pult- és perem-fallbacket**
   - ez segít, ha a festett háttérpolc és az overlayelt könyvek kicsit elcsúsznak egymáshoz képest

## Érintett fájlok

- `src/components/spirit/ShioriShelf.tsx`
- `src/components/spirit/ShioriShelf.module.css`
- `src/components/spirit/SpiritLibraryApp.module.css`
- `scripts/shiori-visual-polish03.test.mjs` (a korábbi szöveges gombot ellenőrző teszt frissítése ikon-only állapotra)

## Kézi ellenőrzés

1. **Desktop / nappal / Shiori library**
   - bal oldali tábla tetején sötét Shiori fejléc
   - jobb felső szűrő gomb csak ikon
   - könyvek alatt látszik a diszkrét kódból rajzolt pult-fallback

2. **Desktop / éjszaka / Shiori library**
   - bal oldali panel tintakék-szürkés, nem áttetsző
   - fejléc sötétebb, mint maga a panel

3. **Mobile / Shiori**
   - nincs desktopos tábla-fejléc duplikáció
   - felső brand továbbra is használható

## Validáció

A négy korábbi Shiori-ellenőrző tesztfájllal futtatott célzott Node tesztek: 28/28 sikeres. Teljes Next.js buildet és böngészős vizuális tesztet ebben a környezetben nem tudtunk igazolni; a felhasználó gépén szükséges.
