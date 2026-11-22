# Shiori UI polish 02 — célzott felületi patch

Ez a csomag a `Shiori_UI_Implementation_Patch_2026-11-21.zip`-et feltételezi. A 2026-11-21-i `kincstarto-main(8).zip` eredeti CSS-ére közvetlenül NEM alkalmazható.

Az állapotátmeneteket, TSX-et, API-t és adatmodellt nem módosítja. Csak 2 CSS-fájlt cserél, 4 új WebP textúrát, statikus tesztet és dokumentációt ad hozzá.

Telepítés ELŐTT ellenőrizni kell a 2 forrásfájl SHA-256 értékét:
- `src/components/spirit/ShioriShelf.module.css`: `a232fa35d5faa585158bf447317d104f244a8fcb318777d62167154556369f19`
- `src/components/spirit/ShioriBookDetail.module.css`: `4558790dfc6a7d3f1d1bafa13ee9d41ed5121479bd9ce5ca1704b5e8b639f973`

Ha bármelyik eltér, NE írj felül semmit: a másik fejlesztővel össze kell olvasztani.

Telepítés után:
`node --test scripts/shiori-visual-polish02.test.mjs`
`node --test scripts/shiori-visual-ui.test.mjs`
`tsc --noEmit` / `git diff --check` / localhost vizuális QA.

Részletek: `docs/SHIORI_UI_POLISH_02_2026-11-21.md`
