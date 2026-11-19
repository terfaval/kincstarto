# Kincstarto - fresh source ZIP készítése (Windows PowerShell)

A parancsokat a repository **gyökérmappájából** futtasd. A ZIP a forráskódot adja át egy fejlesztési körhöz, nem egy telepített alkalmazást.

## 1. Alap ZIP - ezt használd a legtöbbször

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\create-main-zip.ps1
```

Eredmény: `kincstarto-main.zip` a repo gyökerében.

Tartalmazza a `src/`, `data/`, `docs/`, `scripts/` és a könnyű `public/` állományait, valamint a szükséges gyökérkonfigurációkat. Nincs benne a nagy `public/audio/`, `public/backgrounds/`, `public/yogi/` és a korábbi `TICKETS/` mappa.

## 2. Teljes ZIP - médiát érintő munkához

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\create-main-zip.ps1 -Mode Full
```

Eredmény: `kincstarto-full.zip`. Bevonja a médiaállományokat és a történeti ticketeket is, de **nem** vonja be a személyes aktivitásnaplót, a titkokat vagy az egyéb kizárt helyi fájlokat.

## 3. Egyedi ZIP - szűk fejlesztési területhez

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\create-main-zip.ps1 -Mode Custom -Paths "src/features/meditations;src/features/audio;src/app/meditations/page.tsx;data/meditations;data/audio"
```

Eredmény: `kincstarto-custom.zip`. A `-Paths` paraméterben pontosvesszővel (`;`) elválasztott repo-relatív fájlokat és mappákat adj meg. Egyedi módban médiát is kijelölhetsz, például `public/audio/accent` mappát. Az asszisztens három belépési dokumentuma mindig hozzáadódik.

Ha más helyre vagy névre kéred az eredményt, mindhárom módnál megadhatsz `-Destination` értéket:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\create-main-zip.ps1 -Mode Base -Destination "kincstarto-review.zip"
```

## Biztonsági kizárások (mindhárom módban)

- `.git/`, `node_modules/`, `.next/`, `.vercel/`, build/cache/output/temp mappák;
- `.env*`, lokális konfigurációk, privát kulcsok, adatbázisfájlok és archívumok;
- `data/body/activity-logs.json` (személyes aktivitásadatok);
- generált `next-env.d.ts`, napló- és ideiglenes fájlok.

A kizárási szabályok nem képesek bármilyen más nevű személyes fájlt vagy véletlenül bemásolt tokent felismerni. **Feltöltés előtt érdemes átnézni a ZIP tartalmát**, különösen Full/Custom módban. A ZIP-eket a `.gitignore` kizárja a verziókövetésből.

## Gyors ZIP-ellenőrzés

```powershell
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead("$PWD\kincstarto-main.zip")
try {
  $entries = @($zip.Entries | ForEach-Object { $_.FullName })
  "Files: $($entries.Count)"
  "AGENTS: $($entries -contains 'AGENTS.md')"
  "HANDOFF: $($entries -contains 'docs/HANDOFF.md')"
  "Meditation code: $([bool]($entries | Where-Object { $_ -like 'src/features/meditations/*' }))"
  "Audio files in Base: $([bool]($entries | Where-Object { $_ -like 'public/audio/*' }))"
  "Private log included: $($entries -contains 'data/body/activity-logs.json')"
} finally {
  $zip.Dispose()
}
```

Várt: az első három jelző `True`; az utolsó kettő `False`.

## Patch alkalmazása

A következő lépések a ZIP-es körre vonatkoznak. Ha a Codex közvetlenül dolgozik a helyi repóban, ő futtatja az ellenőrzéseket, és siker esetén a commit- és push-parancsot adja meg.

A visszakapott `kincstarto-patch-*.zip` **csak a változott vagy új fájlokat** tartalmazza. A repository gyökerébe csomagold ki a relatív útvonalak megtartásával.

1. Futtasd az asszisztens ellenőrző PowerShell-blokkját, és küldd vissza a releváns kimenetet. Az esetleg megjelenő titkokat és személyes adatokat takard ki. Hiba esetén az asszisztens javító patch-et és új ellenőrzést készít.
2. Sikeres ellenőrzés után az asszisztens elkészíti a feladathoz tartozó védett Git-blokkot. Futtasd, nézd át a commitra kijelölt fájlok összesítését, és `yes` beírásával hagyd jóvá a commitot és a push-t. Küldd vissza az eredményt, hiba esetén a Git hibaüzenetét is.
3. A következő érdemi fejlesztéshez készíts friss forrás ZIP-et.

A két PowerShell-blokk követelményeit a [fejlesztési útmutató](DEVELOPMENT_WORKFLOW.md) rögzíti.
