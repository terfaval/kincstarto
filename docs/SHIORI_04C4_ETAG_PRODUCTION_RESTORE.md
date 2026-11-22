# SHIORI-04C/4 – feltételes éles visszatöltés (előkészített eszköz)

**Hatókör:** pontosan a `spirit/library.json` helyreállítása 59 könyvről / 4 olvasási útról 86 könyvre / 8 útra, a korábbi SHIORI-04C/2 **helyi, személyes adatokat is tartalmazó** biztonsági csomagjából. A patch **nem tartalmaz könyvtáradatot, tokent vagy új függőséget**. Nem módosít admin-API-t vagy alkalmazásadatot. A parancs alapértelmezett működése **csak olvasás**.

## Jóváhagyott ujjlenyomatok

- Kiinduló éles katalógus: `fc667dcee29223948b9b0b5fa0d7e49af9ebf57dfb6391eee8f739d3dea19a00` (59 könyv, 4 út).
- Kész, összevezetett jelölt: `23840c39cf8815181c0d6940e6f4fab411617835ef1292ecebceab6160abee84` (86 könyv, 8 út).
- Helyi könyvtár: `Documents\ShioriBackups\recovery-f52f88c626e94d57b20070ceaad935fb`.
- A 59 létező könyv összes régi mezője változatlan a kibővített `related` listán kívül; a 4 létező út és a történeti személyes mezők megmaradnak. A referencia eltérő szerzőmezője és a négy meglévő út szerkesztői eltérései nem kerülnek automatikus felülírásra.

## Miért ETag-alapú a feltöltés?

A Vercel Blob SDK `2.3.1` (a forrás `package-lock.json` verziója) támogatja az `ifMatch` feltételes írást. Az `ifMatch` a Blob-szolgáltatásban ellenőrzött optimista konkurenciavédelem: ha a másik admin vagy folyamat időközben megváltoztatta a Blob-objektumot, a feltöltés **HTTP 412** hibával elutasításra kerül. Ez jelentősen biztonságosabb, mint a kiolvasás utáni feltétel nélküli `allowOverwrite: true`.

A `get()` a **public** Blob esetén CDN-cache-ből olvashat. Ezért előellenőrzéskor a letöltött JSON SHA-256-át, az olvasáskor kapott ETag-et és a Blob `head()` metadata ETag-jét, méretét és pathname-ját együtt ellenőrizzük. Ha az első CDN-válasz és a metadata eltér, az eszköz **egyetlen** új, egyedi query-paraméteres publikus URL-lekérést végez (a Blob dokumentált cache-busting mintájával), majd a `head()` választ ismét lekéri. Csak akkor fogadja el az adatot, ha az új tartalom ETag-je és mérete megegyezik a két egymást követő, változatlan eredet-metadata értékkel; eltérés esetén továbbra is leáll, **éles írás nélkül**. A tényleges `put()` a frissen ellenőrzött ETag-et használja.

**Korlát:** az éles webalkalmazás adminmentései nem módosulnak ettől a patch-től, ezért a visszatöltés idejére fel kell függeszteni őket. A feltételes írás megakadályozza, hogy *ez az eszköz* felülírjon egy korábbi ellenőrzés óta módosult Blob-változatot, de nem akadályozza meg, hogy más szerverfolyamat később újra felülírja a katalógust. A publikus CDN akár kb. 60 másodpercig a régi könyvtárat adhatja vissza; a későbbi `--postcheck` emiatt külön parancs.

## 04C/4a – publikus CDN-előellenőrzési javítás

A 04C/4 első éles előellenőrzése `CDN read and origin metadata ETags differ` hibával megállt. A javítás nem lazít a változat-egyezésen, hanem új, egyszeri query-paraméteres olvasással próbálja igazolni az aktuális verziót. Ha ez sem egyezik, nem lehet használni a `--apply` módot, és a teljes Blob-adatot tovább kell vizsgálni. Egy cache-busted olvasás nem tekinthető önmagában bizonyítéknak: az eredeti `head()` ETag-nek a friss olvasás után is változatlannak kell maradnia.

## Üzemmódok

1. **Előellenőrzés (alapértelmezett):** `node --env-file="<temp-env>" scripts/qa/shiori-recovery-promotion.mjs --recovery-dir "<backup-dir>"` – csak olvasás; az aktuális Blob SHA, ETag, méret, a mentés, a manifest, a jelölt és a linkek ellenőrzése. Várható: `VERIFIED`, `READ ONLY`, 59 → 86.
2. **Éles feltöltés (külön, későbbi felhasználói engedély):** ugyanez `--apply` kapcsolóval, kizárólag felhasználó által indított **interaktív** PowerShellben. A folyamat újra ellenőrzi a fájlokat és az élő Blobot, majd megköveteli a `SHIORI 86 KONYV VISSZAALLITAS` szó szerinti begépelését. Ezután ismét összeveti a SHA-t és ETag-et, külön helyi `PREWRITE_...` mentést készít, és **egyetlen** `put()` hívást indít `ifMatch` opcióval. A válasz és az új `head()` ETag/méret egyezését bizonyítékként menti. Hiba esetén nincs automatikus második feltöltés.
3. **Utóellenőrzés:** ugyanez `--postcheck` kapcsolóval, kizárólag olvasás. Az élő állomány teljes SHA-256-át, könyv- és útszámát ellenőrzi az elfogadott jelölthöz. Public CDN esetén a feltöltés után kb. 60 másodperc szükséges lehet. Sikertelen utóellenőrzéskor tilos a `--apply` újraindítása; csak olvasó vizsgálat következhet.

## Tiltások és biztonsági szabályok

- **A patch tesztelése közben ne használd a `--apply` kapcsolót.** Az éles íráshoz külön, a felhasználó által elindított lépés szükséges.
- Éles írás előtt ellenőrizd a Vercel-projektet, a production környezeti beállításokat és a megfelelő Blob store-t; az adminban szüneteljen a szerkesztés. Sem a lokális `.env.local`, sem a meglévő Blob nem íródik az előellenőrzés során.
- A mentés és a jelölt **személyes adatokat** tartalmazhat. Nem szabad ZIP-be, Gitbe, issue-ba vagy chatbe feltölteni őket. Csak a parancssori státuszüzenetet osszuk meg.
- A `PREWRITE_...` mappa a korábbi helyi mentéstől függetlenül is megőrzi a tényleges írás előtti bájtokat.
- Ha a `put()` hálózati hibára fut vagy a következő ellenőrzés nem döntő, **nem szabad megismételni** az írást: az eredménye lehet, hogy már élesben van. Először `--postcheck` és a Vercel Blob változatának vizsgálata szükséges. Automatikus rollback nincs, mert egy későbbi adminmódosítást az is elveszíthetne.
- A sikeres feltöltés után végre kell hajtani a külön utóellenőrzést és a Shiori böngészős 86 könyv / 8 út ellenőrzését. A régi 59 könyves lokális fallback adatai és a nyilvános történeti személyes mezők kezelése későbbi feladat.

## Fájlok

- `scripts/qa/shiori-recovery-promotion.mjs` – a CLI három üzemmódja.
- `scripts/qa/shiori-recovery-promotion-core.mjs` – SHA, linkek, teljes összevezetési ellenőrzés és feltételes írás védelmei.
- `scripts/qa/shiori-recovery-promotion.test.mjs` – offline 19 egységteszt, köztük CDN/head eltérés, feltételes feltöltés és konkurens írás tesztje.
- `docs/SHIORI_04C4_ETAG_PRODUCTION_RESTORE.md` – ez a leírás.

A TypeScript/Next.js appfájlokat a csomag nem érinti. Nincs kötelező `npm install` vagy teljes build ehhez a script-only patchhez.

## 04C/4c – gyenge CDN ETag és erős control-plane ETag

A 04C/4b **csak olvasó** diagnosztika megmutatta, hogy a CDN `get()` eredményének ETag-je **gyenge** (`W/"..."`, 36 karakter), míg a `head()` **erős** (`"..."`, 34 karakter). A két azonosító SHA-256-lenyomata eltér, mert a gyenge ETag tartalmazza a `W/` előtagot. A feltételes, a HEAD ETag-jét használó olvasás HTTP `304` választ kapott. A 59 könyves JSON objektum SHA-ja és bájtmérete változatlan; a HEAD és a lista metaadata is stabil.

**A változtatás:** verzió-összehasonlításkor kizárólag a szabályos `W/` jelölést távolítjuk el az ETag *összehasonlítható másolatából*; ezt követően a **teljes** idézőjeles azonosítónak pontosan egyeznie kell. Más érték, hibás formátum, gyenge HEAD vagy eltérő bájtméret továbbra is leállítja a folyamatot. Az előzetes és a közvetlen írás előtti JSON-fingerprint ellenőrzése változatlan; az `ifMatch` feltételhez **kizárólag a változatlan, erős HEAD ETag** kerül. A `W/`-prefix levétele **nem teszi erőssé a CDN ETag-et**; az admin-írások szüneteltetése és az atomikus Blob `ifMatch` védelme továbbra is kötelező.

Ez a patch nem módosítja az alapértelmezett, **csak olvasó** futtatást, a jelölt állományt, a mentést vagy a mentési/feltöltési parancssor argumentumait. A külön interaktív `--apply` jóváhagyás továbbra is szükséges; a 04C/4c előellenőrzése önmagában nem tesz éles írást.
