# Landing Background Revert Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revert landing background to cover with a lower position and remove the blur overlay.

**Architecture:** Update landing-specific CSS in `globals.css`.

**Tech Stack:** Next.js App Router, CSS in `src/app/globals.css`.

---

## File Map
- Modify: `src/app/globals.css`

### Task 1: Revert Background to Cover + Lower Position

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write the failing test**

Set the landing background back to `cover` and lower the position to `center 65%`. Remove the `::before` blur layer.

```css
/* src/app/globals.css */
.landing-shell {
  background-size: cover;
  background-position: center 65%;
}

.landing-shell::before {
  content: none;
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run build`
Expected: PASS (visual change, compile unaffected).

- [ ] **Step 3: Write minimal implementation**

Apply the same changes as above and fully remove the pseudo-element definition.

```css
/* src/app/globals.css */
.landing-shell {
  background-size: cover;
  background-position: center 65%;
}

/* remove .landing-shell::before block entirely */
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "tweak: revert landing background position"
```

## Self-Review
- Spec coverage: background cover + position + blur removal covered.
- Placeholder scan: No TODO/TBD.
- Type consistency: CSS only.

