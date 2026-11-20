# Kincstarto SEC-01 — admin hozzaferes lezarasa

Alap: `kincstarto-main.zip` (2026-11-20-i fejlesztoi atadas szerint). Ez egy celzott forraspatch, nem teljes repo es nem telepitett kiadas.

## Valtoztatasok

- Fail-closed minden admin belepesre: hianyzo `ADMIN_KEY` es `ADMIN_PASSWORD` eseten admin-jogosultsag soha nem keletkezik.
- Signed HMAC-SHA256 `kinc_admin_session` cookie; korabbi nyers `admin_key` cookie nem ervenyes, login/logout torli. HttpOnly, SameSite=Lax, Secure production alatt. Normal session 1 nap, `remember` 30 nap.
- Kozos sessio-ellenorzes a proxyban, az admin oldal layoutban, es minden admin API-ban.
- A `/yogis-choice` csak adminnak elerheto; admin eseten atiranyit `/admin/yogis-choice`-ra. A /yogis-choice/poses/[slug] csak adminnak, beleertve metadata lekerest.
- A korabban nyilvanos `/api/yogi-knowledge/*` es `/api/yogis-choice/*` GET vegpontok admin vedelmet kapnak. A `/api/debug` is vedett.
- A modosito admin API-k `Origin`-ellenorzest kapnak; idegen es hianyzo Origin esetben 403. A kep-proxy vedett, nem kovet atiranyitast, nem cache-el publikus valaszkent.
- A jelenlegi nyilvanos Shiori `/library` es Tamayura `/meditations` utvonalakat nem modositja.

## Telepitesi elofeltetelek

- A lokalis rendszerben legyen beallitva `ADMIN_EMAIL`, `ADMIN_PASSWORD`; ajanlott egy eros, kulonallo `ADMIN_KEY` szerver oldali kornyezeti valtozo is.
- NE tegyel ilyen ertekeket a repoba, javitocsomagba, vagy commitba.
- A korabbi admin cookie-k miatt patch utan ki kell jelentkezni / ujra be kell jelentkezni. A regi nyers `admin_key` nem fogadott el.
- A bejelentkezes es az admin POST/PUT/PATCH/DELETE API-k ugyanazon originen legyenek. Kerdeses proxy setupnal a hiba (`403 Forbidden origin`) eloszor origin/proxy konfiguracio ellenorzeset igenyli; ne kapcsoljuk ki a vedelmet.

## Celszeru ellenorzesek a bemasolas utan

```powershell
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath 'C:\kincstarto'

# Teljes TS, lint es build (meglevo fuggosegek mellett)
& .\node_modules\.bin\tsc.cmd --noEmit
if ($LASTEXITCODE -ne 0) { throw 'TypeScript hiba' }
npm.cmd run lint
if ($LASTEXITCODE -ne 0) { throw 'Lint hiba' }
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Build hiba' }

# Node >= 22 esetben a signed session unit tesztek:
node --experimental-strip-types --test scripts/qa/admin-session.test.mjs
if ($LASTEXITCODE -ne 0) { throw 'Session unit teszt hiba' }
```

Futtasd a Next.js fejlesztoi szervert egy masik terminalban (`npm.cmd run dev`), majd:

```powershell
node scripts/qa/verify-sec01.mjs http://localhost:3000
if ($LASTEXITCODE -ne 0) { throw 'Anonim route QA hiba' }
```

**Kezi admin QA**: friss bejelentkezes a `/login` oldalon; admin eseten `/admin/yoga` es `/admin/yogis-choice` nyilik; adatbetoltes, modositas, kijelentkezes; kijelentkezes utan admin route-ok es API-k tiltva. Ellenorizd a normal eszakai/nappali Shiori es Tamayura publikus mukodeset is. Kulon probald admin key nelkul zart staging/dev instancen.

## Nyitott kockazatok / nem resze ennek a patchnek

- Rate limit / IP-alapu brute force vedelmet megbizhato serverless kornyezethez kesobb kulso tarolas vagy edge/WAF oldali beallitas igenyli. A jelen kod ezt NEM vezeti be.
- A stateless sessio kijelentkezeskor torli a cookie-t, de egy korabban ellopott, meg le nem jart token szerveroldali azonnali visszavonasara nincs session denylist. `ADMIN_KEY` csere minden regi sessiont ervenytelenit.
- Nem teljesit vegleges tobb-felhasznalos auth/rate limit/persistence architekturat; Kagami kulon auth terv.
- Nem modositja a szimbolumokat, a fomenut, a jovahagyott copyt, a Shiori- es Tamayura-adatokat.

## Ellenorzesi statusz az atadas pillanataban

- Admin session unit tesztek: 3/3 sikeres (Node 22 local).
- Modositott TS/TSX: szintaktikai transpile ellenorzes 27/27 sikeres.
- Next.js teljes typecheck/build/valodi HTTP teszt: jelenlegi izolalt kontenerben a `npm ci` idokorlatba futott; **meg nem ellenorzott**. Futtasd a lokalis gepen.
