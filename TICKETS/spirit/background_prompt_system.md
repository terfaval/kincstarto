# Kincstartó háttérképek – Prompt rendszer (v1)

Ez a dokumentum a teljes generálási rendszer alapja. Tartalmazza:

* Master prompt
* Negatív prompt
* Moduláris blokkok
* Első 12 kész prompt
* Batch struktúra a 108 képhez

---

## 1. MASTER PROMPT

```
a serene taoist-buddhist altar scene, front-facing composition, ancient sacred wall and low ritual table, minimal zen aesthetic, painterly digital matte painting, soft brush textures, subtle grain, calm and meditative atmosphere, refined east asian sacred design, elegant and timeless, soft cinematic lighting, highly detailed but not noisy, balanced composition, negative space, no people, no modern elements
```

---

## 2. NEGATÍV PROMPT

```
no people, no characters, no modern objects, no sci-fi, no cyberpunk, no neon, no horror, no fantasy armor, no exaggerated magic effects, no glowing overload, no clutter, no messy composition, no text, no watermark, no logo, no oversaturated colors
```

---

## 3. MODULÁRIS BLOKKOK

### Fal

* ancient stone wall with subtle cracks and moss
* dark wooden temple wall, aged cedar panels
* textured plaster wall with faded pigments
* hybrid temple wall, stone base with wooden elements

### Fény (nappali)

* soft diffused daylight
* gentle side sunlight casting soft shadows
* morning light with floating dust particles

### Fény (esti)

* warm candlelight, soft flickering glow
* dim lantern light with deep shadows
* moonlight with subtle cool highlights

### Tárgyak

* a single incense burner
* a small stone bowl with water
* incense burner with thin smoke, small candle, ceramic bowl
* small statue, incense sticks, ritual objects
* taoist talisman paper
* I Ching sticks
* natural stones and branches

### Színek

* jade green tones with neutral stone
* warm amber and gold accents
* deep blue and silver tones
* muted earth tones
* soft grey and misty palette

### Atmoszféra

* faint incense smoke
* light dust in the air
* subtle mist
* clean clear air

---

## 4. PROMPT SABLON

```
[MASTER PROMPT],
[FAL],
[FÉNY],
[TÁRGYAK],
[SZÍN],
[ATMOSZFÉRA]
```

---

## 5. ELSŐ 12 PROMPT

### 01

```
[MASTER PROMPT], ancient stone wall with subtle cracks and moss, soft diffused daylight, a single incense burner, jade green tones with neutral stone, faint incense smoke
```

### 02

```
[MASTER PROMPT], textured plaster wall with faded pigments, gentle side sunlight casting soft shadows, a small stone bowl with water, soft grey and misty palette, light dust in the air
```

### 03

```
[MASTER PROMPT], dark wooden temple wall, aged cedar panels, morning light with floating dust particles, a minimal wooden object, warm amber and gold accents, clean clear air
```

### 04

```
[MASTER PROMPT], ancient stone wall with subtle cracks and moss, moonlight with subtle cool highlights, a single incense burner, deep blue and silver tones, faint incense smoke
```

### 05

```
[MASTER PROMPT], dark wooden temple wall, aged cedar panels, warm candlelight, soft flickering glow, a small ceramic bowl, warm amber and gold accents, subtle mist
```

### 06

```
[MASTER PROMPT], textured plaster wall with faded pigments, dim lantern light with deep shadows, a minimal altar object, muted earth tones, light smoke
```

### 07

```
[MASTER PROMPT], hybrid temple wall, stone base with wooden elements, soft diffused daylight, incense burner with thin smoke, small candle, ceramic bowl, jade green tones with neutral stone, faint incense smoke
```

### 08

```
[MASTER PROMPT], ancient stone wall with subtle cracks and moss, gentle side sunlight casting soft shadows, incense burner, taoist talisman paper, natural stones, muted earth tones, light dust in the air
```

### 09

```
[MASTER PROMPT], dark wooden temple wall, aged cedar panels, morning light with floating dust particles, small statue, incense sticks, ritual objects, warm amber and gold accents, clean clear air
```

### 10

```
[MASTER PROMPT], hybrid temple wall, stone base with wooden elements, warm candlelight, soft flickering glow, incense burner, candle, ceramic bowl, deep blue and silver tones, faint incense smoke
```

### 11

```
[MASTER PROMPT], textured plaster wall with faded pigments, dim lantern light with deep shadows, taoist talisman paper, I Ching sticks, small bowl, muted earth tones, subtle mist
```

### 12

```
[MASTER PROMPT], ancient stone wall with subtle cracks and moss, moonlight with subtle cool highlights, minimal altar with incense and small object, deep blue and silver tones, faint glowing aura, very subtle
```

---

## 6. BATCH STRUKTÚRA (108 KÉP)

### Batch 1 (1–12)

* alap teszt

### Batch 2 (13–24)

* minimal nappali + esti variációk

### Batch 3 (25–36)

* ritual nappali

### Batch 4 (37–48)

* ritual esti

### Batch 5 (49–60)

* taoista hangsúly

### Batch 6 (61–72)

* színkísérletek

### Batch 7 (73–84)

* atmoszféra variációk

### Batch 8 (85–96)

* elevated / spirituális

### Batch 9 (97–108)

* finomhangolt, legjobb irányok ismétlése

---

## 7. ALAPELV

> Konzisztencia > változatosság

> Finom eltérések > látványos különbségek

> Nyugalom > részlet
