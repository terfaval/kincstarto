# Night Theme Landing + Toolbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply night-only styling to landing icons/logo and add a dark blue overlay, plus make the library toolbar SVG icons appear white at night.

**Architecture:** Use scoped CSS under `:root[data-time-theme="night"]` for landing and toolbar overrides. Add a pseudo-element overlay on the landing shell.

**Tech Stack:** Next.js App Router, CSS in `src/app/globals.css`.

---

## File Map
- Modify: `src/app/globals.css`

### Task 1: Night Theme Landing Overlay + White Icons

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write the failing test**

Add night-theme overrides for landing icons/logo and add an overlay layer with a dark blue gradient at ~45% opacity.

```css
/* src/app/globals.css */
:root[data-time-theme="night"] .landing-shell {
  position: relative;
  isolation: isolate;
}

:root[data-time-theme="night"] .landing-shell::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  background: radial-gradient(120% 120% at 20% 10%, rgba(8, 20, 36, 0.45), transparent 60%),
    linear-gradient(135deg, rgba(8, 20, 36, 0.45), rgba(8, 20, 36, 0.25));
}

:root[data-time-theme="night"] .landing-hero,
:root[data-time-theme="night"] .landing-cards {
  position: relative;
  z-index: 1;
}

:root[data-time-theme="night"] .landing-brand img,
:root[data-time-theme="night"] .landing-icon {
  filter: brightness(0) invert(1);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run build`
Expected: PASS (visual change, compile unaffected).

- [ ] **Step 3: Write minimal implementation**

Keep the overrides and ensure overlay does not affect interactions.

```css
/* src/app/globals.css */
:root[data-time-theme="night"] .landing-shell::after {
  pointer-events: none;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: night theme landing overlay"
```

### Task 2: Night Theme Library Toolbar SVG Icons

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write the failing test**

Add a scoped rule that only targets the toolbar SVG images used in the two toolbar buttons and makes them white in night theme.

```css
/* src/app/globals.css */
:root[data-time-theme="night"] .spiritToolbarIcon {
  filter: brightness(0) invert(1);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Write minimal implementation**

Add a class to the two toolbar `Image` elements and ensure no other icons are affected.

```tsx
// src/components/spirit/SpiritLibraryApp.tsx
<Image
  src="/icons/meditations.svg"
  alt=""
  width={18}
  height={18}
  className={`${styles.fabIcon} spiritToolbarIcon`}
  aria-hidden
/>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/components/spirit/SpiritLibraryApp.tsx
git commit -m "feat: night theme toolbar icon tint"
```

## Self-Review
- Spec coverage: night overlay, landing icon whitening, toolbar icon whitening.
- Placeholder scan: No TODO/TBD.
- Type consistency: CSS + JSX only.

