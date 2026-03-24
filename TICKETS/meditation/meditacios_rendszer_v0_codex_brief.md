# Meditációs rendszer v0 – Codex implementációs brief

## Cél

A Kincstartó projektben készüljön el egy új meditációs alrendszer v0-ja, amely nem klasszikus listaoldalként, hanem rituális élménytérként működik.

A cél egy olyan első működő verzió, amely:

- egy közös atmoszferikus térben jeleníti meg a meditációkat
- szabad felfedezést enged
- egy külön meditáció-preview réteget használ
- egy minimal, automatikusan lejátszott reader nézetet biztosít
- statikus JSON fájlokból dolgozik
- nem igényel backend vagy adatbázis logikát

A rendszernek stabil alapot kell adnia későbbi bővítésekhez, de a v0 scope maradjon szűk és kontrollált.

---

## Terméklogika

### Alapelv

Ez a rendszer nem dashboard és nem tartalomlista.

A kívánt UX:

- lassú
- atmoszferikus
- fókuszált
- minimál
- rituális belépésérzetet adó

### V0 felhasználói folyamat

1. A felhasználó belép a meditációs térbe.
2. Egy sötét, atmoszferikus háttér előtt gyűrűs / gyöngyfüzéres elrendezésben látja a meditációkat.
3. Hover esetén a középső fókuszterületen megjelenik:
   - a kategória
   - a meditáció címe nagyobban
4. Kattintásra megnyílik a meditáció preview panel.
5. A preview panel tartalmazza:
   - cím
   - rövid leírás
   - időtartam
   - belépés gomb
6. Belépés után elindul a reader mód.
7. A reader mód automatikusan játssza le a meditációt text és pause blokkok alapján.
8. A meditáció végén az end behavior szerint zár:
   - fade_out
   - soft_end
   - complete

---

## V0 scope

### Benne van

- meditációs landing / tér nézet
- statikus JSON alapú adatbetöltés
- data/meditations könyvtár használata
- meditációk megjelenítése gyűrűs layoutban
- hover fókusz-infó a középpontban
- preview panel
- automatikus reader nézet
- explicit text/pause blokk-kezelés
- end behavior kezelés
- minimál animációk és átmenetek
- egyetlen közös default háttérvilág

### Nincs benne

- login
- user progress mentés
- unlock / kampánylogika
- adatbázis
- admin felület
- TTS
- manuális léptetés
- kategóriafilter
- több theme
- személyre szabott ajánlás
- összetett mozgó háttérvilág

---

## Technikai alapelvek

### Adatforrás

A rendszer statikus JSON fájlokat használjon.

Elvárt könyvtár:

`data/meditations`

Minden meditáció külön fájl.

A frontend ezt a könyvtárat olvassa be és ezekből építi fel a felületet.

### Kimeneti szerződés

A meditáció JSON szerkezete legyen kompatibilis a külön definiált meditáció DOCX → JSON pipeline-nal.

A reader nem értelmez szabad szöveget, csak explicit blokkokat.

---

## Elvárt JSON séma

A rendszer legalább ezt a struktúrát támogassa:

```ts
type Meditation = {
  id: string
  title: string
  category: "ALV" | "STR" | "FOK" | "ENR" | "SPC"
  level: "kezdo" | "kozep-halado" | "halado"
  order_in_category: number
  duration_sec: number
  summary_short: string
  tone: string[]
  techniques: string[]
  visual_theme: string
  status: "raw" | "optimalizalt"
  is_published: boolean
  campaign_key: string | null
  source_docx: string
  reader: {
    autoplay: true
    end_behavior: "fade_out" | "soft_end" | "complete"
    blocks: ReaderBlock[]
  }
}

type ReaderBlock =
  | {
      type: "text"
      content: string
      tone: "soft" | "neutral" | "deep"
    }
  | {
      type: "pause"
      duration_ms: number
    }
```

A renderelésnél a rendszer csak az `is_published: true` meditációkat vegye figyelembe.

---

## Javasolt fájlszerkezet

Az alábbi struktúra javasolt. A meglévő projektstruktúrához illesztve módosítható, de a logikai bontás maradjon.

```text
src/
  features/
    meditations/
      components/
        MeditationSpace.tsx
        MeditationRing.tsx
        MeditationCenterFocus.tsx
        MeditationPreviewPanel.tsx
        MeditationReader.tsx
        ReaderStage.tsx
        ReaderTextBlock.tsx
      hooks/
        useMeditations.ts
        useReaderEngine.ts
      lib/
        meditation-types.ts
        meditation-loaders.ts
        meditation-layout.ts
        meditation-utils.ts
      styles/
        meditations.css
      index.ts

data/
  meditations/
    ALV_1_01_alomba_simulo_legzes.json
    ...
```

Ha a projekt architektúrája más szerkezetet kíván, a komponenslogika és felelősségi határok akkor is maradjanak elkülönítve.

---

## Komponensspecifikáció

### 1. MeditationSpace

Felelősség:

- teljes meditációs tér shell
- háttér renderelése
- betöltött meditációk átadása a gyűrű komponensnek
- aktuálisan hoverelt / kiválasztott elem state-je
- preview panel nyitása/zárása
- reader nézetbe való belépés

Tartalmazza:

- default dark atmospheric background
- center focus area
- ring layout
- preview layer
- reader overlay vagy route-level reader megjelenítés

### 2. MeditationRing

Felelősség:

- a meditációk gyűrűs / köríves pozicionálása
- hover és click események kezelése
- vizuális gyöngyök kirajzolása

Követelmények:

- v0-ban egyszerű determinisztikus elrendezés elég
- ne legyen physics engine
- ne legyen túlmozgó
- desktopon hoverre működjön
- mobilon tap-fókusz megoldás legyen

### 3. MeditationCenterFocus

Felelősség:

- a középpontban jelenítse meg a fókuszban lévő meditáció adatait

Hoverelt állapotban mutassa:

- kategória
- title nagyobban

Alapállapotban mutathat egy rövid bevezető vagy neutrális placeholder szöveget.

### 4. MeditationPreviewPanel

Felelősség:

- a kiválasztott meditáció előnézete

Mutassa:

- title
- category
- duration
- summary_short
- belépés gomb
- opcionálisan level és techniques visszafogottan

Ne legyen túl információszerű vagy dashboard-hangulatú.

### 5. MeditationReader

Felelősség:

- teljes képernyős vagy domináns overlay olvasó mód
- lejátszás indítása a reader blokkok alapján
- text blokkok megjelenítése
- pause blokkok idejének kivárása
- lezárási logika kezelése
- kilépés biztosítása

A reader legyen vizuálisan minimal.

### 6. ReaderStage

Felelősség:

- a reader háttérszínpad
- minimál elsötétített atmoszféra
- text blokk középre igazítva
- finom fade átmenetek

### 7. ReaderTextBlock

Felelősség:

- aktuális text blokk tipografikus megjelenítése
- tone alapján finom, nem harsány vizuális különbségek kezelése

Nem kell erős stilizálás.
Nem kell színkódolt tipográfia.
Csak finom ritmikai különbség.

---

## Reader engine specifikáció

Ez a rendszer lelke. Stabil és egyszerű legyen.

### Alapelv

A reader engine a `reader.blocks` tömbön megy végig sorrendben.

- `text` blokk esetén megjeleníti a szöveget
- `pause` blokk esetén vár a megadott ideig
- majd továbblép a következő blokkra

### Fontos

A frontend semmilyen rejtett timingot ne generáljon.

A timing kizárólag a JSON-ból jöjjön.

### Javasolt hook

`useReaderEngine(meditation)`

Feladatai:

- aktuális blokk index
- aktuális text blokk
- running state
- end state
- cleanup timeouts
- restart / exit lehetőség

### Elvárt működés

#### Text blokk
- szöveg megjelenik fade-in átmenettel
- a blokk addig marad, amíg a következő `pause` blokk vagy logikai továbblépés meg nem történik

#### Pause blokk
- ha pause blokk következik, a rendszer vár `duration_ms` ideig
- a text közben maradhat látható, vagy enyhén halványulhat
- v0-ban maradhat egyszerű: az utolsó text blokk látszik a pause alatt is

#### Blokkhatár
- a következő text blokk érkezésekor az előző finoman kifade-el, az új befade-el

### End behavior

#### `fade_out`
- a végén a text és a reader UI lassan eltűnik
- nincs kemény “vége” érzet

#### `soft_end`
- marad egy halk lezárás, de nem pattog ki
- lehet finom “vissza” vagy bezárás lehetőség

#### `complete`
- egyértelműbb lezárás
- megjelenhet egy diszkrét befejezés-állapot

---

## Layout logika

### Gyűrűs elrendezés

V0-ban az egyszerűség fontosabb, mint a teljes organikusság.

Javaslat:

- egy központi kör/gyűrű
- az elemek egyenletesen elosztva
- kisebb vizuális variancia megengedett
- ne legyen túl zsúfolt
- 17 meditációt még kényelmesen el kell bírnia

### Vizuális kódolás

V0-ban visszafogottan:

- category: nagyon finom árnyalat- vagy glow-különbség
- level: méret vagy fényintenzitás enyhe eltérés
- hovered: erősebb glow / fókusz

Semmiképp ne legyen játékos vagy app-szerű badge rendszer.

---

## Stílusirány

### Közös háttér

Egyetlen default háttér kell:

- sötét
- atmoszferikus
- nem túl mozgalmas
- nem zavarja a szövegolvasást
- inkább textúra / fény / mélység, mint konkrét illusztráció

### UI hangulat

- visszafogott
- misztikus
- puha átmenetek
- jó whitespace
- semmi dashboard-esztétika
- semmi túl erős gamification

### Reader tipográfia

- középre rendezett
- kevés sor egyszerre
- jó olvashatóság
- képernyőnként 1 rövid blokk
- finom fade átmenetek

---

## Adatbetöltés

### useMeditations hook

Feladata:

- statikus meditation JSON fájlok betöltése
- parse / validate minimális szinten
- csak publikált elemek visszaadása
- rendezés:
  - category
  - order_in_category
  - vagy a térnézethez szükséges stabil sorrend

Ha a build setup lehetővé teszi, használjon glob importot vagy annak megfelelő megoldást.

Elvárt viselkedés:

- hibás JSON esetén ne törjön el az egész UI
- logoljon értelmes fejlesztői hibát
- a hibás meditáció kimaradhat a listából

---

## State modell

V0-ban elég egyszerű kliensoldali state.

Javasolt állapotok:

- `hoveredMeditationId`
- `selectedMeditationId`
- `readerMeditationId`
- `readerOpen`
- `readerCompleted`

Nincs szükség globális store-ra, ha lokális state-ből tisztán kezelhető.

Ha a projektben már van kialakult state management, ahhoz illeszkedjen.

---

## Hozzáférhetőség és UX minimum

### Kötelező minimum

- billentyűzettel is elérhető interaktív elemek
- escape vagy egyértelmű bezárás a readerből
- mobilon is használható alapinterakció
- olvasható kontraszt
- ne legyen túl gyors animáció

### Nem cél v0-ban

- full accessibility tuning
- screen reader optimalizáció meditációs ritmuslogikára
- komplex reduced-motion rendszer

De ha motion preference támogatás könnyen megoldható, érdemes finoman figyelembe venni.

---

## Javasolt implementációs sorrend

### 1. Típusok és adatbetöltés
- meditation-types
- meditation-loaders
- useMeditations

### 2. Statikus mock JSON-ok bekötése
- legalább 2–3 referencia meditációval

### 3. Meditációs tér alapváz
- háttér
- center focus
- ring layout
- hover state

### 4. Preview panel
- selected meditation alapján

### 5. Reader engine
- useReaderEngine
- text/pause blokkkezelés
- end behavior

### 6. Finom animációk és polish
- fade-ek
- glow
- tipográfia
- reszponzív igazítás

---

## Elfogadási kritériumok (DoD)

A v0 akkor tekinthető késznek, ha:

1. A rendszer képes legalább 3 meditációs JSON fájlt betölteni a `data/meditations` könyvtárból.
2. A meditációk gyűrűs / gyöngyfüzéres térben jelennek meg.
3. Hoverre a középpontban megjelenik a kategória és a title.
4. Kattintásra preview panel nyílik.
5. A preview panelből elindítható a reader.
6. A reader text/pause blokkok alapján automatikusan végigmegy a meditáción.
7. A reader kezeli a `fade_out`, `soft_end` és `complete` end behavior módokat.
8. A felület egyetlen közös default atmoszferikus háttérrel működik.
9. A teljes rendszer használható desktopon és alap mobilnézetben.
10. A scope nem csúszik át kampánylogikába, TTS-be vagy backendes megoldásba.

---

## Fontos tiltások

Kérlek, ne építsd be v0-ban az alábbiakat, még akkor sem, ha technikailag vonzó lenne:

- backend vagy adatbázis
- user progress mentés
- unlock rendszer
- kategória szerinti külön háttérvilágok
- TTS
- kézi továbbkattintásos reader
- túlbonyolított animációs motor
- physics alapú gyöngyviselkedés
- túl sok UI chrome

A v0 célja nem a funkciógazdagság, hanem egy stabil, atmoszferikus, működő alap létrehozása.

---

## Implementációs megjegyzés

Ha a repo meglévő dizájnrendszere vagy layout-rendszere miatt bizonyos komponensnevek vagy fájlhelyek módosulnak, az rendben van, de a következő logikai egységek mindenképp maradjanak külön:

- adatbetöltés
- meditációs tér
- fókuszközép
- preview panel
- reader engine
- reader megjelenítés

---

## Ajánlott első commit cél

Az első implementációs kör célja ne a teljes polish legyen, hanem egy stabil vertical slice:

- 3 JSON meditáció
- működő space view
- működő preview
- működő reader autoplay

Ha ez megvan, utána jöhet a finomhangolás.

---

## Rövid összefoglaló

Építs egy minimal, atmoszferikus meditációs rendszert statikus JSON alapokon, gyűrűs térnézettel, középponti hover-fókusszal, preview panellel és automatikus readerrel.

A cél egy erős v0 alap, nem egy teljes meditációs platform.
