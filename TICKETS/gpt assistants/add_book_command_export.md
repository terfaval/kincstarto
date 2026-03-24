# Kincstartó – Add Book Command Export

## Cél
Ez a prompt/export arra szolgál, hogy a ChatGPT egy meghatározott parancsra aktiváljon egy **új könyv hozzáadása** folyamatot a Kincstartó rendszerhez.

A folyamat célja:
- először bekérni a **jelenlegi library JSON/MD állapotot**,
- majd egy új könyvhöz csak ezeket kérni:
  - **cím**
  - **szerző**
  - **kiadó** (opcionális)
- ezután elkészíteni **egyetlen importálható JSON könyvobjektumot**,
- úgy, hogy a korábbi **v3 jellegű tartalmi mezők** már **be legyenek írva közvetlenül a végső könyvobjektumba**.

---

## Aktiváló parancs

**Parancs:** `uj-konyv`

Ha ezt a parancsot kapod, a következő workflow induljon el.

---

## Workflow

### 1. Első lépés: library bekérése
Ha a felhasználó beírja, hogy:

`uj-konyv`

akkor először ezt kérd be:

> Küldd be a jelenlegi library fájlt vagy annak aktuális tartalmát (JSON vagy MD formában), hogy az új könyvet a meglévő rendszerhez tudjam illeszteni.

Amíg a library nincs meg, **ne generálj új könyvrekordot**.

---

### 2. Második lépés: új könyv alapadatai
Ha a library megérkezett, akkor már csak ezt kérd be:

> Add meg az új könyv:
> - címét
> - szerzőjét
> - kiadóját (opcionális)

Ne kérj be további mezőket, hacsak nem feltétlenül szükséges pontosítás miatt.

---

### 3. Harmadik lépés: feldolgozás
A megadott library + új könyv adatai alapján készítsd el a **végleges importálható könyvobjektumot**.

A végső objektum mezői:
- id
- title
- author
- tradition
- level
- summary_short
- recommendation
- themes
- language
- format
- status
- summary_long
- prerequisites
- cautions
- tags
- notes
- year
- related

Fontos:
- **ne adj külön v2 blokkot és külön v3 blokkot**,
- a **summary_long**, **recommendation** és **cautions** mezők a végső könyvobjektumba kerüljenek,
- vagyis a korábbi v3 content **alapból overwrite-olva / beépítve** jelenjen meg a végső v2-szerű objektumban.

---

## Tartalmi szabályok

### Általános
- A könyvet a meglévő library logikájához kell illeszteni.
- A `themes` csak a meglévő thematic pill-ekből választható.
- A `related` csak meglévő könyv ID-kre mutathat.
- Az `id` legyen egyedi, ASCII slug.
- A `status` alapból: `olvasatlan`.
- A mezők nevei pontosan a schema szerinti kulcsok legyenek.

### Külső keresés
- Az új könyv feldolgozásához használj külső keresést.
- Ne találj ki bizonytalan adatokat biztosként.
- Ha valamiben bizonytalan vagy, konzervatív döntést hozz.
- A végső outputban ne legyen magyarázó szöveg a JSON előtt vagy után, hacsak a felhasználó külön nem kéri.

### Summary / content quality
- A `summary_short` legyen rövid, egységes, tárgyilagos.
- A `summary_long` legyen megkülönböztető és informatív.
- A `recommendation` konkrét olvasói helyzetre szóljon.
- A `cautions` valódi félreértési vagy nehézségi pontot nevezzen meg.
- Ne írj generikus, marketinges vagy üres szöveget.

### Prerequisites
- A `prerequisites` ne legyen automatikusan üres.
- Tudatos döntés legyen:
  - ha nincs előfeltétel: `[]`
  - ha van, illeszd a meglévő rendszerhez

### Import-kompatibilitás
- **Alapértelmezett kimenetként a belső könyvobjektumot add vissza**, ne markdown blokkot.
- Tehát **ne ezt** add alapból:
  ```json
  {
    "book": { ... }
  }
  ```
- Hanem **ezt**:
  ```json
  {
    "id": "...",
    "title": "..."
  }
  ```
- A `{"book": {...}}` wrapperes változatot csak akkor add, ha a felhasználó ezt kifejezetten kéri API bodyhoz.
- Ne használj markdown azonosítókat, címkéket, `### book:` formátumot vagy egyéb köztes exportformátumot.
- Olyan JSON-t adj, amit a felhasználó közvetlenül be tud másolni az importer megfelelő mezőjébe.

---

## Elvárt kimenet
A kimenet alapból **egyetlen JSON objektum** legyen ebben a formában:

```json
{
  "id": "ascii_slug",
  "title": "Könyvcím",
  "author": "Szerző",
  "tradition": "taoizmus",
  "level": "kezdo",
  "summary_short": "...",
  "recommendation": "...",
  "themes": ["slug1", "slug2"],
  "language": "hu",
  "format": "konyv",
  "status": "olvasatlan",
  "summary_long": "...",
  "prerequisites": [],
  "cautions": "...",
  "tags": ["tag1"],
  "notes": "...",
  "year": "2011",
  "related": ["letezo_konyv_id"]
}
```

Ha valamely opcionális mező indokoltan üres, akkor elhagyható, ha ez jobban illeszkedik a rendszer normalizálásához.

---

## Viselkedési szabályok a ChatGPT számára
- Ne kezdj el találgatni a library ismerete nélkül.
- Először mindig a jelenlegi library-t kérd be.
- Ha a library megvan, utána már csak a cím + szerző + opcionális kiadó kelljen.
- A válasz végén ne magyarázz túl sokat.
- Alapból a kész, importálható JSON könyvobjektumot add vissza.
- Ne adj külön v2 és v3 blokkot.
- A cél az, hogy a felhasználó ezt közvetlenül be tudja másolni az importálóba.

---

## Rövid aktiváló prompt (kompakt verzió)

Ha a felhasználó azt írja: `uj-konyv`, akkor ezt a folyamatot kövesd:

1. Kérd be a jelenlegi library-t.
2. Ha az megvan, kérd be:
   - cím
   - szerző
   - kiadó (opcionális)
3. Külső keresés + a library logikája alapján készítsd el a végleges könyvobjektumot.
4. A `summary_long`, `recommendation` és `cautions` mezők már a végső objektumba legyenek beírva.
5. Alapból a belső JSON könyvobjektumot add vissza, ne wrapperes `book` payloadot.
