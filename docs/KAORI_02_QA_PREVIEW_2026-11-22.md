# KAORI-02 — admin-only, write-free QA előnézet

**Alap:** `kincstarto-main(20261122-195953).zip`; az előző Kaori-01 első lokális build, TypeScript és célzott lint a felhasználó visszajelzése szerint sikeres volt.

**Állapot:** patch, lokális TypeScript/lint/build és böngészős elfogadás még szükséges. Nem éles publikálási engedély.

## Mit ad hozzá?

- `/admin/kaori/preview?count=0|1|2|9|10|11`: **csak bejelentkezett admin** láthatja. A route nem hívja a Kaori Blob-store-t, nem ír adatot, nem hoz létre katalógust, nem használ Mirachai legacy-recepteket.
- Teljesen **fiktív**, technikai minták külön `qaFixture.ts`-ből. Csak doboz-, keresés-, modal-, méretezés- és időzítő-QA-ra valók, **nem** valós tea- vagy elkészítési javaslatok.
- Az adminoldal navigációjából elérhető, a publikus `/kaori` útvonal és `/api/kaori` továbbra is kizárólag a publikus kiadott snapshotot olvassa. Nem jelenít meg tesztadatokat a látogatóknak.
- A főzési előkészítés emberi alapanyagnevet mutat az azonosító helyett. A folyamat Escape / modal-bezárás / kilépés esetén a félbehagyás előtt megerősítést kér; az időzítő 1 órán túl `óó:pp:mm` formátumú.

## Célzott helyi teszt

1. Az adminba való bejelentkezés után nyisd meg: `http://localhost:3000/admin/kaori/preview?count=11`.
2. 1366px és 1440px szélességen 3×3, 768px/1024px-en 2×2, 320–420px-en 1×2 rekesz legyen. Az alapállapotok méreteit a kiemelt QA-felső sávval válthatod.
3. 11 teánál laptopon: 9 + 2, keresés `tizenegyedik` találja a 11. teát is. Nyiss meg teát a második oldalon, Escape után maradjon a második oldal és a fókusz.
4. Az első Teszttea modalban válaszd a „Többlépéses tesztmódszer”-t; ellenőrizd a manuális lépést, az egymás utáni 8 és 6 mp-es időzítőt, a szünet/folytatás/reset működését, kilépés visszaigazolását.
5. A második Teszttea módszerében 25 órás időzítőt kell látnod `25:00:00` formátumban. A tesztszámok nem fogyasztásra valók.
6. 0 teánál: használható üres állapot, egyetlen hamis kártya sincs. Bejelentkezés nélkül az admin előnézetnek a loginra kell irányítania.
7. A valódi `/kaori` és `/api/kaori` oldalakon **nem** jelenhet meg Teszttea; a publikus oldal a dedikált tár aktuális helyzetét tükrözi.

## Nem változik

- Kaori Catalog/Result séma, publikálási kapu, CAS/backup/restore, privát tokenek és környezeti változók.
- Shiori, Yasuragi, Tamayura, Kagami, a kezdőlap és a Mirachai adatok.
- Valódi data import / asset / production release.

**Következő kapu:** a dedikált `KAORI_PRIVATE_BLOB_READ_WRITE_TOKEN` valós, külön privát store-hoz való kapcsolása; a read-only export majd az inicializálás külön engedélyezett staging/próba-táron; a Unified teljes import/backup/restore végigpróbálása előbb nem éles adatokkal.
