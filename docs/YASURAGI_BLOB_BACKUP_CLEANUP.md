# Yasuragi – Vercel Blob mentés és régi illusztrációk takarítása

## Amit ez a patch megváltoztat

- Hozzáad egy **csak olvasó** mentőeszközt (`scripts/yasuragi-blob-backup.mjs`), amely a Vercel Blob `yogi/` prefixének összes objektumát letölti. Benne van a `yogi/poses.json` és minden kép. A képeket SHA-256-tal és (ha rendelkezésre áll) az ETaggel ellenőrzi.
- Hozzáad egy külön, alaphelyzetben **csak tervező/dry-run** takarítóeszközt (`scripts/yasuragi-blob-cleanup.mjs`). Csak olyan már nem hivatkozott `yogi/images/` objektum lehet törlési jelölt, amely benne van a helyben ellenőrzött backupban, az URL és az ETag is változatlan, valamint egyik élő `yogi/*.json` sem hivatkozik rá.
- Az adminos képcsere háttérfolyamata választhatóan törölheti az előző képet, de **alapértelmezetten OFF**. Csak akkor aktiválódik, ha a telepített környezetben `YASURAGI_AUTO_DELETE_OLD_BLOB=true` és `YASURAGI_BACKUP_MANIFEST_SHA256=<64 hex karakter>` is be van állítva. A hash a ténylegesen ellenőrzött helyi mentés `manifest.json` fájljáról származzon. A törlés előtt az app minden, Vercel Blobban tárolt `yogi/*.json` fájlt újra beolvas és ellenőrzi, maradt-e hivatkozás. A `del` ETag-alapú feltételes művelet.
- A csere HTTP-válasza külön jelzi, hogy a régi fájl törlődött, megmaradt vagy ellenőrzési hiba miatt nem törlődhetett. **A sikeresen aktivált új kép nem vonódik vissza akkor sem, ha a takarítás sikertelen.**

## 1. Telepítés (lokális forráskód, először még ne deployolj)

A patch kizárólag új/módosított fájlokat tartalmaz. Telepítés előtt ellenőrizd, hogy a korábbi Yasuragi illusztrációadmin-v1 és v2 patch már alkalmazva van. Másold ezt a patch ZIP-et a repó gyökerébe, vagy bontsd ki ott `Expand-Archive ... -Force` segítségével. A `BLOB_READ_WRITE_TOKEN` továbbra is szerveroldali titok; sem a backup ZIP-be, sem a Git repóba nem kerülhet.

## 2. Teljes production backup a saját gépen

A `C:\kincstarto` gyökérből, miután az adott Vercel-projekthez hozzá vagy linkelve:

```powershell
cd C:\kincstarto
# Ha még nincs összekötve: npx vercel link
$backup = Join-Path $HOME ("Documents\Yasuragi-Backups\yasuragi-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
npx vercel env run -e production -- node scripts/yasuragi-blob-backup.mjs backup --out "$backup"
if ($LASTEXITCODE -ne 0) { throw 'A Vercel Blob mentés nem teljes. Semmit ne törölj!' }
node scripts/yasuragi-blob-backup.mjs verify --dir "$backup"
if ($LASTEXITCODE -ne 0) { throw 'A backup ellenőrzése nem sikerült. Semmit ne törölj!' }
Compress-Archive -Path "$backup\*" -DestinationPath "$backup.zip" -CompressionLevel Optimal
Get-FileHash -Algorithm SHA256 "$backup.zip"
Get-FileHash -Algorithm SHA256 "$backup\manifest.json"
Write-Host "Backup helye: $backup.zip"
```

**A backup NINCS kész addig, amíg a script `VERIFIED` eredményt nem ad**, és a teljes ZIP fájlt nem ellenőrizted/mentetted el olyan helyre, amely nem maga a Vercel projekt. A script nem ír a távoli tárhelyre, és semmit sem töröl.

Az eredmény `manifest.json` fájljában vannak a fájlnevek, eredeti URL-ek, méretek, ETag-ek, SHA-256 hash-ek, a pillanatnyi pózreferenciák és az esetleg nem mentett külső hivatkozások. Ha `unlistedBlobRefs` nem üres, a törlést nem szabad aktiválni a hiány rendezéséig.

## 3. Takarítási terv ellenőrzése (NINCS törlés)

```powershell
npx vercel env run -e production -- node scripts/yasuragi-blob-cleanup.mjs --backup "$backup"
if ($LASTEXITCODE -ne 0) { throw 'Nem készült biztonságos takarítási terv!' }
notepad "$backup\cleanup-dry-run.json"
```

Ez külön listázza a megtartandó objektumokat és a `candidates` törlési jelölteket. A tervet és a `VERIFIED` kimenetet nézd át még tényleges törlés előtt. **A dry-run egyetlen Blob-objektumot sem töröl.**

## 4. Takarítás végrehajtása (CSAK a sikeres backup és az ellenőrzött dry-run után)

```powershell
npx vercel env run -e production -- node scripts/yasuragi-blob-cleanup.mjs --backup "$backup" --apply --confirm YES_DELETE_UNREFERENCED
```

Az `--apply` nem érint aktív képeket; egyenként újraellenőrzi a távoli JSON-referenciákat, a fájlazonosságot és az ETag-et. A Vercel cache-ben egy törölt fájl átmenetileg még elérhető lehet, a törlés visszavonása pedig csak a backupból való visszatöltéssel lehetséges.

## 5. Automatikus törlés engedélyezése (csak a mentés tényleges jóváhagyása után)

Vercel Production környezetben állítsd be:

```text
YASURAGI_AUTO_DELETE_OLD_BLOB=true
YASURAGI_BACKUP_MANIFEST_SHA256=<a helyben ellenőrzött manifest.json SHA-256 hash-e>
```

Ezután külön deployment szükséges. Amíg ezek hiányoznak, az adminos képválasztó csak új URL-re vált és megőrzi a régit. Az új kép aktiválása után a takarítás megpróbálja eltávolítani az előző, nem hivatkozott `yogi/images/` objektumot. Ha bármelyik biztonsági ellenőrzés nem teljesül, kihagyja a törlést és a képcsere sikeres marad.

## Korlátok

- A forrás ZIP-ben nincsenek Vercel-hozzáférési adatok. A távoli backupot nem lehetett az asszisztens munkakörnyezetéből ténylegesen elvégezni; csak a felhasználó gépén, kapcsolt production Vercel-projekttel.
- A `yogi/` prefix az alkalmazásban dokumentált Yasuragi-tárhelyet fedi le; ha máshol vagy más Blob store-ban is vannak korábbi illusztrációk, azokhoz külön feltárás/mentés szükséges.
- A törlési referenciavizsgálat a Vercelben tárolt `yogi/*.json` adatokra terjed ki. A régi admin másik böngészőfülében nyitott elavult vázlatok, az alkalmazáson kívüli hivatkozások vagy egyidejű szerver nélküli szerkesztések nincsenek tranzakciósan zárolva. Az első nagytakarításkor ne szerkessz párhuzamosan pózokat.
- Régi, manuálisan feltöltött, a `yogi/` prefixen kívüli fájlokra a mechanizmus nem nyúl.
- Backup készítéskor és az első takarításkor a Vercel tároló és a fejlesztés környezete legyen egyértelműen azonosítva; a `vercel env run -e production` a linkelt projekt production tokenjét használja.
