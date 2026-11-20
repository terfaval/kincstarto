# Yasuragi – Vercel Blob-mentés, takarítás és automatikus képcsere utáni törlés

## Visszaellenőrzött állapot (2026. november 20.)

- Projekt: `mates-projects-bda608e3/kincstarto`.
- Teljes `yogi/` backup: 288 objektum, 446 848 666 bájt, 79 póz, sikeres `VERIFIED` ellenőrzéssel.
- A helyi backup ZIP SHA-256 ellenőrzőösszege: `2FC6F18882F36767609EE139EDA8D99583DE8F39C7216CE254CFBFDC7AA8CD86`.
- A 202 darab régi, már nem hivatkozott manökenkép törlése sikerült. A végső szárazpróba: 83 megmaradó kép, 0 törlési jelölt.
- A mentés a felhasználó helyi gépén található, nem a repóban vagy a Vercelben. Megőrzése és egy külön példány készítése szükséges.
- Ezeket az eredményeket a felhasználó production parancskimenete igazolja. Az **új automatikus törlés a production környezeti kapcsoló engedélyezéséig nem fut**.

## Automatikus törlés képcsere után

A `POST /api/admin/yogi-knowledge/illustration` admin-útvonal az új kép sikeres feltöltése és a `yogi/poses.json` mentése után hívja meg az automatikus takarítást. Csak production környezetben és az alábbi változó beállításakor engedélyezett:

```text
YASURAGI_AUTO_DELETE_OLD_BLOB=true
```

**Nincs manifest-hash-függőség.** A korábbi SHA-256 változó csak formai engedélyező feltétel volt, nem igazolta a mentés tényleges meglétét. Ezt a korlátot megszüntettük. A régi képek törlése továbbra is végleges: az eredeti mentést másik helyen célszerű megőrizni, és a jövőbeli feltöltésekről külön backupot készíteni.

A szerveroldali védelmek:

1. Kizárólag azonos Vercel Blob-tárhelyen lévő, ismert nevű `mannequin_*` vagy az admin által készített `illustration-*` korábbi pózképeket törölhet. Más képtípusokat kihagy.
2. A tárhelyről frissen listázza a `yogi/` alatti JSON-fájlokat. A `yogi/poses.json` megléte kötelező.
3. A JSON-ok ellenőrzése a már bevált nyilvános Blob-olvasással történik: lista-ETag, GET-ETag és a GET előtti/utáni origin HEAD egyezését vizsgálja. Elavult, gyorsítótárazott tartalomból nem engedélyez törlést.
4. Ha bármelyik JSON még hivatkozik a régi képre, megőrzi azt.
5. A régi kép metaadatait is ellenőrzi, és csak ETag-feltételes (`ifMatch`) törlést végez.
6. Sikertelen biztonsági ellenőrzésnél vagy Blob-hibánál megőrzi a régi képet. **A már aktivált új illusztráció továbbra is működik**, a felület és a szervernapló külön jelzi az eredményt.

**Korlát:** a `yogi/*.json` fájlok vizsgálata nem tudja tranzakciósan megakadályozni egy másik, tökéletesen egyidejű adminírás megjelenését, és nem látja az alkalmazáson kívüli közvetlen URL-hivatkozásokat. A 2026. november 20-i mentés a később feltöltött új képeket sem tartalmazhatja; ezek későbbi visszaállíthatóságához további rendszeres backup szükséges.

## Patch ellenőrzése élesítés előtt

A ZIP csak a módosított/új fájlokat tartalmazza. Kicsomagolás után a `C:\kincstarto` projektben:

```powershell
node --experimental-strip-types --test scripts/yasuragi-auto-delete.test.mjs
if ($LASTEXITCODE -ne 0) { throw 'Az automatikus törlés tesztje hibás' }
.\node_modules\.bin\tsc.cmd --noEmit
if ($LASTEXITCODE -ne 0) { throw 'TypeScript-hiba' }
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Buildhiba' }
```

A korábbi mentés ellenőrzése **nem követelménye** az automatikus törlés technikai engedélyezésének. Ha a korábbi ZIP új helyen rendelkezésre áll, külön is ellenőrizhető:

```powershell
$folder = Join-Path $HOME 'Documents\yasuragi-20261120-141004'
$zip = Join-Path $folder 'yasuragi-20261120-141004.zip'
$backup = Join-Path $folder 'restored'
Get-FileHash -LiteralPath $zip -Algorithm SHA256
node scripts/yasuragi-blob-backup.mjs verify --dir "$backup"
Get-FileHash -LiteralPath (Join-Path $backup 'manifest.json') -Algorithm SHA256
```

## Production bekapcsolása (sikeres teszt és deploy után)

1. Nyisd meg: Vercel Dashboard → `mates-projects-bda608e3/kincstarto` → **Settings → Environment Variables**.
2. **Production** környezetben állítsd be az egyetlen változót. A manifest hash-t a helyi `Get-FileHash` eredményéből vedd, **ne** a ZIP hash-t másold.
3. A tesztelt módosítások kerüljenek Git commit/push útján production deploymentbe. Környezeti változó módosításakor is új deployment szükséges; a már futó deployment nem veszi fel visszamenőleg az új értéket.
4. Az első valódi adminos képcsere után ellenőrizd az `deleted`, `skipped`, `failed` vagy `disabled` státuszt és szükség esetén a Vercel Function logokat. Egy még hivatkozott kép kihagyása a várható biztonságos viselkedés.
5. Visszakapcsolás: állítsd `YASURAGI_AUTO_DELETE_OLD_BLOB=false` értékre és készíts új deploymentet. A képfeltöltés kikapcsolt törléssel is működik.

A korábbi **tömeges takarító script** ettől független: alapértelmezésben dry-run, éles törléshez továbbra is kötelező `--apply --confirm YES_DELETE_UNREFERENCED --max-delete N` (N = 1–250). Az automatikus képcsere nem indít tömeges takarítást.

## Egyszerusitett production kapu (2026-11-20)

A production automatizmus egyetlen kapcsolot vizsgal (`YASURAGI_AUTO_DELETE_OLD_BLOB=true`). A korabbi `YASURAGI_BACKUP_MANIFEST_SHA256` nincs felhasznalva, es nem kell beallitani. A fail-closed JSON/ETag/hivatkozas-ellenorzes valtozatlan. Meglevo backupot az alkalmazas nem tud ellenorizni, ezert a regi Blob automatikus torlese a jovoben keszulo kepekhez nem jelent garantalt visszaallitasi lehetoseget.
