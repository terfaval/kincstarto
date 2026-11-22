# SHIORI – teljes JSON export és könyvimport (admin)

## Cél

A `/admin` ugyanazt a teljes képernyős Shiori-polcnézetet és könyvadatlapot használja, mint a `/library`. A külső oldalsó eszköztár a publikus oldalon üres; az adminban csak a **`+` gomb** látszik. Ez az egyetlen gomb nyitja meg a JSON import/export ablakot. A polcon belüli keresés és polcválasztás mindkét nézetben megmarad. A `+` alatti export a teljes, aktuális **Vercel Blob** katalógust adja; az import id-alapú könyvfelvételt és szerkesztői frissítést végezhet. A teljes export minden könyvet, az aktuális olvasási utakat, témákat, címkefeliratokat és az admin számára visszakapcsolt személyes `status`/`notes` mezőket is tartalmazhatja. A SHIORI-05 migráció után az olvasási adatok külön private Blobban élnek, a publikus raw JSON-ban nem. Ezek **bizalmas adatok**; a JSON soha ne kerüljön nyilvános linkre, Gitbe, ticketbe vagy beszélgetésbe. A fájl mentése böngészőoldali letöltés, nem ír a repóba.

## Felhasználói folyamat

1. Először kattints a **Teljes JSON letöltése** gombra: ez a mentésed. A Blob olvasási hibája esetén nincs export és **nincs 59 könyves helyi fallback**.
2. JSON fájlt válassz ki, vagy illeszd be a tartalmát. Támogatott alakok: egy könyvobjektum (`{ "id": "...", ... }`), egy könyvtömb (`[ {...}, {...} ]`), `{ "books": [...] }`, vagy a teljes könyvtár-JSON. Legfeljebb 500 könyv / 1 MB fájl a felületen.
3. Mód: **Csak új könyvek** (meglévő ID-t kihagy) vagy **Újak és meglévők szerkesztői frissítése**. A változások előnézeténél ellenőrizhető az új ID-k, módosult mezők és a `related` kapcsolatok régi/új listája. **Nincs import mentés előnézet nélkül.**
4. Jelöld be a mentést és a változásokat megerősítő négyzetet, majd indítsd az importot. Az API az aktuális, ellenőrzött Blob-verzióból újraszámolja a diffet, ellenőrzi az előnézet ETag+SHA értékeit és kizárólag `ifMatch`-es feltételes felülírást végez.
5. Import után a böngésző frissíti az admin nézetet. Visszaellenőrzésként exportálj ismét, vagy nézd meg a könyveket. **Ha a feltöltés kimenetele bizonytalan, ne ismételd meg automatikusan; előbb ellenőrizd az exportot.**

## Mit módosíthat az import?

- Könyvek szerkesztői mezői: cím, szerző, sorrendkulcs, elsődleges kategória, borító/gerinc mezők, tradíció, szint, összefoglalók, ajánlás, témák, nyelv, formátum, előfeltételek, óvatosság, címkék, év, **kapcsolódó könyvek (`related`)**.
- Új könyveknél minden kötelező mező szükséges, az `id` ASCII slug, `status` automatikusan `olvasatlan`, `notes` nincs. A hivatkozásoknak létezniük kell az import **utáni teljes** könyvkészletben.
- Meglévő könyvnél **csak a JSON-ban szereplő mezők** változnak. Egy opcionális mezőt `null`-lal, listát `[]`-val lehet eltávolítani. A `related` **teljes listát cserél**, nem csak új elemeket fűz hozzá.
- A teljes export újraimportálásakor a `status` és `notes` mezők minden könyvnél figyelmen kívül maradnak, a jelenlegi élő személyes értékek megmaradnak. A hiányzó könyvek soha nem törlődnek.

## Szándékos korlátok

Ez a ticket **csak könyvimport**. Ha egy teljes könyvtár-JSON-t töltesz be, a `paths`, `thematic_pills`, `tag_labels` és `library_version` adatai **nem íródnak**. Ezeket az export tartalmazza, de az import megőrzi az éles példány aktuális értékeit (beleértve az olvasási utak `progress` és `items.comment` adatait). A polcszabályok továbbra is a `shioriShelves.json` fájlból származnak: az új, oda még nem sorolt könyvek a „Besorolásra váró könyvek” csoportban jelennek meg. A polctérkép automatikus frissítése nem része a ticketnek.

Az egykönyves, AI-alapú régi szerkesztő komponens a forrásban megmarad, de az új admin polcnézetből nem indítható; csak a JSON + folyamat látható. A meglévő `status`/`notes` személyes mezőket az admin polc is a publikus vetülettel jeleníti meg, de a belépett admin teljes JSON exportja tartalmazhatja őket. A SHIORI-05 aktiválása után a személyes státusz/útvonal-mentések külön privát Blobban, ETag-védelemmel működnek. A régi könyvmentés 410-es válasszal le van tiltva. Migrációig az import és az állapotmentés karbantartási okból szünetel. Bővebben: `docs/SHIORI_05_PRIVATE_BLOB_SPLIT.md`.

## Hiba- és adatvédelmi viselkedés

- Új admin végpont: `GET`/`POST /api/admin/spirit/json`, szerveroldali session-ellenőrzéssel és POST-nál azonos origin követelménnyel. `Cache-Control: private, no-store`; teljes export **csak belépett adminnak**.
- **Nincs 59 könyves repo-fallback.** A kiválasztott Blob GET `W/` gyenge ETag-jét a HEAD erős ETag-jével normalizáltan ellenőrzi; az írásnál az eredeti erős HEAD ETag-et használja `ifMatch`-hez.
- A szerveroldali diff és Zod-séma validáció minden mentés előtt újra lefut. Hiányzó/duplikált hivatkozás vagy schema hiba esetén **nincs írás**. A válasz nem tartalmaz személyes olvasási adatokat.
- A Blob-feltöltés csak egyszer történik, automatikus retry/rollback nélkül. A feltöltés utáni HEAD-metaadat és byte-szám ellenőrzése után jelez sikert; a publikus CDN késhet.

## Ellenőrzés

`node --experimental-strip-types --test scripts/qa/shiori-json-import.test.mjs` és a projekt célzott Shiori-tesztjei. Lokálisan telepített npm-függőségekkel `npx.cmd tsc --noEmit` és `npm.cmd run build`. Manuálisan: `/admin` asztali és legfeljebb 420 px-es mobilnézet; JSON export; `related` módosítás előnézete; hiányzó kapcsolódó ID blokkolása; régi személyes státusz/jegyzet megőrzése; frissítés után könyv megjelenése a könyvtárban.

## Egységes könyvtárnézet ellenőrzése

A `/library` és `/admin` ugyanazt a `ShioriShelf` és `ShioriBookDetail` komponenst kapja, az admin is a privát státuszokat elhagyó `publicShioriCatalog` vetületet használja. A `+` megnyitja a JSON folyamatot; az **Előnézet** nem ír, míg a jóváhagyó jelölőnégyzet után a **Jóváhagyott import** valós, admin-only `action=apply` Blob-mentést végez. Új könyveknél minden kötelező mezőt meg kell adni. A teljes könyvtár export/import nem töröl könyveket, az újakat a polcnézet teljes könyvtár listája azonnal vagy a CDN-frissítés után mutatja.

A repó `data/spirit/library.json` fájlja egy régi, 59 könyves pillanatkép; nem kötelező frissíteni. A SHIORI-05 aktiválása után az oldalak kizárólag a hitelesített Blob-verziót használják, a régi fallback nem lép életbe.
