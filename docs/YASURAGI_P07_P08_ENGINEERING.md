# Yasuragi P07–P08 — admin munkafolyamat és helyi kiadásbiztonsági kapu

**Hatókör:** 2026-11-22, a feltöltött `kincstarto-main.zip` és a már sikeresen ellenőrzött P06 célzott overlay alapján. A felhasználó a P01–P06-ot a `89f64de` commitban rögzítette. E patch **nem** publikál, nem migrál, nem tölt fel és nem töröl Blob-objektumokat.

## P07 — kézi szerkesztés automatizált műszaki segédlete

- Az admin `/admin/yasuragi/practices` kiválasztott tervezetéhez a rendszer sorrendezett **következő lépések** listáját számolja a már szerveroldalon kiértékelt `PublicationGate`, változat-/könyvtárhash-hoz kötött review-nyugta és a kiadástároló aktuális állapota alapján.
- Az eredmény különbözteti meg a hiányzó könyvtári függőséget, elmaradt/lejárt kézi signoffot, kiadástároló-hibát, explicit kiadásra váró projektet és egy publikus, de elavult pillanatképet.
- A **Műszaki státuszjelentés exportálása** egy `yasuragi.workflow-report.v1` JSON-fájlt készít a böngészőben, összegző adatokkal, kapu- és revízióslenyomattal, valamint feladatlistával. Nem kerül bele a gyakorlásscript, a privát szerkesztői szöveg vagy tárolótoken.
- Ez **tanácsadó pillanatkép**, nem jóváhagyás. A valódi API minden későbbi kiadásnál újraolvas és ellenőriz. Nem történik automatikus képi/szakmai validálás, signoff vagy publikálás. A szerkesztői workflow meglévő explicit műveleteit nem kerülheti meg.

## P08 — egyetlen regressziós parancs és privát helyi adat-audit

Futtatás a telepített repóban:

```powershell
node scripts/yasuragi-p08-release-gate.mjs --quick
node scripts/yasuragi-p08-release-gate.mjs --full
```

- `--quick`: P01–P07 fókuszált Node tesztek, P02, P04 és a helyi privát adat-integritási audit. Nem változtat publikált adatot.
- `--full`: ugyanez + `npx tsc --noEmit` és `npm run build`. Ez **helyi kódbuild**, nem Vercel-deployment. Az új `.next` buildfájlok létrejöhetnek.
- A `scripts/yasuragi-p08-local-audit.mjs` **csak helyi** `private/` adatot olvas. Ellenőrzi a tervezetek és jóváhagyások JSON-struktúráját/lenyomatát, valamint az immutable kiadási pillanatképeket, kiadásfejléceket és egyező SHA-256-okat. A régi vagy egy félbeszakadt CAS által hátrahagyott pillanatképeket külön jelzi; semmit nem töröl.
- Üres `private/` esetén az eredmény **`NO_LOCAL_DATA`**, nem Blob PASS. A Vercel privát Blobhoz nem kapcsolódik, így nem vizsgálja az éles tervezeteket és kiadásokat.

### Helyi backup integritásellenőrzése (nem éles Blob backup)

A tartalom másolása előtt létrehozható egy külön SHA-256 manifest egy **privát, Git-en kívüli** könyvtárban:

```powershell
node --experimental-strip-types scripts/yasuragi-p08-local-audit.mjs --manifest-out C:\yasuragi-private-backup\before.json
```

A `private/` alkönyvtárakat másold le hozzáférésvédett offline mentési helyre. Másolás után a másolt könyvtárból külön ellenőrizhető az azonosság:

```powershell
node --experimental-strip-types scripts/yasuragi-p08-local-audit.mjs --root C:\yasuragi-private-backup\private --verify-manifest C:\yasuragi-private-backup\before.json
```

A `before.json` csak fájlútvonalakat és hash-eket tartalmaz, nem teljes tervezeteket. A manifest létrehozásakor az eredeti célkönyvtárnak léteznie kell; a script nem írja felül a meglévő manifestet. A **teljes restore-próba** és a Vercel Blob független export/restore továbbra is P08 nyitott feltétel. Üres helyi könyvtár exportálását ne tekintsd valódi adatmentésnek.

## Ellenőrzés, elfogadás és nyitott feladatok

1. `node scripts/yasuragi-p08-release-gate.mjs --full` a helyi telepített Kincstartó repóban; a forrás-ZIP nem tartalmazza a `node_modules` könyvtárat.
2. UI ellenőrzés adminon: blokkolt, kézi jóváhagyásra váró, érvényes és elavult kiadás állapot; exportált jelentés nem tartalmaz privát scriptet. Mobilon max. 420 px.
3. A publikus `/yasuragi` katalógus, egy érvényes gyakorlás részletei, indítás, szünet és visszavonás ellenőrzése megengedett tesztadattal; valódi kiadást nem aktivál a patch.
4. Backup: privát tárolók független exportja + sértetlenség-ellenőrzés + **helyreállítási próba** eldobható környezetben. A helyi manifest önmagában nem adatmentés.
5. Blob-környezeti elkülönítés és tényleges production/preview környezeti próba nélkül nem állítható, hogy P08 élesüzemi elfogadása lezárult.

**Módosított fájlok:**
- `src/features/yasuragi/components/YasuragiPracticeAdmin.tsx`
- `src/features/yasuragi/lib/practice-workflow.ts`
- `scripts/yasuragi-p08-local-audit.mjs`
- `scripts/yasuragi-p08-release-gate.mjs`
- `scripts/test-yasuragi-p07-p08.mjs`
- `docs/YASURAGI_P07_P08_ENGINEERING.md`
