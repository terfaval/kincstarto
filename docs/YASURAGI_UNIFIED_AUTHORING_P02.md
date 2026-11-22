# Yasuragi P02 – unified authoring projekt és privát gyakorlástervezetek

**Hatókör:** 2026-11-22 tervezet, csak admin, nincs automatikus könyvtári írás vagy publikálás. A legfrissebb forrás-ZIP alapján készült; a helyi build és a böngészős vizsgálat még külön ellenőrzendő.

## Felhasználói cél

Egy gyakorlást egyetlen együttműködő alkotói folyamatban lehessen megírni. Ha a lejátszásához új póz kell, ugyanabban a projektben lehessen elkészíteni a teljes PoseSchema-kompatibilis adatlapot és az illusztrációs briefet. Az admin jelenítse meg a hiányzó könyvtári függőségeket, és őrizze meg változatlanul a tervezetverziókat. A felhasználó külön ellenőrzéssel importálhatja a pózokat, rendelhet hozzájuk jóváhagyott képeket, majd próbálhatja ki a gyakorlatot.

## Admin-felület

- `/admin/yasuragi/practices`: JSON-ellenőrzés, privát mentés, listázás, mentett projekt megnyitása, pose draft JSON letöltése és átvezetés a könyvtárkezelőhöz.
- `/admin/yasuragi?draft=<immutable-id>`: közös P01 motorral végzett próbalejátszás, csak ha a szükséges aktív könyvtári pózok/útvonalak feloldhatók.
- `/admin/yogis-choice`: meglévő tudásbázis-szerkesztő; az új pózok szakmai ellenőrzése és képi asset-kezelése külön folyamat, nem automatikus írás.
- `GET /api/admin/yasuragi/practices`: privát tervezetek listája.
- `GET /api/admin/yasuragi/practices?draft=<id>`: egy privát tervezet és **frissen újraértékelt** könyvtári függőségek.
- `POST /api/admin/yasuragi/practices` `{ "action": "preview"|"save", "source": {...} }`: csak admin, max. 600 KB kérés, előbb validálás, majd új immutable verzió. `save` soha nem ír át régi rekordot.

## Formátumok

### 1. Önálló gyakorlásscript (visszafelé kompatibilis)

`yasuragi.practice.v1`, `status: draft`. A v8-as design fixture **nem** az importformátum; a P02-höz külön minta jár.

### 2. Egységes authoring projekt

```json
{
  "format": "yasuragi.authoring.v1",
  "status": "draft",
  "projectId": "foldon_dolgozas",
  "practice": { "format": "yasuragi.practice.v1", "status": "draft" },
  "poseProposals": [
    {
      "poseId": "pose_supported_side_sit",
      "record": { "id": "pose_supported_side_sit", "status": "draft" },
      "illustration": { "brief": "Pontos anatómiai és vizuális feladat, később jóváhagyandó." }
    }
  ]
}
```

A fenti rövid JSON **alakot mutat**, nem importálható minta: a `practice` teljes script és a `record` teljes `PoseSchema` objektum legyen. **Működő mintafájl:** `data/yasuragi/foldon-dolgozas-p02-unified-authoring-sample.json`.

- A `poseProposals` legfeljebb 32 teljes könyvtári póztervezetet tartalmazhat.
- Minden javasolt póz csak `status=draft`, `content_status=draft`, `validated=false`, `mannequin_angled.status=missing`, `asset_ref=null` lehet. Kép-URL-t nem tekintünk automatikusan ellenőrzött assetnek.
- A vázlat nem importálja automatikusan a pózt és nem készít automatikusan képet.
- A hiányzó, de **szabályosan hivatkozott** pózok virtuális helykitöltőt csak a gráf **szerkezeti ellenőrzéséhez** kapnak. Ez nem elérhető póz a lejátszó számára.
- `report.ok` = strukturálisan menthető; `report.previewReady` = a jelenlegi könyvtárral próbalejátszásra alkalmas. A kettő szándékosan eltérhet.
- A blokkolt útvonalak továbbra sem aktiválódnak. A publikálási gate későbbi P03 feladat; ma minden mentés csak tervezet.

## Egyesített függőségek és következő feladatok

A P02 report soronként osztályozza a hivatkozott pózokat: `ready`, `review_needed`, `image_missing`, `proposal_pending`, `missing`. A konkrét pózfelvételi és ábrázolási feladatok együtt jelennek meg a project detailben. Hiányzó eszközazonosító külön warning marad.

**A későbbi P03–P05 célfolyamat:** az admin saját projektképernyőjén belüli pózjavaslat-ellenőrzés és import, képfeltöltési/jóváhagyási munkalépések, automatikusan újraszámolt blokkerek, szerkesztői előnézet, változatjóváhagyás, végül publikálás. Az egyetlen Yasuragi Unified Authoring asszisztens ugyanilyen formátumban állítja majd elő a teljes projektet a hivatalos Authoring Kit alapján. Ne építs külön, egymással versengő skillt minden részfeladatra.

## Tárolás és biztonsági korlát

- A P02 külön privát tervezetstore-t használ. Production környezetben az izolált `YASURAGI_PRIVATE_BLOB_TOKEN` hiányában nincs mentés; lokálisan `private/yasuragi-practice-drafts` alatti, `.gitignore` által kizárt fájlok készülnek.
- Kód csak `requireAdmin` után olvas/ír. Cache-control private/no-store. A projekttartalom nem kerül publikus fájlba.
- A mentett objektum SHA-256 ellenőrzése a teljes `{script,authoring}` tartalomra kiterjed; a régebbi, csak-script objektumok régi ellenőrzőösszege olvasható marad.
- Egy korábban elmentett pózjavaslatot importálás előtt össze kell vetni a könyvtár élő azonosítóival, mert az azonosító időközben létrejöhetett. A meglévő könyvtár save endpointja tud felülírni, ezért a P02 csak **exportál**, automatikusan nem hívja.
- Szerkezeti ellenőrzés nem helyettesít jógatanári, anatómiai és illusztrációs szakmai jóváhagyást.

## Ellenőrzés és kézi QA

- `node --experimental-strip-types --test scripts/test-yasuragi-player.mjs`
- `node scripts/test-yasuragi-p02.mjs` – a repo ZIP-jéből kihagyott Zod helyett célzott tesztdupla; a valódi sémát a helyi telepített függőségekkel kell ellenőrizni.
- `npx.cmd tsc --noEmit`, `npm.cmd run build` a telepített lokális Kincstartóban.
- Böngészőben (mobil 420px alatt is): JSON előnézet, mentés, draft újranyitás, póztervezet letöltés, tiltott ág, két nézet egy session, saját időtartamú importált script és jogosulatlan hozzáférés megtagadása.
