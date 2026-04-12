# Library Toolbar Icon Swap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the library toolbar icons for Meditációs tér and Yogi's choice with the landing SVG assets.

**Architecture:** Update `SpiritLibraryApp.tsx` to render SVG images instead of Lucide icons for the two specific toolbar buttons. Keep all other toolbar buttons intact.

**Tech Stack:** Next.js App Router, React, `next/image`.

---

## File Map
- Modify: `src/components/spirit/SpiritLibraryApp.tsx`

### Task 1: Swap Toolbar Icons

**Files:**
- Modify: `src/components/spirit/SpiritLibraryApp.tsx`

- [ ] **Step 1: Write the failing test**

Replace the two Lucide icons with SVG images using `next/image` and keep the existing `fabIcon` class for sizing.

```tsx
// src/components/spirit/SpiritLibraryApp.tsx
import Image from "next/image";

// ...
<Link
  href={meditationsHref}
  className={styles.addFab}
  aria-label="Meditációs tér"
  title="Meditációs tér"
>
  <Image
    src="/icons/meditations.svg"
    alt=""
    width={18}
    height={18}
    className={styles.fabIcon}
    aria-hidden
  />
</Link>
<Link
  href="/yogis-choice"
  className={styles.addFab}
  aria-label="Yogi's choice"
  title="Yogi's choice"
>
  <Image
    src="/icons/yoga.svg"
    alt=""
    width={18}
    height={18}
    className={styles.fabIcon}
    aria-hidden
  />
</Link>
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run build`
Expected: PASS (visual change, compile unaffected).

- [ ] **Step 3: Write minimal implementation**

Ensure the two Lucide icon imports are removed if no longer used.

```tsx
// src/components/spirit/SpiritLibraryApp.tsx
import {
  Bookmark,
  Check,
  Clock,
  Circle,
  Dumbbell,
  LayoutList,
  LogOut,
  Route,
  SlidersHorizontal,
  X,
} from "lucide-react";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/spirit/SpiritLibraryApp.tsx
git commit -m "tweak: swap library toolbar icons"
```

## Self-Review
- Spec coverage: only the two toolbar icons swapped.
- Placeholder scan: No TODO/TBD.
- Type consistency: JSX only.

