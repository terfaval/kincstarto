# Landing Page Design Spec

Date: 2026-04-12
Topic: Public landing page for Kincstarto

## Summary
Replace the public root page with a simple landing page that shows a large logo and name, a centered 3-4 sentence description, and three clickable cards. The existing library view moves to `/library`. The landing cards navigate to the existing public sections.

## Goals
- Make `/` a clean landing page with only logo + text + three cards.
- Keep existing internal navigation and behavior within each section unchanged.
- Ensure the main entry to the library is still accessible via `/library`.

## Non-Goals
- No new admin changes.
- No new content management or CMS.
- No new custom icons yet.

## Routes
- `/` => Landing page
- `/library` => Existing Spirit Library (currently `/`)
- `/meditations` => Existing page
- `/yogis-choice` => Existing page

## Content
- Logo: `public/favicon.svg` scaled large.
- Title: `Kincstarto` next to the logo.
- Description (centered):
  "Konyvek, meditaciok es mozgas egy helyen — egy szemelyes gyujtemeny, amit nem hasznalatra terveztem, hanem hogy vissza lehessen terni hozza, amikor szukseg van ra."
- Cards:
  - Konyvtar -> `/library`
  - Uveggyongyok -> `/meditations`
  - Joga -> `/yogis-choice`
- Icons: Lucide icons, large and consistent in style.

## Layout
- Simple vertical stack.
- Top row: logo + title aligned on a single row.
- Centered description under the header block.
- Three cards in a row on desktop, stacking on mobile.
- No global header or extra sections on the landing page.

## Interactions
- Cards are fully clickable and navigate to their routes.
- Hover state on cards (subtle elevation or border change).

## Styling Notes
- Use existing global font setup.
- Keep spacing generous; landing should feel airy and focused.
- Ensure good contrast and readability.

## Error Handling
- Not applicable beyond standard Next.js routing.

## Testing
- Manual check:
  - `/` renders landing only.
  - Cards navigate correctly.
  - `/library` shows the previous library view.
  - `/meditations` and `/yogis-choice` remain unchanged.
  - Responsive layout behaves on mobile.
