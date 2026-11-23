# KAORI-01 — első integrációs patch (2026-11-22)

**Forrás:** `kincstarto-main(20261122-172454).zip` + `mirachai(2).zip` + `Kaori_UNIFIED_Developer_Handoff_2026-11-22(1).zip`.

**Állapot: fejlesztői integrációs jelölt, NEM éles elfogadás és NEM produkciós deploy.**

## Mi került bele?

- `/kaori` külön publikus route, 3×3 desktop / 2×2 tablet / 1×2 mobil, valódi fa-rekeszes CSS doboz, teljes katalóguskeresés, ízszűrő, lapozás, üres állapot.
- Tartalmas, billentyűzettel is kezelhető modal, íz–alapanyag közös tokenek, összetevőarány, szerkesztett ízprofil és elkészítési összefoglaló.
- Négyfázisú (Választás / Előkészítés / Áztatás–elkészítés / Elkészült) flow; manuális és időzített, több egymást követő művelet, csészemennyiség-gramm skálázás; időbélyeg-alapú pause/resume/reset.
- `/admin/kaori` + API: élő Startup Kit JSON-séma, Result-feltöltés, strict előnézet, egyszeri megerősítés, validált publikálási kapu, editor fallback.
- **Dedikált privát Kaori Blob store** `kaori/catalog.v1.json`; `ifMatch`/ETag CAS, import előtti teljes privát backup, utóellenőrzés, visszaállítás előnézete és külön megerősítése. Nincs közös Shiori-pointer.
- Szigorú, külön adattípusok: ingredient, tea, method, tea×method preparation profile; 10D taste 0–3; százalékösszeg / hivatkozások / revízió / ismeretlen kulcs ellenőrzés; publikált DTO-ra külön whitelist, módosításkor a régi publikált verzió megmarad, amíg az új nem jogosult.
- Az előző Mirachai 117 teája/13 kategóriája és 1073 leírása nincs beépítve, nincs automatikus adatimport vagy demo tea. A Mirachai forrása csak termék- és algoritmusreferencia volt.
- Kezdőlapi Kaori link **nem aktiválódik ebben a patchben**, mert a release-gate még nincs igazolva. A `/kaori` route közvetlenül tesztelhető; a nyitóoldali link külön, sikeres QA utáni engedélyezés.

## Kötelező tárkonfiguráció (nem kerül a patchbe jelszó/token)

A Kincstartó meglévő `BLOB_READ_WRITE_TOKEN` és `SHIORI_PRIVATE_BLOB_READ_WRITE_TOKEN` (vagy `SHIORI_PRIVATE_BLOB_TOKEN`) mellé csatlakoztass egy **harmadik, külön privát Vercel Blob store-t**, amelynek env változója:

`KAORI_PRIVATE_BLOB_READ_WRITE_TOKEN`

A három store ID eltérő legyen. A Kaori kód *fail closed* módon visszautasítja a megosztott vagy hiányzó store-t. A Vercel `Preview`, majd külön `Production` env-ban állítsd be ugyanilyen módon, de ne használj véletlenül eltérő környezeti katalógust az ellenőrzéshez. **Nem állítjuk, hogy a Vercel store-t már létrehoztuk.**

Új, üres Kaori-katalógust csak bejelentkezett admin hozhat létre a `/admin/kaori` képernyőn explicit megerősítéssel; az init API meglévő állományt soha nem ír felül. A publikus oldal nem inicializál adatokkal GET-kérés közben.

## Adatkészítés és publikáció

1. Konfigurált, új privát store létrehozása után adminban egyszeri inicializálás.
2. `Startup Kit letöltése`, amely az **aktuális privát** katalógusból és a tényleges runtime sémából készül. A korábbi handoff `NOT_IMPORTABLE` mintáit **ne** használd importfájlként: a kanonikus schema most az élő export része.
3. Közös kidolgozás → `kaori.result.v1` fájl (minden új rekord `revision:1`; patch: `id`, `expectedRevision`, `set`, opcionálisan `clear`).
4. Feltöltés → kizárólag read-only előnézet → **egyszeri megerősítés** → CAS+backup+utóellenőrzés. A `save_draft` nem publikál, `publish_eligible` csak a Resultban megérintett, feltételeknek megfelelő rekordokat publikálhatja; a régi publikus verziók megmaradnak.
5. Az `editorialStatus=approved`, `identityVerified=true` és `sourceRefs` **nem bizonyít automatikus, külső forrás- vagy szakmai validálást**. A rendszer konzervatív kulcsszavas kockázatszűrése csak *első szűrő*, és a felhasználói megerősítés sem helyettesíti a megfelelő szaktudást. Gyanús botanikai azonosítás, egészségügyi/gyógyszerhatású állítás, allergén, veszélyes vagy atipikus eljárás **nem adható ki** külön valódi felülvizsgálat nélkül.
6. A legutóbbi és korábbi backupok a `/admin/kaori` **Verziók és visszaállítás** szekcióban választhatók ki; a restore külön preview/apply kör és új backup után történik.

## Ellenőrzés (helyi Windows, függőségek már telepítve)

`node --experimental-strip-types --test scripts/qa/kaori-guards.test.mjs` — tiszta gráf és adagolási tesztek.

`& .\node_modules\.bin\tsc.cmd --noEmit` — teljes TS.

`npm.cmd run lint` — meglévő ESLint.

`npm.cmd run build` — Next.js build.

Majd böngészőben `/admin/kaori`, `/kaori`: 320/375/390/420/768/1024/1366/1440px; day/night; 0,1,2,9,10+ tea; mobil billentyűzet, fókusz, modal Escape; timer tabváltással; adatok és auth; 99/105%-os Result elutasítás; stale baseSha; mentés/restore; Shiori/Yasuragi/Tamayura regresszió. A teszt-Result kizárólag külön, nem produkciós store-ba menjen.

## Nyitott gate-ek — ezért nem „kész production”

- Next.js build, e2e, valós mobil/screenshot és privát Blob ETag/CAS/restore **nem futott ebben a forrás-ZIP körben**: a zip tudatosan nem tartalmaz npm függőségeket és éles tokent. A TS/TSX fájlok szintaktikai ellenőrzése sikeres; a külön Node gráf/gramm tesztek zöldek.
- A kockázatszűrő csak konzervatív minimum; teljes botanikai, allergén-, forrás- és szakértői review workflow még nem készült el. **Éles, egészségügyileg érzékeny teák publikálását tiltsd addig.**
- A Mirachai 122 alapanyaga és 21 módszere **nincs** átmozgatva stagingbe vagy importálva; külön migrációs audit után csak ellenőrzött jelöltekkel folytatjuk.
- Végleges teáskert day/night desktop/mobile képi assetek hiányoznak. A CSS négy cserélhető háttérváltozót fogad; jelenleg csak CSS kert-fallback van. A végleges képi világ közös döntés marad.
- Bonyolult időzítések (több napos cold brew háttérben, lapfrissítés utáni session-helyreállítás, szokatlan feldolgozási módok) még nincsenek teljeskörűen végigtesztelve. A lapfrissítés most explicit session reset.
- Az admin fallback teljes rekord-JSON-t editál, nem mezőspecifikus szép formokat. A normál Workflow ettől függetlenül mezőszerkesztés nélkül használható.
- QA után külön jóváhagyással aktiválható a Kaori kezdőlapi link és az éles tartalom.

## Asset-cserehelyek

A `KaoriApp.module.css` `.garden` rétegénél CSS-custom-prop útvonalakon:
`--kaori-garden-day-desktop`, `--kaori-garden-night-desktop`, `--kaori-garden-day-mobile`, `--kaori-garden-night-mobile`.

Például a későbbi közösen megalkotott fájllal: `--kaori-garden-day-desktop:url('/backgrounds/kaori/garden-day-desktop.webp')`. Ezt csak akkor add meg, ha az asset ténylegesen létezik; a mostani patch nem hoz létre vagy cserél képeket.

## Regresszióhatár

A változások kizárólag új `src/features/kaori/**`, új `src/app/kaori/**`, `src/app/admin/kaori/**`, két új API, egy teszt és ez a dokumentum. Shiori, Yasuragi, Tamayura, Kagami, kezdőlap, auth és más adatrekord nincs módosítva.
