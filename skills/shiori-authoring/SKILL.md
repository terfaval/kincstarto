---
name: shiori-authoring
description: Gondozza a Kincstartó Shiori közös könyvkatalógusát a Shiori Unified Authoring adminból exportált shiori.startup.v1 JSON alapján. Használd könyvek bibliográfiai és szerkesztői javítására, ismertetők, témák, címkék, kapcsolódó művek, címkeszótár és olvasási utak ellenőrzésére vagy bővítésére, valamint importálható shiori.result.v1 JSON készítésére.
---

# Shiori Authoring

## Bemenet és feladat

Kérd a felhasználótól a **Shiori Könyvtárműhelyből exportált `shiori.startup.v1` JSON-t**. Ez az egyetlen hiteles aktuális katalógus-pillanatkép. Olvasd el az `instructions`, `library`, `baseSha` és `result_example` mezőket; ne helyettesítsd őket korábbi könyvlistával vagy a repóban található fallback katalógussal. A felhasználó mondja meg a szerkesztés fókuszát; ha nincs fókusz, ajánlj rövid auditot és prioritásokat, ne írj át mindent automatikusan.

## Munkafolyamat

1. Ellenőrizd a `format` értékét (`shiori.startup.v1`), az alapverziót (`baseSha`) és a katalógus könyvazonosítóit.
2. Végezz célzott tartalmi auditot: bibliográfiai pontosság; szövegek konkrétsága; tradíciók pontos megkülönböztetése; címkék jelentése és használata; kapcsolódó művek relevanciája; tematikus besorolások és olvasási utak koherenciája.
3. A javaslatokat egyeztesd a felhasználóval, különösen vitatható besorolások, új címkekulcsok, új könyvek és útvonalszerkezet esetén. Ne találj ki bibliográfiai tényeket. Külső kutatás esetén különítsd el a forrással igazolt tényeket a szerkesztői értelmezéstől.
4. Készíts egyetlen UTF-8 JSON-t, `format: "shiori.result.v1"`, a Startup `baseSha` értékével és kizárólag az indokolt változtatásokkal a `changes` alatt. Kövesd a Startup `instructions` és `result_example` szerződését.
5. Validáld a JSON szintaxisát, az azonosítók egyediségét, a könyv- és útvonalhivatkozásokat, az engedélyezett mezőket és az esetleges nem szándékos módosításokat. Adj rövid, magyar nyelvű változásösszefoglalót.
6. A felhasználó az adminban importál, előnézetet ellenőriz és hagy jóvá. A skill **soha nem publikál és nem importál közvetlenül**.

## Result-szerződés

A `changes` csak a következő kulcsokat használhatja: `books`, `tag_labels`, `thematic_pills`, `paths`. A `books` rekordok az `id` mellett csak a ténylegesen módosított mezőket tartalmazzák. A `tag_labels` kulcsonkénti részleges frissítés, `null` törlést jelent. A `thematic_pills` és `paths` elemek meglévő azonosító alapján teljes objektumként szerkeszthetők; a nem szereplő elemek változatlanok. Nincs könyvtörlés. **Személyes** `status`, `notes`, útvonal-`progress` és elem-`comment` soha nem kerülhet a Resultba. Ne változtass meg olvasási adatokat.

Kapcsolódó könyveknél ellenőrizd a hivatkozott ID-kat, a saját magára mutató kapcsolatokat és a megengedett elemszámot a Startup és a tényleges importáló szabályai alapján. Ha az importáló egy mezőt teljes listaként kezel, add vissza a szándékolt teljes listát, ne csak a hozzáadott elemeket.

## Minőségi elvek

A Shiori keleti filozófiai, vallási, irodalmi és pszichológiai könyvtár. Kerüld a felületes, mindent összemosó „spiritualitás” címkézést. Különítsd el például a taoista, zen, tibeti buddhista, indiai/védikus és jungi kontextusokat. A címkék legyenek újrafelhasználhatók és tartalmilag indokoltak. A `related` kapcsolatok ne pusztán azonos hangulatú műveket, hanem értelmes olvasói összefüggéseket jelöljenek. A leírások természetes, konkrét magyar nyelven készüljenek.

## Kimenet

Egyetlen importálható `shiori.result.v1` JSON-fájl és rövid változásjegyzék. Ha a felhasználó csak auditot kér, ne készíts importfájlt jóváhagyatlan módosításokkal. Ha a Startup hiányzik vagy elavult, kérj friss exportot.
