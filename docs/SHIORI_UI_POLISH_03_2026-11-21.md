# Shiori - finomito UI patch 03 (2026-11-21)

## Scope

A felhasznalo 1650 x 928-as desktop localhost kepen visszajelzett, hogy a Shiori mar jol nez ki. Megmarad a festett pult, az organikus boritok, a bal oldali falitabla, az adatlap es a mobil mukodes. Negy apro UX valtozas tortenik:

1. A jobb felso ket kategoria-valto nyil eltunik (redundans a bal oldali falitablaval). A kereso melletti szurogomb "Szurok" szoveget es ertheto kontrasztot kap.
2. Desktopon az alul onmagaban allo konyvcim/szerzo vagy "N konyv" szoveg megszunik. A fejlécben megmarad az aktualis konyvhalmaz neve es a dinamikus darabszam.
3. A gerincessor a kontener tenyleges szelessegebol es a gerincek mert szelessegebol szamol. Csak teljes gerinceket renderel egy lapon; nincs felebevagott konyv. Kulon diszkret lapozo-, billentyuzet-, touch- es vizszintes trackpad-kezeles tartozik a gerincessorhoz; a falitabla tovabbra is kategoriat valt. Kepernyomeret-valtozaskor ujraszamolas tortenik.
4. Kijeloles nelkul a jobb oldali ures zonaban attetszo, konnyu konyvkontur es "Valassz egy konyvet / Kattints egy gerincre" uzenet jelenik meg. Nappali es ejszakai kontraszt kulon megoldott.

## Changed files

- `src/components/spirit/ShioriShelf.tsx`: whole-spine paged view; user controls; empty-state copy; desktop footer text removal.
- `src/components/spirit/ShioriShelf.module.css`: unobtrusive pager, contrast, placeholder, filter control.
- `scripts/shiori-visual-polish03.test.mjs`: six focused static regression checks.

## Deliberately untouched

No API, persistence, schema, migration, privacy/private-Blob, auth, admin import, content data, images, book-detail UI, or global layout files changed. The previous visual polish 01 and 02 are prerequisites. This patch is a narrow follow-up to the user's screenshots, not a full rebuild.

## Verification / acceptance

- Run `node --test scripts/shiori-visual-ui.test.mjs scripts/shiori-visual-polish02.test.mjs scripts/shiori-visual-polish03.test.mjs`.
- Run local `tsc.cmd --noEmit`, `git diff --check` and scoped `git status`.
- In desktop localhost, verify 94 current books are still dynamic (count is not hardcoded); no partial spines on first/middle/last carousel page at widths 1650, 1280 and 1024 pixels, and after browser zoom or resize.
- Verify search, category change, selection and detail opening still work. The category arrows no longer exist in the top-right header; the small chevrons near the **spines** only page books.
- Verify the empty selection message has good contrast on both day and night backgrounds, and the desktop footer no longer shows an orphan title or count.
- At 420px and 375px, verify the mobile two-zone layout, full-list scrolling and bottom search trigger are unchanged.
- Manual browser and build checks are still outstanding; static tests do not prove pixel-perfect behavior.

## Concurrent developer safety

Patch over only if the existing files have exactly the SHA256 digests printed in the installation block. If either file has moved, do not overwrite. Request a new source ZIP/merge. Do not overwrite backend or private data work.
