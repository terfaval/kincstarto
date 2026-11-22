# Yasuragi P06 — privát kiadási kapu és publikus gyakorláskatalógus

**Állapot:** fejlesztői patch, production élesítés nélkül · **Forrás:** 2026-11-22-i feltöltött `kincstarto-main.zip`.

## Felhasználói folyamat

1. A Kincstartó főoldal Yasuragi pontja a `/yasuragi` **publikus katalógust** nyitja meg; nem indít lejátszót. Ha nincs aktív, érvényes kiadás, üres állapot jelenik meg, nem próbatervezet.
2. Egy kiválasztott kártya a `/yasuragi/<practiceId>` részletező oldalra vezet. Ott időtartam, cím, verzió és **Indítás** gomb látható.
3. Az Indítás a `/yasuragi/<practiceId>/play` felületet nyitja meg. A lejátszó **megállítva, 0:00-nál** indul; maga az óra csak a Play gomb megnyomásával kezd haladni.
4. A publikus lejátszóban nincs admin debug-panel, időugró és fixture. A teljes/mini T/M és a pózválasztó a meglévő motoron fut. Az admin `/admin/yasuragi?draft=...` próbafelület érintetlenül megmarad.

## Kiadás és visszavonás

- Kizárólag admin jogosultságú, azonos eredetű POST kérésből. A publikálás **külön**, kifejezett UI-megerősítéssel történik; tervezet/import/jóváhagyás önmagában soha nem publikál.
- Publikáláskor a szerver egyetlen élő könyvtárbetöltésből számolja újra a struktúrát, a teljesen jóváhagyott kötelező pózokat, a könyvtári lenyomatot és a kiadáshoz szükséges képeket. A legfrissebb szerkesztői jóváhagyási bizonylatnak **ugyanahhoz** a mentett tervezethez és élő könyvtárlenyomathoz kell tartoznia. Az API `expectedSha256` és `expectedLibrarySha256` értékeket is ellenőriz.
- A kiadási pillanatkép immutable, külön revízióazonosítóval, a jóváhagyott T/M/E scripttel, a megfelelő **publikusan elérhető** képhivatkozásokkal és a könyvtár SHA-256 lenyomatával. Nincsenek benne privát tervezet- vagy adminnapló-rekordok.
- Az aktuális `/publication-heads/<practiceId>.json` privát pointerre CAS (Blob: `ifMatch`/`allowOverwrite:false`, helyben: per-ID zár és atomikus átnevezés) érvényes. Ütközés HTTP **409**; bizonytalan tárolóeredmény HTTP **503**, automatikus újrapróbálkozás nélkül. A kész, de nem aktivált revízió CAS-verseny után ártalmatlan orphan maradhat.
- Visszavonás csak a megnyitott aktuális release ID-t fogadja el; a pointer `revoked` állapotra vált. A katalógus és a közvetlen URL azonnal újraellenőrzi a pointert; nincs kiszolgált privát tervezet vagy automatikus visszaállítás.
- Ha egy szükséges élő ászanarekord megváltozik, vagy elveszti a szakmai/képi jóváhagyását, az eredeti kiadás **nem érhető el nyilvánosan**. A publikus kiszolgálás a kiadás rögzített könyvtárlennyomatát a jelenlegi könyvtárhoz ellenőrzi. Az admin kiadási állapota jelezheti, hogy a pointer technikailag aktivált, de az elérés a friss jóváhagyásig tiltott.

## Tárolás és környezeti változók

- **Fejlesztői gépen:** `private/yasuragi-publications/heads/` és `private/yasuragi-publications/releases/` alatti lokális JSON-fájlok; a `private/` eleve szerepel a `.gitignore` fájlban.
- **Production:** szükséges egy **külön Vercel Private Blob Store**, amelyhez a szerver `YASURAGI_PUBLICATION_BLOB_TOKEN` read-write tokent kap. Ez **nem egyezhet meg** `YASURAGI_PRIVATE_BLOB_TOKEN`, `BLOB_READ_WRITE_TOKEN` vagy `SHIORI_PRIVATE_BLOB_TOKEN` értékével. A P05c eldobható tárolója nem használható éles kiadási tárolónak.
- Hiányzó production token esetén a publikus katalógus biztonságos hibaállapotot mutat, a kiadási API nem enged mentést. Nincs éles–lokális visszaesés vagy tárolók összekeverése.
- A Blob-tároló privát; a publikus weboldalak kizárólag a szerveren ellenőrzött kiadásokból kapnak adatot. A meglévő, admin-védett `/api/yogi-knowledge/image-proxy` nem válik nyilvánossá: a jóváhagyott publikus Blob-képek közvetlen, szigorúan engedélyezett URL-je kerül a release-be.

## Műszaki elfogadási terv

1. `scripts/test-yasuragi-p06.mjs`: kontrollált pure, lokális end-to-end és mock Blob CAS tesztek; hozzáférés-, kép-, érvénytelenítés- és publikálási határtesztek.
2. Korábbi P01–P05 regressziók; teljes `npx tsc --noEmit`, `npm run build`, `git diff --check` a felhasználó helyi repójában.
3. Indítás után `/yasuragi` még **üres**, amíg egy konkrét gyakorlást külön nem publikálnak. A jelenlegi, nem szakmailag validált pózokhoz **nem szabad jóváhagyást kényszeríteni** a teszt kedvéért.
4. Production publikálási próbát csak dedikált **nem éles** kiadástárolóval és szakmailag jóváhagyott, tesztnek szánt tartalommal; a tényleges éles aktiválás külön döntés.
5. Mobil 420 px: katalóguskártyák, részletek/Indítás, teljes/mini lejátszó, belső admin-panel és visszavonás; teszt véletlen kimaradt vagy blokkolt ágak esetén is.

## Korlátok és következő lépések

- A publikus katalógus kis és közepes kiadásszámnál az aktív fejléceket és kiadási revíziókat szerveroldalon listázza. Nagy, több ezres katalógushoz külön lapozható keresőindex/gyorsítótár javasolt.
- Az immutable release mellett a műveletekhez tartozó, önálló, név szerinti admin auditnapló és későbbi kézi rollback/migráció P07/P08 terület lehet. Most csak explicit újrapublikálás vagy visszavonás történhet.
- A P06 implementáció nem helyettesíti az ászanák szakmai validációját, böngészős próbáját, a valós privát Blob tároló ellenőrzését vagy a teljes buildet. Nincs automatikus élesítés.
