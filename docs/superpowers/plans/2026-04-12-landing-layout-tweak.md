# Landing Layout Tweak Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make landing cards visibly narrower and show the full landing background image without empty bands.

**Architecture:** Update landing-specific CSS in `globals.css` to constrain card widths and introduce a layered background using a pseudo-element for the blurred fill.

**Tech Stack:** Next.js App Router, CSS in `src/app/globals.css`.

---

## File Map
- Modify: `src/app/globals.css`

### Task 1: Narrow the Card Layout

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write the failing test**

Add temporary CSS to set a smaller max width on the cards container and cards.

```css
/* src/app/globals.css */
.landing-cards {
  width: min(720px, 100%);
  justify-items: center;
}

.landing-card {
  width: min(240px, 100%);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run build`
Expected: PASS (visual change, compile unaffected).

- [ ] **Step 3: Write minimal implementation**

Keep the narrower width settings and ensure they are compatible with mobile layouts.

```css
/* src/app/globals.css */
.landing-cards {
  width: min(720px, 100%);
  justify-items: center;
}

.landing-card {
  width: min(240px, 100%);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "tweak: narrow landing cards"
```

### Task 2: Show Full Background Without Empty Bands

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write the failing test**

Add a pseudo-element to `.landing-shell` that fills the area with a blurred cover image while the primary background uses `contain`.

```css
/* src/app/globals.css */
.landing-shell {
  position: relative;
  isolation: isolate;
  background-image: url("/backgrounds/landing_background.png");
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
}

.landing-shell::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  background-image: url("/backgrounds/landing_background.png");
  background-repeat: no-repeat;
  background-position: center;
  background-size: cover;
  filter: blur(18px);
  transform: scale(1.02);
  opacity: 0.85;
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run build`
Expected: PASS (visual change, compile unaffected).

- [ ] **Step 3: Write minimal implementation**

Keep the above and ensure landing content remains on top.

```css
/* src/app/globals.css */
.landing-shell {
  position: relative;
  isolation: isolate;
  background-image: url("/backgrounds/landing_background.png");
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
}

.landing-shell::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  background-image: url("/backgrounds/landing_background.png");
  background-repeat: no-repeat;
  background-position: center;
  background-size: cover;
  filter: blur(18px);
  transform: scale(1.02);
  opacity: 0.85;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "tweak: adjust landing background fit"
```

## Self-Review
- Spec coverage: Card width change and background layering both covered.
- Placeholder scan: No TODO/TBD.
- Type consistency: CSS only.

