# KAORI 05 – Mirachai-mandala teakártyák

Dátum: 2026-11-23

## Mi változott

A Kaori teakártyái most már a Mirachai mandala-készletét használják újra.

### 1. Kártyavizuál
- a korábbi növényi vonalrajzos illusztráció helyett mandala-részlet jelenik meg;
- a mandala-családot a tea domináns ízjegye választja ki;
- a kártyán látható részlet már **nem a rácspozíciótól függ**, hanem a tea `id` alapján stabil;
- így ugyanaz a tea lapozás, keresés vagy szűrés után is ugyanazt a saját részletet kapja.

### 2. Jövőbiztos editorial override
- a `Tea` rekord opcionális `visual` mezőt kapott;
- ezzel később tea-szinten kézzel megadható:
  - `mandalaKey`
  - `focusX`
  - `focusY`
  - `scale`
  - `rotationDeg`
- ha ez nincs kitöltve, a felület determinisztikus automatikus cropot használ.

### 3. Új assetek
A Mirachai-ból átemelt mandalák a következő helyre kerültek:

- `public/kaori/teacard_background/`

## Érintett fájlok
- `src/features/kaori/components/KaoriApp.tsx`
- `src/features/kaori/components/KaoriApp.module.css`
- `src/features/kaori/lib/teaCardMandala.ts`
- `src/features/kaori/lib/schema.ts`
- `src/features/kaori/lib/public.ts`
- `scripts/qa/kaori-mandala.test.mjs`
- `public/kaori/teacard_background/*.svg`

## QA javaslat
1. `count=11` preview-ban lapozd végig a teakártyákat.
2. Szűrés és keresés után ellenőrizd, hogy ugyanaz a tea ugyanazt a mandala-részletet tartja meg.
3. Nézd meg mobil törésponton is (2 kártyás nézet).
4. Ha szeretnéd, később egy-egy teához már kézzel is be tudunk állítani saját cropot a `visual` mezőn át.

## Lokális ellenőrzés
```powershell
node --experimental-strip-types --test scripts/qa/kaori-mandala.test.mjs
```
