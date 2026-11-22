# SHIORI-05E/1 — helyi státuszikon-előnézet

## Miért nem jelent meg eddig localdevben?

A kiemelt borítón megjelenő ikon a `canManagePrivate` jogból indul ki. Ez a szerveroldalon csak akkor igaz, amikor az admin a `SHIORI_PRIVATE_STATE_READY=1` mellett valóban betölti a külön privát Blob-ot. A Vercel Production/Preview Secretje nem érhető el automatikusan a helyi `npm run dev` folyamatban. A publikus JSON nem tartalmazhat olvasottsági státuszokat.

## Mit tesz az új patch?

- A `NODE_ENV=development` mellett, **kizárólag a hitelesített** `/admin` oldalon, **kizárólag ha nincs aktív privát olvasó**, megjelenít egy **vizuális státuszikon-mintát** a kiemelt borítón (desktop és mobil).
- A mintát a könyvazonosítóból determinisztikusan választja ki: üres kör, könyv, pipa, könyvjelző. Az ikon nem a felhasználó valódi olvasottságát jelzi. Borító-tooltip: „Helyi státuszikon-minta, nem valódi olvasottság”.
- A **privát szerkesztés letiltva marad** a mintanézetben. Sem privát Blob-token, sem adatmozgatás, sem új környezeti változó, sem mentés nem szükséges. Az admin `status`/`notes` mezők valódi változata localdevben továbbra sem tölthető be hozzáférés nélkül.
- Production és Preview környezetben nem létezik ez az előnézet. A valódi privát olvasó aktív állapotában mindig a hiteles privát státusz dönt; a publikus `/library` oldalon soha nincs ikon.

## Helyi ellenőrzés

1. A patch fájljait másold be a friss repóba.
2. Ha az `.env.local` fájlban szerepel `SHIORI_PRIVATE_STATE_READY=1` **valódi helyi privát hitelesítés nélkül**, vedd ki onnan. A Vercel Production beállítását ne módosítsd.
3. Indítsd újra a `npm.cmd run dev` parancsot. Hitelesített helyi adminban nyisd meg `http://localhost:3000/admin`, válassz könyvet: jobb felső ikon és egérre „Helyi státuszikon-minta…” tooltip jelenik meg.
4. Nyisd meg `http://localhost:3000/library`: nincs ikon és nincs belső adat; mobilnézetben is ellenőrizhető.
5. A fejlesztői előnézet csak **vizuális minta**, nem a 94 élő könyv státuszainak tükrözése.

Csak a helyi teszt és megjelenítés ellenőrzése szükséges; Vercel Preview-deployment nem indokolt.
