# SHIORI-05B – külön privát Blob store bekötése, csak olvasó kapu

## Állapot és hatókör

Ez a patch **nem hoz létre tárolót, nem ír a Vercel Blobba, nem migrál adatot, nem deployol és nem kapcsolja be** a `SHIORI_PRIVATE_STATE_READY` változót. A 05A kész, de az éles személyes adatok még a publikus `spirit/library.json` régi változatában lehetnek; a hozzáférési probléma éles lezárására a későbbi, külön jóváhagyott migráció szükséges.

A forrásban rögzített `@vercel/blob` verzió **2.3.1** (package-lock). A Vercel Blob OIDC `storeId`-támogatása **2.4.0**-tól érhető el. A 05B ezért kifejezetten a 2.3.1-es SDK-val kompatibilis, **két külön statikus read-write token** útvonalat készíti elő, nem hallgatólagos OIDC-váltást. Ne állíts be csak `SHIORI_PRIVATE_BLOB_STORE_ID`-t: ez a kód még nem használja. Ha az új privát store csak OIDC-hozzáférést ajánl fel, **állj meg**: külön SDK- és credential-váltás kell, a publikus store jelenlegi beállításának átírása helyett.

## Vercel-beállítások – NEM kell hozzá új alkalmazás vagy új projekt

1. A jelenlegi `kincstarto` projektben / azonos teamen belül hozz létre egy **új, valóban `Private` access módú** Vercel Blob store-t (pl. `shiori-reading-private`). **Ne módosítsd** a meglévő public store-t, és ne kapcsolj új tárolót a már működő `BLOB_READ_WRITE_TOKEN` névre.
2. A külön privát store **statikus read-write tokenjét** a Vercel projekt `Production` környezetében `SHIORI_PRIVATE_BLOB_READ_WRITE_TOKEN` néven a Vercel automatikusan beállítja, ha a kapcsolatnál a `SHIORI_PRIVATE_BLOB` prefixet és a read-write token opciót választod. A régi `SHIORI_PRIVATE_BLOB_TOKEN` név visszafelé kompatibilitásból támogatott; **ne állítsd be mindkettőt eltérő tokennel**. A token értékét nem szabad a repóba, jegyzetbe vagy beszélgetésbe másolni. A projekt meglévő `BLOB_READ_WRITE_TOKEN` változójának változatlannak kell maradnia.
3. Ne állítsd be `SHIORI_PRIVATE_STATE_READY=1`-re. A mostani ellenőrzés nem kívánja meg, hogy a privát `spirit/reading-state.json` már létezzen; migráció előtt általában **nem létezik**.
4. A felületen ellenőrizd, hogy az új store hozzáférése tényleg **Private**. Egy **üres** store-ról a lista önmagában nem bizonyítja a hozzáférési módot: ezt a dashboardon kell megállapítani.
5. A két token különböző *tárolóazonosítóra* mutasson. Az azonos tárolóhoz létrehozott két külön titok **nem elegendő**. A 05B ezt a Vercel read-write token formátumából ellenőrzi, mielőtt hálózati műveletet végezne.

**OIDC-jövőkép:** a Vercel új tárolókapcsolatainál a 2026-os ajánlott mód az OIDC. Egy későbbi, önálló SDK-frissítéses körben `@vercel/blob >=2.4.0`, explicit privát store ID és a rövid életű hitelesítés teljes fail-closed kezelése szükséges, mielőtt OIDC-vel bármilyen privát írást engednénk. A mostani patch nem próbálja a publikus tokent privát OIDC hitelesítés helyettesítésére használni.

## Csak olvasó előellenőrzés

A két szükséges titok konfigurálása után, *csak helyben*. A Vercel automatikus `SHIORI_PRIVATE_BLOB_READ_WRITE_TOKEN` változója közvetlenül használható; sem kézi tokenmásolás, sem `SHIORI_PRIVATE_BLOB_TOKEN` alias létrehozása nem szükséges:

```powershell
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath 'C:\kincstarto'
node --experimental-strip-types --test scripts/qa/shiori-private-store-preflight.test.mjs scripts/qa/shiori-private-state.test.mjs
if ($LASTEXITCODE -ne 0) { throw 'Shiori 05B teszthiba' }
$id = [guid]::NewGuid().ToString('N')
$tempEnv = Join-Path $env:TEMP "shiori-05b-$id.env"
try {
  npx.cmd vercel env pull "$tempEnv" --environment=production
  if ($LASTEXITCODE -ne 0) { throw 'Vercel env pull sikertelen' }
  node --experimental-strip-types --env-file="$tempEnv" scripts/qa/shiori-private-store-preflight.mjs --check
  if ($LASTEXITCODE -ne 0) { throw 'Shiori 05B Blob preflight megallt' }
}
finally {
  Remove-Item -LiteralPath $tempEnv -Force -ErrorAction SilentlyContinue
}
```

A preflight **csak** `get`, `head`, `list` műveleteket használ. Nincs `put`, `delete`, `copy`, staging vagy lokális nyers JSON-mentés. A kimenetben csak darabszámok, a publikus tartalom SHA-256-ja és nem érzékeny állapotjelzők szerepelnek. A teljes publikus katalógus száma nem lehet kevesebb 86 könyvnél és 8 útnál. Az esetleges, már létező privát állományt csak validálja, nem módosítja. A `privateAccessVerifiedFromExistingObject: false` egy üres store-nál **nem hiba**; ilyenkor a Vercel dashboardban kötelező ellenőrizni a `Private` access módot.

Ha a privát kapcsolathoz nincs külön statikus token, nem felismerhető a token formátuma, azonos store-t jelöl a két token, megváltozott a publikus könyvtár, vagy az új store nem privát: **STOP**, semmi automatizált javítás és semmilyen `--apply`.

## Következő, külön engedélyezett lépések

- A 05B eredmény átnézése és a privát store `Private` módjának kézi ellenőrzése.
- 05C: `scripts/qa/shiori-private-state-migrate.mjs --check` futtatása, majd külön jóváhagyás esetén a két tároló közötti migráció, postcheck és környezeti aktiválás.
- Migráció előtt a Shiori-admin írásokat függeszd fel. Két store felülírása nem atomi; ha a művelet állapota bizonytalan, nem szabad megismételni automatikusan.
- A már publikált JSON történelmi másolatai nem vonhatók vissza automatikusan, és a CDN régi változatot tarthat a cache-ben.
