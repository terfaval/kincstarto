# SHIORI-05 – személyes olvasási állapot leválasztása (előkészített, kétlépcsős migráció)

## Termékdöntés és hatókör

- A publikus könyvtárban és a publikus Vercel Blob-állományban **nem lehet személyes olvasási státusz, saját könyvjegyzet, útvonal-előrehaladás vagy útvonal-megjegyzés**.
- Adminhitelesítés mellett ezek az adatok megmaradnak, az admin JSON-export ismét tartalmazza őket.
- A meglévő JSON import csak szerkesztői könyvmezőket módosít, és ETag-feltételesen írja a publikus katalógust.
- A régi, nem verzióvédett egész-könyvtár mentés le van tiltva (`410`). Az új privát státusz/útvonal-adat mentések a privát Blob ETag-jével történnek.
- A helyi 59 könyves tartalék nem lesz aktív a **migráció aktiválása után**, és ez a kör nem hoz létre kötelező helyi mentést.
- A 86 könyves éles katalógushoz **ez a patch önmagában nem nyúl**. Minden éles írás külön, interaktív jóváhagyású CLI-művelet.

## Miért kell külön privát Blob store?

A jelenlegi `spirit/library.json` egy publikus Vercel Blob store-ban van. A UI-ban történő elrejtés önmagában nem véd: a nyers URL bárki számára letölthető, ha ismeri. Egy **másik, access=private** Blob store-ban a `spirit/reading-state.json` csak hitelesített szerveroldali olvasásra elérhető. Ehhez külön titkos token és admin ellenőrzés kell.

A publikus JSON-ból kizárandó mezők: `books[].status`, `books[].notes`, `paths[].progress`, `paths[].items[].comment`.

A `notes` itt személyes olvasói jegyzet. A későbbi, mindenki számára megjelenő kiadási/fordítási megjegyzésnek külön szerkesztői mezőt kell kialakítani, nem a `notes`-t újra felhasználni.

> **05B kiegészítés:** A külön privát store előellenőrzése a `docs/SHIORI_05B_PRIVATE_STORE_PREFLIGHT.md` szerint történik. A jelenleg zárolt Blob SDK 2.3.1 csak explicit statikus privát tokennel használható ebben a körben; OIDC támogatása külön frissítés. A 05B nem végzi el a 05A migrációját.

## Két tároló – hozzáférés

| Tároló | Hozzáférés | Objektum | Tartalom |
|---|---|---|---|
| Meglévő Vercel Blob | `public` | `spirit/library.json` | Könyvek, utak, témák, címkék – **privát mezők nélkül** |
| Új Vercel Blob | `private` | `spirit/reading-state.json` | Csak olvasási státuszok, jegyzetek, útvonal-előrehaladás, személyes úthoz fűzött kommentek |

Külön Vercel Blob store-t hozz létre a Vercel Storage UI-jában. **Ne** módosítsd vagy cseréld le a jelenlegi publikus tároló `BLOB_READ_WRITE_TOKEN` változóját. Az új privát store tokenjét **külön** `SHIORI_PRIVATE_BLOB_TOKEN` néven kell elérhetővé tenni a szerveroldali production környezetben és a migrációt futtató CLI környezetében. A tokeneknek eltérőknek kell lenniük. Ne írd őket a Gitbe vagy a beszélgetésbe.

A `SHIORI_PRIVATE_STATE_READY=1` kapcsolót **ne állítsd be** a migráció sikeres `--postcheck` eredményéig. Ha aktív, az admin JSON-export kizárólag a privát tárolóból állíthatja vissza a személyes mezőket, a publikus oldalon pedig szigorúan ellenőrizzük, hogy a nyers public JSON nem tartalmaz ilyen mezőt. Hiányzó/corrupt privát állapot esetén az admin megáll: nincs csendes adatvesztés.

## Kötelező sorrend (ne cseréld fel!)

1. A patch bemásolása után lokális tesztek, TypeScript és Next.js build. **Semmilyen Blob-írás ne legyen.**
2. Új **private** Blob store előkészítése, külön tokennév. Ezt követően deploy-olni kell az új, hiányzó `status` mezőt elfogadó alkalmazáskódot, **még `SHIORI_PRIVATE_STATE_READY` nélkül**. A migráció előtti JSON-import és státuszmentés ekkor átmenetileg le van tiltva: rövid, tudatos karbantartási ablak szükséges. Semmiképpen ne legyen közben másik adminmódosítás.
3. `node --experimental-strip-types --env-file=<temporary-production-env> scripts/qa/shiori-private-state-migrate.mjs --check`: csak olvas; ellenőrzi a publikus 86+ könyvet / 8+ utat, a privát store-t és a jelenlegi állományt.
4. A `--check` áttekintése után **külön jóváhagyással** `--apply`: először egy private `put` (vagy a már írt pontos egyezésének ellenőrzése), utána csak változatlan publikus ETag esetén egyetlen feltételes public `put`. **Nem atomi** a két tároló között; hiba esetén nincs automatikus retry vagy rollback. Nem ír helyi mentést.
5. `--postcheck` külön: privát fájl elérhető és valid, publikus fájlban nincs egyik privát mező sem. Publikus CDN-caching miatt előbb lehet `STOP`; ilyenkor csak a `--postcheck` ismételhető, az `--apply` nem.
6. `SHIORI_PRIVATE_STATE_READY=1` hozzáadása a production környezethez, majd a szükséges redeploy. Ezután a publikus és admin oldal, admin JSON export, import és személyes mentések funkcionális ellenőrzése. A publikus nyers Blob URL-t is vizsgáld privát ablakból, hogy ne legyen benne személyes mező.

**Adatvédelmi korlát:** a már korábban közzétett nyers JSON korábbi másolatait és külső cache-eit nem lehet a migrációval visszamenőleg törölni. A Vercel CDN egy ideig a régi változatot is kiszolgálhatja. A migráció befejezéséig a jelenlegi nyilvános fájl továbbra sem tekinthető védettnek.

## Fontos kódhatárok

- `src/lib/shioriPrivateState.ts`: tiszta szétválasztás/összefűzés, séma- és adatintegritás-ellenőrzés.
- `src/lib/shioriPrivateBlob.ts`: szerveroldali privát `get`, `head`, `ifMatch`-es `put` (külön token).
- `src/lib/spiritLibrary.ts`: aktiválás után szigorú publikus forrás, elavult lokális fallback nélkül; nincs feltétel nélküli mentés.
- `src/lib/spiritJsonBlob.ts`: csak privát állapot megléte után írhat; minden nyilvános fájlból kiszűri a személyes mezőket.
- `src/app/api/admin/spirit/json/route.ts`: admin export egyesítve, import kizárólag szerkesztői mezőkre.
- `src/app/api/admin/spirit/status/route.ts`: admin státusz/jegyzet csak private store-ba.
- `src/app/api/admin/spirit/path/route.ts`: privát haladás/komment private store-ba; szerkesztői cím/leírás ETag-es public write, út törlés a további adatbiztonsági körig tiltva.
- `src/app/api/admin/spirit/save/route.ts`: régi, feltétel nélkül mentő végpont kivezetve (`410`).

## Elfogadás

- 86 (vagy időközben igazoltan több) könyv, legalább 8 olvasási út; az eredeti könyv- és kapcsolatazonosítók változatlanok.
- Az admin privát JSON-exportban az eredeti nem alapértelmezett státuszok és jegyzetek megmaradnak.
- A publikus Blob JSON-ban és a publikus oldal klienskódjában nem jelenik meg valódi privát olvasási állapot.
- Az admin státusz és jegyzet mentés után visszaolvasható, de a nyilvános JSON nem változik tőle.
- Nem hitelesített `GET /api/admin/spirit/json` továbbra is 401; nincs token a HTML/JSON-válaszban.
- Rossz ETag, eltérő token, ismeretlen mező vagy hiányzó privát állomány: leállás írás nélkül.

Megjegyzés: amíg nincs külön private store és sikeres migráció, ez **előkészített architektúra**, nem lezárt éles adatvédelmi megoldás. Git commit/push/deploy csak külön felhasználói jóváhagyással.

## SHIORI-05C/1 kiegészítés (94 könyv, read-only audit)

A 05B/2 aktuális szerveres állapota **94 könyv, 8 út**, nyers publikus SHA-256:
`18ee5992ed904606c203afad635ea13f5967476a932be98aec1f85fe799911e3`.
Ez egy megfigyelt pillanatkép, nem írásra szóló jóváhagyás.

**Fontos:** a 05C/1 alkalmazáskódja zárolja a régi `shiori-private-state-migrate.mjs --apply`
ághoz tartozó minden írást. Az eredeti 86-os minimumellenőrzés önmagában nem elégséges
a 94-es állapot védelmére. A Vercel Secret miatt a régi CLI-s lokális migráció sem alkalmas
megbízható éles írásra.

A 05C/1 új, adminvédett `GET /api/admin/spirit/private-migration-audit` végpontja
kizárólag olvas: 05B tárolóellenőrzés, SHA-256 egyezés, a nyers és validált szerkesztői
mezők veszteségmentes összevetése, a privát állapot roundtrip-integritása,
valamint személyes mezők **darabszáma** (nem az értékek).

Az új, teljesebb Shiori handoff `04_DATA_MODEL/03_PRIVATE_USER_STATE.md` szerint a történeti
`status`, `progress` nem rendelhető automatikusan egy `userId`-hez, és a `notes` mező
kiadási/szerkesztői megjegyzésként is értelmezhető. Az 05A kód ezzel szemben minden
`notes`-t privát jegyzetként kezel. **A 05C/2 tényleges migráció előtt explicit
besorolási és tulajdonosi döntés kell**, különben személyes adatvesztés vagy szerkesztői
adat átsorolás következhet be.

A 05C/1 nem változtat a publikus vagy privát Blobon, nem hoz létre backupot,
nem kapcsolja át a `SHIORI_PRIVATE_STATE_READY` változót, és nem készít deployt.
A korábbi dokumentumban szereplő `--apply` lépést **ne futtasd**;
a 05C/2 új, auditált tranzakciós tervéig érvénytelennek kell tekinteni.
