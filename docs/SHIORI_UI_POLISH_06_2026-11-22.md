# Shiori UI Polish 06 — kereső- és szűrőpanel

**Cél:** a 2026-11-22-i localhost képen látható, túl általános bézs szűrőoldal finomítása a Shiori szobájának tipográfiai és anyaghasználati rendszerében.

## Változások

- Felül külön szürkés tintakék fejléc, visszafogott `Shiori · Könyvtár` jelöléssel, hangsúlyos panelcímmel és kör alakú bezáróval.
- A papírszerű panelben összefogott keresőmező; élő találatszám a tényleges `shownBooks` alapján. Nem vezetünk be új keresési/adatforrás-logikát.
- A kiválasztott szűrők megjelennek eltávolítható címkékként; ezek a **meglévő `changeFilter` függvényt** hívják, nincs párhuzamos szűrési állapot.
- A lenyíló csoportok kompakt sorok, egyértelmű nyíl ikonnal és kiválasztott elemek darabszámával. Az opciók natív jelölőnégyzetes, papírhatású szűrőpillek.
- Alsó láblécben egy fő művelet: **Könyvek megtekintése**, az aktuális találatszámmal; a szűrők törlése és az eredeti válogatáshoz visszatérés másodlagos funkció. A megtekintés a panel bezárását jelenti: a szűrők továbbra is **azonnal** hatnak.
- Mobilon a saját témák/olvasási utak választó megmarad a panelben; a helyszűke miatt tömörebb elemek és külön, görgethető szűrőlista van.
- Éjszakai nézetben a fejléc szürkés-tintakék; a panel tudatosan világosabb, olvasható papír marad.

## Nem változik

- A teljes könyvtárra kiterjedő keresés és a korábbi témához/olvasási úthoz visszatérés.
- A csoporton belüli VAGY, csoportok közötti ÉS-szűrés.
- A meglévő kategóriák, útvonalak, könyvek, kapcsolatok és rendezés.
- A desktop szoba, a festett fapult, a mobilos könyvlista és a nyitott könyvadatlap.
- Az adminimport, API, adatmodell, privát adatok és jogosultságok.

## Módosult állományok

- `src/components/spirit/ShioriShelf.tsx`
- `src/components/spirit/ShioriShelf.module.css`

Új célzott teszt: `scripts/shiori-visual-polish06.test.mjs`.

## Kézi elfogadási ellenőrzés

1. Nappali asztali nézet: a szűrőpanel legyen jól olvasható, ne fedje el a teljes szobát. A kinyitott csoportok világosan elkülönüljenek.
2. Keresés és többes szűrés: a számláló, az aktív pillék és a fő gomb száma mindig egyezzen a tényleges könyvsorral.
3. Egy aktív pille X-je csak azt az egy szűrőt távolítsa el. A „Szűrők törlése” a szűrőket törli, nem a keresett szöveget.
4. „Vissza a válogatáshoz” visszaállítja a korábban kiválasztott témát/útvonalat. A fő gomb bezárja a panelt, de megtartja a szűrőket.
5. Éjjel: a fejléc tónusa harmonizáljon a tintakék táblával; a szöveg kontrasztos legyen.
6. Mobilon 360–420 px: a panel, a kategóriák és olvasási utak és a lábléc teljesen elérhető; a mögöttes alsó könyvlista változatlan.
7. Billentyűzettel: natív checkboxok és details nyithatók; Esc bezárja a panelt és visszaadja a fókuszt.

**Korlát:** a jelen csomagon a célzott statikus ellenőrzések és szintaktikai vizsgálatok futottak. Valós mobil- és desktopböngészős vizuális QA-t, valamint teljes Next.js-buildet a felhasználó helyi környezetében kell lefuttatni.
