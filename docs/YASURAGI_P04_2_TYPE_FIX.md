# Yasuragi P04.2 — Zod JSON-séma TypeScript javítás

## Tünet

A P04.1 célzott tesztjei sikeresek, de `npx.cmd tsc --noEmit` megáll:

`TS2741: Property 'schemas' is missing ... ReturnType<typeof z.toJSONSchema>`

## Ok

A Zod 4 `z.toJSONSchema` túlterhelt függvény. A `ReturnType<typeof z.toJSONSchema>` a regiszteres túlterhelés visszatérési típusát következteti ki, miközben a tényleges `z.toJSONSchema(PoseSchema)` hívás az egyedi séma túlterhelését használja.

## Javítás

A `route.ts` egy kicsi, `PoseSchema`-hoz kötött `exportPoseSchema` segédfüggvényen keresztül hívja a Zodot. Az `ReturnType<typeof exportPoseSchema>` így a **ténylegesen választott**, inputfüggő túlterhelés típusát jelenti. Az exportált JSON, a jogosultságellenőrzés, a szakaszos hibakódok és a privát tervezetek védelme nem változik.

## Telepítés

A patch a már felrakott P04 és P04.1 után telepítendő. Nem teljes repó.

```powershell
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath 'C:\kincstarto'
$zip = Join-Path $env:USERPROFILE 'Downloads\kincstarto_yasuragi_P04_2_zod_types_patch.zip'
Expand-Archive -LiteralPath $zip -DestinationPath . -Force
node --test scripts/test-yasuragi-p04-2.mjs
if ($LASTEXITCODE -ne 0) { throw 'P04.2 teszthiba' }
node --experimental-strip-types --test scripts/test-yasuragi-p04-1.mjs
if ($LASTEXITCODE -ne 0) { throw 'P04.1 regresszio' }
npx.cmd tsc --noEmit
if ($LASTEXITCODE -ne 0) { throw 'TypeScript hiba' }
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Build hiba' }
```

Az előző hibát a P04.1 `z.toJSONSchema(PoseSchema)` runtime tesztje nem fedte le, mert a Node nem végez TypeScript típusellenőrzést. Emiatt a teljes `tsc` itt szükséges.

Éles Authoring Kit exportot még böngészőben ellenőrizni kell a helyi szerveren.
