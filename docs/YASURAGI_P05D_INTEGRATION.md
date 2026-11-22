# Yasuragi P05d — elágazási, előzmény- és jogosultsági integráció

**Dátum:** 2026-11-22
**Bázis:** a felhasználó legfrissebb `kincstarto-main.zip` forráscsomagja + a helyileg már sikeresen ellenőrzött P05c overlay.
**Határ:** célzott P05d patch; nem publikál gyakorlást, nem hoz létre nyilvános katalógust, nem módosítja a póztárat, a Shiorit vagy a Blob-tároló tartalmát.

## 1. Elágazás: nincs néma fallback

- `chosenOption()` csak kifejezetten kiválasztott **elérhető** opciót, vagy az aktuális **elérhető alapágat** adja vissza; ha egyik sem elérhető, `null`.
- A próbalеjátszó indulás előtt hibát jelez, ha az alapág blokkolt/nincs megfelelő illusztrációja. A gráf futás közben sem térhet át önkényesen másik opcióra.
- Az importáló megőrzi a hiányzó könyvtári elemhez kötött **menthető tervezetet**. A `previewReady=false` és `DEFAULT_UNAVAILABLE` figyelmeztetés megmutatja, miért nem indítható.
- Megmarad a működő alapág és a választott, elérhető alternatíva rendes viselkedése.

## 2. Privát előzmények: korlátos, kurzoros lapozás

- A tervezetlista és a jóváhagyási napló **30 rekordos oldalakat** ad. A kliens „További…” gombot kap, nem áll meg 100 bejegyzésnél.
- Blob: az SDK `list()` natív, átlátszatlan kurzora, a `blob:` előtaggal; Local: az immutable rekordazonosító, `local:` előtaggal. Két mód között a kurzor nem újrahasználható.
- A dátum-előtagú rekordazonosítók miatt a listák az **idősebbektől az újabbak felé** haladnak. A `list()` natív API-ja csak előrefelé lapoz, a fordított rendezéshez külön index lenne szükséges. Nem készül sérülékeny, teljes tárolóolvasásra épülő fordított lapozás.
- A legújabb szerkesztői jóváhagyás keresése Blobnál csak az **objektumneveket** lapozza, majd a legutolsó naplóobjektumot olvassa be. Helyben a fájlnevekből keresi meg.
- A hiányos, túl hosszú vagy eltérő tárolótípusú kurzor hibát kap; az API 400-zal tér vissza. Tárolási hiba 503. Nincs automatikus újramentés vagy törlés.
- A GET végpontok továbbra is adminvédettek és `private, no-store` válaszokat adnak.

## 3. Jogosultsági határ

- A `/admin/yasuragi` és `/admin/yasuragi/practices` oldalak a projekt meglévő proxy védelmén *túl* szerveroldalon is meghívják az `isAdminRequest()` ellenőrzést.
- A privát tervezetet és a hozzá tartozó adatokat nem kapja meg publikus szerverkomponens vagy böngészőútvonal.
- Nem adtunk hozzá új auth mechanizmust vagy Next `middleware.ts` fájlt; a D62 proxy-konvenció marad.

## 4. A P06-tal szembeni elfogadott követelmény: publikus gyakorlásválasztó

A felhasználói igény: a lejátszó **nem** a Yasuragi-főoldal megnyitásakor indul. Előbb gyakorlást kell választani; több gyakorlást a katalógusban kell áttekinteni.

Tervezett végfelhasználói út:

1. Kincstartó főmenü → **Yasuragi** → `/yasuragi` (**publikus katalógus**).
2. A katalógus minden kártyája a kiadott gyakorlás címét, valós időtartamát és csak meglévő, ellenőrzött metaadatait mutatja. Ha nincs kiadott gyakorlás, informatív üres állapot van, nem mintagyakorlat.
3. Gyakorlás kiválasztása → `/yasuragi/[slug]` (**részletek és „Indítás” gomb**).
4. Kifejezett „Indítás” → `/yasuragi/[slug]/play`; a kiválasztott kiadás konkrét, immutable scriptje és a hozzá kötött pózképek kerülnek a lejátszóba. Az óra nem indul el automatikusan a katalógusoldal betöltésétől.
5. Kilépéskor vissza lehet térni a kiválasztott gyakorláshoz vagy a teljes katalógushoz. A belső `/admin/yasuragi?draft=...` próbalеjátszó külön marad.

**Publikációs határ:** a publikus lista és a publikus lejátszó kizárólag **kifejezetten publikált** immutable kiadásokat olvashat. A tervezetlista, a jóváhagyási napló és a teszt-fixture soha nem szolgálhat public source-of-truth-ként. Az admin jóváhagyása önmagában nem publikál. Visszavont/lejárt jóváhagyású kiadásnál a kiadási logika szabályai szerint az index és a közvetlen lejátszólink is védett. Az aktiválás, visszavonás, slug-ütközések és nyilvános kiadási index **P06 feladat**.

**Jelenlegi állapot:** a Kincstartó főoldal Yasuragi-bejegyzése szándékosan `href: null`. A P05d ezen nem változtat; hamis publikus menüt vagy próbakiadást nem aktiválunk.

## 5. Ellenőrzés és korlátok

- `scripts/test-yasuragi-p05d.mjs`: alapág hiány, kurzorvalidálás, 135 helyi és 135 mock Blob tervezet, 135 helyi és 135 mock Blob jóváhagyási napló, legfrissebb jóváhagyás, auth és publikus határ.
- A korábbi P02 import-tesztek igazolják a menthető, de nem előnézet-kész default ág esetét.
- A már meglévő P01–P05c regressziók újrafuttatása szükséges. A ZIP-ben szándékosan **nincsenek telepített függőségek**, ezért a projekt-szintű `tsc --noEmit`, `npm run build` és a mobil böngészős ellenőrzés az operátor helyi repójában futtatandó.
- Az új listák egy lapra legfeljebb 30 privát JSON-t kérnek le. A Blob név szerinti rendezése és forward-only kurzora miatt az újabb rekordok későbbi oldalakon találhatók. Ha a tartalom mennyisége nő, külön időrendi index lehet P06/P07 optimalizáció.
- A tesztek nem helyettesítik a valódi privát Blob-tároló jogosultság- és cache-méréseit, és nem igazolnak szakmai tartalomjóváhagyást.
