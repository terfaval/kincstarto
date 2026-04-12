# Library Toolbar Inline SVG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use inline SVGs with currentColor for the two library toolbar icons so they inherit the muted toolbar color in night mode.

**Architecture:** Replace `next/image` SVG usage with inline `<svg>` markup in `SpiritLibraryApp.tsx` for the two toolbar buttons only.

**Tech Stack:** React, TypeScript, CSS.

---

## File Map
- Modify: `src/components/spirit/SpiritLibraryApp.tsx`

### Task 1: Inline Toolbar SVGs

**Files:**
- Modify: `src/components/spirit/SpiritLibraryApp.tsx`

- [ ] **Step 1: Write the failing test**

Replace the two `Image` components with inline SVGs using `currentColor`.

```tsx
// src/components/spirit/SpiritLibraryApp.tsx
const MeditationsIcon = () => (
  <svg viewBox="0 0 24 24" className={styles.fabIcon} aria-hidden="true">
    {/* inline paths from public/icons/meditations.svg */}
  </svg>
);

const YogaIcon = () => (
  <svg viewBox="0 0 24 24" className={styles.fabIcon} aria-hidden="true">
    {/* inline paths from public/icons/yoga.svg */}
  </svg>
);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Write minimal implementation**

Ensure `stroke="currentColor"` / `fill="currentColor"` are applied to paths as appropriate. Remove `next/image` import if unused.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/spirit/SpiritLibraryApp.tsx
git commit -m "tweak: inline toolbar SVG icons"
```

## Self-Review
- Spec coverage: only the two toolbar icons swapped to inline SVG.
- Placeholder scan: No TODO/TBD.
- Type consistency: JSX only.

