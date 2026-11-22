# Shiori — Polish 05: falitábla-emelés és fapulttest

**Forrás:** a `Shiori_UI_Polish_04_2026-11-22_PATCH.zip` által átadott aktuális Shiori CSS, illetve a felhasználó 2026-11-22-i nappali localhostos képernyőképe.

## Mi változott?

1. A bal oldali táblát **nagyjából egy fejlécnyi magassággal feljebb** emeljük (reszponzív, 48–72 px), miközben az alja a korábbi pozíciójában marad. Így a sötét „Könyvtár / Shiori” fejléce a keresősávhoz kerül közelebb, és a kategóriasorok nem veszítik el az elérhető magasságot.
2. A korábbi nagy, áttetsző barna overlayt **két fizikai hatású részből álló fapult** váltja: 18 px vastag felső falap és 58 px magas függőleges, faerezetes előlap. Ez nem puszta árnyék vagy átlátszó téglalap.
3. A pult **a bal oldali tábla jobb széle körül kezdődik, és végigfut a jobb oldali területig**. Nem rajzolunk második, lebegő polcot a könyvek fölé. A könyvgerincek és a kiemelt borító előrébb kerülnek a rétegzésben, a pult mögöttük marad.
4. Az éjszakai pult külön sötétebb famintázatot kap. A tintakék falitábla, a Shiori-hanko, a csak ikonos szűrő, a mobilos működés, a könyvlogika és a privát adatok nem változnak.

## Érintett fájl

- `src/components/spirit/ShioriShelf.module.css`

Plusz ellenőrző teszt, dokumentáció és biztonságos PowerShell-telepítő.

## Helyi vizuális ellenőrzés

- **Nappal, desktop (pl. 1920×1080):** a tábla teteje nagyjából a jobb felső keresővel legyen egy vonalban; az utolsó kategória is elérhető legyen; a gerincek és a kiemelt borító egy végigfutó barna **fa felső lapon** álljanak, alatta látható fa **előlappal**.
- **Éjjel, desktop:** ugyanez a geometria, sötétebb famintázattal; a tintakék táblának megmarad a kontrasztja.
- **Kisebb asztali méretek:** a pult nem takarhatja el a könyvgerincek címét, a könyvek kiválasztása és a lapozás működjön.
- **Mobil (<= 420 px):** az új asztali tábla és pult nem jelenhet meg; a felső borító és az alsó lista megmarad.

## Korlátok

A megoldás kizárólag CSS. A festett nappali és éjszakai háttérképek **még nem lettek újragenerálva vagy egymáshoz igazítva**. A pult végső pixelpozícióját helyi böngészőben kell ellenőrizni, különösen `background-size: cover` mellett. A forrás ZIP nem tartalmaz telepített `node_modules`-t, így teljes Next.js-buildet itt nem lehet hitelesen igazolni.
