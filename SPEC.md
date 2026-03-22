# Kincstartó – SPEC v0

## 1. Cél

Az MVP célja egy belső (nem admin-felülethez kötött) rendszer a Kincstartó modulokhoz, amely:

- Activity logokat kezel (yoga / strength / acl / running)
- Spirit Library (spirit / könyvek) read-only felületet ad
- AI-t csak szerver-oldalon használ (nincs runtime függőség a felületeken)
- Determinisztikus adatforrásokra épül (DB + repo JSON)

---

## 2. Scope Lock

### IN (MVP-ben benne van)

- Activity logok kezelése `activity_logs` táblában
- Yoga naplózó felület
- Yoga Guru (tervezett) server-side ajánlás (D44)
- Spirit Library (D60): statikus JSON forrás + build-time validáció
- Spirit Library – Add Book with AI (modal flow)
- UI rendszer-szintű szabályok:
  - Mobil ellenőrzés <= 420px (D29)
  - Szöveg-színezés: globális tokenek + `UI_DESIGN_STOCK.md` (D19)

### OUT (MVP-ben nincs)

- Admin funkciók vagy admin-only felület
- Madarak / Places / Phenomena domain
- Képgenerálás, publish gate, publikálás
- Publikus/Explorer felület
- Promptolható UI
- Multi-role rendszer
- Külső adatforrás integráció (kivéve Spirit könyvkeresés az Add Book flow-ban)
- Analitika, közösségi funkciók, public journaling
- Chef modul

---

## 3. Entitások / Adatforrások

### 3.1 `activity_logs` (Supabase)

- Insert-alapú journaling; egy nap/tevékenység **több bejegyzést is** tartalmazhat.
- Oszlopok: `category`, `label`, `exercise_id`, `duration_minutes`, `distance_km`, `intensity`, `notes`, opcionális `metadata`, `created_by`, `created_at`.
- Kezelés: hitelesített `/api/activity-logs` GET/POST/PATCH/DELETE.

### 3.2 Spirit Library JSON

- Forrás: repo-ban tárolt JSON (`data/spirit/library.json`).
- Build-time validáció: egyedi id-k, themes/related referenciák, enum ellenőrzés.
- Kliens oldalon betöltött, read-only UI.

### 3.3 Statikus könyvtárak (Yoga/ACL/Strength/Running)

- A UI dropdownjai statikus meta-listákból és az előző logokból épülnek.
- A statikus rutinok/kártyák a repo-ban dokumentáltak (pl. `TICKETS/yoga/acl_stabilitas_erosito_program.md`).

---

## 4. Felületek

### 4.1 Yoga naplózó felület

- Nap kiválasztás + heti sor + havi rács vizuális visszajelzéssel.
- Négy aktivitás típus: yoga, strength, acl, running.
- Yoga dropdown a statikus könyvtárból + előző logokból épül.
- Új yoga lognál manuálisan megadható cím, időtartam, intenzitás, megjegyzés; mentés után bekerül a dropdownba.
- ACL és strength kártyák a statikus rutinlistákból jönnek; kiválasztás után log mentés történik.
- Running log opcionális `distance` és/vagy `duration` mezőkkel menthető.

### 4.2 Yoga Guru (tervezett)

- Külön felület.
- Server-side AI ajánlás több formában (template / link / kereső kulcsszavak).
- A kiválasztott javaslat mentése ugyanazzal az ActivityLog contracttal történik.

### 4.3 Spirit Library

- Read-only könyvtár-app egyetlen lokális JSON forrásból.
- UI: könyvgrid, filter/search toolbar, könyv overlay/modal, related books blokk.
- Mobil nézhetőség: <= 420px (D29) kötelező.

### 4.4 Spirit Library – Add Book with AI

- Modal flow a Spirit Library felületén (title + author + optional publisher).
- External search: OpenAI Responses web_search (`SPIRIT_SEARCH_MODEL`).
- Draft generation: OpenAI (`SPIRIT_AI_MODEL`).
- Duplicate checks: title+author, slug, fuzzy title.
- Draft review + edit before save.
- Atomic write `data/spirit/library.json` fájlba.

---

## 5. Modellhasználat

- Modellnév ENV-ből.
- Nem hardcode-olunk konkrét verziót.
- Spirit Add Book flow:
  - `SPIRIT_SEARCH_MODEL`
  - `SPIRIT_AI_MODEL`

---

## 6. MVP Kész Definíciója

Az MVP kész, ha:

- Activity logok létrehozhatók és szerkeszthetők
- Yoga UI végigvihető flow-t ad (napi logok + heti/havi nézet)
- Spirit Library megjelenik és szűrhető
- Add Book with AI flow képes új könyvet menteni a JSON-ba
- A UI mobil nézeten is használható (<= 420px), és minden UI változtatásnál ellenőrzött (D29)

---

## 7. Line endings policy

- The repo standard for Studio and Explorer sources is LF (line feed) endings only; .gitattributes now insists that .ts/.tsx/.css/.md/.json files are normalized to LF regardless of developer OS.
- Do not commit CRLF files; if Git keeps warning about CRLF, rerun git checkout -- <file> after updating core.autocrlf or syncing with the .gitattributes policy.