# Yasuragi P05c — Blob-integráció, migráció és 409 adatbiztonság

2026-11-22 · ZIP-alapú, kizárólag technikai patch · kiindulás: a P05b után feltöltött `kincstarto-main.zip`.

## Határok

A patch **nem** ír át JSON gyakorlást, pózt, képet vagy éles Blob-adatot. Nem publikál, nem töröl és nem állít vissza semmit automatikusan. A közös Yogi póztár és a Yasuragi egyazon revíziós könyvtárát érinti. Shiori, API-auth, proxy, függőségek és UI-megjelenítés (egy 409 hibaszövegen kívül) változatlanok.

## Javítások

1. **Első Blob head:** `head()` egy nem létező pathra `BlobNotFoundError` kivételt dob a telepített Blob SDK-ban, nem `null`-t. Ezt kizárólag az első migráció során kezeljük mint hiányzó headet. Jogosultsági, hálózati, store- vagy egyéb hibából továbbra sem lesz automatikus bootstrap.
2. **Head olvasás:** a HEAD és GET ETag mellett egy újabb HEAD ellenőrzés védi a pointert az olvasás közbeni változástól. Ha a CDN késik, a rendszer **fail-closed** módon olvasási hibát jelez; nem ír felül korábbi állapotot. A public Blob CDN akár 60 másodpercig késleltetheti a módosított pointer láthatóságát. Ehhez a patchhez nem szükséges SDK-frissítés.
3. **Legacy migráció:** ha nincs head, a kezdő pózkönyvtár kizárólag a távoli Blob immutable-revízióból vagy a távoli `yogi/poses.json` fájlból eredhet. Nem tölthető át rejtetten a repo lokális `data/yogi/poses.json` fájlja, és nem lehet automatikusan üres tömbbel indulni. Ha mindkét távoli legacy forrás létezik és eltér, **kézi egyeztetés szükséges** a migráció előtt. Másik access típusra nem vált automatikusan; `BLOB_ACCESS` konfigurációt ellenőrizni kell.
4. **Admin HTTP 409:** az elavult pózmentés a szerkesztett JSON-t az oldalon hagyja, megmagyarázza a konfliktust, és kifejezetten kéri az adatok külön mentését az újratöltés előtt. Automatikus felülírás vagy merge nincs.
5. **Üzemeltetői ellenőrzés:** külön, csak olvasó preflight létezik éles Blobhoz; külön, eldobható Blob-tárolóba **szándékosan író**, izolált CAS smoke test is elérhető. Sem az élő könyvtárban, sem automatikusan nem futnak.

## Offline ellenőrzés

```powershell
node --experimental-strip-types --test scripts/test-yasuragi-p05c.mjs scripts/test-yasuragi-p05b.mjs scripts/test-yasuragi-p05a.mjs scripts/test-yasuragi-player.mjs scripts/test-yasuragi-p03.mjs scripts/test-yasuragi-preview-bridge.mjs
node scripts/test-yasuragi-p02.mjs
node --experimental-strip-types --test scripts/test-yasuragi-p04.mjs scripts/test-yasuragi-p04-1.mjs scripts/test-yasuragi-p04-2.mjs
npx.cmd tsc --noEmit
npm.cmd run build
```

## Éles store — csak olvasó preflight

**Ne másold be a tokent a chatbe vagy naplóba.** A read-only script szándékosan a meglévő `yogi/` útvonalakat vizsgálja, de semmilyen módosítást vagy visszaállítást nem végez. Használható akkor, amikor az adott környezethez van jogszerű hozzáférés. A token megszerzése és tárolása az üzemeltető feladata. Példa PowerShell, ha az operátor maga állítja be a titkos változót a folyamatban:

```powershell
$env:YASURAGI_P05C_READONLY_TOKEN = $env:BLOB_READ_WRITE_TOKEN
$env:YASURAGI_P05C_READONLY_ACCESS = 'public' # a tényleges store access szerint
node --experimental-strip-types scripts/yasuragi-p05c-readonly-preflight.mjs
Remove-Item Env:YASURAGI_P05C_READONLY_TOKEN -ErrorAction SilentlyContinue
```

**PASS:** ha már van `head-v1.json`, az ETag és a hivatkozott immutable revízió ellenőrzőösszege egyezik. Ha még nincs head, a két lehetséges régi forrás közül legalább az egyik létezik, és ha mindkettő létezik, azonos a teljes JSON-tartalmuk. A szkript csak darabszámot/rövid hash-előtagot közöl, nem ad vissza rekordokat. A sikeres preflight nem egyenlő a migráció vagy a production rollout jóváhagyásával.

**BLOCKED:** eltérő legacy állapot, hiányzó/corrupt immutable revízió, elévült cache, hibás konfiguráció vagy jogosultsági hiba. Ilyenkor **tilos** felülírni a pointert vagy tippelésből `yogi/poses.json`-t visszaállítani.

## Elkülönített, tényleges Vercel Blob CAS-smoke

Kizárólag **eldobható, külön létrehozott Blob store tokenjével**. Nem fogadja el a fő `BLOB_READ_WRITE_TOKEN` változóval azonos tokent. A script csak a `diagnostics/yasuragi-p05c/<uuid>/` prefix alá ír rövid teszt-JSON-okat. Nem olvas és nem módosít éles `yogi/` útvonalat; nem töröl tesztobjektumot sem. A futás összeveti az immutable írást, a hiányzó headet, az ETag-CAS versenyt (pontosan egy nyertes), az azonnali olvasás esetleges cache-késését és a pointert nem érintő árva revíziót.

```powershell
# A token egy külön, eldobható Blob store-ból származzon, NEM az élő tárból.
$env:YASURAGI_P05C_DISPOSABLE_BLOB_TOKEN = '<KULON_TESZT_STORE_TOKEN>'
$env:YASURAGI_P05C_DISPOSABLE_ACCESS = 'private' # vagy public, a teszt store szerint
$env:YASURAGI_P05C_CONFIRM = 'YES_DISPOSABLE_STORE'
node scripts/yasuragi-p05c-disposable-blob.mjs
Remove-Item Env:YASURAGI_P05C_DISPOSABLE_BLOB_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:YASURAGI_P05C_CONFIRM -ErrorAction SilentlyContinue
```

Az eredményben `Read-after-write: CDN lag observed` azt jelenti, hogy a CAS versenyhelyzet ellenőrzése sikeres lehetett, de a runtime még nem garantál azonnal használható pointerolvasást. A rendelkezésre állást csak az adott deployban végzett külön teszt után szabad késznek nyilvánítani.

## Hiba és helyreállítás — adatvesztés nélkül

1. Írások leállítása, az összes hibajelzés és a readonly preflight eredményének megőrzése (titkok nélkül).
2. Nem módosító ellenőrzés: aktuális head ETag, benne jelölt immutable pathname, JSON és SHA-256, régi `yogi/poses.json` és történeti revíziók megőrzése.
3. Hiányzó vagy rossz head esetén **ne auto-bootstrapolj** és ne legyen fallback a lokális repo JSON-ból. A megfelelő immutable revíziót külön kell azonosítani, ellenőrzött, ETag-feltételes javítást pedig külön ticket keretében végezzünk. Egyetlen revíziót se töröljünk automatikusan.
4. 409 esetén a szerkesztett JSON maradjon a felhasználónál, ne induljon automatikus újramentés. Friss adat alapján kell a módosításokat egyeztetni.

## Nyitott feltételek és kizárások

- A csatolt ZIP-ben nincsenek Vercel titkok és `node_modules`, ezért itt **nem futott tényleges Blob művelet** vagy teljes Next.js build. Ezeket a helyi környezetben kell igazolni.
- Public head cache akár 60 másodperces fail-closed olvasási kiesést okozhat. A `useCache:false` későbbi, SDK-verzióhoz és private storage-hoz kötött lehetőség; nincs itt vak SDK-frissítés.
- A régi `yogi/poses.json` nem frissül minden P05b/C commitkor. Külső direkt fogyasztói és a régi backup/auto-delete eszközök továbbra is külön átállási vizsgálatot igényelnek.
- A P05b szerződése továbbra is CAS; a P05c nem terjeszti ki az anatomy/knowledge-card írásokra.
- A P05 további műszaki pontjai: default elágazás visszaesése, 100 rekordnál régebbi draft/review előzmények, és a teljes admin route/auth smoke. A P06 publikálás nem része a P05c-nek.
