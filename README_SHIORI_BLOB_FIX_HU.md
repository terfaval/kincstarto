# Shiori – publikus Blob olvasási konfliktus javítása

## Tünet

Admin import utáni `SpiritJsonBlobConflict` a `src/lib/spiritJsonBlob.ts` `readSpiritJsonBlob()` függvényében. A Vercel Blob publikus URL-jén a `get()` a CDN-ből régi tartalmat adhat, miközben a `head()` a felülírt blob új ETag-jét/méretét látja. Ez átmeneti téves konfliktust okozhat. Valódi párhuzamos módosítást továbbra is blokkolni kell.

## Módosított fájlok

- `src/lib/spiritJsonBlob.ts`: csak az olvasási útvonalban van módosítás. A normál `get()` + `head()` továbbra is az elsődleges út. Ha publikus Blob esetén eltér az ETag vagy a bájtméret, egy új, ETag-gel verziózott publikus lekérést próbál, majd újabb `head()`-del ellenőrzi, hogy közben nem történt írás. Bármely ellenőrzési hiba továbbra is `SpiritJsonBlobConflict`-hoz vezet.
- `src/lib/spiritBlobFreshPublicRead.ts`: új segédfüggvény az ellenőrzött publikus URL-beolvasáshoz, hitelesítő adat küldése nélkül, kontrollált domain/path és ETag/méret vizsgálattal.
- `scripts/qa/shiori-blob-fresh-public-read.test.mjs`: öt biztonsági/funkcionális teszt.

Nem tartalmaz Blob API-tokent, .env fájlt, könyvtár JSON-adatot vagy adatbázis-módosító scriptet. Az írási `put(..., { allowOverwrite: true, ifMatch: snapshot.etag })` útvonal változatlan.

## Telepítés Windowson (PowerShell)

1. **Ne próbálj újra importálni, amíg az aktuális könyvtárat nem ellenőrizted!**
2. A csomagot másold a `Downloads` mappába `shiori-blob-cache-read-fix.zip` néven.
3. A projekt mappájában:

```powershell
$ErrorActionPreference = "Stop"
Set-Location "C:\kincstarto"

$backup = Join-Path $HOME ("Downloads\shiori-blob-read-before-fix-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".zip")
Compress-Archive -LiteralPath ".\src\lib\spiritJsonBlob.ts" -DestinationPath $backup -Force
Write-Host "Backup: $backup"

$patch = Join-Path $HOME "Downloads\shiori-blob-cache-read-fix.zip"
Expand-Archive -LiteralPath $patch -DestinationPath . -Force

node --experimental-strip-types --test scripts/qa/shiori-blob-fresh-public-read.test.mjs
if ($LASTEXITCODE -ne 0) { throw "Blob read teszt hiba" }

& .\node_modules\.bin\tsc.cmd --noEmit
if ($LASTEXITCODE -ne 0) { throw "TypeScript hiba" }
```

4. Indítsd újra a localhost fejlesztői szervert, majd az admin oldalt. A javítás nem ment adatot, csak a betöltést teszi robusztusabbá.
5. Ha az admin betöltődik, készíts **friss Startup exportot**, és ellenőrizd, hogy az első szerkesztői kör változásai már megjelentek-e (a korábbi import megvalósulhatott). Csak akkor készíts új import-előnézetet, ha tényleg nem történtek meg a módosítások; az eredeti Result-et csak azonos aktuális `baseSha` esetén használd.
6. Ha a hiba megmarad, **ne** állítsd vissza vakon a Blob-adatokat és ne ismételd az importot. Ekkor az eltérés valószínűleg nem egyszerű CDN-stale állapot; célzott, csak olvasó diagnosztikát kell végezni.

## QA a csomagban

A tesztek az ETag-verziózott lekérés sikerét, eltérő ETag-jét, méretütközését, tiltott hosztját, illetve hibás útvonalát/ETag-jét ellenőrzik. Node 22 szükséges. Az élő Vercel Blobot és a helyi teljes Next.js buildet a készítő nem futtatta: ehhez a te környezeted szükséges.

## Biztonság / visszaállítás

A csomag **nem írja felül** a `spirit/library.json` élő Blob-adatot, nem érint személyes státuszokat vagy privát tárolót. Sikeres teszt után sem telepít vagy deployol automatikusan.

Ha a TypeScript teszt hibázik, vagy a javítás helyileg regressziót okoz, a ZIP telepítésekor elmentett előző `src/lib/spiritJsonBlob.ts` visszaállítható; a hozzáadott `src/lib/spiritBlobFreshPublicRead.ts` és teszt pedig törölhető. A Blob-tartalomhoz ekkor sem kell nyúlni.
