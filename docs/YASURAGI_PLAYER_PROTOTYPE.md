# Yasuragi – belső lejátszóprototípus (P01)

**Állapot:** implementált kódjavaslat, felhasználói böngészőteszt és szakmai jóváhagyás előtt. Nem publikus Yasuragi-modul és **nem** végleges admin-import.

## Bejutás és adatok

- Bejelentkezett admin: `/admin/yasuragi` (az `src/app/admin/layout.tsx` meglévő adminvédelmén keresztül).
- A teljes 60 perces, 15 csomópontos **v8 design-fixture** változatlanul szerepel a `data/yasuragi/foldon-dolgozas-prototype.json` fájlban, **nem** éles adatbázistartalomként.
- A server page a `getYogiKnowledgeStore().listPoses()` aktuális pózait olvassa, csak a scripthivatkozásokhoz szükséges adatokat és a meglévő biztonságos képfeloldót adja át a kliensnek. Nem ír a pózkatalógusba.
- Az aktuális 72 rekordos repóban a `pose_seated_side_stretch` nem szerepel: a P4A opcionális lapozási lehetőségét a prototípus elrejti, de az alappóz marad. Hiányzó könyvtári képnél helykitöltő van. A `P4B-S` ág **blokkolt**, és a `D2B` egyopciós választása csendes átvezetéssé alakul. A jelenlegi pózrekordok `validated` mezője miatt nem állítható szakmai jóváhagyás.

## Funkciók

- Egyetlen aktív óra, `performance.now()` alapú aktív időszámítás, valódi pause/resume és visszatéréskor az aktuális idő feloldása; nincs elmaradt M-eseményekből képzett sor.
- Teljes nézet: a script által korlátozott egyképes pózpool, pózfüggő T/E, rövid M, a tudásbázis részletes gyorssúgója.
- Mini: 300 × 300 körüli méret, egyetlen T/M szöveghely, T-bevezető elsőbbség, M megjelenési ablakok, szándékos csend. Döntésnél két képes opció, ha mindkettő elérhető.
- Támogatott böngészőben Document Picture-in-Picture ablak; támogatás vagy engedély hiányában **csak az aktuális lapon** megjelenő mini. Ez utóbbi nem lebeg más alkalmazások fölött.
- Tesztugrások (00:00, 29:30, 35:30, 42:00), időcsúszka, ágak kiválasztása és tesztállapot nullázása. A próba alapállapota a P3-nál, 29:30-nál indul szüneteltetve.
- Hang és background audio **nincs**; mobil és böngészőfüggő PiP viselkedés csak valódi eszközön ellenőrizhető.

## Várt kézi tesztek

1. Nyisd meg admin fiókkal az `/admin/yasuragi` oldalt. A P3 alap Sukhasanája jelenik meg a libraryből.
2. Indítsd; 29:30 után a mini először T-t, majd M-et mutat. 30:30-kor csendes szöveghelynek kell lennie.
3. Pózlapozás 31:50-kor: Dandasana-kép, T és E változik; az M csak a még érvényes ablakban jelenhet meg.
4. Ugrás D2-re 35:30: két képes választható irány, legutóbbi kiválasztás érvényes. 36:00-kor a kijelölt vagy alapértelmezett ág folytatódik.
5. Válaszd D2-n a csípő–láb ágat, utána 42:00-kor D2B: a blokkolt oldalülés nem kínálható fel.
6. Pause közben az idő és a döntési ablak áll. A teljes és a mini nézet ugyanazt a route-ot és pózt mutatja.
7. Dokumentáltan engedélyezett Chrome/Edge környezetben próbáld a PiP-t; egyébként csak in-page mini.
8. A böngészőfül háttérbe tétele után ne torlódjanak fel M-üzenetek.
9. Keskeny mobilnézet és billentyűzetes használat vizsgálata.

## Még nem része

Importálás, adatbázis-/Blob-írás, Authoring Kit, admin jóváhagyás, éles publikálás, hang, többablakos visszatöltés/persistencia, jóga-szakmai validálás, új Yasuragi-illusztrációk.

A meglévő `src/app/page.tsx` Yasuragi gyöngye szándékosan **nem** kapott publikus href-et ebben a patchben.
