# SHIORI-05B/2 — privát Blob-szerviz ellenőrzése a Vercel futtatókörnyezetében

## Miért kell ez a kör?

A Vercel által létrehozott `SHIORI_PRIVATE_BLOB_READ_WRITE_TOKEN` Production/Preview **Secret**. A `vercel env pull --environment=production` nem adja vissza a titkos értéket, így a helyi, valódi Blob-tokenes ellenőrzés nem végezhető el a letöltött env fájlból. A 05B/1 helyi `--check` általános hibája ezért önmagában nem jelenti, hogy a privát tároló hibás.

## A patch

Új, **csak GET** végpont: `/api/admin/spirit/private-preflight`.

- Kötelező admin-munkamenet (`requireAdmin()`), a meglévő `proxy.ts` védelme mellett.
- Kizárólag `get`, `head`, `list`: **nem használ `put` vagy `del` műveletet**.
- A 05B/1 `preflight()` ellenőrzését hívja változatlanul, a **Vercel runtime valódi környezeti változóival**.
- A válasz csak számlálókat, SHA-256-ot, állapotjelzőket és szükség esetén a hibás ellenőrzési **szakaszt** tartalmazza. Se tokent, se Blob URL-t, se nyers JSON-t, se személyes jegyzetet nem ír ki.
- 503 esetén `PREFLIGHT_STOPPED` + `stage`; a hiba nem kapcsol ki biztonsági vizsgálatot.
- `Cache-Control: private, no-store`; nem teszi nyilvánossá az adminadatokat.

## Előfeltételek

1. A `shiori-reading-private` tároló `Private` státuszú (ezt a Vercel dashboard mutatja).
2. A két külön tároló Production tokenje jelen van; a régi `BLOB_READ_WRITE_TOKEN` változatlan.
3. A SHIORI-05A és 05B/1 kódja a repo része.
4. A patch tesztjei és a helyi build sikeresek.
5. A route **csak új Vercel-deploy után** érhető el. A patch elkészítése és helyi tesztje nem deploy.

## Használat, külön jóváhagyott deploy után

Az éles Kincstartóban adminként bejelentkezve nyisd meg az alábbi útvonalat a böngészőben:

`/api/admin/spirit/private-preflight`

Várt sikeres mezők: `ok: true`, `mode: READ_ONLY`, `separatedStoreTokens: true`, `catalogBooks: 86`, `catalogPaths: 8`, `privateObjectExists: false`, `action: NO_WRITES`.

Egy üres privát store-nál a `privateAccessVerifiedFromExistingObject: false` normális; a Private módot a dashboardon kell ellenőrizni.

Hiba esetén `stage` érték segít elhatárolni a gondot, de nem adja ki a tokent vagy a nyers választ. Ne oszd meg a teljes könyvtári exportot vagy a hozzáférési kulcsokat.

**Ne futtasd a migrációs `--apply` műveletet, ne állítsd be a `SHIORI_PRIVATE_STATE_READY=1` kapcsolót, és ne módosítsd a publikus Blob tokenjét.** A következő kör 05C előbb külön, ellenőrzött migrációs terv.
