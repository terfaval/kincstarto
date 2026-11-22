# Yasuragi P04.1 — Authoring Kit exportjavítás és diagnosztika

## Jelenség

`GET /api/admin/yasuragi/authoring-kit` általános 503-as válasszal leállt: „Az Authoring Kit nem készíthető el az aktuális ászanatárból.” A korábbi végpont egyetlen catch-ben kezelte a könyvtárolvasás, a katalógusprojekció és a Zod JSON Schema konverzió hibáit.

## Célzott változtatások

- A kitkészítő hiánytűrően olvassa a régi pózrekordok `mannequin_angled` mezőjét; hiány esetén `imageStatus: "missing"` és `hasIllustration: false`. Nem állít jóváhagyást vagy képelérhetőséget.
- A GET végpont külön kezeli és címkézi a könyvtárbetöltés (`YAS_P04_LIBRARY_READ`), a katalógusprojekció (`YAS_P04_KIT_BUILD`), a teljes PoseSchema export (`YAS_P04_POSE_SCHEMA`) és a JSON-válasz (`YAS_P04_RESPONSE`) hibáit.
- Nem módosulnak az import, mentés, publikálás, approval, Shiori vagy más Kincstartó funkciók.
- A böngésző nem kap stacktrace-t, szerveroldali adatot vagy kivételüzenetet. Helyi fejlesztésben a `[Yasuragi P04.1]` prefixű napló segít az ok azonosításában.
- A tényleges `PoseSchema`-t exportáljuk, nem lazítjuk a szabályokat automatikusan.

## Próbamenet

1. Patch alkalmazása, `node --experimental-strip-types --test scripts/test-yasuragi-p04-1.mjs`, `npx.cmd tsc --noEmit` és `npm.cmd run build`.
2. Dev szerver, majd az admin „Authoring Kit letöltése” művelete vagy a `/api/admin/yasuragi/authoring-kit` megnyitása.
3. Sikernél `yasuragi.authoring-kit.v1` JSON érkezik `poses`, `equipment`, `poseSchema`, `exampleProject` kulcsokkal.
4. Ha kódolt hiba marad, annak neve megmondja, melyik részben kell célzottan vizsgálódni. A Next.js terminálban megjelenő `[Yasuragi P04.1]` napló alapján lehet folytatni. Titkokat ne ossz meg.

## Korlátok

A hibás képslot reprodukálható volt célzott tesztben; a felhasználó élő könyvtárának pontos kivétele nem áll rendelkezésre. A patch ezért javítás és diagnosztika is; a teljes böngészős sikert csak helyi próba igazolhatja.
