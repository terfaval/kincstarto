# Library Toolbar Inline SVG Design Spec

Date: 2026-04-12
Topic: Inline toolbar SVGs to support currentColor

## Summary
Replace the two library toolbar icons (Meditációs tér, Yogi's choice) with inline SVG markup using `currentColor`. This allows the icons to match the toolbar muted color in night mode without filters. Leave all other toolbar buttons unchanged.

## Goals
- Toolbar SVGs inherit `color` (muted) like other toolbar icons.
- No change to other toolbar buttons.
- No layout changes.

## Non-Goals
- No new assets.
- No changes to landing icons.

## Implementation Notes
- Update `src/components/spirit/SpiritLibraryApp.tsx`.
- Replace `next/image` SVG usage with inline `<svg>` elements.
- Set `stroke="currentColor"` / `fill="currentColor"` based on the SVG paths.

## Testing
- Manual check:
  - Toolbar icons look the same as before in day mode.
  - In night mode, toolbar icons match other muted toolbar icons.
