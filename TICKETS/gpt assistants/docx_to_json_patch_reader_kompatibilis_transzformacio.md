# PATCH – Imperatív kezdő/záró instrukciók transzformálása reader-kompatibilis nyelvre

## Cél

A DOCX → JSON asszisztens ne törölje automatikusan a meditációk elején vagy végén megjelenő klasszikus, felolvasásra írt instrukciókat, hanem szükség esetén alakítsa át őket reader-kompatibilis, képernyőn olvasható formára.

Ez különösen fontos olyan soroknál, amelyek eredetileg hangvezetett meditációhoz készültek, és direkt testi vagy szemmozgásos felszólításként szerepelnek.

---

## Alapelv

### Ne törölje, hanem transzformálja

A cél nem az, hogy az ilyen sorok eltűnjenek a reader-változatból, hanem az, hogy természetesebben illeszkedjenek az olvasó meditáció formájához.

A reader-verzióban a túl direkt imperatívusz helyett előnyben kell részesíteni az alábbi minőségeket:

- lágyabb
- olvasóbarátabb
- kevésbé vezényszavas
- kevésbé testi-parancsoló
- egyszerű
- nem túlírt
- nem tanító hangú

---

## Tipikus transzformációs esetek

### Kezdő instrukciók

❌ Eredeti:
- „Hunyd be a szemed…”
- „Csukd le a szemed…”
- „Figyelj a légzésedre…”

✅ Reader-kompatibilis irány:
- „Ha jól esik, a figyelmed befelé fordulhat…”
- „Engedd, hogy a külső tér lassan háttérbe húzódjon…”
- „A figyelem lassan megérkezhet a légzésedhez…”

### Záró instrukciók

❌ Eredeti:
- „Nyisd ki a szemed.”
- „Mozgasd meg a tested.”
- „Térj vissza a szobába.”

✅ Reader-kompatibilis irány:
- „Lassan visszatérhetsz a körülötted lévő térhez…”
- „Engedd, hogy a külvilág újra megjelenjen…”
- „A figyelmed fokozatosan újra kifelé fordulhat…”

---

## Döntési szabály

Az asszisztens minden ilyen sor esetén mérlegelje:

1. A mondat valóban szükséges része-e a meditáció ívének?
2. Megtartható-e változtatás nélkül reader-formában?
3. Ha nem, átalakítható-e lágy, nem direkt, olvasókompatibilis megfogalmazásra?
4. Ha az adott sor túl technikai vagy túl hangfelvétel-specifikus, csak akkor hagyja el, ha transzformálva sem illeszthető természetesen a readerbe.

---

## Stílusszabály

A transzformáció során a célhang legyen:

- egyszerű
- tiszta
- visszafogott
- nem modoros
- nem ezoterikusan túlírt
- nem „spirituális bullshit”
- nem tanítói
- nem terápiás

Az asszisztens kerülje az ilyen típusú túlírt helyettesítéseket:

- túl sok metafora
- túl sok ködös belső emelkedettség
- öncélú líraiság
- mesterkélt finomkodás

---

## Ajánlott nyelvi irány

A direkt felszólítás helyett előnyben részesítendők az ilyen szerkezetek:

- „ha jól esik…”
- „lassan…”
- „engedheted, hogy…”
- „megérkezhet…”
- „visszatérhet…”
- „fokozatosan…”
- „újra érzékelhetővé válhat…”

De ezeket se használja mechanikusan vagy túlhalmozva.

---

## Elemzési lépésben való jelölés

Ha az asszisztens ilyen transzformációt tervez, ezt az első, elemző lépcsőben röviden jelezze.

Például:

- „A nyitó sor eredetileg hangvezetett imperatívusz; reader-kompatibilis, lágyabb megfogalmazást javaslok.”
- „A záró blokkban a direkt visszahozó instrukciókat enyhébb, olvasóbarát formára alakítanám.”

Ha a transzformáció mértéke kérdéses, ezt vigye be a bizonytalanságok közé.

---

## Kötelező elv

A végleges JSON reader-szkriptje ne tartalmazzon indokolatlanul nyers, vezényszavas, hangfelvételre szabott utasításokat, ha azok természetesebb reader-formára átírhatók.

A cél: a meditáció megőrizze az ívét és funkcióját, miközben természetesen olvasható marad képernyőn is.
