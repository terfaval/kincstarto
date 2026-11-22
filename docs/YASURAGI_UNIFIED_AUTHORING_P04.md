# Yasuragi P04 — Authoring Kit és kötött szerkesztői jóváhagyás

**Forrás:** a felhasználó 2026-11-22-én feltöltött friss `kincstarto-main.zip`. P01/P02/P03 megőrzése, csak Yasuragi-admin scope.

## A P04 mit valósít meg?

1. **Authoring Kit export:** `GET /api/admin/yasuragi/authoring-kit` admin-auth mögött, no-store, JSON letöltés. A _jelenlegi_ könyvtárban levő pózok ID-ja, magyar/angol neve, státusza, képének elérhetősége; engedélyezett equipment kulcsok; a PoseSchema Zod 4 JSON-sémaként; a `yasuragi.authoring.v1` és `yasuragi.practice.v1` formátumok mezőlistája, szerkesztési alapelvek és egy rövid példa. Nincsenek privát gyakorlatok, tokenek vagy képfájlok/asset URL-ek a kitben. A JSON-kitet később az egységes alkotói skillhez lehet feltölteni.
2. **Függőség- és kiadási kapu:** `GET /api/admin/yasuragi/practices/approval?draft=<id>` a szerkezetileg érvényes gyakorlás **aktív / ténylegesen elérhető** útvonalaihoz követeli meg a könyvtári ID-kat, az aktív pózt, `validated:true`, `content_status:verified|published`, `mannequin_angled.status:verified` és érvényes képhivatkozás. Az elérhetetlen/explicit `blocked...` opciók nem aktiválódnak; a projekt csak javasolt, de scriptben nem használt pózai nem kiadási követelmények. A régi P02 próbaléjátszás-kaput nem helyettesíti.
3. **Kézi szerkesztői ellenőrzés:** csak akkor kínál fel rögzíthető ellenőrzést, amikor a szerkezet, a teljes bejárható útvonal és az összes releváns könyvtári függőség rendben van. Három külön nyilatkozat: T/M/E-szövegek; mozgási/biztonsági tartalom; minden aktív útvonal próbaléjátszása. Ez önbevallás, nem automatizált jóga-szakértői hitelesítés.
4. **Immutable review receipt:** `POST /api/admin/yasuragi/practices/approval` admin-session + same-origin ellenőrzés, max. 4096 B. A böngésző által megadott immutable script SHA256 és az aktuális könyvtár SHA256 egyezését a szerver újraellenőrzi, és kizárólag a 3 megerősítés + gate teljesülésekor ment privát, új, append-only naplórekordot. Egy későbbi póz-/kép-/státuszváltozás elavulttá teszi a jóváhagyást; ez a következő GET-ben látszik.

## Felső korlátok / kiadási határ

- **Nincs tényleges nyilvános publikálás, live kapcsoló, aktív release pointer vagy végfelhasználói API.** A P04 szerkesztői jóváhagyási előfeltételt és Authoring Kitet épít ki; az éles kiadás külön, explicit műveletet igényel a későbbi P05-ben. Az adminjelölés nem változtatja meg a P01/P02/P03 lejátszót, a könyvtári pose status-t vagy a nyilvános alkalmazást.
- A szándékosan blokkolt, későbbi alternatív útvonalak továbbra is rejtve maradnak. Újonnan engedélyezésük esetén a script új, immutable tervezetverzióként érkezik, és a kapu újraszámolódik.
- A `mannequin_angled.status:verified` technikai/szerkesztői státusz, **nem** bizonyítja a kép anatómiai hitelességét; a kézi ellenőrzés ettől külön marad.
- A privát napló helyben `private/yasuragi-practice-reviews/<draft>` könyvtárba íródik (`.gitignore` kizárja); productionben csak külön `YASURAGI_PRIVATE_BLOB_TOKEN` mellett működik, a Yasuragi privát prefixben. Nincs új env-változó, sem DB.
- Írási kimenetel bizonytalanságánál ne kattints automatikusan ismét: ellenőrizd a privát naplót / adminstátuszt. Többadminos, egymással versengő könyvtári írásra továbbra sincs CAS-tranzakció: a jóváhagyás aktuális ellenőrzőösszeghez kötése **nem** helyettesíti a kötetlen képfeltöltésben szükséges CAS-t.
- Minden rögzített ellenőrzés admin-session jelenlétében történik, személyazonosító vagy jóváhagyói név tárolása nélkül. Ha később név szerinti jóváhagyói napló kell, ahhoz az auth-adatmodell külön bővítése szükséges.
- A P04 Authoring Kit exportja a *jelenlegi* könyvtár állapotát tükrözi, a skill nem tekintheti történetileg stabilnak. Friss authoring munkához új kitet kell kérni.

## Lokális ellenőrzés

```
node --experimental-strip-types --test scripts/test-yasuragi-player.mjs
node scripts/test-yasuragi-p02.mjs
node --experimental-strip-types --test scripts/test-yasuragi-p03.mjs
node --experimental-strip-types --test scripts/test-yasuragi-p04.mjs
npx.cmd tsc --noEmit
npm.cmd run build
```

Böngésző, `/admin/yasuragi/practices`:

1. Mentett `foldon_dolgozas` projekt megnyitása: az új kapu mutasson blokkoló pózokat, ne kínáljon aktív jóváhagyási gombot.
2. `Aktuális Yasuragi Authoring Kit letöltése`: JSON érkezik, benne a `format`, `poses`, `equipment`, `poseSchema` és `exampleProject` kulcsokkal; privát tervezet és asset URL nélkül.
3. Pózstátusz-függőségek változtatása után „Élő könyvtári státusz frissítése”: a gate az új állapotot mutassa.
4. Egy **csak lokális, szakmailag ellenőrzött** teljesen kész mintagyakorlásnál a három kézi ellenőrzés után új immutable naplóbejegyzés keletkezhet. Nem javasolt éles könyvtári rekordok átállítása pusztán a gomb próbájához.
5. Mobil (<=420px): ellenőrizd a kapu blokkolólistáját, checkboxait és az Authoring Kit linket.
6. Véletlen kettős jóváhagyás, hiányzó megerősítés, elavult SHA, hiányzó token/permission: biztonságosan utasítsa el, ne publikáljon.

A ZIP-en belüli teszt és izolált TS/TSX-szintaxisvizsgálat **nem** helyettesíti a helyi Next.js/Zod 4/build és böngészős ellenőrzéseket.

## Következő mérföldkő

Az egységes beszélgetéses **Yasuragi Authoring Asszisztens skill** az Authoring Kit alapján, majd a külön megtervezett, explicit és visszavonható *public release* munkafolyamat. Ne kapcsoljuk össze a publikus megjelenítést egy szerkesztői checkbox-szal.
