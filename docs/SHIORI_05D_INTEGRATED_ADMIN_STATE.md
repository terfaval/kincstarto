# SHIORI-05D — Belső adatok a közös olvasófelületen

Forrás: 2026-11-22, a felhasználó által feltöltött friss `kincstarto-main.zip` (az új Shiori szoba, könyvadatlap, mobilnézet, szűrőpanel és éjjeli stílus megőrzésével).

## Termékdöntés

Nem külön állapotoldal a fő felület: az admin `/admin` a **pontosan ugyanolyan** Shiori szobát használja, mint a publikus `/library`, de a hitelesített adminnak a könyvadatlapon látható a belső olvasottsági státusz és a szerkesztői jegyzet; az útvonal kiválasztásakor a belső haladás (és ahol vannak `items`, a hozzájuk tartozó belső megjegyzések). A publikus oldalon ezeknek nincs UI-eleme. Az adatok fizikailag a külön privát Vercel Blobban maradnak.

## Adat- és biztonsági határ

- `/library/page.tsx`: változatlan `publicShioriCatalog(await loadSpiritLibrary())` és `admin={false}`. Se privát beolvasás, se admin panel; a publikus `spirit/library.json` már ellenőrzötten nem tartalmaz privát mezőket.
- `/admin/page.tsx`: közvetlen `isAdminRequest()` ellenőrzés a layout-ellenőrzés mellett; csak hitelesített admin és `SHIORI_PRIVATE_STATE_READY=1` esetén `loadSpiritLibrary({ includePrivate: true })`. Ha a privát kapcsoló nincs bekapcsolva, csak a publikus vetületet adja át és nincs privát editor.
- A nyitott könyvadatlapon a státusz és a `notes` csak akkor renderelődik, ha az admin szerver átadta a privát megjelenítési engedélyt. Nincs rejtett, csak CSS-sel elfedett személyes blokk a nyilvános felületen.
- Az útvonalhaladás és megjegyzések ugyanígy csak adminnál, a kiválasztott útvonal nézetében láthatók.
- A mentés külön `/api/admin/spirit/status` és `/api/admin/spirit/path` POST, amelyek `requireAdmin(request)` és same-origin vizsgálatot végeznek, majd **csak a privát** Blobba írnak ETag-feltétellel. Ezek nem írják vissza a privát adatokat a publikus katalógusba.
- A módosítás csak explicit Mentésre történik, nem gépelés közben. Sikertelen vagy nem igazolható írás esetén az űrlap zárolva marad, amíg az admin frissítéssel ellenőrzi az élő állapotot; automatikus ismétlés nincs.
- A régi `/admin/shiori-state` read-only diagnosztikus oldal továbbra is elérhető, de a fő Shiori UI már nem navigál oda.

## Mi NEM változik

- A 94 könyv, 8 út, azok kapcsolatai, címei és a szerkesztői mezők; nincsen adatmigráció, Blob-átírás vagy újabb production-aktiváció e patch telepítésekor.
- A legfrissebb Shiori UI szoba, borítók, gerincek, keresés/szűrés, Tamayura visszagomb, mobil könyvnézet és vizuális pigmentrendszer.
- A JSON import/export admin-funkciója és a külön privát tároló/Blob-útvonalak.

## Tesztek, élesítési menetrend

1. Csak a ZIP változott fájljait másold a helyi repó megfelelő relatív útvonalaira; ne cseréld le a friss main többi állományát.
2. Futtasd a mellékelt tesztparancsot, `npx.cmd tsc --noEmit`, `npm.cmd run build`, `git diff --check`.
3. Csak Preview telepítés (`vercel.cmd deploy`) a friss helyi munkafából. Adminbelépés után `/admin`: nézz meg egy korábbi státuszos és jegyzetes könyvet; lépj át egy olvasási útra és nyisd ki a Belső haladás panelt. **Teszteléshez még nem kell semmit módosítani.**
4. A `/library` a Preview-ban és kijelentkezve sehol nem mutathat státuszt, privát jegyzetet, haladást vagy admin vezérlőt. Nézd meg mobilon is 360–420 px szélességen; az útvonalválasztó a meglévő szűrőpanelben marad.
5. A Preview alatt a valódi privát Blobhoz kapcsolódhat az adminoldal; bármely Mentés az éles adatot is megváltoztathatja. Írásos próbát csak külön jóváhagyással végezz.
6. Ha a Preview jó, production kiadás külön döntés: `vercel.cmd deploy --prod` csak teljes munkafa és környezeti változók kontrollja után. A migráció írásengedélyét (`SHIORI_05C2_WRITE_ENABLED`) Preview-ból is kapcsoljuk ki. A felesleges Preview-k csak a sikeres végső ellenőrzés után törlendők.

## Ellenőrzött adatállapot a felhasználói visszajelzés alapján

A korábbi éles ellenőrző API `phase=POST_REDACTION`, `postcheckPassed=true`, `privateObjectVerified=true`, `privateStateReady=true`, 94 könyv, 8 olvasási út, 22 nem alapértelmezett státusz, 10 belső jegyzet és 8 útvonal-előrehaladás. A publikus SHA-256: `d787c4ca4787e719cf914d62fab69a8b5fd06b79da0d116b9ca16de1c7e83d86`. A mostani patch nem változtatja meg az adatokat; **a jelenlegi éles állapotot deployment előtt és után is újra kell olvasni**.
