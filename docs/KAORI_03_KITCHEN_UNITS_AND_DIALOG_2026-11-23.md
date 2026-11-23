# KAORI-03 · Konyhai mértékek és elkészítési modal javítása

## Mi változott
- Az előkészítésben a kanálmennyiség az elsődleges, **de csak akkor, ha az adott alapanyaghoz hitelesített, csapott 5 ml-es mérő-teáskanál grammtömege tartozik**. A pontos grammérték ilyenkor kisebb betűvel továbbra is látszik.
- 1 mérő-evőkanál = 3 mérő-teáskanál (15 ml / 5 ml). Az átváltás NEM azonos azzal, hogy minden teafűnek egységes g/tk tömege lenne.
- Az átváltás maximum nyolcad tk lépésekben jelenik meg; jelentős kerekítési eltérésnél vagy hiányzó adatnál **gramm** marad.
- A modal fejléce, lépésjelzője, alsó gombsora és figyelmeztetése nem nyeli el a középső tartalmat; csak a tartalom gördül. Lépésváltáskor a görgetés az elejére áll. Az Elkészült állapotból való visszalépés már nem kér hibásan megszakítási megerősítést.

## Adatmodell és adatbiztonság
- Opcionális ingredient mező:
  `spoonMeasure: { gramsPerLevelTeaspoon: number, evidenceUrl: string }`.
- Az `evidenceUrl` szerepeljen az adott alapanyag `sourceRefs` tömbjében; egyébként a rekord nem léphet át az adatkapcsolat-ellenőrzésen.
- Régi összetevőknél az új mező hiányozhat, migráció nem kötelező. A Unified patch képes az új opcionális mezőt később felvenni vagy explicit `clear` művelettel eltávolítani.
- Az éles publikációs adatokat nem módosítja a patch. A forrásellenőrzés továbbra is szerkesztői felelősség; ne adj meg kitalált `gramsPerLevelTeaspoon` értéket.
- A QA-előnézetben A=1,2 g/tk, B=0,8 g/tk **kitalált, elkülönített mérési mintaszám** a felület teszteléséhez. Nem fizikai ajánlás, nem kerül a Blob tárolóba.

## Ellenőrzés
1. `node --experimental-strip-types --test scripts/qa/kaori-guards.test.mjs scripts/qa/kaori-preview.test.mjs scripts/qa/kaori-spoon-measure.test.mjs`
2. `npx eslint src/features/kaori src/app/kaori src/app/admin/kaori src/app/api/kaori src/app/api/admin/kaori`
3. `npx tsc --noEmit` és `npm run build`
4. `/admin/kaori/preview?count=11` → Teszttea 05 → Előkészítés: **2 tk (2,4 g)** és **2 tk (1,6 g)**.
5. Teszttea 02 → 25h timer: indítás, szünet, görgetés. Alul minden gomb legyen elérhető asztali és mobil képernyőn.
6. Valódi összetevőnél `spoonMeasure` nélkül változatlanul gramm jelenjen meg.

Nincs deploy, automatikus import, Blob-módosítás vagy publikálás.
