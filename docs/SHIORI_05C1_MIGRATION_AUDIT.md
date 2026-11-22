# SHIORI-05C/1 — 94 könyves migrációs adatkapu (csak olvasás)

## Miért külön kör?

A 2026-11-21-i 05B/2 admin-válasz 94 könyvet / 8 utat, nyilvános személyes mezőket
és üres privát tárolót igazolt. A korábbi 86 könyves korlát nem garantálja a
későbbi adatváltozások sértetlenségét. Az aktuális SHA256:
`18ee5992ed904606c203afad635ea13f5967476a932be98aec1f85fe799911e3`.

Az új teljes fejlesztői handoff különválasztja a **szerkesztői notes**-t és a
**privát olvasói jegyzetet**, és kimondja, hogy régi státuszok/progressziók
nem rendelhetők automatikusan felhasználóhoz. A 05A architektúra egyadminos,
privát `notes` feltételezését a 05C/2 előtt ellenőrizni kell.

## Csomag és biztonsági korlátok

- `src/lib/shioriMigrationAudit.ts` — tiszta adatintegritás-vizsgálat, nem ír.
- `src/app/api/admin/spirit/private-migration-audit/route.ts` — kizárólag
  GET, `requireAdmin()`, `no-store`; a 05B tárolópreflight és a 94-es SHA egyeztetése.
- `scripts/qa/shiori-migration-audit-core.mjs` — független, tesztelhető ellenőrző mag.
- `scripts/qa/shiori-private-migration-audit.test.mjs` — veszteség, duplikált
  komment, számlálók, adminvédelem és írásmentesség tesztje.
- `scripts/qa/shiori-private-state-migrate.mjs` — a régi `--apply` mód
  **explicit letiltva**, amíg tulajdonosi és jegyzet-besorolási döntés nincs.
- `docs/SHIORI_05_PRIVATE_BLOB_SPLIT.md` — az eredeti architektúra és a
  05C-vel változó gate naplózása.

A válasz nem tartalmaz könyvcímet, azonosítót, jegyzetértéket, Blob-URL-t vagy tokent.
A szerver `SHA256`-ot, darabszámokat, logikai integritásjelzőket ad vissza.
`reviewRequired=true`, `ownershipReviewRequired=true`,
`eligibleForAutomaticMigration=false` minden 05C/1 eredményben várható.
Ez **nem** a teszt sikertelensége, hanem az adatbiztonsági kapu.

## Ellenőrzés és teszt

1. Másold be a hét érintett fájlt a repository azonos útvonalaira.
2. Helyi Node tesztek, majd `npx tsc --noEmit` és `npm run build`.
3. Csak utána, külön jóváhagyott új **Preview** deploy (`vercel deploy`,
   nem `--prod`). A preview a jelenlegi publikus katalógust csak olvassa.
4. A Preview saját Kincstartó-adminbejelentkezése után:
   `/api/admin/spirit/private-migration-audit`.
5. Ellenőrizd a visszakapott 94/8-as darabszámokat, az SHA-t, a
   `editorialProjectionLossless`, `privateRoundtripLossless`, és a
   `booksWithNotes` értékeket. A teljes JSON-válasz megosztható,
   amennyiben valóban csak a dokumentált számlálókat/jelzőket tartalmazza.

## Várt döntési kapuk a 05C/2 előtt

- Eltérés az utolsó SHA-tól: új katalógusreview, nincs automatikus írás.
- `editorialProjectionLossless=false`: a séma ismeretlen mezőket dobna el;
  előbb sémafrissítés.
- `privateRoundtripLossless=false`: a privát állapot nem állítható vissza;
  előbb modelljavítás.
- `booksWithNotes > 0`: a korábbi `notes` értékek jelentése/tulajdona
  tisztázandó, különben nem biztonságos a szétválasztás.
- `ownershipReviewRequired=true`: a történeti státusz/progress attribúciójához
  szükséges explicit tulajdonosi döntés.
- `privateObjectExists=true`: a meglévő állapottal külön egyeztetés kell.
- A privát tárolóban még nem létező objektum miatt a tényleges privát adatolvasás
  csak egy későbbi hitelesített és ellenőrzött írás után bizonyítható.

**Ne futtasd a régi `--apply` parancsot, ne állítsd be
`SHIORI_PRIVATE_STATE_READY=1`-et, ne használj public/privát tokeneket
felcserélve, ne léptesd élesbe a 05C/1 Previewt.** Git commit/push nincs.
