# Kincstartó – Döntésnapló

## D1 – Admin-only MVP

Superseded: az admin felület és admin-only scope kikerült a Kincstartó aktuális scope-jából. A rendszer nem függ admin UI-tól.

---

## D2 – AI nem runtime függőség

AI használat csak szerver oldalon történik; nincs runtime AI függőség a felületeken.

Indok: stabilitás és kontroll.

---

## D3 – API route réteg

AI hívások API route-on keresztül történnek.
Nincs külön generálási service réteg MVP-ben.

Indok: gyors, de kontrollált indulás.

---

## D4 – Modell konfigurálhatóság

A használt modellek ENV változóban vannak definiálva.
Nem hardcode-olunk verziót.

Indok: modellciklusok gyors változása.

---

## D7 – Nincs promptolható UI

Nincs promptolható felület. Minden generálás rögzített konfiguráció alapján történik.

Indok: konzisztencia védelme.

---

## D10 – Idő alapú theme váltás

- Az inline `timeThemeScript` eltávolítva, hogy React szerver oldali markupja ne mutáljon eltérést a klienssel, ami hydration mismatch hibát okozott.
- A `prefers-color-scheme: dark` blokk csak addig érvényes, amíg a kliens még nem állította be a `data-time-theme` attribútumot, így a napszak által vezérelt sötét/világos paletta nyeri az előnyt.

Indok: garantálja, hogy a szerver- és kliens-oldali megjelenítés a napszak szerint változtat, és megszünteti a hydration hibákat.

---

## D15 – F3 builds mandate paired F4 checks

- Minden F3 (Build) munka mellett kötelező a megfelelő F4 (Check) tervezése és dokumentálása.
- Indok: a validáció nyoma mindig együtt marad a builddel.

---

## D16 – Activity logok: insert-alapú journaling

- A journaling insert-alapú: egy nap/tevékenység **több bejegyzést is** tartalmazhat.
- A logok strukturált mezőkkel készülnek: `category`, `label`, `exercise_id`, `duration_minutes`, `distance_km`, `intensity`, `notes`, opcionális `metadata`.

Indok: rugalmas, auditálható naplózási modell.

---

## D19 — Szöveg-szerepek és színsemantika

**Status:** Accepted  
**Date:** 2026-03-06

### Döntés
A felületek szövegszerepei és színei globális tokenekre és egységes segédosztályokra épülnek (dashboard-bázis). Új szöveg-szerep csak globális definícióval vezethető be.

---

## D29 – Mobil ellenőrzés (<= 420px)

- A felületnek mobil nézeten is használhatónak kell maradnia (<= 420px).
- Minden UI-t érintő változtatásnál kötelező legalább egy gyors manuális ellenőrzés mobil szélességen.

Indok: a regressziók tipikusan layout/touch problémákból jönnek.

---

## D44 – Yoga Guru (planned): server-side ajánlás + ActivityLog rögzítés

**Status:** Accepted  
**Date:** 2026-03-11

### Döntés (v1 irány)
- A Yoga Guru AI hívás **csak server-side** történik.
- A Guru outputja **szigorúan validált JSON contract**, és több javaslatot ad (template / link / kereső kulcsszavak).
- A kiválasztott javaslat rögzítése a meglévő ActivityLog contracton keresztül történik.
- Modell az env-ből jön (nincs hardcoded model id).

### Out of scope (v1)
- Anatómiai és jóga katalógus generálás/pipeline.
- YouTube API integráció és automatikus videó meta letöltés.

---

## D60 - Spirit Library v1

**Status:** Accepted  
**Date:** 2026-03-21

### Döntés
1) Egyetlen JSON forrás: repo-ban tárolt, kliensoldalon betöltött adat.
2) Build-time validáció: egyedi id-k, themes/related referenciák, enum ellenőrzés.
3) Nincs runtime AI és nincs DB.

### Out of scope (v1)
- Backend perzisztencia vagy CRUD.
- Automatikus ajánlórendszer / learning path engine.

---

## D61 – Magyar ékezetes tipográfia és UTF-8

**Status:** Accepted  
**Date:** 2026-03-22

### Döntés
- A felület szövege **mindig magyar ékezetes** karaktereket használ.
- Minden UI szövegfájl **UTF-8** kódolású.
- A betűkészleteknek kötelezően támogatniuk kell a magyar ékezeteket (Rubik, Roboto vagy egyenértékű).

### Indok
- A hibás kódolás és a nem megfelelő fontok vizuális és tartalmi hibákat okoznak.
