# Landing Night Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use `landing_night.png` as the landing background image only in night theme.

**Architecture:** Add a night-scoped background-image override in `globals.css`.

**Tech Stack:** Next.js App Router, CSS in `src/app/globals.css`.

---

## File Map
- Modify: `src/app/globals.css`

### Task 1: Night-Only Background Image Override

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write the failing test**

Add a night-scoped rule to override the landing background image.

```css
/* src/app/globals.css */
:root[data-time-theme="night"] .landing-shell {
  background-image: url("/backgrounds/landing_night.png");
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Write minimal implementation**

Keep the rule above; no other changes required.

```css
/* src/app/globals.css */
:root[data-time-theme="night"] .landing-shell {
  background-image: url("/backgrounds/landing_night.png");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "tweak: use landing night background"
```

## Self-Review
- Spec coverage: night-only background override covered.
- Placeholder scan: No TODO/TBD.
- Type consistency: CSS only.

