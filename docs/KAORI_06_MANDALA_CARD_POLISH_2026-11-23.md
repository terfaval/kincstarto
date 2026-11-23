# Kaori-06 – Mandala teakártya finomítás

A Kaori-05 után készült, a felhasználói QA-képen látható problémákra reagálva.

## Változások

- A mandalák már **a teljes papírcímke hátterén** jelennek meg, nem egy felső, 43%-os illusztrációs dobozban.
- A felső sáv kemény vízszintes vágási határa eltűnik; a grafika alul lágyan halványul el.
- A kártyák közepére helyezett Kaori-mon (piros pontszerű elem) kikerül. A Kaori-mon továbbra is szerepel a fejlécben.
- A teanév, rövid leírás és ízjelölés a mandala fölött, olvasható rétegben marad.
- A `tea.id` alapú, determinisztikus mandala-részlet és a `visual` szerkesztői felülírás érintetlen.

## Érintett fájlok

- `src/features/kaori/components/KaoriApp.tsx`
- `src/features/kaori/components/KaoriApp.module.css`
- `scripts/qa/kaori-mandala-card.test.mjs` – új statikus komponens/CSS regressziós ellenőrzés
- `scripts/qa/kaori-ts-import-hook.mjs` – a Node 22 TypeScript tesztek extensionless importjához teszt-írássegéd, csak QA környezetben

## QA

A ZIP gyökere a Kincstartó repó gyökere, más modul nem módosul.

```powershell
$ErrorActionPreference = 'Stop'
Set-Location 'C:\kincstarto'
$patch = Join-Path $HOME 'Downloads\KINCSTARTO_KAORI_06_MANDALA_POLISH_20261123.zip'
Expand-Archive -LiteralPath $patch -DestinationPath . -Force

node --experimental-strip-types --import ./scripts/qa/kaori-ts-import-hook.mjs --test `
  scripts/qa/kaori-guards.test.mjs `
  scripts/qa/kaori-preview.test.mjs `
  scripts/qa/kaori-spoon-measure.test.mjs `
  scripts/qa/kaori-mandala.test.mjs `
  scripts/qa/kaori-mandala-card.test.mjs
if ($LASTEXITCODE -ne 0) { throw 'Kaori teszthiba' }

& .\node_modules\.bin\eslint.cmd src/features/kaori src/app/kaori src/app/admin/kaori src/app/api/kaori src/app/api/admin/kaori
if ($LASTEXITCODE -ne 0) { throw 'Kaori lint hiba' }
& .\node_modules\.bin\tsc.cmd --noEmit
if ($LASTEXITCODE -ne 0) { throw 'TypeScript hiba' }
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Build hiba' }
```

Ez a patch lokális TypeScript/Next build nélkül került csomagolásra. A vizuális böngészős ellenőrzéshez nyisd meg az admin QA preview-t, készíts képernyőképet a 11 teáról és a mobilnézetről. Semmi sem ír a privát teaadatbázisba.
