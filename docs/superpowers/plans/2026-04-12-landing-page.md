# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/` with a landing page and move the current library to `/library`, keeping other public pages intact.

**Architecture:** Introduce a new `src/app/library/page.tsx` that renders the existing library. Create a new `src/app/page.tsx` landing page composed of a simple layout and three linked cards. Update any root-link references to point to `/library`.

**Tech Stack:** Next.js App Router, React, TypeScript, existing CSS setup.

---

## File Map
- Create: `src/app/library/page.tsx` (library page, moved from current root)
- Modify: `src/app/page.tsx` (new landing UI)
- Modify: `src/app/globals.css` (landing styles, if needed)
- Modify: `src/components/...` (only if a root link exists that must point to `/library`)

### Task 1: Move Library Page to `/library`

**Files:**
- Create: `src/app/library/page.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/app/library/page.tsx` with a simple placeholder component and set `src/app/page.tsx` to render a placeholder landing. This is not a formal test, but ensures routes are split before final UI.

```tsx
// src/app/library/page.tsx
export default function LibraryPlaceholder() {
  return <div>Library placeholder</div>;
}

// src/app/page.tsx
export default function LandingPlaceholder() {
  return <div>Landing placeholder</div>;
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run build`
Expected: PASS (route split is compile-valid). If it fails, fix imports.

- [ ] **Step 3: Write minimal implementation**

Move the current library code from `src/app/page.tsx` into `src/app/library/page.tsx`, preserving its exports and behavior. Then replace `src/app/page.tsx` with a landing shell that returns the landing root element.

```tsx
// src/app/library/page.tsx
import { loadSpiritLibrary } from "@/lib/spiritLibrary";
import SpiritLibraryApp from "@/components/spirit/SpiritLibraryApp";

export const metadata = {
  title: "Kincstartó",
  description: "Könyvek és gondolatok személyes gyûjteménye a belsõ út kereséséhez",
};

export const dynamic = "force-dynamic";

export default async function SpiritPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const library = await loadSpiritLibrary();
  const debugParam = searchParams?.debug;
  const debugEnabled = Array.isArray(debugParam)
    ? debugParam.includes("1")
    : debugParam === "1";
  return (
    <>
      {debugEnabled && (
        <div
          style={{
            position: "fixed",
            top: "8px",
            right: "8px",
            padding: "6px 8px",
            background: "rgba(40, 120, 60, 0.92)",
            color: "#fff",
            fontSize: "12px",
            borderRadius: "6px",
            zIndex: 10000,
          }}
        >
          {"SSR debug=1"}
        </div>
      )}
      <SpiritLibraryApp library={library} admin={false} />
    </>
  );
}
```

```tsx
// src/app/page.tsx
export default function LandingShell() {
  return <main className="landing-shell" />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/library/page.tsx
git commit -m "feat: move library to /library"
```

### Task 2: Build Landing Page UI

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write the failing test**

Add markup for the landing page with required structure and links, but without final styles.

```tsx
// src/app/page.tsx
import Image from "next/image";
import Link from "next/link";
import { Book, Bead, Lotus } from "lucide-react";

const landingDescription =
  "Könyvek, meditációk és mozgás egy helyen — egy személyes gyûjtemény, amit nem használatra terveztem, hanem hogy vissza lehessen térni hozzá, amikor szükség van rá.";

export default function LandingPage() {
  return (
    <main className="landing-shell">
      <section className="landing-hero">
        <div className="landing-brand">
          <Image
            src="/favicon.svg"
            alt="Kincstartó"
            width={140}
            height={140}
          />
          <h1>Kincstartó</h1>
        </div>
        <p className="landing-description">{landingDescription}</p>
      </section>
      <section className="landing-cards">
        <Link className="landing-card" href="/library">
          <Book size={52} strokeWidth={1.5} />
          <span>Könyvtár</span>
        </Link>
        <Link className="landing-card" href="/meditations">
          <Bead size={52} strokeWidth={1.5} />
          <span>Üveggyöngyök</span>
        </Link>
        <Link className="landing-card" href="/yogis-choice">
          <Lotus size={52} strokeWidth={1.5} />
          <span>Jóga</span>
        </Link>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run build`
Expected: FAIL if lucide-react icons are missing or unused; install/import fixes as needed.

- [ ] **Step 3: Write minimal implementation**

Add landing styles to `src/app/globals.css` to match the requested layout (centered description, three cards, hover).

```css
/* src/app/globals.css */
.landing-shell {
  min-height: 100vh;
  padding: 64px 24px 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 48px;
}

.landing-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  text-align: center;
  max-width: 720px;
}

.landing-brand {
  display: inline-flex;
  align-items: center;
  gap: 18px;
}

.landing-brand h1 {
  font-size: clamp(2.6rem, 4vw, 3.6rem);
  font-weight: 700;
  letter-spacing: -0.02em;
}

.landing-description {
  font-size: clamp(1rem, 1.6vw, 1.2rem);
  color: rgba(255, 255, 255, 0.78);
  line-height: 1.6;
}

.landing-cards {
  width: min(960px, 100%);
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.landing-card {
  min-height: 180px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  font-size: 1.05rem;
  font-weight: 600;
  color: inherit;
  text-decoration: none;
  transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
}

.landing-card:hover {
  transform: translateY(-4px);
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.2);
}

@media (max-width: 600px) {
  .landing-shell {
    padding: 48px 16px 64px;
  }

  .landing-brand {
    flex-direction: column;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/globals.css
git commit -m "feat: add landing page UI"
```

### Task 3: Update Root Links to `/library`

**Files:**
- Modify: `src/**` (only files that link to `/` as the library)

- [ ] **Step 1: Write the failing test**

Find all links to `/` that refer to the library and update them to `/library`.

```bash
rg "href=\"/\"|to=\"/\"|/\"\s*\)" src
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run build`
Expected: PASS (search step ensures correctness, not build failure).

- [ ] **Step 3: Write minimal implementation**

Update relevant links to point at `/library`.

```tsx
<Link href="/library">Könyvtár</Link>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "chore: point library links to /library"
```

## Self-Review
- Spec coverage: All required route changes, landing UI, and card navigation covered in Tasks 1-3.
- Placeholder scan: No TODO/TBD.
- Type consistency: Uses existing imports and component signatures.

