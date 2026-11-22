# Shiori — esti vezérlők és Tamayura-visszalépő

**Forrás:** `kincstarto-main(9).zip` (a korábbi Polish 03 változatát már tartalmazza).
**Változás határa:** kizárólag Shiori UI, nincs adatmodell-, import-, API- vagy privát tároló módosítás.

## Jóváhagyott változtatások

1. **Éjszakai Shiori gombok:** sötét, tintakék, enyhén áttetsző háttér; meleg törtfehér feliratok, placeholder és ikonok. Ide tartozik a kereső, a szűrő és a keresési visszalépő. A gerincessor saját lapozógombjai továbbra is az előző, sötét éjszakai szabályt használják. A nappali gombok változatlanul világosak.
2. **Bal felső visszalépő:** a Tamayura (`/meditations`) tényleges `backLink`, `backIcon`, `backLabel` CSS-modulját használja. A kapszulás „‹ Kincstartó” helyett szabadon álló `‹` látható; rámutatva a „VISSZA” felirat jelenik meg. Azonos útvonal: `/`. A Shiori nappali képen a jel/felirat sötétebb tintaszínt kap, éjjel ugyanolyan világos, mint a Tamayurán. A klaviatúrás fókusz is megmutatja a feliratot.
3. **Nem változik:** kategória-/útvonalnavigáció, egész gerinces lapozás, kiválasztás, mobil könyvlista, könyvadatlap, admin, négy master-háttér és az összes személyes adatot érintő folyamat.

## Ellenőrzés

- Éjszakai `/library`: a kereső és a Szűrők gomb sötét, a keresőikon/placeholder világos, olvasható. A gerincessor lapozógombjai sötétek.
- Nappali `/library`: a vezérlők világos papírhatásúak, a visszanyíl sötét és kontrasztos.
- Visszanyíl: hoverre és billentyűzetes fókuszra „VISSZA”; kattintásra `/`.
- `/meditations`: változatlan megjelenés és működés.
- Desktop és <=420px mobilnézet: nincs átfedés a visszanyíl és a fejléc között, nincs vízszintes kilógás.

**Nem történt böngészős vagy teljes build-teszt a ZIP készítésekor; ezeket a helyi futtatásban kell ellenőrizni.**
