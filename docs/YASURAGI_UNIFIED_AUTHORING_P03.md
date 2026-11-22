# Yasuragi P03 — egységes projektmunkafolyamat (draft póz + kép + könyvtári státusz)

**Forrás:** 2026-11-22-én kapott `kincstarto-main.zip`. A P02 és P01 működésére épülő, csak admin által elérhető fejlesztés. A valódi buildet és böngészős műveleteket a helyi Kincstartó checkoutban kell ellenőrizni.

## Mit ad hozzá?

A `/admin/yasuragi/practices` mentett authoring projektje egy közös munkafolyamatot mutat:

1. **Függőséglista:** a hivatkozott pózok és az esetleg nem hivatkozott pózjavaslatok egy összevont listában; hivatkozásszám, jelenlegi könyvtári státusz, illusztrációs slot, tartalmi és jóga-szakmai jóváhagyás.
2. **Új draft póz felvétele:** a mentett, integritásellenőrzött authoring projekt egyik `poseProposals` rekordját csak akkor lehet hozzáadni az aktív könyvtár tárolójához, ha sem az ID, sem a normalizált slug nem létezik. A rekord `draft` / `content_status: draft` / `validated: false` / kép nélkül kerül be. A meglévő rekordok felülírását ez az új API nem engedi; a teljes szakmai ellenőrzés továbbra is az ászanatárban zajlik.
3. **Kép hozzárendelése:** az új, kép nélküli draft rekordhoz a projektkártyában PNG/WebP fájl választható (max. 4 MB). Explicit ellenőrző jelölőnégyzet után a meglévő `/api/admin/yogi-knowledge/illustration` végpont végzi a feltöltést, a pillanatnyi üres `expected_asset_ref` ellenőrzésével. Az endpoint a képslotot `verified`-re állítja: ez **nem** bizonyítja a tartalom szakmai jóváhagyását, és nem aktiválja automatikusan a pózt. Meglévő képet ezen a P03-felületen nem lehet cserélni.
4. **Friss állapot és próba:** minden könyvtári művelet után a mentett projektet újra beolvassuk. A külön `previewReady` P02-szabály továbbra is a tényleges lejátszási feltétel, nem a pózjavaslat megléte.

## Új API

- `POST /api/admin/yasuragi/practices/pose`:
  - admin-authentikáció, same-origin ellenőrzés, 4 KB kéréskorlát;
  - body: `{ "draftId": "...json", "expectedSha256": "64 hex", "poseId": "pose_...", "confirm": true }`;
  - a szerver újraolvassa az immutable tervezetet és a jelenlegi pózlistát, validálja a PoseSchema-t, majd meghívja a meglévő szerkesztői minőségellenőrzést;
  - `201`: új draft; `409`: azonosító-/slugütközés vagy nem egyező projektverzió; hibás/szakmailag problémás adat nem kerül be.
  - Írási kimenetel bizonytalansága esetén **először ellenőrizni kell a könyvtárat, nem szabad automatikusan újraküldeni**.
- `GET /api/admin/yasuragi/practices?draft=<id>`: a P02-es `{ draft, report }` mellé az aktuális `review` összefoglalót adja vissza.

## Továbbra is érvényes határok

- **Nincs gyakorlás-, póz- vagy képpublikálás** a P03 projektfelületéről; nincs automatikus `active` vagy `validated=true` státusz, nincs törlés és nincs meglévő póz felülírása.
- A régi P01 lejátszó és az immutable P02 gyakorlástervezetek változatlanok.
- A P03 új pózfelvételi végpontja a meglévő lista-mentési API-n keresztül dolgozik. Ez az adattár **nem biztosít atomi több-adminos összehasonlítás-és-csere (CAS) tranzakciót**; ezért egyidejű független könyvtárszerkesztés nem tekinthető teljesen versenyhelyzet-mentesnek. Éles, többadminos folyamat előtt külön tárolási zár/CAS-revízió szükséges.
- A képfeltöltő a felhasználó vizuális ellenőrzésének megerősítésével működik; a karakterhűség és az anatómia független ellenőrzése továbbra is külön szerkesztői feladat.
- `review.libraryReady` csak munkafolyamat-jelzés, nem publikálási engedély. A gyakorláspublikálási gate nincs implementálva.

## Ellenőrzés

Offline lefutott: P01 10/10, P02 6/6, P03 tiszta állapot-/ütközésellenőrzési tesztek 3/3; a friss JSON-minta három pózjavaslatának meglévő szerkesztői quality checkje nem jelzett hard error-t; az új TS/TSX-fájlok szintaktikai transzpilációja sikeres.

Helyi, függőségekkel rendelkező repóban szükséges:

```powershell
node --experimental-strip-types --test scripts/test-yasuragi-player.mjs
node scripts/test-yasuragi-p02.mjs
node --experimental-strip-types --test scripts/test-yasuragi-p03.mjs
npx.cmd tsc --noEmit
npm.cmd run build
```

Böngészőben: `/admin/yasuragi/practices` alatt (1) minta import és P02 mentés; (2) mentett projekt megnyitása; (3) új `pose_supported_side_sit` vagy más javasolt hiányzó póz hozzáadása; (4) második felvételi kísérlet ütközést kapjon, ne írjon felül; (5) opcionális PNG/WebP feltöltés és státuszfrissítés; (6) szakmai ellenőrzési mezők ne változzanak automatikusan, a gyakorlás ne publikálódjon; (7) 420 px-nél keskenyebb nézet. Soha ne használj automatikus próbafeltöltést éles könyvtáron.

## Következő mérföldkő

Jóváhagyási és publikálási állapotgép a gyakorlásokhoz, szerkesztői ellenőrzőnapló, az egyes könyvtári állapotok adminból vezérelt biztonságos lezárása. Ezután a tényleges `Yasuragi Authoring Kit` és a közös alkotói skill. Az illusztrációk előállítását továbbra is a külön vizuális eszköz végzi, a projekt a briefet és függőséget követi.
